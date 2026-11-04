import { useEffect, useState } from "react";
import { Bot, Brain, Check, Sparkles, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Pencil, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { EmptyState } from "../components/ui/primitives";
import { useAssistenteInternet } from "../services/assistenteNet";
import { useSession } from "../stores/workspace";
import { useTour } from "../tour/tour";
import Intro from "./assistente/Intro";
import { passosTourIA, TOUR_IA } from "../tour/passosIA";
import { agruparPorData, useAssistente, type Conversa as ConversaT } from "./assistente/store";
import Conversa from "./assistente/Conversa";
import MemoriaPainel from "./assistente/MemoriaPainel";

function Item({ c, ativa, aoAbrir }: { c: ConversaT; ativa: boolean; aoAbrir: () => void }) {
  const { abrir, apagar, renomear } = useAssistente();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(c.titulo);
  const [confirmando, setConfirmando] = useState(false);
  if (editando)
    return (
      <form className="assistente-item editando" onSubmit={(e) => { e.preventDefault(); renomear(c.id, titulo); setEditando(false); }}>
        <input autoFocus value={titulo} maxLength={80} aria-label="Novo nome da conversa" onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditando(false)} />
        <button type="submit" aria-label="Salvar nome"><Check size={14} /></button>
        <button type="button" aria-label="Cancelar" onClick={() => setEditando(false)}><X size={14} /></button>
      </form>
    );
  if (confirmando)
    return (
      <div className="assistente-item confirmando">
        <span>Apagar?</span>
        <button type="button" onClick={() => apagar(c.id)}>Sim</button>
        <button type="button" onClick={() => setConfirmando(false)}>Não</button>
      </div>
    );
  return (
    <div className={clsx("assistente-item", ativa && "ativa")}>
      <button type="button" className="assistente-item-titulo" onClick={() => { abrir(c.id); aoAbrir(); }} title={c.titulo} aria-current={ativa ? "true" : undefined}>
        {c.titulo}
      </button>
      <button type="button" aria-label={`Renomear ${c.titulo}`} title="Renomear" onClick={() => { setTitulo(c.titulo); setEditando(true); }}><Pencil size={13} /></button>
      <button type="button" aria-label={`Apagar ${c.titulo}`} title="Apagar" onClick={() => setConfirmando(true)}><Trash2 size={13} /></button>
    </div>
  );
}

export default function Assistente() {
  const user = useSession((s) => s.user);
  const status = useAssistenteInternet();
  const { conversas, ativaId, carregar, nova, enviando } = useAssistente();
  const [lista, setLista] = useState(true);
  const [memoria, setMemoria] = useState(false);
  const iniciarTour = useTour((t) => t.iniciar);
  const tourAtivo = useTour((t) => !!t.ativo);
  // A página de abertura aparece sempre que a tela é aberta (e em "Nova conversa"); o tour precisa da tela de conversa, então ela cede lugar enquanto ele roda.
  const [sobre, setSobre] = useState(true);
  const intro = sobre && !tourAtivo;
  useEffect(() => { if (user) carregar(String(user.id)); }, [user, carregar]);

  if (status.data?.configurada === false || status.isError)
    return (
      <div className="page">
        <EmptyState icon={Bot} title="Inteligência Artificial indisponível">
          O assistente ainda não foi configurado no servidor ou está fora do ar. Tente de novo mais tarde.
        </EmptyState>
      </div>
    );

  const grupos = agruparPorData(conversas);
  return (
    <div className={clsx("assistente-layout", !lista && "sem-lista")}>
      <aside className="assistente-lateral" data-tour="assistente-lateral" aria-label="Conversas anteriores" hidden={!lista}>
        <button type="button" className="assistente-nova" disabled={!!enviando} onClick={() => { setSobre(true); nova(); }}>
          <MessageSquarePlus size={16} /> Nova conversa
        </button>
        <div className="assistente-historico">
          {grupos.length ? (
            grupos.map((g) => (
              <section key={g.rotulo}>
                <h3>{g.rotulo}</h3>
                {g.itens.map((c) => <Item key={c.id} c={c} ativa={c.id === ativaId} aoAbrir={() => setSobre(false)} />)}
              </section>
            ))
          ) : (
            <p className="muted assistente-historico-vazio">Suas conversas ficam salvas aqui, só neste computador.</p>
          )}
        </div>
        <button type="button" className="assistente-nova" data-tour="assistente-memoria" onClick={() => setMemoria(true)} title="Ver e editar o que o Assistente lembra sobre você">
          <Brain size={16} /> Memória
        </button>
      </aside>
      <section className="assistente-principal">
        <header className="assistente-topo">
          <button type="button" className="icon-button" aria-label={lista ? "Esconder conversas" : "Mostrar conversas"} title={lista ? "Esconder conversas" : "Mostrar conversas"} onClick={() => setLista((v) => !v)}>
            {lista ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          <strong>{conversas.find((c) => c.id === ativaId)?.titulo ?? "Nova conversa"}</strong>
          <button type="button" className="assistente-tour-botao" onClick={() => iniciarTour(TOUR_IA, passosTourIA)} title="Veja de novo o passo a passo de como usar a inteligência artificial">
            <Sparkles size={15} aria-hidden="true" /> Ver o tour da IA
          </button>
        </header>
        {intro ? <Intro onComecar={() => { nova(); setSobre(false); }} /> : <Conversa />}
      </section>
      {memoria ? <MemoriaPainel onClose={() => setMemoria(false)} /> : null}
    </div>
  );
}
