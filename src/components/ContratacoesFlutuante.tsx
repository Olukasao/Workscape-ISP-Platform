import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { abrirSgpNoWorkspace } from "../services/navegadorInterno";
import { ClipboardCheck } from "lucide-react";
import { useContratacoes, descreverPedido, type Contratacao } from "../services/contratacoes";
import LixeiraDeArraste, { sobreLixeira } from "./LixeiraDeArraste";

// Botão flutuante das contratações pendentes do site (como no Chat Interno): arrastável,
// brilha enquanto houver pedido, avisa a cada pedido novo e abre a lista resumida.
const POSICAO_KEY = "workspace:contratacoes:posicao";
const BOLHA = 52;
const MARGEM = 12;
const LIMIAR_ARRASTE = 5;
const AVISO_MS = 12000;
// "Tirar da tela" vale só até fechar o aplicativo: na próxima sessão a bolha volta.
const DISPENSADA_KEY = "workspace:contratacoes:dispensada";
const lerDispensada = () => {
  try { return sessionStorage.getItem(DISPENSADA_KEY) === "1"; } catch { return false; }
};

type Ponto = { x: number; y: number };
const limitar = ({ x, y }: Ponto): Ponto => ({
  x: Math.min(Math.max(MARGEM, x), Math.max(MARGEM, window.innerWidth - BOLHA - MARGEM)),
  y: Math.min(Math.max(MARGEM, y), Math.max(MARGEM, window.innerHeight - BOLHA - MARGEM)),
});
const posicaoPadrao = () => limitar({ x: window.innerWidth - BOLHA - 20, y: window.innerHeight - BOLHA - 110 });
const lerPosicao = (): Ponto => {
  try {
    const salva = JSON.parse(localStorage.getItem(POSICAO_KEY) || "null");
    if (Number.isFinite(salva?.x) && Number.isFinite(salva?.y)) return limitar(salva);
  } catch {
    /* Posição salva inválida: usa a padrão. */
  }
  return posicaoPadrao();
};
const formatarHora = (iso?: string) => {
  const data = new Date(iso || "");
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function ContratacoesFlutuante() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { conectado, pendentes, itens, novos } = useContratacoes();
  const [aberto, setAberto] = useState(false);
  const [precadastroAberto, setPrecadastroAberto] = useState(false);
  const [avisos, setAvisos] = useState<(Contratacao & { aviso: string })[]>([]);
  const [chamando, setChamando] = useState(false);
  const [posicao, setPosicao] = useState<Ponto>(lerPosicao);
  const [arrastando, setArrastando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [dispensada, setDispensada] = useState(lerDispensada);
  const arraste = useRef<{ id: number; inicioX: number; inicioY: number; origem: Ponto; moveu: boolean } | null>(null);
  const ignorarClique = useRef(false);
  const vistos = useRef<Set<number>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const salvarPosicao = useCallback((nova: Ponto) => {
    const ajustada = limitar(nova);
    setPosicao(ajustada);
    try {
      localStorage.setItem(POSICAO_KEY, JSON.stringify(ajustada));
    } catch {
      /* Sem armazenamento: a posição vale só nesta sessão. */
    }
  }, []);
  useEffect(() => {
    const aoRedimensionar = () => setPosicao((atual) => limitar(atual));
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);
  // Cada pedido novo (ids que entram em `novos`) gera um aviso na tela, uma única vez.
  useEffect(() => {
    const recentes = novos.filter((id) => !vistos.current.has(id));
    if (!recentes.length) return;
    recentes.forEach((id) => vistos.current.add(id));
    const pedidos = itens.filter((i) => recentes.includes(i.id)).map((i) => ({ ...i, aviso: `${i.id}-${Date.now()}` }));
    if (!pedidos.length) return;
    setAvisos((atuais) => [...pedidos, ...atuais].slice(0, 4));
    setChamando(true);
    const timer = setTimeout(() => {
      setAvisos((atuais) => atuais.filter((a) => !pedidos.some((p) => p.aviso === a.aviso)));
      setChamando(false);
    }, AVISO_MS);
    timers.current.push(timer);
  }, [novos, itens]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const iniciarArraste = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    arraste.current = { id: event.pointerId, inicioX: event.clientX, inicioY: event.clientY, origem: posicao, moveu: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moverArraste = (event: PointerEvent<HTMLButtonElement>) => {
    const atual = arraste.current;
    if (!atual || atual.id !== event.pointerId) return;
    const dx = event.clientX - atual.inicioX;
    const dy = event.clientY - atual.inicioY;
    if (!atual.moveu && Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
    if (!atual.moveu) {
      atual.moveu = true;
      setArrastando(true);
    }
    setPosicao(limitar({ x: atual.origem.x + dx, y: atual.origem.y + dy }));
    setSobre(sobreLixeira(event.clientX, event.clientY));
  };
  const terminarArraste = (event: PointerEvent<HTMLButtonElement>) => {
    const atual = arraste.current;
    if (!atual || atual.id !== event.pointerId) return;
    arraste.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (atual.moveu && sobreLixeira(event.clientX, event.clientY)) {
      // Soltou na lixeira: some até a próxima sessão (a posição antiga é mantida para quando voltar).
      setArrastando(false);
      setSobre(false);
      setAberto(false);
      setAvisos([]);
      try { sessionStorage.setItem(DISPENSADA_KEY, "1"); } catch { /* vale só até recarregar */ }
      setDispensada(true);
      return;
    }
    if (atual.moveu) {
      ignorarClique.current = true;
      setArrastando(false);
      setSobre(false);
      salvarPosicao({ x: atual.origem.x + event.clientX - atual.inicioX, y: atual.origem.y + event.clientY - atual.inicioY });
    }
  };
  // Shift + setas move o botão pelo teclado; Shift + Home volta à posição padrão.
  const moverPeloTeclado = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.shiftKey) return;
    const passo = 24;
    const deslocamentos: Record<string, [number, number]> = {
      ArrowUp: [0, -passo], ArrowDown: [0, passo], ArrowLeft: [-passo, 0], ArrowRight: [passo, 0],
    };
    if (event.key === "Home") {
      event.preventDefault();
      salvarPosicao(posicaoPadrao());
      return;
    }
    const delta = deslocamentos[event.key];
    if (!delta) return;
    event.preventDefault();
    salvarPosicao({ x: posicao.x + delta[0], y: posicao.y + delta[1] });
  };

  // Na própria tela de Contratações o botão seria redundante.
  if (pathname.startsWith("/contratacoes") || dispensada) return null;
  const temPendencia = pendentes > 0;
  const metadeSuperior = posicao.y + BOLHA / 2 < window.innerHeight / 2;
  const ladoEsquerdo = posicao.x + BOLHA / 2 < window.innerWidth / 2;
  const estilo = {
    ...(metadeSuperior ? { top: posicao.y } : { bottom: window.innerHeight - posicao.y - BOLHA }),
    ...(ladoEsquerdo ? { left: posicao.x } : { right: window.innerWidth - posicao.x - BOLHA }),
  };
  const classes = ["contratacoes-widget", metadeSuperior ? "abre-abaixo" : "", ladoEsquerdo ? "alinha-esquerda" : "", arrastando ? "is-dragging" : ""]
    .filter(Boolean).join(" ");
  return (
    <>
    <LixeiraDeArraste visivel={arrastando} ativa={sobre} texto="Tirar da tela (volta na próxima sessão)" />
    <div className={classes} style={estilo}>
      {avisos.length > 0 && (
        <div className="contratacoes-toasts" role="status" aria-live="polite">
          {avisos.map((aviso) => (
            <button
              type="button"
              key={aviso.aviso}
              className="contratacoes-toast"
              onClick={() => {
                setAberto(true);
                setAvisos((atuais) => atuais.filter((a) => a.aviso !== aviso.aviso));
              }}
            >
              <strong>Nova contratação no site</strong>
              <span>{aviso.cliente}</span>
              <small>{descreverPedido(aviso)}</small>
            </button>
          ))}
        </div>
      )}
      {aberto && (
        <section className="contratacoes-panel" aria-label="Contratações pendentes">
          <header>
            <strong>Contratações pendentes</strong>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
          </header>
          {!conectado && <p className="contratacoes-aviso-offline">Sem conexão com o site agora. Mostrando a última lista.</p>}
          {itens.length === 0 ? (
            <p className="contratacoes-vazio">Nenhum pedido novo aguardando atendimento.</p>
          ) : (
            <ul>
              {itens.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <strong>{item.cliente}</strong>
                  <span>{descreverPedido(item)}</span>
                  <small>{[item.protocolo, formatarHora(item.criadoEm)].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ul>
          )}
          {pendentes > Math.min(itens.length, 8) && (
            <p className="contratacoes-mais">+ {pendentes - Math.min(itens.length, 8)} pedidos na tela de Contratações.</p>
          )}
          {/* Pré-cadastro no SGP: o botão abre as duas opções; o link abre no navegador do computador. */}
          <button
            type="button"
            className="contratacoes-abrir contratacoes-precadastro"
            aria-expanded={precadastroAberto}
            onClick={() => setPrecadastroAberto((atual) => !atual)}
          >
            Pré-cadastro {precadastroAberto ? "▴" : "▾"}
          </button>
          {precadastroAberto && (
            <div className="contratacoes-precadastro-opcoes" role="menu">
              {[
                { rotulo: "Pessoa física", url: "https://acessanet.sgp.net.br/public/precadastro/F/" },
                { rotulo: "Pessoa jurídica", url: "https://acessanet.sgp.net.br/public/precadastro/J/" },
              ].map((opcao) => (
                <button
                  key={opcao.url}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPrecadastroAberto(false);
                    void abrirSgpNoWorkspace(opcao.url, navigate);
                  }}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="contratacoes-abrir contratacoes-painel"
            onClick={() => {
              if (window.desktop) void window.desktop.openExternal("painel-contratacoes");
              else window.open("https://acessanet.com.br/admin/contratacoes", "_blank", "noopener,noreferrer");
            }}
          >
            Abrir painel admin no navegador
          </button>
          <button
            type="button"
            className="contratacoes-abrir"
            onClick={() => {
              setAberto(false);
              navigate("/contratacoes");
            }}
          >
            Abrir contratações do site
          </button>
        </section>
      )}
      <button
        type="button"
        className={`contratacoes-bubble${temPendencia ? " is-pending" : ""}${chamando ? " is-ringing" : ""}${conectado ? "" : " is-offline"}`}
        onClick={() => {
          if (ignorarClique.current) {
            ignorarClique.current = false;
            return;
          }
          setAberto((atual) => !atual);
        }}
        onPointerDown={iniciarArraste}
        onPointerMove={moverArraste}
        onPointerUp={terminarArraste}
        onPointerCancel={terminarArraste}
        onKeyDown={moverPeloTeclado}
        aria-label={temPendencia ? `${pendentes} contratações pendentes no site` : "Nenhuma contratação pendente"}
        aria-describedby="contratacoes-dica-arraste"
        title="Contratações pendentes do site — arraste para mover ou para a lixeira, à direita, para tirar da tela"
      >
        <ClipboardCheck size={22} aria-hidden="true" />
        <span className="contratacoes-count">{pendentes > 99 ? "99+" : pendentes}</span>
      </button>
      <span id="contratacoes-dica-arraste" className="contratacoes-sr-only">
        Arraste para mover. Pelo teclado, use Shift e as setas; Shift e Home voltam à posição inicial.
      </span>
    </div>
    </>
  );
}
