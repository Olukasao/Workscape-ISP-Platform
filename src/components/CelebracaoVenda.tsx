import { useEffect, useRef, useState } from "react";
import { PartyPopper } from "lucide-react";
import { useDashboard } from "../services/dashboard";
import { groupTotal } from "../services/dashboardModel";
import { socket } from "../services/socket";
import { useSession } from "../stores/workspace";

// Comemoração de venda do chat antigo: quando "ATIVAÇÃO DE CONTRATO - COMUM" sobe no Painel NOC,
// toca um som, mostra o aviso e solta fogos de artifício na tela. O admin pode disparar um teste para todos.
export const CHAVE_VENDAS = "ATIVAÇÃO DE CONTRATO - COMUM";
const DURACAO_AVISO_MS = 5600;

interface Comemoracao { id: number; incremento: number; total: number | null; titulo?: string; subtitulo?: string }

function tocarSom() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const tom = (inicio: number, freq: number, dur: number, ganho: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, inicio);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(ganho, inicio + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + dur + 0.05);
    };
    const t = ctx.currentTime + 0.015;
    // Mesmo arpejo do chat antigo (dó, mi, sol, dó).
    tom(t, 523.25, 0.16, 0.6);
    tom(t + 0.1, 659.25, 0.18, 0.7);
    tom(t + 0.2, 783.99, 0.2, 0.8);
    tom(t + 0.32, 1046.5, 0.24, 0.85);
    setTimeout(() => void ctx.close(), 1500);
  } catch { /* Sem áudio disponível. */ }
}

const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function CelebracaoVenda() {
  const token = useSession((s) => s.token);
  const snapshot = useDashboard((s) => s.snapshot);
  const connected = useDashboard((s) => s.connected);
  const anterior = useRef<number | null>(null);
  const [atual, setAtual] = useState<Comemoracao | null>(null);
  const palco = useRef<HTMLDivElement>(null);

  const comemorar = (c: Omit<Comemoracao, "id">) => {
    tocarSom();
    setAtual({ ...c, id: Date.now() });
  };

  // Só conta vendas a partir de números ao vivo: o primeiro valor (ou o cache de antes) é a referência.
  useEffect(() => {
    if (!snapshot || !connected) return;
    const valor = groupTotal(snapshot.groups, CHAVE_VENDAS);
    if (valor == null) return;
    const antes = anterior.current;
    anterior.current = valor;
    if (antes !== null && valor > antes) comemorar({ incremento: valor - antes, total: valor });
  }, [snapshot, connected]);

  useEffect(() => {
    if (!connected) anterior.current = null;
  }, [connected]);

  // Teste local do painel de administração: só nesta tela, sem avisar ninguém.
  useEffect(() => {
    const local = () => comemorar({ incremento: 1, total: null, titulo: "Teste de venda", subtitulo: "Só na sua tela" });
    // "testar-foguetes" é o nome antigo do evento; continua aceito.
    window.addEventListener("workspace:testar-fogos", local);
    window.addEventListener("workspace:testar-foguetes", local);
    return () => {
      window.removeEventListener("workspace:testar-fogos", local);
      window.removeEventListener("workspace:testar-foguetes", local);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const s = socket;
    const teste = (data: { incremento?: number; criado_por?: string } = {}) =>
      comemorar({
        incremento: Math.max(1, Number(data.incremento) || 1),
        total: null,
        titulo: "Teste de venda",
        subtitulo: data.criado_por ? `Disparado por ${data.criado_por}` : "Disparado pelo painel admin",
      });
    s.on("sales_celebration_test", teste);
    return () => { s.off("sales_celebration_test", teste); };
  }, [token]);

  useEffect(() => {
    if (!atual) return;
    let desmontar: (() => void) | undefined;
    let cancelado = false;
    const fim = setTimeout(() => setAtual((c) => (c?.id === atual.id ? null : c)), DURACAO_AVISO_MS);
    if (!semMovimento() && palco.current) {
      const alvo = palco.current;
      // O código dos fogos só é carregado na primeira comemoração.
      void import("./celebracao/fogosScene").then(({ iniciarFogos }) => {
        if (!cancelado) desmontar = iniciarFogos(alvo, atual.incremento, () => undefined);
      }).catch(() => undefined);
    }
    return () => { cancelado = true; clearTimeout(fim); desmontar?.(); };
  }, [atual]);

  if (!atual) return null;
  return (
    <div className="venda-camada" aria-hidden="false">
      <div ref={palco} className="venda-palco" aria-hidden="true" />
      <div key={atual.id} className="venda-aviso" role="status" aria-live="polite">
        <span className="venda-aviso-icone"><PartyPopper size={22} strokeWidth={2} /></span>
        <span className="venda-aviso-texto">
          <strong>{atual.titulo || (atual.incremento > 1 ? `${atual.incremento} novas vendas!` : "Venda confirmada!")}</strong>
          <small>{atual.subtitulo || (atual.total != null ? `Ativação de contrato · ${atual.total.toLocaleString("pt-BR")} no painel` : "Ativação de contrato")}</small>
        </span>
        <em>+{atual.incremento}</em>
      </div>
    </div>
  );
}
