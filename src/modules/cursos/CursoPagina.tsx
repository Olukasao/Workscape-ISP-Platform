import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Award, CheckCircle2, ChevronDown, CircleDashed, ClipboardCheck, Clock, Heart, Lock, PlayCircle, Star, Target } from "lucide-react";
import { clsx } from "clsx";
import { Badge, EmptyState, Skeleton } from "../../components/ui/primitives";
import { NIVEL_ROTULO, cursosApi, errorMessage, formatarData, formatarDuracao, useCursosMutation, useCursosQuery, type CursoDetalhe } from "./api";
import { Capa, Progresso } from "./componentes";

const linhas = (t?: string | null) => (t || "").split("\n").map((s) => s.trim()).filter(Boolean);

export function IconeEstado({ estado, tipo }: { estado: string; tipo?: string }) {
  if (estado === "concluida") return <CheckCircle2 size={17} className="est ok" aria-label="Concluída" />;
  if (estado === "bloqueada") return <Lock size={16} className="est bloq" aria-label="Bloqueada" />;
  if (estado === "andamento") return <PlayCircle size={17} className="est and" aria-label="Em andamento" />;
  return tipo === "prova" ? <ClipboardCheck size={16} className="est" aria-label="Avaliação" /> : <CircleDashed size={16} className="est" aria-label="Não iniciada" />;
}

export default function CursoPagina() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCursosQuery<CursoDetalhe>(["curso", id], `/curso/${id}`);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [erroAcao, setErroAcao] = useState("");
  const fav = useCursosMutation((v: boolean) => cursosApi.put(`/curso/${id}/favorito`, { favorito: v }), [["cursos", "curso", id]]);
  const nota = useCursosMutation((v: { nota: number; comentario: string }) => cursosApi.put(`/curso/${id}/feedback`, v), [["cursos", "curso", id]]);
  const [comentario, setComentario] = useState("");
  if (isLoading) return <div className="curso-pagina"><Skeleton lines={6} /></div>;
  if (error || !data) return <EmptyState icon={Lock} title="Curso não encontrado">Ele pode ter sido despublicado ou arquivado.</EmptyState>;
  const { curso: c, modulos, progresso } = data;
  const comecar = async () => {
    setErroAcao("");
    try {
      const alvo = data.ultimaAulaId && data.matriculado ? data.ultimaAulaId : data.proximaAulaId ?? modulos[0]?.aulas[0]?.id;
      if (!alvo) return;
      if (!data.matriculado && !data.previa) await cursosApi.post(`/curso/${id}/matricular`);
      navigate(`/cursos/aula/${alvo}`);
    } catch (e) { setErroAcao(errorMessage(e)); }
  };
  const toggle = (mid: number) => setAbertos((s) => { const n = new Set(s); n.has(mid) ? n.delete(mid) : n.add(mid); return n; });
  const totalAulas = modulos.reduce((s, m) => s + m.aulas.length, 0);
  return (
    <div className="curso-pagina">
      <Link to="/cursos/catalogo" className="voltar">← Catálogo</Link>
      {data.previa && <div className="aviso-previa">Prévia administrativa: este curso ainda não está publicado. Você vê o que o aluno verá; o progresso não é registrado.</div>}
      <section className="curso-banner">
        <Capa capa={c.capa} titulo={c.titulo} className="banner-capa" />
        <div className="banner-corpo">
          <div className="curso-cartao-meta">{c.categoria && <span>{c.categoria}</span>}<span className={clsx("nivel", data && c.nivel)}>{NIVEL_ROTULO[c.nivel]}</span>{c.obrigatorio && <Badge tone="warn">Obrigatório</Badge>}</div>
          <h1>{c.titulo}</h1>
          {c.instrutor && (
            <p className="instrutor">
              Responsável:{" "}
              {c.instrutorUrl
                ? <a href={c.instrutorUrl} target="_blank" rel="noopener noreferrer"><strong>{c.instrutor}</strong></a>
                : <strong>{c.instrutor}</strong>}
            </p>
          )}
          <ul className="curso-cartao-info grande">
            <li><Clock size={15} /> {c.cargaHorariaMin ? formatarDuracao(c.cargaHorariaMin) : "Carga horária não informada"}</li>
            <li><PlayCircle size={15} /> {modulos.length} módulos · {totalAulas} aulas</li>
            {c.emiteCertificado && <li><Award size={15} /> Certificado de conclusão</li>}
          </ul>
          {data.matriculado && (
            <div className="banner-progresso">
              <Progresso valor={progresso.percentual} className="grande" />
              <span>{progresso.feitas} de {progresso.total} aulas · {progresso.percentual}%{data.prazoEm ? ` · prazo ${formatarData(data.prazoEm)}` : ""}</span>
            </div>
          )}
          <div className="banner-acoes">
            {c.requisitoCumprido || data.previa ? (
              <button type="button" className="btn btn--primary btn--lg" onClick={comecar}>
                {progresso.concluido ? "Revisar curso" : data.matriculado && progresso.feitas ? "Continuar de onde parei" : "Começar curso"}
              </button>
            ) : <Badge tone="warn"><Lock size={11} /> Conclua primeiro: {c.cursoRequisito?.titulo}</Badge>}
            {data.certificado && <Link className="btn btn--outline btn--lg" to="/cursos/certificados"><Award size={16} /> Ver certificado</Link>}
            <button type="button" className="btn btn--ghost" aria-pressed={data.favorito} onClick={() => fav.mutate(!data.favorito)}><Heart size={16} fill={data.favorito ? "currentColor" : "none"} /> {data.favorito ? "Favorito" : "Salvar para depois"}</button>
          </div>
          {erroAcao && <p className="erro-inline" role="alert">{erroAcao}</p>}
        </div>
      </section>

      <div className="curso-colunas">
        <div className="curso-principal">
          {c.descricao && <section><h2>Sobre este curso</h2>{linhas(c.descricao).map((p, i) => <p key={i}>{p}</p>)}</section>}
          {c.objetivos && <section><h2><Target size={18} /> O que você vai aprender</h2><ul className="lista-check">{linhas(c.objetivos).map((p, i) => <li key={i}><CheckCircle2 size={16} />{p}</li>)}</ul></section>}
          {c.prerequisitos && <section><h2>Pré-requisitos</h2><ul className="lista-simples">{linhas(c.prerequisitos).map((p, i) => <li key={i}>{p}</li>)}</ul></section>}
          <section>
            <h2>Conteúdo do curso</h2>
            <div className="curriculo">
              {modulos.map((m, i) => {
                const aberto = abertos.has(m.id) || (abertos.size === 0 && i === 0);
                const feitas = m.aulas.filter((a) => a.estado === "concluida").length;
                return (
                  <div key={m.id} className={clsx("modulo", aberto && "aberto")}>
                    <button type="button" className="modulo-topo" aria-expanded={aberto} onClick={() => { if (abertos.size === 0 && i === 0) setAbertos(new Set([m.id])); toggle(m.id); }}>
                      <ChevronDown size={16} /><strong>{m.titulo}</strong><small>{feitas}/{m.aulas.length} aulas</small>
                    </button>
                    {aberto && (
                      <ul>
                        {m.aulas.map((a) => (
                          <li key={a.id}>
                            <button type="button" disabled={a.estado === "bloqueada" && !data.previa} onClick={() => navigate(`/cursos/aula/${a.id}`)}>
                              <IconeEstado estado={a.estado} tipo={a.tipo} /><span>{a.titulo}</span>
                              {a.tipo === "prova" && <Badge tone="info">Avaliação</Badge>}
                              {a.duracaoMin > 0 && <small>{formatarDuracao(a.duracaoMin)}</small>}
                            </button>
                          </li>
                        ))}
                        {!m.aulas.length && <li className="mudo">Nenhuma aula neste módulo.</li>}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="curso-lateral">
          <div className="caixa"><h3>Avaliações e certificado</h3>
            <p>{modulos.some((m) => m.aulas.some((a) => a.tipo === "prova")) ? `Este curso tem avaliações. Média final mínima: ${c.notaFinalMinima}.` : "Este curso não tem avaliações."}</p>
            <p>{c.emiteCertificado ? "O certificado é emitido automaticamente ao concluir todas as etapas." : "Este curso não emite certificado."}</p>
          </div>
          {progresso.concluido && (
            <div className="caixa"><h3>Como foi o curso?</h3>
              <div className="estrelas" role="radiogroup" aria-label="Sua avaliação">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={data.feedback?.nota === n} className={clsx((data.feedback?.nota ?? 0) >= n && "on")} onClick={() => nota.mutate({ nota: n, comentario })}><Star size={20} fill={(data.feedback?.nota ?? 0) >= n ? "currentColor" : "none"} /></button>)}
              </div>
              <textarea rows={3} placeholder="Sugestões de melhoria (opcional)" defaultValue={data.feedback?.comentario ?? ""} onChange={(e) => setComentario(e.target.value)} onBlur={() => data.feedback && nota.mutate({ nota: data.feedback.nota, comentario })} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
