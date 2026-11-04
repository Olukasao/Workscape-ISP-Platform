import { io, type Socket } from "socket.io-client";

export interface DashboardStatus {
  connected: boolean;
  status: string;
  detail: string;
}
export interface DashboardDiagnostics {
  sourceOrigin?: string;
  origin: string;
  connected: boolean;
  transport: string | null;
  lastUpdateAt: string | null;
  lastCustomersAt: string | null;
  lastError: string | null;
  attempts: number;
}
type Send = (channel: "dashboard:update" | "dashboard:clientes" | "dashboard:status" | "dashboard:diagnostics", payload: unknown) => void;

/**
 * Conexão com o servidor do Painel NOC feita pelo processo principal (rede do Node, como o painel antigo),
 * sem as restrições da página (CSP, conteúdo misto, proxy do navegador). O renderizador só recebe os eventos.
 * A origem vem sempre da configuração validada; o renderizador não escolhe endereço.
 */
export function createDashboardFeed(getOrigin: () => string, send: Send) {
  let socket: Socket | null = null;
  let origin = "";
  let lastUpdate: unknown;
  let lastCustomers: unknown;
  let diagnostics: DashboardDiagnostics = emptyDiagnostics();
  function emptyDiagnostics(): DashboardDiagnostics {
    return { origin: "", connected: false, transport: null, lastUpdateAt: null, lastCustomersAt: null, lastError: null, attempts: 0 };
  }
  const report = () => send("dashboard:diagnostics", { ...diagnostics });
  const status = (value: DashboardStatus) => send("dashboard:status", value);

  function stop() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    origin = "";
    lastUpdate = undefined;
    lastCustomers = undefined;
    diagnostics = emptyDiagnostics();
  }
  function start() {
    const url = getOrigin();
    if (!url) {
      stop();
      status({ connected: false, status: "Não configurado", detail: "" });
      report();
      return;
    }
    if (socket && origin === url) {
      status({ connected: socket.connected, status: socket.connected ? "Conectado" : "Conectando…", detail: "" });
      // O legado não implementa request_update. Reentrega o que já recebemos,
      // preservando as datas da fonte quando a janela é remontada.
      if (lastUpdate !== undefined) send("dashboard:update", lastUpdate);
      if (lastCustomers !== undefined) send("dashboard:clientes", lastCustomers);
      report();
      return;
    }
    stop();
    origin = url;
    diagnostics.origin = url;
    report();
    status({ connected: false, status: "Conectando…", detail: "" });
    const s = io(url, {
      autoConnect: false,
      transports: ["polling", "websocket"],
      tryAllTransports: true,
      reconnection: true,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
    socket = s;
    s.on("connect", () => {
      diagnostics.connected = true;
      diagnostics.transport = s.io.engine.transport.name;
      diagnostics.lastError = null;
      s.io.engine.on("upgrade", () => {
        diagnostics.transport = s.io.engine.transport.name;
        report();
      });
      status({ connected: true, status: "Conectado", detail: "" });
      report();
    });
    s.on("disconnect", (reason) => {
      diagnostics.connected = false;
      diagnostics.lastError = reason;
      status({ connected: false, status: "Reconectando…", detail: reason });
      report();
    });
    s.io.on("reconnect_attempt", (attempt) => { diagnostics.attempts = attempt; report(); });
    s.on("connect_error", (error: Error & { description?: unknown }) => {
      s.io.opts.transports = ["polling", "websocket"];
      const description = error.description as { message?: string; code?: string; error?: { message?: string; code?: string } } | undefined;
      const detail = [error.message,
        typeof error.description === "string" || typeof error.description === "number" ? String(error.description)
          : [description?.message, description?.code, description?.error?.message, description?.error?.code].filter(Boolean).join(" · "),
      ].filter(Boolean).join(" · ");
      diagnostics.lastError = detail;
      diagnostics.connected = false;
      status({
        connected: false,
        status: "Não foi possível conectar ao Dashboard",
        detail,
      });
      report();
    });
    s.on("update", (payload: unknown) => {
      lastUpdate = payload;
      diagnostics.lastUpdateAt = new Date().toISOString();
      send("dashboard:update", payload);
      report();
    });
    s.on("clientes", (payload: unknown) => {
      lastCustomers = payload;
      diagnostics.lastCustomersAt = new Date().toISOString();
      send("dashboard:clientes", payload);
      report();
    });
    s.connect();
  }
  function refresh() {
    if (!socket) return start();
    status({ connected: false, status: "Conectando…", detail: "" });
    socket.disconnect().connect();
  }
  return { start, stop, refresh };
}
