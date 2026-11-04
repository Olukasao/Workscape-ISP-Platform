import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Award, CalendarClock, CheckCircle2, Clock, Flame, GraduationCap, Medal, Sparkles, Trophy } from "lucide-react";
import { EmptyState, Panel, Skeleton } from "../../components/ui/primitives";
import { useSession } from "../../stores/workspace";
import { useCursosQuery, useCursosMutation, cursosApi, formatarData, type CursoResumo, type Painel } from "./api";
import { CartaoCurso, CartoesSkeleton, Capa, Progresso } from "./componentes";

export const saudacao = (h = new Date().getHours()) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");

export function useFavorito() {
  return useCursosMutation((c: CursoResumo) => cursosApi.put(`/curso/${c.id}/favorito`, { favorito: !c.favorito }));
}

function Secao({ titulo, itens, vazio }: { titulo: string; itens: CursoResumo[]; vazio?: string }) {
  const fav = useFavorito();
  if (!itens.length && !vazio) return null;
  return (
    <section className="cursos-secao" aria-label={titulo}>
      <h2>{titulo}</h2>
      {itens.length ? <div className="curso-grade">{itens.map((c) => <CartaoCurso key={c.id} c={c} onFavorito={(x) => fav.mutate(x)} />)}</div> : <p className="mudo">{vazio}</p>}
    </section>
  );
}

export default function CursosHome() {
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const { data, isLoading, error } = useCursosQuery<Painel>(["painel"], "/painel");
  const primeiro = (data?.usuario.nome || user?.nome || "").split(" ")[0];
  if (error) return <EmptyState icon={GraduationCap} title="Não foi possível abrir os Cursos">Verifique a conexão com o servidor e tente novamente.</EmptyState>;
  const d = data?.destaque;
  const e = data?.estatisticas;
  return (
    <div className="cursos-home">
      <header className="cursos-saudacao">
        <h1>{saudacao()}, {primeiro || "colega"}!</h1>
        <p>Continue evoluindo. Seu próximo conhecimento está a um clique.</p>
      </header>

      {isLoading ? <Skeleton className="cursos-destaque-skel" lines={3} /> : d ? (
        <section className="cursos-destaque" aria-label="Continuar de onde parei">
          <Capa capa={d.capa} titulo={d.titulo} className="destaque-capa" />
          <div className="destaque-corpo">
            <span className="selo">Continue de onde parou</span>
            <h2>{d.titulo}</h2>
            <p>Você já concluiu <strong>{d.progresso}% deste curso</strong>.</p>
            <Progresso valor={d.progresso} className="grande" />
            <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate(d.ultimaAulaId ? `/cursos/aula/${d.ultimaAulaId}` : `/cursos/curso/${d.id}`)}>
              Continuar de onde parei <ArrowRight size={18} />
            </button>
          </div>
        </section>
      ) : (
        <section className="cursos-destaque vazio">
          <div className="destaque-corpo">
            <span className="selo">Comece agora</span>
            <h2>Escolha seu primeiro curso</h2>
            <p>Explore o catálogo e comece a aprender no seu ritmo.</p>
            <Link className="btn btn--primary btn--lg" to="/cursos/catalogo">Ver catálogo <ArrowRight size={18} /></Link>
          </div>
        </section>
      )}

      <div className="cursos-metricas" aria-label="Seu desempenho">
        <div><span className="ic"><Sparkles size={17} /></span><b>{e ? `${e.progressoGeral}%` : "—"}</b><small>Meu progresso</small></div>
        <div><span className="ic"><Clock size={17} /></span><b>{e ? `${e.horas} h` : "—"}</b><small>Horas de aprendizado</small></div>
        <div><span className="ic"><CheckCircle2 size={17} /></span><b>{e?.cursosConcluidos ?? "—"}</b><small>Cursos concluídos</small></div>
        <div><span className="ic"><Award size={17} /></span><b>{e?.certificados ?? "—"}</b><small>Certificados</small></div>
        <div><span className="ic"><Flame size={17} /></span><b>{e ? `${e.sequencia} ${e.sequencia === 1 ? "dia" : "dias"}` : "—"}</b><small>Sequência de estudos</small></div>
        <div><span className="ic"><Trophy size={17} /></span><b>{e?.pontos ?? "—"}</b><small>Pontos</small></div>
      </div>

      <div className="cursos-duas">
        <Panel title="Próximas atividades" icon={CalendarClock}>
          {data?.proximas.length ? (
            <ul className="atividades">
              {data.proximas.map((a, i) => (
                <li key={i}>
                  <Link to={`/cursos/curso/${a.cursoId}`}>
                    <strong>{a.titulo}</strong>
                    <small>{a.tipo === "prazo" ? `Prazo: ${formatarData(a.prazoEm)}${a.obrigatorio ? " · obrigatório" : ""}` : "Aguardando correção"}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mudo">Nenhum prazo ou avaliação pendente. Aproveite para explorar o catálogo.</p>}
        </Panel>
        <Panel title="Conquistas" icon={Medal}>
          {data?.conquistas.length ? (
            <ul className="conquistas">{data.conquistas.map((c) => <li key={c.id}><Medal size={18} /><span><strong>{c.titulo}</strong><small>{c.descricao}</small></span></li>)}</ul>
          ) : <p className="mudo">Conclua seu primeiro curso para ganhar a medalha “Primeiros Passos”.</p>}
        </Panel>
      </div>

      {isLoading ? <CartoesSkeleton /> : (
        <>
          <Secao titulo="Continue estudando" itens={data?.continuar ?? []} />
          <Secao titulo="Recomendados para você" itens={data?.recomendados ?? []} />
          <Secao titulo="Novos cursos" itens={data?.novos ?? []} />
          <Secao titulo="Mais acessados" itens={data?.maisAcessados ?? []} />
          {!data?.novos.length && <EmptyState icon={GraduationCap} title="Ainda não há cursos publicados">Quando a equipe publicar treinamentos, eles aparecerão aqui.</EmptyState>}
        </>
      )}
    </div>
  );
}
