import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Flag, RotateCcw, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Skeleton } from "../../components/ui/primitives";
import { cursosApi, errorMessage, useCursosQuery } from "./api";
import { Progresso } from "./componentes";

type Resp = any;
interface Questao {
  id: string; tipo: string; enunciado: string; pontos: number; obrigatoria: boolean;
  opcoes?: { id: string; texto: string }[]; esquerda?: { id: string; texto: string }[]; direita?: { id: string; texto: string }[]; itens?: { id: string; texto: string }[];
}
interface Conferida { acertou: boolean; parcial: boolean; correta?: any }
interface Tentativa { id: number; numero: number; expiraEm: string | null; agora: string; respostas: Record<string, Resp>; conferidas?: Record<string, Conferida>; prova: { titulo: string; notaMinima: number; tempoLimiteMin: number; feedback: string; questoes: Questao[] } }
interface Info {
  aula: { id: number; titulo: string };
  config: { titulo: string; questoes: number; notaMinima: number; maxTentativas: number; tempoLimiteMin: number; feedback: string };
  tentativas: { id: number; numero: number; status: string; nota: number | null; aprovado: boolean | null; tempoSegundos: number | null }[];
  podeIniciar: boolean; motivo: string | null; emAndamento: number | null; aprovada: boolean;
}
interface Resultado {
  id: number; numero: number; status: string; nota?: number | null; aprovado?: boolean | null; notaMinima: number; mensagem?: string; tempoSegundos?: number | null; feedback: string;
  questoes?: Record<string, { pontos: number | null; maximo: number; acertou: boolean | null; parcial: boolean; correta?: any }>; enunciados?: Record<string, string>; respostas?: Record<string, Resp>;
  curso?: { concluido: boolean; certificado: string | null };
}

const fmtTempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

function CampoQuestao({ q, valor, onChange }: { q: Questao; valor: Resp; onChange: (v: Resp) => void }) {
  switch (q.tipo) {
    case "unica":
      return <div className="cb-opcoes">{q.opcoes!.map((o) => <label key={o.id} className={clsx("cb-opcao", valor === o.id && "marcada")}><input type="radio" name={q.id} checked={valor === o.id} onChange={() => onChange(o.id)} />{o.texto}</label>)}</div>;
    case "multipla": {
      const sel: string[] = Array.isArray(valor) ? valor : [];
      return <div className="cb-opcoes">{q.opcoes!.map((o) => <label key={o.id} className={clsx("cb-opcao", sel.includes(o.id) && "marcada")}><input type="checkbox" checked={sel.includes(o.id)} onChange={() => onChange(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])} />{o.texto}</label>)}<small className="mudo">Marque todas as corretas.</small></div>;
    }
    case "vf":
      return <div className="cb-vf">{[true, false].map((v) => <button key={String(v)} type="button" className={clsx("btn btn--outline", valor === v && "marcada")} aria-pressed={valor === v} onClick={() => onChange(v)}>{v ? "Verdadeiro" : "Falso"}</button>)}</div>;
    case "associacao": {
      const mapa: Record<string, string> = valor && typeof valor === "object" ? valor : {};
      return (
        <div className="cb-assoc">
          {q.esquerda!.map((e) => (
            <div key={e.id} className="linha"><span>{e.texto}</span>
              <select aria-label={`Associação de ${e.texto}`} value={mapa[e.id] ?? ""} onChange={(ev) => onChange({ ...mapa, [e.id]: ev.target.value })}>
                <option value="">Selecione…</option>{q.direita!.map((d) => <option key={d.id} value={d.id}>{d.texto}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case "ordenacao": {
      const ordem: string[] = Array.isArray(valor) && valor.length === q.itens!.length ? valor : q.itens!.map((i) => i.id);
      const texto = (id: string) => q.itens!.find((i) => i.id === id)?.texto ?? "";
      const mover = (i: number, d: number) => { const n = [...ordem]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
      return (
        <ol className="cb-ordem">
          {ordem.map((id, i) => (
            <li key={id}><span>{texto(id)}</span>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Descer" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={14} /></button>
            </li>
          ))}
          <small className="mudo">Coloque as etapas na ordem correta.</small>
        </ol>
      );
    }
    case "curta":
      return <input type="text" maxLength={300} value={valor ?? ""} placeholder="Sua resposta" onChange={(e) => onChange(e.target.value)} />;
    default:
      return <textarea rows={6} maxLength={10000} value={valor ?? ""} placeholder="Escreva sua resposta. Ela será corrigida pelo responsável." onChange={(e) => onChange(e.target.value)} />;
  }
}

function Fazendo({ t, onFim }: { t: Tentativa; onFim: (r: Resultado) => void }) {
  const [i, setI] = useState(0);
  const [resp, setResp] = useState<Record<string, Resp>>(t.respostas ?? {});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [conferidas, setConferidas] = useState<Record<string, Conferida>>(t.conferidas ?? {});
  const [agora, setAgora] = useState(Date.now());
  const deslocamento = useMemo(() => new Date(t.agora).getTime() - Date.now(), [t.agora]);
  const qs = t.prova.questoes;
  const q = qs[i];
  const restante = t.expiraEm ? Math.round((new Date(t.expiraEm).getTime() - (agora + deslocamento)) / 1000) : null;
  const respRef = useRef(resp); respRef.current = resp;
  const finalizado = useRef(false);

  const finalizar = useCallback(async () => {
    if (finalizado.current) return;
    finalizado.current = true; setEnviando(true); setErro("");
    try { onFim(await cursosApi.post<Resultado>(`/tentativa/${t.id}/finalizar`, { respostas: respRef.current })); }
    catch (e) { finalizado.current = false; setErro(errorMessage(e)); setEnviando(false); }
  }, [t.id, onFim]);

  useEffect(() => { const x = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(x); }, []);
  useEffect(() => { if (restante !== null && restante <= 0) void finalizar(); }, [restante, finalizar]);
  // Rascunho das respostas no servidor: fechar o app não perde a prova em andamento.
  useEffect(() => {
    const x = setTimeout(() => { void cursosApi.put(`/tentativa/${t.id}/respostas`, { respostas: resp }).catch(() => undefined); }, 1200);
    return () => clearTimeout(x);
  }, [resp, t.id]);

  const conferir = async () => {
    setErro("");
    try { const r = await cursosApi.post<Conferida>(`/tentativa/${t.id}/conferir`, { questaoId: q.id, resposta: resp[q.id] }); setConferidas((c) => ({ ...c, [q.id]: r })); }
    catch (e) { setErro(errorMessage(e)); }
  };
  const imediato = t.prova.feedback === "imediato" && q.tipo !== "discursiva";
  const conf = conferidas[q.id];
  const respondidas = qs.filter((x) => { const r = resp[x.id]; return r !== undefined && r !== "" && !(Array.isArray(r) && !r.length) && !(r && typeof r === "object" && !Array.isArray(r) && !Object.keys(r).length); }).length;
  const faltamObrigatorias = qs.filter((x) => x.obrigatoria && !(resp[x.id] !== undefined && resp[x.id] !== "")).length;
  return (
    <div className="prova">
      <header className="prova-topo">
        <div><strong>{t.prova.titulo}</strong><small>Tentativa {t.numero} · {qs.length} questões</small></div>
        {restante !== null && <span className={clsx("cronometro", restante < 60 && "urgente")} role="timer" aria-label="Tempo restante"><Clock size={15} /> {fmtTempo(restante)}</span>}
      </header>
      <Progresso valor={(respondidas / qs.length) * 100} rotulo="Questões respondidas" />
      <nav className="prova-nav" aria-label="Questões">
        {qs.map((x, k) => <button key={x.id} type="button" aria-current={k === i} className={clsx(k === i && "atual", resp[x.id] !== undefined && resp[x.id] !== "" && "feita")} onClick={() => setI(k)}>{k + 1}</button>)}
      </nav>
      <section className="questao" aria-live="polite">
        <div className="questao-cab"><span>Questão {i + 1} de {qs.length}</span><span>{q.pontos} pts{q.obrigatoria ? " · obrigatória" : ""}</span></div>
        <h2>{q.enunciado}</h2>
        <fieldset className="questao-campos" disabled={!!conf}>
          <CampoQuestao q={q} valor={resp[q.id]} onChange={(v) => setResp((r) => ({ ...r, [q.id]: v }))} />
        </fieldset>
        {imediato && !conf && <button type="button" className="btn btn--soft btn--sm conferir" disabled={resp[q.id] === undefined || resp[q.id] === ""} onClick={conferir}>Conferir resposta</button>}
        {conf && <p className={clsx("cb-retorno", conf.acertou ? "ok" : "erro")}>{conf.acertou ? "Resposta correta!" : conf.parcial ? "Resposta parcialmente correta." : "Resposta incorreta."}{!conf.acertou && conf.correta !== undefined ? ` Correta: ${descreverCorreta(q, conf.correta)}` : ""} A resposta conferida não pode mais ser alterada.</p>}
      </section>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      <footer className="prova-rodape">
        <button type="button" className="btn btn--outline" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={16} /> Anterior</button>
        <span className="grow" />
        {i < qs.length - 1 ? <button type="button" className="btn btn--primary" onClick={() => setI(i + 1)}>Próxima <ChevronRight size={16} /></button>
          : <button type="button" className="btn btn--primary" disabled={enviando} onClick={() => setConfirmar(true)}><Flag size={16} /> Finalizar avaliação</button>}
        {i < qs.length - 1 && <button type="button" className="btn btn--soft" disabled={enviando} onClick={() => setConfirmar(true)}>Finalizar</button>}
      </footer>
      {confirmar && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Finalizar avaliação">
          <div className="modal">
            <h3>Finalizar a avaliação?</h3>
            <p>Você respondeu {respondidas} de {qs.length} questões.{faltamObrigatorias ? ` Há ${faltamObrigatorias} obrigatória(s) em branco; isso reprova a tentativa.` : ""} Depois de finalizar não é possível alterar as respostas.</p>
            <div className="modal-acoes"><button type="button" className="btn btn--outline" onClick={() => setConfirmar(false)}>Voltar à prova</button><button type="button" className="btn btn--primary" disabled={enviando} onClick={() => { setConfirmar(false); void finalizar(); }}>Finalizar agora</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function descreverCorreta(q: Questao | undefined, c: any, _r?: Resultado): string {
  if (c === undefined || c === null) return "";
  const txt = (id: string) => q?.opcoes?.find((o) => o.id === id)?.texto ?? q?.itens?.find((o) => o.id === id)?.texto ?? id;
  if (typeof c === "boolean") return c ? "Verdadeiro" : "Falso";
  if (q?.tipo === "associacao" && Array.isArray(c)) return q.esquerda!.map((e) => `${e.texto} ↔ ${q.direita!.find((d) => d.id === e.id)?.texto}`).join("; ");
  if (Array.isArray(c)) return c.map(txt).join(q?.tipo === "ordenacao" ? " → " : ", ");
  return String(c);
}

function ResultadoView({ r, enunciados, tentativa }: { r: Resultado; enunciados?: Record<string, string>; tentativa?: Tentativa | null }) {
  if (r.status === "aguardando_correcao") {
    return <div className="resultado pendente"><AlertTriangle size={28} /><h2>Avaliação enviada</h2><p>{r.mensagem}</p></div>;
  }
  const aprovado = !!r.aprovado;
  return (
    <div className={clsx("resultado", aprovado ? "aprovado" : "reprovado")}>
      {aprovado ? <CheckCircle2 size={34} /> : <XCircle size={34} />}
      <h2>Avaliação concluída</h2>
      <p className="nota">Nota: <strong>{r.nota}/100</strong></p>
      <p>Nota mínima: <strong>{r.notaMinima}/100</strong></p>
      <p className="veredito">Resultado: <strong>{aprovado ? "Aprovado" : "Reprovado"}</strong></p>
      {r.tempoSegundos != null && <small>Tempo utilizado: {fmtTempo(r.tempoSegundos)}</small>}
      {r.curso?.concluido && <Badge tone="ok">Curso concluído{r.curso.certificado ? ": certificado emitido" : ""}</Badge>}
      {r.questoes && (
        <ol className="revisao">
          {Object.entries(r.questoes).map(([id, c], k) => {
            const q = tentativa?.prova.questoes.find((x) => x.id === id);
            return (
              <li key={id} className={clsx(c.acertou ? "certa" : c.parcial ? "parcial" : "errada")}>
                <span className="n">{k + 1}</span>
                <div><strong>{enunciados?.[id] ?? q?.enunciado ?? `Questão ${k + 1}`}</strong>
                  <small>{c.pontos === null ? "Aguardando correção" : `${Math.round((c.pontos ?? 0) * 100) / 100} de ${c.maximo} pontos`}{c.correta !== undefined && !c.acertou ? ` · resposta correta: ${descreverCorreta(q, c.correta, r)}` : ""}</small>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function ProvaAluno({ aulaId, previa, onMudou, proxima }: { aulaId: number; previa: boolean; onMudou: () => void; proxima: number | null }) {
  const info = useCursosQuery<Info>(["prova", aulaId], `/aula/${aulaId}/prova`, undefined, { staleTime: 0 });
  const [tent, setTent] = useState<Tentativa | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { setTent(null); setRes(null); setErro(""); }, [aulaId]);
  const iniciar = async () => {
    setErro("");
    try { setRes(null); setTent(await cursosApi.post<Tentativa>(`/aula/${aulaId}/prova/iniciar`)); } catch (e) { setErro(errorMessage(e)); }
  };
  const fim = useCallback((r: Resultado) => { setRes(r); onMudou(); void info.refetch(); }, [onMudou, info]);
  if (info.isLoading) return <Skeleton lines={4} />;
  if (info.error || !info.data) return <p className="erro-inline">{errorMessage(info.error)}</p>;
  const c = info.data.config;
  if (tent && !res) return <Fazendo t={tent} onFim={(r) => { fim(r); }} />;
  if (res) {
    return (
      <>
        <ResultadoView r={res} tentativa={tent} />
        <div className="prova-acoes">
          {!res.aprovado && res.status === "finalizada" && info.data.podeIniciar && <button type="button" className="btn btn--primary" onClick={iniciar}><RotateCcw size={15} /> Tentar novamente</button>}
          {res.aprovado && proxima && <span className="mudo">Próxima etapa liberada.</span>}
        </div>
      </>
    );
  }
  return (
    <div className="prova-intro">
      <div className="prova-cartao">
        <ClipboardCheck size={26} />
        <h2>{c.titulo}</h2>
        <ul>
          <li><b>{c.questoes}</b> questões</li>
          <li>Nota mínima: <b>{c.notaMinima}/100</b></li>
          <li>Tentativas: <b>{c.maxTentativas || "ilimitadas"}</b>{c.maxTentativas ? ` (você fez ${info.data.tentativas.length})` : ""}</li>
          <li>Tempo: <b>{c.tempoLimiteMin ? `${c.tempoLimiteMin} min` : "sem limite"}</b></li>
        </ul>
        {info.data.aprovada && <Badge tone="ok">Você já foi aprovado nesta avaliação</Badge>}
        {previa ? <p className="aviso-previa">Prévia: a prova só pode ser feita com o curso publicado.</p>
          : info.data.emAndamento ? <button type="button" className="btn btn--primary btn--lg" onClick={iniciar}>Retomar tentativa</button>
            : info.data.podeIniciar ? <button type="button" className="btn btn--primary btn--lg" onClick={iniciar}>{info.data.tentativas.length ? "Nova tentativa" : "Iniciar avaliação"}</button>
              : <p className="mudo">Você usou todas as tentativas.</p>}
        {erro && <p className="erro-inline" role="alert">{erro}</p>}
      </div>
      {info.data.tentativas.length > 0 && (
        <div className="prova-historico"><h3>Suas tentativas</h3>
          <ul>{info.data.tentativas.map((x) => <li key={x.id}><span>Tentativa {x.numero}</span>
            {x.status === "aguardando_correcao" ? <Badge tone="warn">Aguardando correção</Badge> : x.status === "em_andamento" ? <Badge tone="info">Em andamento</Badge> : <><b>{x.nota}/100</b><Badge tone={x.aprovado ? "ok" : "crit"}>{x.aprovado ? "Aprovado" : "Reprovado"}</Badge></>}
          </li>)}</ul>
        </div>
      )}
    </div>
  );
}
