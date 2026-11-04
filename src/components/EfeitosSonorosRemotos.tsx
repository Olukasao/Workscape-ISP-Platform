import { useEffect } from "react";
import { socket } from "../services/socket";
import { tocarEfeitoRemoto, type EfeitoRemoto } from "../services/efeitosSonoros";
import { useSession } from "../stores/workspace";

/** Ouve os efeitos sonoros enviados por outras pessoas e toca em qualquer tela do Workspace. Não desenha nada. */
export default function EfeitosSonorosRemotos() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token) return;
    const s = socket;
    const aoReceber = (dados: EfeitoRemoto = {}) => void tocarEfeitoRemoto(dados);
    s.on("play-prank-sound", aoReceber);
    return () => { s.off("play-prank-sound", aoReceber); };
  }, [token]);
  return null;
}
