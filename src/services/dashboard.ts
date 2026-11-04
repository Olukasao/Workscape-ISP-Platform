import { useEffect } from "react";
import { io } from "socket.io-client";
import { create } from "zustand";
import { useSession, useServers } from "../stores/workspace";
import { socketEndpoint } from "./live";
import type { DashboardDiagnostics } from "../../electron/dashboardFeed";
import { dashboardOrigin } from "../../electron/agendaDeployment";
import { api, errorMessage } from "./api";
import {
  parseDashboardUpdate,
  parseCustomerCounts,
  dashboardTimestamp,
  type DashboardSnapshot,
  type CustomerCounts,
} from "./dashboardModel";

const readCompact = () => {
  // O primeiro layout do Painel NOC é a visão resumida; só quem escolheu a completa continua nela.
  try { return localStorage.getItem("workspace:dashboard:compact") !== "0"; } catch { return true; }
};
// O servidor só envia a base de clientes a cada 3 minutos (não ao conectar). Guardamos a última
// recebida, como o painel antigo, para a tela não abrir com a base vazia.
const CLIENTES_CACHE = "workspace:noc-clientes";
const lerClientesGuardados = (origin: string, userId: string | number) => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLIENTES_CACHE) || "null");
    if (guardado?.origin !== origin || guardado?.userId !== userId) return null;
    const data = parseCustomerCounts(guardado?.data);
    if (data && Number.isFinite(guardado?.ts) && guardado.ts <= Date.now() && Date.now() - guardado.ts < 24 * 3600_000)
      return { data, updated: dashboardTimestamp(guardado.data?.atualizado) ?? new Date(guardado.ts).toISOString() };
  } catch { /* Cache inexistente ou inválido. */ }
  return null;
};
// Última atualização recebida: com a conexão fora do ar a tela mostra os números de antes (marcados como
// desatualizados) em vez de ficar vazia.
const ULTIMO_CACHE = "workspace:noc-ultimo";
const lerUltimoGuardado = (origin: string, userId: string | number) => {
  try {
    const guardado = JSON.parse(localStorage.getItem(ULTIMO_CACHE) || "null");
    if (guardado?.origin !== origin || guardado?.userId !== userId) return null;
    const snapshot = parseDashboardUpdate(guardado?.payload);
    if (snapshot && Number.isFinite(guardado?.ts) && guardado.ts <= Date.now() && Date.now() - guardado.ts < 6 * 3600_000)
      return { ...snapshot, updated: dashboardTimestamp(guardado.payload?.atualizado) ?? new Date(guardado.ts).toISOString() };
  } catch { /* Cache inexistente ou inválido. */ }
  return null;
};
let socketAtivo: ReturnType<typeof io> | null = null;
let refreshRelay: (() => Promise<void>) | null = null;
/** Tenta conectar de novo agora (botão "Tentar novamente"). */
export function reconectarDashboard() {
  useDashboard.setState({ status: "Conectando…", detail: "" });
  if (refreshRelay) void refreshRelay();
  else if (window.desktop?.dashboardRefresh) void window.desktop.dashboardRefresh();
  else socketAtivo?.disconnect().connect();
}
const empty = {
  snapshot: null,
  diagnostics: null,
  detail: "",
  customers: null,
  connected: false,
  status: "Não configurado",
  customersUpdated: null,
  filter: "",
  compact: readCompact(),
};
export const useDashboard = create<{
  snapshot: DashboardSnapshot | null;
  diagnostics: DashboardDiagnostics | null;
  /** Motivo técnico da última falha de conexão, para diagnóstico. */
  detail: string;
  customers: CustomerCounts | null;
  customersUpdated: string | null;
  connected: boolean;
  status: string;
  filter: string;
  compact: boolean;
}>(() => empty);

// Mounted once in Shell. Home and Dashboard read the same connection and cache.
// No aplicativo desktop quem conversa com o servidor é o processo principal (window.desktop.dashboard*);
// a conexão direta pela página fica só para a visualização web e os testes.
export function useDashboardConnection() {
  const origin = useServers((s) => s.config.dashboard);
  const userId = useSession((s) => s.user?.id);
  const chatOrigin = useServers((s) => s.config.chat);
  useEffect(() => {
    useDashboard.setState({
      ...empty,
      status: origin ? "Conectando…" : "Não configurado",
    });
    if (!origin || !userId) return;
    const guardados = lerClientesGuardados(origin, userId);
    if (guardados) useDashboard.setState({ customers: guardados.data, customersUpdated: guardados.updated });
    const ultimo = lerUltimoGuardado(origin, userId);
    if (ultimo) useDashboard.setState({ snapshot: ultimo });
    const aoAtualizar = (payload: unknown) => {
      const snapshot = parseDashboardUpdate(payload);
      if (snapshot) {
        useDashboard.setState({ snapshot });
        try { localStorage.setItem(ULTIMO_CACHE, JSON.stringify({ origin, userId, payload, ts: Date.now() })); } catch { /* Sem armazenamento. */ }
      }
    };
    const aoReceberClientes = (payload: unknown) => {
      const customers = parseCustomerCounts(payload);
      if (customers) {
        useDashboard.setState({
          customers,
          customersUpdated: dashboardTimestamp((payload as Record<string, unknown>).atualizado) ?? new Date().toISOString(),
        });
        try { localStorage.setItem(CLIENTES_CACHE, JSON.stringify({ origin, userId, data: payload, ts: Date.now() })); } catch { /* Sem armazenamento. */ }
      }
    };
    // O desktop corporativo recebe o snapshot pelo serviço já autenticado do chat.
    // Só o servidor acessa a porta 5000; não há WebSocket direto no computador do usuário.
    if (window.desktop && origin === dashboardOrigin) {
      let cancelled = false;
      let inFlight = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const request = async () => {
        if (cancelled || inFlight) return;
        clearTimeout(timer);
        inFlight = true;
        try {
          const { data } = await api.get("/integrations/dashboard");
          if (cancelled) return;
          if (data.update) aoAtualizar(data.update);
          if (data.customers) aoReceberClientes(data.customers);
          useDashboard.setState({
            connected: !!data.connected,
            status: data.connected ? "Conectado via Chat Interno" : "Aguardando o servidor do dashboard",
            detail: String(data.error || ""),
            diagnostics: {
              origin: chatOrigin, sourceOrigin: origin, connected: !!data.connected,
              transport: "HTTP autenticado · Chromium", lastUpdateAt: data.updateReceivedAt || null,
              lastCustomersAt: data.customersReceivedAt || null, lastError: data.error || null, attempts: 0,
            },
          });
        } catch (error) {
          if (!cancelled) useDashboard.setState({
            connected: false, status: "Não foi possível consultar o dashboard pelo Chat Interno",
            detail: errorMessage(error),
            diagnostics: { origin: chatOrigin, sourceOrigin: origin, connected: false, transport: "HTTP autenticado · Chromium", lastUpdateAt: null, lastCustomersAt: null, lastError: errorMessage(error), attempts: 0 },
          });
        } finally {
          inFlight = false;
          if (!cancelled) timer = setTimeout(() => void request(), 5000);
        }
      };
      refreshRelay = request;
      void request();
      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (refreshRelay === request) refreshRelay = null;
        useDashboard.setState(empty);
      };
    }
    if (window.desktop?.dashboardStart) {
      const desktop = window.desktop;
      const parar = desktop.onDashboardEvent((canal, payload) => {
        if (canal === "dashboard:update") aoAtualizar(payload);
        else if (canal === "dashboard:clientes") aoReceberClientes(payload);
        else if (canal === "dashboard:diagnostics") useDashboard.setState({ diagnostics: payload as DashboardDiagnostics });
        else if (canal === "dashboard:status" && payload && typeof payload === "object") {
          const p = payload as { connected?: boolean; status?: string; detail?: string };
          useDashboard.setState({ connected: !!p.connected, status: String(p.status || ""), detail: String(p.detail || "") });
        }
      });
      void desktop.dashboardStart().catch((error: unknown) => {
        useDashboard.setState({ connected: false, status: "Não foi possível conectar ao Dashboard", detail: error instanceof Error ? error.message : String(error) });
      });
      return () => {
        parar();
        void desktop.dashboardStop();
        useDashboard.setState(empty);
      };
    }
    // Como no painel antigo: polling primeiro; um upgrade bloqueado não impede a carga inicial.
    const endpoint = socketEndpoint("dashboard", origin);
    const socket = io(endpoint.url, {
      path: endpoint.path,
      autoConnect: false,
      transports: ["polling", "websocket"],
      tryAllTransports: true,
      reconnection: true,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
    socketAtivo = socket;
    // Se o WebSocket falhar de qualquer forma (inclusive aceitar e derrubar), as próximas tentativas usam
    // long-polling primeiro, exatamente como o painel antigo faz no navegador.
    let alternativo = false;
    // O servidor legado envia update ao conectar e clientes no ciclo de 3 minutos.
    // Ele não implementa request_update; não enviamos pedidos sem resposta.
    socket.on("connect", () => {
      useDashboard.setState({ connected: true, status: "Conectado", detail: "" });
    });
    socket.on("disconnect", () =>
      useDashboard.setState({ connected: false, status: "Reconectando…" }),
    );
    socket.on("connect_error", (error: Error & { description?: unknown }) => {
      if (!alternativo) {
        alternativo = true;
        socket.io.opts.transports = ["polling", "websocket"];
      }
      useDashboard.setState({
        connected: false,
        status: "Não foi possível conectar ao Dashboard",
        detail: [error.message, typeof error.description === "string" || typeof error.description === "number" ? String(error.description) : ""]
          .filter(Boolean).join(" · "),
      });
    });
    socket.on("update", aoAtualizar);
    socket.on("clientes", aoReceberClientes);
    const online = () => {
      socket.connect();
    };
    window.addEventListener("online", online);
    socket.connect();
    return () => {
      window.removeEventListener("online", online);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketAtivo === socket) socketAtivo = null;
      useDashboard.setState(empty);
    };
  }, [origin, userId, chatOrigin]);
}
