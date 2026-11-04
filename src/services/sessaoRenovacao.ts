import { useEffect } from "react";
import { clients } from "./api";
import { configureSocketAuth } from "./socket";
import { useSession } from "../stores/workspace";

// Renovação silenciosa do login: antes de o token do Chat vencer, o app troca por um novo e a pessoa continua
// trabalhando. Sem isso o token (7 dias) vencia no meio do uso e a pessoa era deslogada, e a agenda passava a
// registrar ações sem o nome de quem as fez.
export const RENOVAR_QUANDO_FALTAR_MS = 3 * 86_400_000;
export const CONFERIR_A_CADA_MS = 30 * 60_000;

/** Fim da validade de um token JWT, em milissegundos (só lê; a conferência de verdade é do servidor). */
export function validadeDoToken(token: string | null | undefined): number | null {
  try {
    const corpo = String(token ?? "").split(".")[1];
    if (!corpo) return null;
    const json = JSON.parse(atob(corpo.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(corpo.length / 4) * 4, "=")));
    return Number.isFinite(json?.exp) ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Renova quando faltam menos de 3 dias e o token ainda não venceu (token vencido só se resolve entrando de novo). */
export function precisaRenovar(token: string | null | undefined, agora = Date.now()): boolean {
  const fim = validadeDoToken(token);
  return fim !== null && fim > agora && fim - agora < RENOVAR_QUANDO_FALTAR_MS;
}

let emAndamento: Promise<boolean> | null = null;

/** Pede um token novo ao servidor e passa a usá-lo em tudo (chamadas, socket e sessão guardada para a próxima abertura). */
export function renovarSessao(): Promise<boolean> {
  emAndamento ??= (async () => {
    try {
      const { token, user } = useSession.getState();
      if (!token || !user) return false;
      const { data } = await clients.chat.post<{ token: string }>("/auth/renovar");
      if (typeof data?.token !== "string" || !data.token) return false;
      useSession.getState().setSession(data.token, user);
      configureSocketAuth(data.token);
      if (window.desktop) await window.desktop.saveSession({ token: data.token });
      return true;
    } catch {
      // Falha de rede: tenta de novo na próxima conferência. Token recusado (401) já é tratado pelo app como sessão expirada.
      return false;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

/** Confere ao abrir, a cada 30 minutos, ao voltar a internet e ao voltar para a janela. */
export function useRenovarSessao() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token) return;
    const conferir = () => { if (precisaRenovar(useSession.getState().token)) void renovarSessao(); };
    const inicio = window.setTimeout(conferir, 5000);
    const timer = window.setInterval(conferir, CONFERIR_A_CADA_MS);
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    window.addEventListener("online", conferir);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(timer);
      window.removeEventListener("online", conferir);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [token]);
}
