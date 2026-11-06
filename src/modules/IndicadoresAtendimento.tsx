import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, MessageSquareText, Star, Trophy, UserX } from "lucide-react";
import { clients, errorMessage } from "../services/api";
import { addDays, today } from "../services/agenda";
import { EmptyState } from "../components/ui/primitives";

// Atendimento dos técnicos (SGP): atendidos, adiados, não atendidos, por dia, semana e mês, com ranking.
// Regras (calculadas no servidor da Agenda sobre as OS agendadas no período):
//  atendido = encerrado no dia agendado · adiado = encerrado em dia depois do agendado ·
//  não atendido = ainda aberto com data agendada anterior a hoje · pendente = agendado para hoje ou depois.
interface Grupo { total: number; atendidos: number; adiados: number; naoAtendidos: number; pendentes: number; avaliacoes?: number; notaMedia?: number | null }
interface Avaliacao { cliente: string; contrato: number | string; osId: number | string; protocolo: string; tecnico: string; nota: number; comentario: string; respondidoEm: string; motivo: string }
interface Indicadores {
  de: string; ate: string; geradoEm: string;
  totais: Grupo & { taxa: number | null };
  porDia: (Grupo & { data: string; taxa: number | null })[];
  ranking: (Grupo & { tecnico: string; taxa: number | null })[];
  porMotivo: (Grupo & { motivo: string })[];
  avaliacoesDisponivel?: boolean;
  avaliacoes?: Avaliacao[];
}
type Periodo = "dia" | "semana" | "mes";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const segunda = (d: string) => addDays(d, -((dow(d) + 6) % 7));
const fimDoMes = (d: string) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 1, 0); return x.toISOString().slice(0, 10); };
const inicioDoMes = (d: string) => `${d.slice(0, 7)}-01`;
function mesmoMes(d: string, delta: number) { const x = new Date(`${inicioDoMes(d)}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + delta, 1); return x.toISOString().slice(0, 10); }

export function intervalo(periodo: Periodo, ref: string) {
  if (periodo === "dia") return { de: ref, ate: ref };
  if (periodo === "semana") { const s = segunda(ref); return { de: s, ate: addDays(s, 6) }; }
  return { de: inicioDoMes(ref), ate: fimDoMes(ref) };
}
const dataCurta = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
function rotulo(periodo: Periodo, ref: string) {
  const { de, ate } = intervalo(periodo, ref);
  if (periodo === "dia") return ref === today() ? `Hoje · ${dataCurta(ref)}` : new Date(`${ref}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
  if (periodo === "semana") return `${dataCurta(de)} a ${dataCurta(ate)}`;
  return new Date(`${de}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
}

function useIndicadores(de: string, ate: string) {
  return useQuery({
    queryKey: ["agenda", "indicadores", de, ate],
    queryFn: async () => (await clients.agenda.get<Indicadores>("/agenda-tecnicos/indicadores", { params: { de, ate }, timeout: 90000 })).data,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: (anterior) => anterior,
  });
}

const nota = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
function Estrelas({ valor }: { valor: number }) {
  return (
    <span className="indic-estrelas" role="img" aria-label={`${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} className={i <= Math.round(valor) ? "cheia" : undefined} aria-hidden="true" />)}
    </span>
  );
}

function somar(lista: (Grupo & { notaMedia?: number | null })[]): Grupo & { taxa: number | null } {
  const g = lista.reduce<Grupo & { soma: number }>((a, x) => ({ total: a.total + x.total, atendidos: a.atendidos + x.atendidos, adiados: a.adiados + x.adiados, naoAtendidos: a.naoAtendidos + x.naoAtendidos, pendentes: a.pendentes + x.pendentes, avaliacoes: (a.avaliacoes ?? 0) + (x.avaliacoes ?? 0), soma: a.soma + (x.avaliacoes ?? 0) * (x.notaMedia ?? 0) }), { total: 0, atendidos: 0, adiados: 0, naoAtendidos: 0, pendentes: 0, avaliacoes: 0, soma: 0 });
  const vencidas = g.atendidos + g.adiados + g.naoAtendidos;
  const { soma, ...resto } = g;
  return { ...resto, notaMedia: g.avaliacoes ? Math.round((soma / g.avaliacoes) * 100) / 100 : null, taxa: vencidas ? Math.round(((g.atendidos + g.adiados) / vencidas) * 1000) / 10 : null };
}

function Cartoes({ g, mostrarNota }: { g: Grupo & { taxa: number | null }; mostrarNota?: boolean }) {
  const itens: [string, number | string, string][] = [
    ["Atendidos", fmt(g.atendidos), "ok"],
    ["Adiados", fmt(g.adiados), "warn"],
    ["Não atendidos", fmt(g.naoAtendidos), "crit"],
    ["Pendentes", fmt(g.pendentes), "info"],
    ["Total agendado", fmt(g.total), "neutral"],
    ["Taxa de atendimento", pct(g.taxa), "taxa"],
    ...(mostrarNota ? [["Nota dos clientes", g.notaMedia == null ? "—" : `★ ${nota(g.notaMedia)}`, "nota"] as [string, string, string]] : []),
  ];
  return (
    <div className="indic-cartoes">
      {itens.map(([nome, valor, tom]) => (
        <div key={nome} className={`indic-cartao indic-${tom}`}>
          <span>{nome}</span><strong>{valor}</strong>
          {tom === "nota" ? <small>{g.avaliacoes ? `${fmt(g.avaliacoes)} avaliações` : "nenhuma avaliação ainda"}</small> : null}
        </div>
      ))}
    </div>
  );
}

function Barras({ dias }: { dias: Indicadores["porDia"] }) {
  const max = Math.max(1, ...dias.map((d) => d.total));
  return (
    <div className="indic-barras" role="img" aria-label="Chamados por dia">
      {dias.map((d) => (
        <div key={d.data} className="indic-barra" title={`${dataCurta(d.data)}: ${d.atendidos} atendidos, ${d.adiados} adiados, ${d.naoAtendidos} não atendidos, ${d.pendentes} pendentes`}>
          <div className="indic-pilha" style={{ height: `${(d.total / max) * 100}%` }}>
            {d.pendentes ? <i className="indic-info" style={{ flex: d.pendentes }} /> : null}
            {d.naoAtendidos ? <i className="indic-crit" style={{ flex: d.naoAtendidos }} /> : null}
            {d.adiados ? <i className="indic-warn" style={{ flex: d.adiados }} /> : null}
            {d.atendidos ? <i className="indic-ok" style={{ flex: d.atendidos }} /> : null}
          </div>
          <small>{dataCurta(d.data)}</small>
        </div>
      ))}
    </div>
  );
}

function Ranking({ lista, limite }: { lista: Indicadores["ranking"]; limite?: number }) {
  const itens = limite ? lista.slice(0, limite) : lista;
  const max = Math.max(1, ...itens.map((t) => t.atendidos + t.adiados));
  if (!itens.length) return <EmptyState compact icon={UserX} title="Nenhum chamado no período." />;
  return (
    <table className="indic-ranking">
      <thead><tr><th>#</th><th>Técnico</th><th>Atendidos</th><th>Adiados</th><th>Não atend.</th><th>Pend.</th><th>Taxa</th><th>Nota</th></tr></thead>
      <tbody>
        {itens.map((t, i) => (
          <tr key={t.tecnico}>
            <td>{i === 0 ? <Trophy size={14} aria-label="Primeiro lugar" /> : i + 1}</td>
            <td><strong>{t.tecnico}</strong><span className="indic-fio"><i style={{ width: `${((t.atendidos + t.adiados) / max) * 100}%` }} /></span></td>
            <td>{fmt(t.atendidos)}</td><td>{fmt(t.adiados)}</td><td className={t.naoAtendidos ? "indic-alerta" : undefined}>{fmt(t.naoAtendidos)}</td><td>{fmt(t.pendentes)}</td><td>{pct(t.taxa)}</td><td title={t.avaliacoes ? `${t.avaliacoes} avaliações` : "sem avaliações"}>{t.notaMedia == null ? "—" : `★ ${nota(t.notaMedia)}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Legenda = () => (
  <p className="indic-legenda">
    <b>Atendido</b>: encerrado no dia agendado · <b>Adiado</b>: encerrado depois do dia agendado · <b>Não atendido</b>: ainda aberto com data já passada · <b>Pendente</b>: agendado para hoje ou depois.
  </p>
);

/** Versão resumida: hoje, semana e mês em números, com o top 3 do mês. */
function Resumida() {
  const hoje = today();
  const sem = intervalo("semana", hoje);
  const mes = intervalo("mes", hoje);
  const semana = useIndicadores(sem.de, sem.ate);
  const mensal = useIndicadores(mes.de, mes.ate);
  const doDia = somar((semana.data?.porDia ?? []).filter((d) => d.data === hoje));
  const blocos: [string, (Grupo & { taxa: number | null }) | null][] = [
    ["Hoje", semana.data ? doDia : null],
    ["Semana", semana.data?.totais ?? null],
    ["Mês", mensal.data?.totais ?? null],
  ];
  const erro = semana.error || mensal.error;
  return (
    <section className="panel indic-painel" aria-label="Atendimento dos técnicos">
      <div className="panel-heading"><div className="panel-title"><CheckCircle2 size={16} strokeWidth={1.9} /><h2>Atendimento dos técnicos</h2></div></div>
      {erro && !semana.data && !mensal.data ? <p className="inline-error" role="alert">{errorMessage(erro)}</p> : null}
      <div className="indic-resumo">
        {blocos.map(([nome, g]) => (
          <div key={nome} className="indic-resumo-bloco">
            <h3>{nome}</h3>
            {g ? (
              <dl>
                <div className="indic-ok"><dt>Atendidos</dt><dd>{fmt(g.atendidos)}</dd></div>
                <div className="indic-warn"><dt>Adiados</dt><dd>{fmt(g.adiados)}</dd></div>
                <div className="indic-crit"><dt>Não atendidos</dt><dd>{fmt(g.naoAtendidos)}</dd></div>
                <div className="indic-info"><dt>Pendentes</dt><dd>{fmt(g.pendentes)}</dd></div>
                {g.avaliacoes ? <div className="indic-nota"><dt>Nota dos clientes</dt><dd>★ {nota(g.notaMedia)}</dd></div> : null}
              </dl>
            ) : <p className="muted">Carregando…</p>}
            {g ? <small>Taxa {pct(g.taxa)} · {fmt(g.total)} chamados</small> : null}
          </div>
        ))}
      </div>
      {mensal.data?.ranking.length ? (
        <>
          <h3 className="indic-sub"><Trophy size={14} /> Top 3 do mês</h3>
          <Ranking lista={mensal.data.ranking} limite={3} />
        </>
      ) : null}
    </section>
  );
}

/** Versão completa: dia, semana ou mês, com gráfico por dia, ranking completo e motivos. */
function Completa() {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [ref, setRef] = useState(today);
  const { de, ate } = intervalo(periodo, ref);
  const q = useIndicadores(de, ate);
  const d = q.data;
  const andar = (delta: number) => setRef((r) => (periodo === "dia" ? addDays(r, delta) : periodo === "semana" ? addDays(r, 7 * delta) : mesmoMes(r, delta)));
  const noPresente = ref >= intervalo(periodo, today()).de && ref <= intervalo(periodo, today()).ate;
  return (
    <section className="panel indic-painel" aria-label="Atendimento dos técnicos">
      <div className="panel-heading">
        <div className="panel-title"><CheckCircle2 size={16} strokeWidth={1.9} /><h2>Atendimento dos técnicos</h2></div>
        <div className="indic-controles">
          <div className="indic-abas" role="tablist" aria-label="Período">
            {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as [Periodo, string][]).map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={periodo === id} onClick={() => setPeriodo(id)}>{nome}</button>
            ))}
          </div>
          <div className="indic-nav">
            <button type="button" aria-label="Período anterior" onClick={() => andar(-1)}><ChevronLeft size={16} /></button>
            <span>{rotulo(periodo, ref)}</span>
            <button type="button" aria-label="Próximo período" onClick={() => andar(1)}><ChevronRight size={16} /></button>
            {!noPresente ? <button type="button" className="indic-hoje" onClick={() => setRef(today())}>Hoje</button> : null}
          </div>
        </div>
      </div>
      {q.error && !d ? <p className="inline-error" role="alert">{errorMessage(q.error)}</p> : null}
      {!d && !q.error ? <p className="muted"><Clock size={14} /> Consultando o SGP… pode levar alguns segundos.</p> : null}
      {d ? (
        <>
          <Cartoes g={d.totais} mostrarNota={d.avaliacoesDisponivel !== false} />
          {periodo !== "dia" && d.porDia.length ? (
            <>
              <h3 className="indic-sub"><CalendarClock size={14} /> Chamados por dia</h3>
              <Barras dias={d.porDia} />
              <div className="indic-chaves"><span className="indic-ok">Atendidos</span><span className="indic-warn">Adiados</span><span className="indic-crit">Não atendidos</span><span className="indic-info">Pendentes</span></div>
            </>
          ) : null}
          <h3 className="indic-sub"><Trophy size={14} /> Ranking de técnicos</h3>
          <Ranking lista={d.ranking} />
          {d.avaliacoesDisponivel && d.avaliacoes?.length ? (
            <>
              <h3 className="indic-sub"><MessageSquareText size={14} /> Últimas avaliações dos clientes</h3>
              <ul className="indic-avaliacoes">
                {d.avaliacoes.map((a) => (
                  <li key={a.protocolo}>
                    <div><Estrelas valor={a.nota} /><strong>{a.cliente || "Cliente"}</strong><span>→ {a.tecnico}</span></div>
                    <small>OS {a.osId} · {a.motivo} · {a.respondidoEm ? new Date(a.respondidoEm).toLocaleDateString("pt-BR") : ""}</small>
                    {a.comentario ? <p>“{a.comentario}”</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {d.avaliacoesDisponivel === false ? <p className="indic-legenda">As notas dos clientes ainda não estão ligadas a este painel (falta o token do site na Agenda).</p> : null}
          {d.porMotivo.length ? (
            <>
              <h3 className="indic-sub">Motivos mais frequentes</h3>
              <ul className="indic-motivos">
                {d.porMotivo.map((m) => (
                  <li key={m.motivo}><span>{m.motivo}</span><b>{fmt(m.total)}</b><small>{fmt(m.atendidos + m.adiados)} atendidos{m.naoAtendidos ? ` · ${fmt(m.naoAtendidos)} não atendidos` : ""}</small></li>
                ))}
              </ul>
            </>
          ) : null}
          <Legenda />
          <p className="indic-rodape">Atualizado às {new Date(d.geradoEm).toLocaleTimeString("pt-BR")}{q.isFetching ? " · atualizando…" : ""}</p>
        </>
      ) : null}
    </section>
  );
}

export default function IndicadoresAtendimento({ modo }: { modo: "resumido" | "completo" }) {
  return modo === "resumido" ? <Resumida /> : <Completa />;
}
