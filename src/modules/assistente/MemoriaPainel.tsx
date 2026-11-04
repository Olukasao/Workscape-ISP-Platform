import { useEffect, useState } from "react";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { useMemorias, type Memoria } from "../../services/assistenteNet";
import { useAssistente } from "./store";

function Linha({ m }: { m: Memoria }) {
  const { editar, apagar } = useMemorias();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(m.texto);
  const [erro, setErro] = useState("");
  if (editando)
    return (
      <li>
        <form
          className="memoria-edicao"
          onSubmit={(e) => {
            e.preventDefault();
            setErro("");
            editar.mutate({ id: m.id, texto }, { onSuccess: () => setEditando(false), onError: (x) => setErro(x.message) });
          }}
        >
          <input autoFocus value={texto} maxLength={300} aria-label="Editar memória" onChange={(e) => setTexto(e.target.value)} />
          <button type="submit" aria-label="Salvar"><Check size={14} /></button>
          <button type="button" aria-label="Cancelar" onClick={() => { setEditando(false); setTexto(m.texto); }}><X size={14} /></button>
        </form>
        {erro ? <p role="alert" className="form-error">{erro}</p> : null}
      </li>
    );
  return (
    <li className="memoria-item">
      <span>{m.texto}</span>
      <small>{m.origem === "pedido" ? "você pediu" : "aprendida"}</small>
      <button type="button" aria-label="Editar" title="Editar" onClick={() => setEditando(true)}><Pencil size={13} /></button>
      <button type="button" aria-label="Apagar" title="Apagar" onClick={() => apagar.mutate(m.id)}><Trash2 size={13} /></button>
    </li>
  );
}

/** Tela para ver, editar, adicionar e apagar o que o assistente lembra sobre a pessoa. */
export default function MemoriaPainel({ onClose }: { onClose: () => void }) {
  const { lista, adicionar, apagarTudo } = useMemorias();
  const { usarMemoria, setUsarMemoria } = useAssistente();
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const itens = lista.data?.memorias ?? [];
  return (
    <div className="memoria-fundo" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="memoria-janela" role="dialog" aria-modal="true" aria-label="Memória da Inteligência Artificial">
        <header>
          <Brain size={18} aria-hidden="true" />
          <strong>Memória da Inteligência Artificial</strong>
          <span className="espaco" />
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        </header>
        <p className="muted">O que o Assistente lembra sobre você, em qualquer computador. Fica guardado no servidor da empresa e só você vê. Ele usa isso para responder melhor, e o texto vai junto com suas perguntas aos serviços de IA.</p>
        <label className="settings-check">
          <input type="checkbox" checked={usarMemoria} onChange={(e) => setUsarMemoria(e.target.checked)} />
          <span>Usar e aprender memórias</span>
        </label>
        <form
          className="memoria-edicao"
          onSubmit={(e) => {
            e.preventDefault();
            setErro("");
            adicionar.mutate(novo, { onSuccess: () => setNovo(""), onError: (x) => setErro(x.message) });
          }}
        >
          <input value={novo} maxLength={300} placeholder="Adicionar: ex. Atendo o suporte N2 da região de Resende" aria-label="Nova memória" onChange={(e) => setNovo(e.target.value)} />
          <button type="submit" disabled={!novo.trim() || adicionar.isPending} aria-label="Adicionar"><Plus size={14} /></button>
        </form>
        {erro ? <p role="alert" className="form-error">{erro}</p> : null}
        {lista.isError ? (
          <p role="alert" className="form-error">Não foi possível carregar a memória agora.</p>
        ) : itens.length ? (
          <ul className={clsx("memoria-lista", lista.isFetching && "carregando")}>{itens.map((m) => <Linha key={m.id} m={m} />)}</ul>
        ) : (
          <p className="muted">{lista.isPending ? "Carregando…" : "Ainda não há nada guardado. Conte algo sobre você ao Assistente, como seu setor ou como prefere as respostas, ou adicione acima."}</p>
        )}
        {itens.length ? (
          <footer>
            <span className="muted">{itens.length} de {lista.data?.maximo ?? 60}</span>
            {confirmando ? (
              <span className="memoria-confirma">Apagar tudo? <button type="button" onClick={() => apagarTudo.mutate(undefined, { onSuccess: () => setConfirmando(false) })}>Sim</button> <button type="button" onClick={() => setConfirmando(false)}>Não</button></span>
            ) : (
              <button type="button" className="memoria-apagar-tudo" onClick={() => setConfirmando(true)}>Apagar tudo</button>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
