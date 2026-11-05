import { useFundoUsuario } from "../services/fundoUsuario";

/** Imagem de fundo da área principal, escolhida por usuário. Fica atrás de todo o conteúdo. */
export default function FundoUsuario({ userId }: { userId: number | undefined }) {
  const fundo = useFundoUsuario(userId);
  if (!fundo) return null;
  const imagem = `url(${JSON.stringify(fundo.url)})`;
  return (
    <div className="fundo-usuario" aria-hidden="true">
      {fundo.ajuste === "inteira" ? <div className="fundo-usuario-borrado" style={{ backgroundImage: imagem }} /> : null}
      <div className={`fundo-usuario-imagem ${fundo.ajuste}`} style={{ backgroundImage: imagem }} />
    </div>
  );
}
