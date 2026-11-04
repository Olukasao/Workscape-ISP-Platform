import { useState, type ReactNode } from "react";

export interface DadosBase {
  setores: { id: number; nome: string }[]; usuarios: { id: number; nome: string; setor_id: number | null; setor: string | null }[];
  categorias: { id: number; nome: string; ordem: number }[]; linguagens: string[];
}

export function Confirmar({ titulo, texto, rotulo = "Confirmar", perigo = false, onOk, onCancelar }: { titulo: string; texto: ReactNode; rotulo?: string; perigo?: boolean; onOk: () => void; onCancelar: () => void }) {
  return (
    <div className="modal-fundo" role="alertdialog" aria-modal="true" aria-label={titulo} onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p>{texto}</p>
        <div className="modal-acoes">
          <button type="button" className="btn btn--outline" onClick={onCancelar}>Cancelar</button>
          <button type="button" className={perigo ? "btn btn--danger" : "btn btn--primary"} onClick={onOk}>{rotulo}</button>
        </div>
      </div>
    </div>
  );
}

/** Pede confirmação antes de uma ação destrutiva. */
export function useConfirmar() {
  const [estado, setEstado] = useState<null | { titulo: string; texto: ReactNode; rotulo?: string; acao: () => void }>(null);
  const pedir = (titulo: string, texto: ReactNode, acao: () => void, rotulo = "Excluir") => setEstado({ titulo, texto, acao, rotulo });
  const dialogo = estado ? <Confirmar titulo={estado.titulo} texto={estado.texto} rotulo={estado.rotulo} perigo onCancelar={() => setEstado(null)} onOk={() => { const a = estado.acao; setEstado(null); a(); }} /> : null;
  return { pedir, dialogo };
}

export const Campo = ({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) => (
  <label className="campo"><span>{rotulo}</span>{children}{dica && <small>{dica}</small>}</label>
);

export const novoId = () => Math.random().toString(36).slice(2, 10);
export const mover = <T,>(lista: T[], de: number, para: number) => {
  if (para < 0 || para >= lista.length || de === para) return lista;
  const n = [...lista]; const [x] = n.splice(de, 1); n.splice(para, 0, x); return n;
};
