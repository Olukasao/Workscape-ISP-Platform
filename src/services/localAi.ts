// Ponte para a IA local (electron/localAi.ts). Só existe no app desktop; na
// versão web (window.desktop ausente) os recursos ficam escondidos.
export type LocalAiTask = "resumo-chamado" | "chat-resumir" | "chat-reescrever" | "chat-sugerir" | "resumo-dia" | "corrigir-texto" | "explicar-erro";
export type LocalAiStatus =
  | { phase: "unsupported"; message: string }
  | { phase: "idle"; model: string }
  | { phase: "downloading"; model: string; percent: number; receivedMB: number; totalMB: number }
  | { phase: "starting"; model: string }
  | { phase: "ready"; model: string }
  | { phase: "error"; message: string };

export const localAiDisponivel = () => typeof window !== "undefined" && !!window.desktop?.localAiComplete;

export async function localAiStatus(): Promise<LocalAiStatus> {
  if (!window.desktop?.localAiStatus) return { phase: "unsupported", message: "Disponível só no aplicativo Windows." };
  return window.desktop.localAiStatus();
}

export function onLocalAiStatus(callback: (status: LocalAiStatus) => void) {
  if (!window.desktop?.onLocalAiStatus) return () => {};
  return window.desktop.onLocalAiStatus(callback);
}

/** Texto curto para mostrar enquanto a IA local prepara (baixa o modelo, sobe o servidor). */
export function descreverStatusLocalAi(status: LocalAiStatus): string {
  switch (status.phase) {
    case "downloading":
      return `Baixando o modelo (${status.model})... ${status.percent}% — ${status.receivedMB} de ${status.totalMB} MB`;
    case "starting":
      return `Iniciando a IA local (${status.model})...`;
    case "ready":
      return "";
    default:
      return "Preparando a IA local...";
  }
}

/** Pode levar alguns minutos na primeira vez (baixa o modelo); as vezes seguintes são rápidas. */
export async function localAiCompletar(task: LocalAiTask, texto: string): Promise<string> {
  if (!window.desktop?.localAiComplete) throw new Error("A IA local só está disponível no aplicativo Windows.");
  const limpo = texto.trim();
  if (!limpo) throw new Error("Nada para processar.");
  return window.desktop.localAiComplete({ task, texto: limpo });
}

export interface MensagemAssistente {
  role: "user" | "assistant";
  content: string;
}
/** Conversa livre com a IA local; envia o histórico recente e devolve a resposta. */
export async function localAiConversar(mensagens: MensagemAssistente[]): Promise<string> {
  if (!window.desktop?.localAiChat) throw new Error("A IA local só está disponível no aplicativo Windows.");
  return window.desktop.localAiChat({ mensagens });
}

export type ModoAssistente = "local" | "internet";
