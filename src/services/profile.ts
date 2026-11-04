import { clients } from "./api";
import { useSession, type User } from "../stores/workspace";

const LADO = 256;
const LIMITE_ARQUIVO = 10 * 1024 * 1024;

/** Recorta o centro da imagem em quadrado e reduz para 256 px, gerando uma foto leve (WebP). */
export async function prepararFoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  if (file.size > LIMITE_ARQUIVO) throw new Error("A imagem é grande demais. Escolha uma de até 10 MB.");
  const imagem = await createImageBitmap(file).catch(() => {
    throw new Error("Não foi possível ler esta imagem.");
  });
  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LADO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  imagem.close();
  return canvas.toDataURL("image/webp", 0.85);
}

/** Atualiza o perfil no Chat Interno e mantém o usuário da sessão em dia. */
export async function atualizarPerfil(body: { avatar?: string; email?: string; senha_atual?: string; nova_senha?: string }) {
  const { data } = await clients.chat.put("/profile", body);
  const { token, user } = useSession.getState();
  if (token && user) {
    const atualizado: User = { ...user, ...(data as Partial<User>) };
    // Sem foto o servidor devolve null (ou omite o campo): o valor antigo não pode sobreviver à mesclagem.
    if (body.avatar !== undefined) atualizado.avatar = (data as Partial<User>).avatar || undefined;
    useSession.getState().setSession(token, atualizado);
  }
  return data as User;
}
