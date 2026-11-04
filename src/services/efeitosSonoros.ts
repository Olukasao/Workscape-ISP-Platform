import { useServers } from "../stores/workspace";

// Efeitos sonoros remotos: quem tem permissão toca um som no computador de outra pessoa que está online.
// Quem recebe ouve o som onde quer que esteja no Workspace (antes só tocava com a tela do Chat carregada).
// Os arquivos de áudio ficam no servidor do Chat, em /sounds.

// Volume em porcentagem. Até 100% é o volume normal; de 101% a 200% o som é amplificado (com limitador).
// O servidor já limita o que cada pessoa pode pedir; este é o teto de segurança de quem recebe.
export const VOLUME_ABSOLUTO_PERCENT = 200;
const VOLUME_PADRAO_PERCENT = 60;
const CHAVES_CONHECIDAS: Record<string, string> = {
  faaaa: "/sounds/faaaa.wav",
  vine_boom: "/sounds/vine-boom.wav",
  metal_pipe: "/sounds/metal-pipe.wav",
  windows_error: "/sounds/windows-error.wav",
  bruh: "/sounds/bruh.wav",
  minecraft_cave: "/sounds/minecraft-cave.wav",
};
const CAMINHO_VALIDO = /^\/sounds\/(?:custom\/)?[a-zA-Z0-9._-]+\.(mp3|wav|ogg|opus|webm|m4a|mp4|aac|flac)$/i;

export interface EfeitoRemoto {
  sound?: string;
  sound_key?: string;
  soundKey?: string;
  /** Fração de 0 a 1 (apps antigos) ou, se maior que 1, porcentagem. */
  volume?: number | string;
  /** Porcentagem de 0 a 200 (campo novo). */
  volume_percent?: number | string;
  label?: string;
  requested_by?: string;
}

/** Caminho do som no servidor, ou "" se o pedido não for um som permitido (nunca toca endereço de fora). */
export function caminhoPermitido(payload: EfeitoRemoto = {}): string {
  const chave = String(payload.sound_key || payload.soundKey || "").trim().toLowerCase();
  if (CHAVES_CONHECIDAS[chave]) return CHAVES_CONHECIDAS[chave];
  const caminho = String(payload.sound || "").trim();
  return CAMINHO_VALIDO.test(caminho) ? caminho : "";
}

/** Endereço completo do áudio no servidor do Chat. Dentro do app, "/sounds/x.wav" sozinho apontaria para o próprio app. */
export function urlDoSom(caminho: string, origem = useServers.getState().config.chat): string {
  if (!CAMINHO_VALIDO.test(caminho)) return "";
  try {
    return new URL(caminho, origem).href;
  } catch {
    return "";
  }
}

/** Volume do pedido em porcentagem, de 0 a 200. Aceita o campo novo (volume_percent) ou o antigo (volume). */
export function percentDoEfeito(payload: Pick<EfeitoRemoto, "volume" | "volume_percent"> = {}): number {
  const novo = payload.volume_percent;
  if (novo !== undefined && novo !== null && novo !== "" && Number.isFinite(Number(novo))) {
    return Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Math.round(Number(novo))));
  }
  const antigo = payload.volume;
  const n = Number(antigo);
  if (antigo === undefined || antigo === null || antigo === "" || !Number.isFinite(n)) return VOLUME_PADRAO_PERCENT;
  return Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Math.round(n > 1 ? n : n * 100)));
}

let atual: HTMLAudioElement | null = null;
let contexto: AudioContext | null = null;

/** Liga o áudio a um amplificador seguido de um limitador (sem ele, o som estoura). Devolve false se o navegador não deixar. */
function amplificar(audio: HTMLAudioElement, ganho: number): boolean {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    contexto ??= new Ctx();
    void contexto.resume?.();
    const fonte = contexto.createMediaElementSource(audio);
    const amplificador = contexto.createGain();
    amplificador.gain.value = ganho;
    // Limitador: segura os picos para o som ficar alto sem distorcer nem machucar o alto-falante.
    const limitador = contexto.createDynamicsCompressor();
    limitador.threshold.value = -3;
    limitador.knee.value = 0;
    limitador.ratio.value = 20;
    limitador.attack.value = 0.003;
    limitador.release.value = 0.12;
    fonte.connect(amplificador).connect(limitador).connect(contexto.destination);
    return true;
  } catch {
    return false;
  }
}

/** Toca um áudio do servidor no volume pedido (0–200%). Acima de 100% amplifica; se não der, toca no máximo normal. */
export async function tocarSomNoVolume(url: string, percent: number): Promise<boolean> {
  if (!url || typeof window === "undefined" || typeof window.Audio !== "function") return false;
  const pct = Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, percent));
  // Um efeito novo corta o anterior, para não empilhar sons.
  atual?.pause();
  if (pct > 100) {
    try {
      // Para amplificar o áudio de outro endereço o navegador exige permissão de leitura (CORS), que o servidor dá em /sounds.
      const audio = new window.Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      audio.volume = 1;
      if (amplificar(audio, pct / 100)) {
        atual = audio;
        await audio.play();
        return true;
      }
    } catch {
      /* cai para o volume normal abaixo */
    }
  }
  try {
    const audio = new window.Audio(url);
    audio.volume = Math.min(1, pct / 100);
    atual = audio;
    await audio.play();
    return true;
  } catch (erro) {
    console.warn("[efeitos-sonoros] não foi possível tocar:", erro instanceof Error ? erro.message : erro);
    return false;
  }
}

/** Toca o efeito recebido. Devolve false se o pedido foi recusado ou o áudio não pôde tocar. */
export async function tocarEfeitoRemoto(payload: EfeitoRemoto): Promise<boolean> {
  const url = urlDoSom(caminhoPermitido(payload));
  if (!url) return false;
  return tocarSomNoVolume(url, percentDoEfeito(payload));
}
