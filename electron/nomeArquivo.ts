import path from "node:path";

const POR_TIPO: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/bmp": ".bmp", "image/svg+xml": ".svg",
  "application/pdf": ".pdf", "text/plain": ".txt", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/webm": ".webm", "audio/mp4": ".m4a", "audio/wav": ".wav",
  "video/mp4": ".mp4", "video/webm": ".webm", "application/zip": ".zip",
  "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

/** Extensão a partir do Content-Type ("image/png; charset=x" -> ".png"); vazio quando não conhecemos. */
export const extensaoDoTipo = (contentType: string | null | undefined) =>
  POR_TIPO[String(contentType || "").split(";")[0].trim().toLowerCase()] || "";

/**
 * Nome sugerido ao salvar: sem caracteres inválidos no Windows e sempre com extensão. A extensão vem do próprio nome,
 * depois do endereço do arquivo e, por último, do tipo que o servidor informou.
 */
export function nomeParaSalvar(nome: string, caminho: string, contentType?: string | null) {
  const base = path.basename(String(nome || "")).replace(/[\\/:*?"<>|]+/g, "_").trim();
  // ".png" sozinho (nome vazio com extensão) o Node trata como arquivo oculto: aqui é só a extensão.
  const soExtensao = /^\.[A-Za-z0-9]{1,5}$/.test(base);
  const extNome = soExtensao ? base : path.extname(base);
  const extFinal = extNome || path.extname(caminho).toLowerCase() || extensaoDoTipo(contentType);
  const semExt = (extNome ? base.slice(0, -extNome.length) : base).trim();
  return `${semExt || "arquivo"}${extFinal}`;
}
