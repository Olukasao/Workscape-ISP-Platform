import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useSession, useServers } from "../stores/workspace";
import { tokenAindaValido } from "./agendaWebSessao";
import { serviceEndpoint } from "./live";
import type { serviceNames } from "../../electron/policy";
type Service = (typeof serviceNames)[number];
export const clients = Object.fromEntries(
  ["chat", "agenda", "dashboard"].map((service) => {
    const client = axios.create({ timeout: 30000 });
    client.interceptors.request.use(async (config) => {
      const origin = useServers.getState().config[service as Service];
      if (!origin) throw new Error("Configure o servidor em Configurações.");
      config.baseURL = `${serviceEndpoint(service as Service, origin)}/api`;
      const token = useSession.getState().token;
      if (token) config.headers.set("Authorization", `Bearer ${token}`);
      // Escritas da agenda levam a sessão do Chat Interno, que identifica o usuário nos registros (como no app antigo).
      let agendaSession: string | undefined;
      if (service === "agenda" && (config.method || "get").toLowerCase() !== "get") {
        agendaSession = await agendaSessionToken();
        if (!window.desktop) config.headers.set("x-agenda-session", agendaSession);
      }
      if (window.desktop)
        config.adapter = async (c) =>
          desktopAdapter(c, service as Service, token, agendaSession);
      return config;
    });
    client.interceptors.response.use(
      (r) => r,
      (error) => {
        // 401 por "senha atual inválida" na troca de senha não é sessão expirada.
        if (
          error.response?.status === 401 &&
          service === "chat" &&
          error.response?.data?.error !== "Senha atual inválida"
        ) {
          // A tela de acesso avisa que a sessão expirou (só quando havia alguém conectado).
          if (useSession.getState().user)
            try { sessionStorage.setItem("workspace:sessao-expirou", "1"); } catch { /* Sem armazenamento. */ }
          useSession.getState().clear();
        }
        return Promise.reject(error);
      },
    );
    return [service, client];
  }),
) as Record<Service, ReturnType<typeof axios.create>>;
let agendaSessionCache: { chatToken: string; token: string; at: number } | null = null;
/** Sessão da agenda emitida pelo Chat Interno (válida por dias); renovada a cada 6 h ou ao trocar de usuário. */
export async function agendaSessionToken(): Promise<string> {
  const chatToken = useSession.getState().token;
  if (!chatToken) throw new Error("Entre com sua conta do Chat Interno para alterar a agenda.");
  const cached = agendaSessionCache;
  if (cached && cached.chatToken === chatToken && Date.now() - cached.at < 6 * 3600_000 && tokenAindaValido(cached.token)) return cached.token;
  const { data } = await clients.chat.post("/integrations/agenda/session");
  if (typeof data?.sessaoToken !== "string" || !data.sessaoToken)
    throw new Error("Não foi possível identificar seu usuário na agenda. Entre novamente no Chat Interno.");
  agendaSessionCache = { chatToken, token: data.sessaoToken, at: Date.now() };
  return data.sessaoToken;
}
async function desktopAdapter(
  c: InternalAxiosRequestConfig,
  service: Service,
  token: string | null,
  agendaSession?: string,
) {
  const query = new URLSearchParams();
  if (c.params)
    for (const [key, value] of Object.entries(c.params)) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
  const raw = c.url || "/";
  if (!raw.startsWith("/") || raw.startsWith("//"))
    throw new Error("Rota inválida.");
  const suffix = query.toString();
  const req: any = {
    service,
    path: `/api${raw}${suffix ? (raw.includes("?") ? "&" : "?") + suffix : ""}`,
    method: (c.method || "GET").toUpperCase(),
    token: token || undefined,
    ...(agendaSession ? { agendaSession } : {}),
  };
  if (c.data instanceof FormData) {
    req.files = [];
    for (const [name, value] of c.data.entries()) {
      if (value instanceof File)
        req.files.push({
          name,
          filename: value.name,
          type: value.type,
          bytes: new Uint8Array(await value.arrayBuffer()),
        });
      else req.files.push({ name, value: String(value) });
    }
  } else if (c.data !== undefined)
    req.body = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
  const result = await window.desktop!.request(req);
  const response = {
    ...result,
    statusText: String(result.status),
    headers: {},
    config: c,
  };
  if (result.status < 200 || result.status >= 300)
    throw new AxiosError(
      result.data?.error || result.data?.erro || "Falha na requisição.",
      undefined,
      c,
      undefined,
      response,
    );
  return response;
}
export const api = clients.chat;
export const errorMessage = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.erro || error.response?.data?.error || error.message
    : error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
