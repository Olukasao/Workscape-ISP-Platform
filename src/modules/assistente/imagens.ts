// Imagens que a pessoa anexa ao Assistente (print de erro, tela do SGP, foto de equipamento). O app reduz o tamanho antes de enviar:
// uma captura de tela inteira passa de 1 MB, e o texto continua legível em 1600 px.

export interface ImagemAnexa {
  id: string;
  tipo: string;
  /** Base64 sem o prefixo "data:...". */
  dados: string;
  /** Miniatura em data URL, para mostrar na conversa e guardar no histórico. */
  miniatura: string;
  nome: string;
}

export const MAX_IMAGENS = 3;
export const LADO_MAXIMO = 1600;
export const LADO_MINIATURA = 160;
export const TAMANHO_MAXIMO_ORIGINAL = 15 * 1024 * 1024;
const TIPOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export const tipoAceito = (tipo: string) => TIPOS.has(String(tipo).toLowerCase());

/** Tamanho final mantendo a proporção; nunca amplia. */
export function reduzir(largura: number, altura: number, maximo = LADO_MAXIMO): { w: number; h: number } {
  if (!(largura > 0) || !(altura > 0)) return { w: 1, h: 1 };
  const fator = Math.min(1, maximo / Math.max(largura, altura));
  return { w: Math.max(1, Math.round(largura * fator)), h: Math.max(1, Math.round(altura * fator)) };
}

const semPrefixo = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);
/** O tamanho em bytes que um base64 representa. */
export const bytesDoBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

function desenhar(bitmap: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  // Fundo branco: PNG transparente vira JPEG sem ficar preto.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

export async function prepararImagem(arquivo: File): Promise<ImagemAnexa> {
  if (!tipoAceito(arquivo.type)) throw new Error("Só imagens PNG, JPG, WEBP ou GIF.");
  if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) throw new Error("Imagem grande demais (máximo de 15 MB).");
  const bitmap = await createImageBitmap(arquivo);
  try {
    const { w, h } = reduzir(bitmap.width, bitmap.height);
    const canvas = desenhar(bitmap, w, h);
    // Print de tela fica melhor em PNG; se passar de 1,5 MB, JPEG de boa qualidade.
    let dataUrl = canvas.toDataURL("image/png");
    let tipo = "image/png";
    if (bytesDoBase64(semPrefixo(dataUrl)) > 1_500_000) { dataUrl = canvas.toDataURL("image/jpeg", 0.85); tipo = "image/jpeg"; }
    const pequeno = reduzir(bitmap.width, bitmap.height, LADO_MINIATURA);
    const miniatura = desenhar(bitmap, pequeno.w, pequeno.h).toDataURL("image/jpeg", 0.6);
    return { id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, tipo, dados: semPrefixo(dataUrl), miniatura, nome: String(arquivo.name || "imagem").slice(0, 80) };
  } finally {
    bitmap.close?.();
  }
}

/** Arquivos de imagem de um evento de colar ou soltar. */
export function imagensDe(itens: ArrayLike<{ kind?: string; type: string; getAsFile?: () => File | null }> | null | undefined): File[] {
  return Array.from(itens ?? [])
    .filter((i) => (i.kind === undefined || i.kind === "file") && tipoAceito(i.type))
    .map((i) => i.getAsFile?.() ?? null)
    .filter((f): f is File => !!f);
}
