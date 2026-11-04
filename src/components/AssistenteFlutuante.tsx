import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Brain, Maximize2, MessageSquarePlus, X } from "lucide-react";
import { usePreferences, useSession } from "../stores/workspace";
import { useAssistenteInternet } from "../services/assistenteNet";
import { useAssistente } from "../modules/assistente/store";
import Conversa from "../modules/assistente/Conversa";
import MemoriaPainel from "../modules/assistente/MemoriaPainel";
import { useArrastar } from "./useArrastar";

const BOLHA = 52;
const JANELA_KEY = "workspace:assistente:janela";
/** Posição da janela ao lado da bolha, no sentido em que há mais espaço (depois a tela corrige para caber). */
const encostada = (b: { x: number; y: number }, w: number, h: number) => ({
  x: b.x + BOLHA / 2 < window.innerWidth / 2 ? b.x : b.x + BOLHA - w,
  y: b.y + BOLHA / 2 < window.innerHeight / 2 ? b.y + BOLHA + 10 : b.y - h - 10,
});
const janelaJaMovida = () => {
  try { return localStorage.getItem(JANELA_KEY) !== null; } catch { return false; }
};

/** Botão no canto da tela que abre o Assistente em uma janela. A bolha e a janela se arrastam, cada uma com a sua posição. */
export default function AssistenteFlutuante() {
  const user = useSession((s) => s.user);
  const habilitado = usePreferences((s) => s.assistenteFlutuante);
  const status = useAssistenteInternet();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { aberto, setAberto, carregar, nova, enviando } = useAssistente();
  const [memoria, setMemoria] = useState(false);
  const bolha = useArrastar({
    chave: "workspace:assistente:posicao",
    tamanho: BOLHA,
    // Começa ao lado da barra lateral (aberta ou recolhida), no canto de baixo, sem cobrir o menu.
    padrao: () => ({ x: (document.querySelector(".sidebar")?.getBoundingClientRect().right ?? 68) + 16, y: window.innerHeight - BOLHA - 20 }),
  });
  const largura = Math.min(400, window.innerWidth - 24);
  const altura = Math.min(580, window.innerHeight - 24);
  const janela = useArrastar({
    chave: JANELA_KEY,
    tamanho: { w: largura, h: altura },
    padrao: () => encostada(bolha.posicao, largura, altura),
  });
  const { definir: definirJanela } = janela;
  useEffect(() => { if (user) carregar(String(user.id)); }, [user, carregar]);
  useEffect(() => {
    // Com a tela de Memória por cima, o Esc fecha só ela (ela cuida disso).
    if (!aberto || memoria) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, memoria, setAberto]);
  // Enquanto a janela nunca foi movida, ela abre encostada na bolha (onde quer que a bolha esteja).
  useEffect(() => {
    if (aberto && !janelaJaMovida()) definirJanela(encostada(bolha.posicao, largura, altura));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!user || !habilitado || status.data?.configurada !== true || pathname === "/assistente") return null;
  return (
    <>
      {aberto ? (
        <div
          className={`assistente-painel-flutuante${janela.arrastando ? " arrastando" : ""}`}
          role="dialog"
          aria-label="Inteligência Artificial"
          style={{ left: janela.posicao.x, top: janela.posicao.y, width: largura, height: altura }}
        >
          <header {...janela.vincular} title="Arraste para mover">
            <Bot size={16} aria-hidden="true" />
            <strong>Inteligência Artificial</strong>
            <span className="espaco" />
            <button type="button" aria-label="Memória" title="O que a Inteligência Artificial lembra sobre você" onClick={() => setMemoria(true)}><Brain size={15} /></button>
            <button type="button" aria-label="Nova conversa" title="Nova conversa" disabled={!!enviando} onClick={nova}><MessageSquarePlus size={15} /></button>
            <button type="button" aria-label="Abrir em tela cheia" title="Abrir em tela cheia, com as conversas anteriores" onClick={() => { setAberto(false); navigate("/assistente"); }}><Maximize2 size={15} /></button>
            <button type="button" aria-label="Fechar" title="Fechar (Esc)" onClick={() => setAberto(false)}><X size={16} /></button>
          </header>
          <Conversa compacto />
          {memoria ? <MemoriaPainel onClose={() => setMemoria(false)} /> : null}
        </div>
      ) : null}
      <div className={`assistente-flutuante${bolha.arrastando ? " arrastando" : ""}`} style={{ left: bolha.posicao.x, top: bolha.posicao.y }}>
        <button
          type="button"
          className="assistente-bolha"
          data-tour="assistente-bolha"
          aria-label={aberto ? "Fechar a Inteligência Artificial" : "Abrir a Inteligência Artificial"}
          aria-expanded={aberto}
          title="Inteligência Artificial (arraste para mover; Shift + Home volta ao canto)"
          onClick={() => { if (!bolha.foiArraste()) setAberto(!aberto); }}
          {...bolha.vincular}
          onKeyDown={(e) => { if (e.shiftKey && e.key === "Home") { e.preventDefault(); bolha.redefinir(); janela.redefinir(); } }}
        >
          {aberto ? <X size={22} /> : <Bot size={24} />}
        </button>
      </div>
    </>
  );
}
