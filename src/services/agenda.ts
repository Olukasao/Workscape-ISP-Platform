import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clients, errorMessage } from "./api";
import { io } from "socket.io-client";
import { useSession, useServers, useNotices } from "../stores/workspace";
import { socketEndpoint } from "./live";
export interface WorkOrder {
  id?: string | number;
  idOrdemServico?: string | number;
  idCliente?: string | number;
  tecnico: string;
  cliente: string;
  hora?: string;
  status?: string;
  motivo?: string;
  enderecoCompleto?: string;
  bairro?: string;
  latitude?: number;
  longitude?: number;
  responsavelStatus?: string;
  tecnicoResponsavelSgpId?: string;
  turnoHorario?: string;
  horarioEfetivo?: { startTime: string; endTime: string };
  [key: string]: unknown;
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function normalizeAgenda(
  payload: unknown,
  date: string,
): WorkOrder[] | null {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray(payload.items)
  ) {
    if ("date" in payload && payload.date !== date) return null;
    return payload.items;
  }
  return null;
}
export function useAgendaFeed(
  service: "agenda",
  dates: string[],
  active = true,
) {
  const origin = useServers((s) => s.config[service]);
  const user = useSession((s) => s.user),
    token = useSession((s) => s.token);
  const key = dates.join(",");
  const [feeds, setFeeds] = useState<
    Record<
      string,
      {
        items: WorkOrder[] | null;
        error: string;
        connected: boolean;
        updated?: string;
      }
    >
  >({});
  useEffect(() => {
    if (!active || !origin || !user) return;
    let cancelled = false;
    const sockets = key.split(",").map((date) => {
      const endpoint = socketEndpoint(service, origin);
      const s = io(endpoint.url, {
        path: endpoint.path,
        auth: { token },
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      const update = (partial: Partial<(typeof feeds)[string]>) => {
        if (!cancelled)
          setFeeds((old) => ({
            ...old,
            [date]: {
              ...(old[date] || { items: null, error: "", connected: false }),
              ...partial,
            },
          }));
      };
      const ask = () => {
        if (s.connected) s.emit("filtrarData", date);
      };
      s.on("connect", () => {
        update({ connected: true, error: "" });
        ask();
      });
      s.on("disconnect", () =>
        update({ connected: false, error: "Reconectando ao servidor…" }),
      );
      s.on("connect_error", () =>
        update({
          connected: false,
          error: `Não foi possível conectar à agenda em ${origin}. Verifique o acesso deste computador à rede interna da empresa.`,
        }),
      );
      const receive = (payload: unknown) => {
        const items = normalizeAgenda(payload, date);
        if (items)
          update({ items, error: "", updated: new Date().toISOString() });
      };
      s.on("agenda", receive)
        .on("agendaAtualizada", receive)
        .on("agendaSemAlteracao", () =>
          update({ error: "", updated: new Date().toISOString() }),
        );
      s.on("agendaErro", () =>
        update({
          error: "O servidor não conseguiu atualizar os dados do SGP.",
        }),
      );
      s.on(
        "agendaOsTecnicoAlterado",
        (event: {
          osId?: string;
          data?: string;
          tecnico?: string;
          updatedAt?: string;
        }) => {
          ask();
          if (
            !/^\d+$/.test(String(event.osId)) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(event.data || "")
          )
            return;
          const target = `/agenda?os=${event.osId}&data=${event.data}`;
          useNotices.getState().add({
            id: `${service}:os:${event.osId}:${event.updatedAt || ""}`,
            title: `OS ${event.osId} atualizada`,
            body: `Técnico responsável: ${event.tecnico || "consulte a agenda"}`,
            target,
            time: event.updatedAt || new Date().toISOString(),
          });
        },
      );
      const timeout = setTimeout(
        () =>
          update({
            error: "Aguardando resposta da agenda. A conexão será mantida.",
          }),
        30000,
      );
      s.on("agenda", () => clearTimeout(timeout));
      s.on("agendaAtualizada", () => clearTimeout(timeout));
      const interval = setInterval(ask, 60000);
      const online = () => {
        s.connect();
        ask();
      };
      window.addEventListener("online", online);
      s.connect();
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener("online", online);
        s.disconnect();
      };
    });
    return () => {
      cancelled = true;
      sockets.forEach((stop) => stop());
    };
  }, [origin, user, token, key, active]);
  const items = useMemo(
    () =>
      key
        .split(",")
        .flatMap((date) =>
          (feeds[date]?.items || []).map((item) => ({ ...item, date })),
        ),
    [feeds, key],
  );
  return {
    feeds,
    configured: !!origin,
    items,
    loaded: dates.every(
      (date) => feeds[date]?.items !== null && feeds[date]?.items !== undefined,
    ),
  };
}

export interface InstallationTechnician {
  id: string;
  nome: string;
}

/** Instalação usa o cadastro e os horários próprios no mesmo servidor da manutenção. */
export function useInstallationFeed(
  dates: string[],
  active: boolean,
  preload = false,
) {
  const origin = useServers((s) => s.config.agenda);
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();
  const key = dates.join(",");
  const query = useQuery({
    queryKey: ["agenda", "instalacao", "feed", key],
    enabled: (active || preload) && !!origin && !!user,
    queryFn: () => Promise.all(dates.map(async (date) => {
      const { data } = await clients.agenda.get("/agenda-instalacao/agenda", { params: { data: date } });
      if (data.data !== date || !Array.isArray(data.items) || !Array.isArray(data.tecnicos))
        throw new Error("Resposta inválida da agenda de instalação.");
      return { date, items: data.items as WorkOrder[], technicians: data.tecnicos as InstallationTechnician[] };
    })),
    staleTime: 30000,
    refetchInterval: active ? 60000 : false,
  });
  useEffect(() => {
    if (!active || !origin || !user) return;
    const socket = io(origin, { auth: { token }, transports: ["websocket"] });
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda", "instalacao"] });
    };
    socket.on("agendaOsTecnicoAlterado", refresh);
    socket.on("agendaInstalacao:ausencias", refresh);
    socket.on("agendaInstalacao:almocos", refresh);
    return () => { socket.disconnect(); };
  }, [active, origin, user, token, queryClient]);
  const error = query.error ? errorMessage(query.error) : "";
  const feeds = Object.fromEntries(dates.map((date) => {
    const day = query.data?.find((d) => d.date === date);
    return [date, { items: day?.items ?? null, error, connected: !!day && !error }];
  }));
  const items = useMemo(() => (query.data || []).flatMap((d) =>
    d.items.map((item) => ({ ...item, date: d.date }))), [query.data]);
  return {
    feeds,
    configured: !!origin,
    loaded: !!query.data,
    items,
    technicians: query.data?.[0]?.technicians || [],
  };
}
