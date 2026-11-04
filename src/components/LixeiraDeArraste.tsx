import { Trash2 } from "lucide-react";

const RAIO = 70;
const BORDA = 16;

/** Centro da lixeira: canto direito da tela, no meio da altura. */
const centro = () => ({ x: window.innerWidth - BORDA - 32, y: window.innerHeight / 2 });

/** O ponteiro está em cima da lixeira? (área um pouco maior que o desenho, para facilitar soltar.) */
export function sobreLixeira(x: number, y: number) {
  const c = centro();
  return Math.hypot(x - c.x, y - c.y) <= RAIO;
}

/** Lixeira que aparece no canto direito enquanto uma janela flutuante é arrastada. */
export default function LixeiraDeArraste({ visivel, ativa, texto = "Solte aqui para tirar da tela" }: { visivel: boolean; ativa: boolean; texto?: string }) {
  if (!visivel) return null;
  return (
    <div className={`arraste-lixeira${ativa ? " ativa" : ""}`} aria-hidden="true">
      <span className="arraste-lixeira-icone"><Trash2 size={ativa ? 28 : 24} /></span>
      {ativa ? <small>{texto}</small> : null}
    </div>
  );
}
