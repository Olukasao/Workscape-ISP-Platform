import { Link } from "react-router-dom";
import { BookOpen, Download, FileText, Flame, Medal, Route, Trophy } from "lucide-react";
import { EmptyState, Panel, Skeleton } from "../../components/ui/primitives";
import { cursosApi, formatarData, urlDoServidor, useCursosMutation, useCursosQuery, type ArquivoInfo, type Conquista, type CursoResumo } from "./api";
import { CartaoCurso, Progresso } from "./componentes";

interface Jornada {
  estatisticas: { aulasConcluidas: number; segundos: number; cursosConcluidos: number; provasAprovadas: number; certificados: number; pontos: number; sequencia: number };
  conquistas: Conquista[]; historico: { curso_id: number; titulo: string; iniciado_em: string; concluido_em: string | null; ultimo_acesso: string | null }[];
  rankingOptIn: boolean; metaSemanalMin: number; estudadoSemanaMin: number;
}

export default function MinhaJornada() {
  const { data, isLoading } = useCursosQuery<Jornada>(["jornada"], "/jornada");
  const rank = useCursosQuery<{ ranking: { posicao: number; nome: string; pontos: number; cursos: number; voce: boolean }[] }>(["ranking"], "/ranking");
  const salvar = useCursosMutation((v: { rankingOptIn: boolean; metaSemanalMin: number }) => cursosApi.put("/preferencias", v), [["cursos", "jornada"], ["cursos", "ranking"]]);
  if (isLoading || !data) return <Skeleton lines={6} />;
  const e = data.estatisticas;
  const metaPct = Math.min(100, Math.round((data.estudadoSemanaMin / data.metaSemanalMin) * 100));
  return (
    <div className="jornada">
      <header className="cursos-titulo"><h1>Minha jornada</h1><p>Sua evolução profissional na AcessaNet.</p></header>
      <div className="cursos-metricas">
        <div><span className="ic"><Trophy size={17} /></span><b>{e.pontos}</b><small>Pontos</small></div>
        <div><span className="ic"><Flame size={17} /></span><b>{e.sequencia}</b><small>Dias seguidos</small></div>
        <div><span className="ic"><BookOpen size={17} /></span><b>{e.aulasConcluidas}</b><small>Aulas concluídas</small></div>
        <div><span className="ic"><Medal size={17} /></span><b>{e.provasAprovadas}</b><small>Provas aprovadas</small></div>
      </div>
      <div className="cursos-duas">
        <Panel title="Meta da semana" icon={Route}>
          <p>{data.estudadoSemanaMin} de {data.metaSemanalMin} minutos estudados nesta semana.</p>
          <Progresso valor={metaPct} className="grande" />
          <label className="campo-linha">Minha meta (min/semana)
            <input type="number" min={10} max={2000} step={10} defaultValue={data.metaSemanalMin} onBlur={(ev) => salvar.mutate({ rankingOptIn: data.rankingOptIn, metaSemanalMin: Number(ev.target.value) || 60 })} />
          </label>
        </Panel>
        <Panel title="Conquistas" icon={Medal}>
          {data.conquistas.length ? <ul className="conquistas">{data.conquistas.map((c) => <li key={c.id}><Medal size={18} /><span><strong>{c.titulo}</strong><small>{c.descricao}</small></span></li>)}</ul> : <p className="mudo">As conquistas aparecem conforme você conclui cursos e trilhas.</p>}
        </Panel>
      </div>
      <Panel title="Ranking interno" icon={Trophy}>
        <label className="campo-check"><input type="checkbox" checked={data.rankingOptIn} onChange={(ev) => salvar.mutate({ rankingOptIn: ev.target.checked, metaSemanalMin: data.metaSemanalMin })} /> Quero aparecer no ranking (opcional; só quem marca aparece)</label>
        {rank.data?.ranking.length ? (
          <ol className="ranking">{rank.data.ranking.map((r) => <li key={r.posicao} className={r.voce ? "voce" : ""}><b>{r.posicao}º</b><span>{r.nome}</span><small>{r.cursos} cursos</small><strong>{r.pontos} pts</strong></li>)}</ol>
        ) : <p className="mudo">Ninguém entrou no ranking ainda.</p>}
      </Panel>
      <Panel title="Histórico de estudos" icon={BookOpen}>
        {data.historico.length ? (
          <ul className="historico">{data.historico.map((h) => (
            <li key={h.curso_id}><Link to={`/cursos/curso/${h.curso_id}`}>{h.titulo}</Link><small>Iniciado em {formatarData(h.iniciado_em)}{h.concluido_em ? ` · concluído em ${formatarData(h.concluido_em)}` : h.ultimo_acesso ? ` · último acesso ${formatarData(h.ultimo_acesso)}` : ""}</small></li>
          ))}</ul>
        ) : <p className="mudo">Você ainda não iniciou nenhum curso.</p>}
      </Panel>
    </div>
  );
}

export function Trilhas() {
  const { data, isLoading } = useCursosQuery<{ trilhas: { id: number; titulo: string; descricao: string | null; progresso: number; cursos: CursoResumo[] }[] }>(["trilhas"], "/trilhas");
  if (isLoading) return <Skeleton lines={5} />;
  return (
    <div className="trilhas">
      <header className="cursos-titulo"><h1>Trilhas de aprendizagem</h1><p>Sequências de cursos para uma formação completa.</p></header>
      {data?.trilhas.length ? data.trilhas.map((t) => (
        <section key={t.id} className="trilha">
          <div className="trilha-cab"><div><h2>{t.titulo}</h2>{t.descricao && <p>{t.descricao}</p>}</div><div className="trilha-prog"><Progresso valor={t.progresso} /><span>{t.progresso}%</span></div></div>
          <ol className="trilha-passos">{t.cursos.map((c, i) => <li key={c.id}><span className="passo">{c.concluido ? "✓" : i + 1}</span><CartaoCurso c={c} /></li>)}</ol>
        </section>
      )) : <EmptyState icon={Route} title="Nenhuma trilha publicada">As trilhas criadas pela equipe aparecerão aqui.</EmptyState>}
    </div>
  );
}

export function Biblioteca() {
  const mat = useCursosQuery<{ materiais: (ArquivoInfo & { cursoId: number; curso: string })[] }>(["biblioteca"], "/biblioteca");
  const notas = useCursosQuery<{ anotacoes: { aula_id: number; texto: string; atualizado_em: string; titulo: string; curso: string }[] }>(["anotacoes"], "/anotacoes");
  return (
    <div className="biblioteca">
      <header className="cursos-titulo"><h1>Biblioteca</h1><p>Materiais complementares dos cursos e suas anotações pessoais.</p></header>
      <Panel title="Materiais" icon={FileText}>
        {mat.data?.materiais.length ? <ul className="materiais">{mat.data.materiais.map((m) => (
          <li key={m.id}><FileText size={16} /><span><a href={urlDoServidor(m.url)} target="_blank" rel="noopener noreferrer">{m.nome}</a><small>{m.curso}</small></span><Download size={14} /></li>
        ))}</ul> : <p className="mudo">Nenhum material disponível ainda.</p>}
      </Panel>
      <Panel title="Minhas anotações" icon={BookOpen}>
        {notas.data?.anotacoes.length ? <ul className="notas">{notas.data.anotacoes.map((n) => (
          <li key={n.aula_id}><Link to={`/cursos/aula/${n.aula_id}`}>{n.titulo}</Link><small>{n.curso} · {formatarData(n.atualizado_em)}</small><p>{n.texto.slice(0, 280)}{n.texto.length > 280 ? "…" : ""}</p></li>
        ))}</ul> : <p className="mudo">Suas anotações das aulas aparecerão aqui. Só você as vê.</p>}
      </Panel>
    </div>
  );
}
