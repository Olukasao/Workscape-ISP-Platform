import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Lock, NotebookPen, PanelLeftClose, PanelLeftOpen, Pencil } from "lucide-react";
import { clsx } from "clsx";
import { Badge, EmptyState, Skeleton } from "../../components/ui/primitives";
import { cursosApi, errorMessage, formatarDuracao, useCursosQuery, type AulaConteudo, type CursoDetalhe } from "./api";
import { Blocos } from "./Blocos";
import { IconeEstado } from "./CursoPagina";
import { Progresso } from "./componentes";
import ProvaAluno from "./ProvaAluno";
import TutorIA from "./TutorIA";

export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const aula = useCursosQuery<AulaConteudo>(["aula", id], `/aula/${id}`, undefined, { staleTime: 0 });
  const cursoId = aula.data?.aula.cursoId;
  const curso = useCursosQuery<CursoDetalhe>(["curso", String(cursoId)], `/curso/${cursoId}`, undefined, { enabled: !!cursoId, staleTime: 0 });
  const [lateral, setLateral] = useState(() => { try { return localStorage.getItem("cursos:lateral") !== "0"; } catch { return true; } });
  const [nota, setNota] = useState<string | null>(null);
  const [notaAberta, setNotaAberta] = useState(false);
  const [salvo, setSalvo] = useState(true);
  const [erro, setErro] = useState("");
  const [concluindo, setConcluindo] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const aulaId = aula.data?.aula.id;
  const concluida = aula.data?.progresso.concluida;

  useEffect(() => { try { localStorage.setItem("cursos:lateral", lateral ? "1" : "0"); } catch { /* ignore */ } }, [lateral]);
  useEffect(() => { setNota(null); setNotaAberta(false); setErro(""); }, [id]);

  // Retoma a posição de leitura salva no servidor.
  useEffect(() => {
    if (aula.data && area.current) area.current.scrollTop = aula.data.progresso.posicao || 0;
  }, [aula.data?.aula.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // O progresso é gravado no servidor a cada 20 s com a aula aberta (e ao sair), nunca só neste computador.
  const posicaoRef = useRef(0);
  const enviarProgresso = useCallback((segundos: number) => {
    if (!aulaId || aula.data?.previa) return;
    void cursosApi.post(`/aula/${aulaId}/progresso`, { segundos, posicao: Math.round(posicaoRef.current) }).catch(() => undefined);
  }, [aulaId, aula.data?.previa]);
  useEffect(() => {
    if (!aulaId) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") enviarProgresso(20); }, 20000);
    return () => { clearInterval(t); enviarProgresso(0); };
  }, [aulaId, enviarProgresso]);

  // Anotação pessoal: salva sozinha após uma pausa na digitação.
  const textoNota = nota ?? aula.data?.anotacao ?? "";
  useEffect(() => {
    if (nota === null || !aulaId) return;
    setSalvo(false);
    const t = setTimeout(() => { cursosApi.put(`/aula/${aulaId}/anotacao`, { texto: nota }).then(() => setSalvo(true)).catch((e) => setErro(errorMessage(e))); }, 900);
    return () => clearTimeout(t);
  }, [nota, aulaId]);

  const atualizar = () => { void qc.invalidateQueries({ queryKey: ["cursos"] }); };
  const concluir = async (ir: boolean) => {
    if (!aulaId) return;
    setConcluindo(true); setErro("");
    try {
      const r = await cursosApi.post<{ concluido?: boolean; certificado?: string | null }>(`/aula/${aulaId}/concluir`);
      atualizar();
      if (r.certificado && r.concluido) { navigate("/cursos/certificados"); return; }
      if (ir && aula.data?.proxima) navigate(`/cursos/aula/${aula.data.proxima}`);
    } catch (e) { setErro(errorMessage(e)); } finally { setConcluindo(false); }
  };

  if (aula.isLoading) return <div className="player"><Skeleton lines={8} /></div>;
  if (aula.error || !aula.data) {
    const msg = errorMessage(aula.error);
    return <EmptyState icon={Lock} title="Esta aula não está disponível">{msg}<br /><Link to="/cursos">Voltar aos Cursos</Link></EmptyState>;
  }
  const a = aula.data;
  const mods = curso.data?.modulos ?? [];
  return (
    <div className={clsx("player", !lateral && "sem-lateral")}>
      <div className="player-topo">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(`/cursos/curso/${a.aula.cursoId}`)}><ArrowLeft size={15} /> {curso.data?.curso.titulo ?? "Curso"}</button>
        {curso.data && <div className="player-prog"><Progresso valor={curso.data.progresso.percentual} /><span>{curso.data.progresso.percentual}%</span></div>}
        {a.previa && <Badge tone="warn">Prévia</Badge>}
        <button type="button" className="btn btn--outline btn--sm" aria-pressed={lateral} onClick={() => setLateral((v) => !v)}>{lateral ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />} Conteúdo</button>
      </div>
      <div className="player-corpo">
        {lateral && (
          <nav className="player-lateral" aria-label="Estrutura do curso">
            {mods.map((m) => (
              <div key={m.id} className="pl-modulo">
                <h3>{m.titulo}</h3>
                <ul>
                  {m.aulas.map((x) => (
                    <li key={x.id}>
                      <button type="button" className={clsx(x.id === a.aula.id && "atual")} disabled={x.estado === "bloqueada" && !a.previa} onClick={() => navigate(`/cursos/aula/${x.id}`)}>
                        <IconeEstado estado={x.estado} tipo={x.tipo} /><span>{x.titulo}</span>{x.duracaoMin > 0 && <small>{formatarDuracao(x.duracaoMin)}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
        <div className="player-conteudo" ref={area} onScroll={(e) => { posicaoRef.current = e.currentTarget.scrollTop; }}>
          <div className="aula-miolo">
            <header className="aula-cab">
              <h1>{a.aula.titulo}</h1>
              {concluida && <Badge tone="ok"><Check size={11} /> Concluída</Badge>}
            </header>
            {a.aula.tipo === "prova" ? <ProvaAluno aulaId={a.aula.id} previa={a.previa} onMudou={atualizar} proxima={a.proxima} /> : (
              <>
                {a.blocos.length ? <Blocos blocos={a.blocos} arquivos={a.arquivos} aulaId={a.aula.id} /> : <p className="mudo">Esta aula ainda não tem conteúdo.</p>}
                {a.blocos.length > 0 && !a.previa ? <TutorIA key={a.aula.id} aulaId={a.aula.id} /> : null}
                <section className="aula-notas">
                  <button type="button" className="btn btn--outline btn--sm" aria-expanded={notaAberta} onClick={() => setNotaAberta((v) => !v)}><NotebookPen size={15} /> Minhas anotações {textoNota && <Pencil size={12} />}</button>
                  {notaAberta && (
                    <div>
                      <textarea rows={5} value={textoNota} maxLength={20000} placeholder="Escreva aqui. Só você vê estas anotações." onChange={(e) => setNota(e.target.value)} />
                      <small>{salvo ? "Salvo" : "Salvando…"}</small>
                    </div>
                  )}
                </section>
              </>
            )}
            {erro && <p className="erro-inline" role="alert">{erro}</p>}
          </div>
          <footer className="aula-rodape">
            <button type="button" className="btn btn--outline" disabled={!a.anterior} onClick={() => a.anterior && navigate(`/cursos/aula/${a.anterior}`)}><ChevronLeft size={16} /> Anterior</button>
            <span className="grow" />
            {a.aula.tipo === "conteudo" && (concluida ? (
              <button type="button" className="btn btn--primary" disabled={!a.proxima} onClick={() => a.proxima && navigate(`/cursos/aula/${a.proxima}`)}>Próxima aula <ChevronRight size={16} /></button>
            ) : (
              <button type="button" className="btn btn--primary" disabled={concluindo} onClick={() => concluir(true)}><Check size={16} /> {a.proxima ? "Concluir e continuar" : "Concluir aula"} <ArrowRight size={16} /></button>
            ))}
            {a.aula.tipo === "prova" && a.proxima && concluida && <button type="button" className="btn btn--primary" onClick={() => navigate(`/cursos/aula/${a.proxima}`)}>Próxima aula <ChevronRight size={16} /></button>}
          </footer>
        </div>
      </div>
    </div>
  );
}
