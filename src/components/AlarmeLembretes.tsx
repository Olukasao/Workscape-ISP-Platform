import { useCallback, useEffect, useRef } from "react";
import { AlarmClock, Check, Volume2, VolumeX } from "lucide-react";
import { useSession } from "../stores/workspace";
import { lembretesApi, useAlarmes, type Alarme } from "../services/lembretes";

const SONECAS = [5, 10, 30];
const CONSULTA_MS = 15_000;

/** Três toques curtos, repetidos até a pessoa agir. Sem arquivo de áudio: o som é gerado aqui. */
function useSomDoAlarme(tocando: boolean) {
  const contexto = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!tocando) return undefined;
    let parar = false;
    const toque = (inicio: number, frequencia: number) => {
      const ctx = contexto.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequencia;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.22);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.25);
    };
    const rodada = () => {
      if (parar) return;
      try {
        contexto.current ??= new AudioContext();
        const ctx = contexto.current;
        void ctx.resume();
        const t = ctx.currentTime + 0.05;
        [0, 0.3, 0.6].forEach((d, i) => toque(t + d, i === 2 ? 1175 : 880));
      } catch { /* sem áudio neste computador: o card continua aparecendo */ }
    };
    rodada();
    const timer = setInterval(rodada, 2200);
    return () => { parar = true; clearInterval(timer); };
  }, [tocando]);
}

/** Card de alarme por cima de tudo. Aparece quando um lembrete toca e fica até a pessoa concluir ou adiar. */
export default function AlarmeLembretes() {
  const user = useSession((s) => s.user);
  const { fila, mudo, definir, tirar, alternarMudo } = useAlarmes();
  const vistos = useRef(new Set<number>());
  const filaRef = useRef<Alarme[]>([]);
  filaRef.current = fila;

  const consultar = useCallback(async () => {
    try {
      const alarmes = await lembretesApi.alarmes();
      const locais = filaRef.current.filter((a) => a.id < 0);
      const novos = alarmes.filter((a) => !vistos.current.has(a.id));
      novos.forEach((a) => vistos.current.add(a.id));
      definir([...locais, ...alarmes]);
      if (novos.length && window.desktop) {
        void window.desktop.notify({ title: "Lembrete", body: novos.map((a) => a.texto).join(" · ").slice(0, 300), target: "/lembretes", kind: "system", tone: "warn" });
        void window.desktop.alarmAttention?.();
      }
    } catch { /* sem conexão agora: tenta de novo no próximo ciclo */ }
  }, [definir]);

  useEffect(() => {
    if (!user) { definir([]); vistos.current.clear(); return undefined; }
    void consultar();
    const timer = setInterval(consultar, CONSULTA_MS);
    return () => clearInterval(timer);
  }, [user, consultar, definir]);

  useSomDoAlarme(fila.length > 0 && !mudo);

  const atual = fila[0];
  useEffect(() => {
    if (!atual) return undefined;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alternarMudo(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [atual, alternarMudo]);

  if (!user || !atual) return null;

  const resolver = async (acao: () => Promise<unknown>) => {
    tirar(atual.id);
    if (atual.id < 0) return;
    try { await acao(); } catch { vistos.current.delete(atual.id); }
    void consultar();
  };

  return (
    <div className="alarme-card" role="alertdialog" aria-live="assertive" aria-label="Lembrete" aria-describedby="alarme-texto">
      <div className="alarme-sino" aria-hidden="true"><AlarmClock size={26} /></div>
      <div className="alarme-corpo">
        <p className="alarme-rotulo">
          {atual.disparou_em ? `Lembrete das ${atual.disparou_em.slice(11, 16)}` : "Lembrete"}
          {fila.length > 1 ? <span className="alarme-mais">+{fila.length - 1}</span> : null}
        </p>
        <p id="alarme-texto" className="alarme-texto">{atual.texto}</p>
        <div className="alarme-acoes">
          <button type="button" className="alarme-concluir" onClick={() => resolver(() => lembretesApi.concluirAlarme(atual.id))}>
            <Check size={17} aria-hidden="true" /> Concluir
          </button>
          <div className="alarme-soneca" role="group" aria-label="Adiar">
            <span>Adiar</span>
            {SONECAS.map((m) => (
              <button key={m} type="button" onClick={() => resolver(() => lembretesApi.sonecaAlarme(atual.id, m))}>{m} min</button>
            ))}
          </div>
          <button type="button" className="alarme-mudo" onClick={alternarMudo} aria-pressed={mudo} title={mudo ? "Ativar o som (Esc)" : "Silenciar o som (Esc)"}>
            {mudo ? <VolumeX size={17} aria-label="Som desligado" /> : <Volume2 size={17} aria-label="Som ligado" />}
          </button>
        </div>
      </div>
    </div>
  );
}
