import fundoEdnesio from "../../assets/ednesio.png";
import fundoPedro from "../../assets/pedro.png";
import { usePreferences } from "../stores/workspace";

/** inteira: mostra a imagem toda, com a própria imagem desfocada preenchendo as sobras; cobrir: preenche a tela cortando as bordas. */
export type AjusteFundo = "inteira" | "cobrir";
export interface FundoEscolhido {
  /** padrao = arte da conta (se houver); nenhum = sem imagem; proprio = imagem enviada pelo usuário. */
  tipo: "padrao" | "nenhum" | "proprio";
  ajuste: AjusteFundo;
  imagem?: string;
}
/** Arte padrão de algumas contas (id do Chat Interno). */
export const FUNDO_PADRAO_POR_USUARIO: Record<number, string> = { 11: fundoEdnesio, 36: fundoPedro };
export const ESCOLHA_INICIAL: FundoEscolhido = { tipo: "padrao", ajuste: "inteira" };

export function resolverFundo(userId: number | undefined, escolha?: FundoEscolhido) {
  if (userId === undefined) return null;
  const e = escolha ?? ESCOLHA_INICIAL;
  if (e.tipo === "nenhum") return null;
  const url = e.tipo === "proprio" ? e.imagem : FUNDO_PADRAO_POR_USUARIO[userId];
  return url ? { url, ajuste: e.ajuste } : null;
}

export function useFundoUsuario(userId: number | undefined) {
  const escolha = usePreferences((s) => (userId === undefined ? undefined : s.fundoPorUsuario[String(userId)]));
  return resolverFundo(userId, escolha);
}

/** Reduz a foto escolhida (máx. 1920 px, JPEG) para caber nas preferências do aplicativo. */
export async function prepararImagem(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("A imagem é grande demais (máximo 25 MB).");
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
