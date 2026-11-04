import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Eye, FileText, GripVertical, ImagePlus, Plus, Trash2, UserMinus } from "lucide-react";
import { clsx } from "clsx";
import { Badge, EmptyState, Panel, Skeleton } from "../../../components/ui/primitives";
import { cursosApi, errorMessage, formatarData, urlDoServidor, useCursosMutation, useCursosQuery } from "../api";
import { Capa } from "../componentes";
import { Campo, mover, useConfirmar, type DadosBase } from "./comum";

interface AulaEd { id: number; modulo_id: number; titulo: string; tipo: "conteudo" | "prova"; duracao_min: number; exige_anterior: number; versao: number }
interface Detalhe {
  curso: { id: number; titulo: string; descricao: string | null; objetivos: string | null; prerequisitos: string | null; instrutor: string | null; instrutorUrl: string | null; nivel: string; categoriaId: number | null; cargaHorariaMin: number; status: string; obrigatorio: boolean; prazoDias: number | null; emiteCertificado: boolean; notaFinalMinima: number; cursoRequisitoId: number | null; capaArquivoId: number | null; capa: string | null };
  modulos: { id: number; titulo: string; ordem: number; aulas: AulaEd[] }[];
  atribuicoes: { tipo: "todos" | "setor" | "usuario"; alvo_id: number; obrigatorio: number; prazo_em: string | null }[];
  outrosCursos: { id: number; titulo: string }[];
}

function Informacoes({ d, base }: { d: Detalhe; base?: DadosBase }) {
  const [f, setF] = useState(d.curso);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => setF(d.curso), [d.curso]);
  const salvar = useCursosMutation(() => cursosApi.put(`/admin/cursos/${d.curso.id}`, f), [["cursos", "admin"], ["cursos", "curso"]], () => setMsg({ ok: true, t: "Informações salvas." }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setMsg(null); };
  const enviarCapa = async (file?: File) => {
    if (!file) return;
    setEnviando(true);
    try { const a = await cursosApi.upload(file, d.curso.id); setF((x) => ({ ...x, capaArquivoId: a.id, capa: a.url })); setMsg(null); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } finally { setEnviando(false); }
  };
  return (
    <form className="form-curso" onSubmit={(e) => { e.preventDefault(); salvar.mutate(undefined, { onError: (er) => setMsg({ ok: false, t: errorMessage(er) }) }); }}>
      <div className="form-capa">
        <Capa capa={f.capa} titulo={f.titulo || "Curso"} className="banner-capa" />
        <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void enviarCapa(e.target.files?.[0])} />
        <button type="button" className="btn btn--outline btn--sm" disabled={enviando} onClick={() => entrada.current?.click()}><ImagePlus size={15} /> {enviando ? "Enviando…" : "Trocar capa"}</button>
      </div>
      <div className="form-grade">
        <Campo rotulo="Título"><input required maxLength={200} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></Campo>
        <Campo rotulo="Responsável / instrutor"><input maxLength={160} value={f.instrutor ?? ""} onChange={(e) => set("instrutor", e.target.value)} /></Campo>
        <Campo rotulo="Link do responsável" dica="Ex.: perfil do GitHub. O nome acima vira clicável para este link."><input type="url" maxLength={300} placeholder="https://github.com/usuario" value={f.instrutorUrl ?? ""} onChange={(e) => set("instrutorUrl", e.target.value)} /></Campo>
        <Campo rotulo="Categoria"><select value={f.categoriaId ?? ""} onChange={(e) => set("categoriaId", e.target.value ? Number(e.target.value) : null)}><option value="">Sem categoria</option>{base?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo rotulo="Nível"><select value={f.nivel} onChange={(e) => set("nivel", e.target.value)}><option value="basico">Básico</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></Campo>
        <Campo rotulo="Carga horária (minutos)" dica="Aparece no certificado."><input type="number" min={0} value={f.cargaHorariaMin} onChange={(e) => set("cargaHorariaMin", Number(e.target.value))} /></Campo>
        <Campo rotulo="Prazo para concluir (dias)" dica="Conta a partir da matrícula. Vazio = sem prazo."><input type="number" min={0} value={f.prazoDias ?? ""} onChange={(e) => set("prazoDias", e.target.value ? Number(e.target.value) : null)} /></Campo>
        <Campo rotulo="Curso pré-requisito" dica="O aluno só começa depois de concluir este."><select value={f.cursoRequisitoId ?? ""} onChange={(e) => set("cursoRequisitoId", e.target.value ? Number(e.target.value) : null)}><option value="">Nenhum</option>{d.outrosCursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></Campo>
        <Campo rotulo="Média mínima nas avaliações" dica="Para concluir e emitir o certificado."><input type="number" min={0} max={100} value={f.notaFinalMinima} onChange={(e) => set("notaFinalMinima", Number(e.target.value))} /></Campo>
      </div>
      <Campo rotulo="Descrição"><textarea rows={5} maxLength={10000} value={f.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} /></Campo>
      <Campo rotulo="Objetivos de aprendizagem" dica="Um por linha."><textarea rows={4} value={f.objetivos ?? ""} onChange={(e) => set("objetivos", e.target.value)} /></Campo>
      <Campo rotulo="Pré-requisitos" dica="Um por linha."><textarea rows={3} value={f.prerequisitos ?? ""} onChange={(e) => set("prerequisitos", e.target.value)} /></Campo>
      <div className="form-checks">
        <label><input type="checkbox" checked={f.obrigatorio} onChange={(e) => set("obrigatorio", e.target.checked)} /> Curso obrigatório para todos os matriculados</label>
        <label><input type="checkbox" checked={f.emiteCertificado} onChange={(e) => set("emiteCertificado", e.target.checked)} /> Emitir certificado ao concluir</label>
      </div>
      <div className="form-rodape">
        <button className="btn btn--primary" type="submit" disabled={salvar.isPending}>Salvar informações</button>
        {msg && <span className={msg.ok ? "ok-inline" : "erro-inline"} role="status">{msg.t}</span>}
      </div>
    </form>
  );
}

type Arrasto = { tipo: "modulo"; mi: number } | { tipo: "aula"; mi: number; ai: number } | null;

function Estrutura({ d }: { d: Detalhe }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mods, setMods] = useState(d.modulos);
  const [erro, setErro] = useState("");
  const arrasto = useRef<Arrasto>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const { pedir, dialogo } = useConfirmar();
  useEffect(() => setMods(d.modulos), [d.modulos]);
  const recarregar = () => qc.invalidateQueries({ queryKey: ["cursos", "admin", "curso"] });
  const falha = (e: unknown) => setErro(errorMessage(e));
  const persistirOrdem = (m: typeof mods) => { setMods(m); cursosApi.put(`/admin/cursos/${d.curso.id}/ordem`, { modulos: m.map((x) => ({ id: x.id, aulas: x.aulas.map((a) => a.id) })) }).then(recarregar).catch(falha); };
  const novoModulo = () => cursosApi.post(`/admin/cursos/${d.curso.id}/modulos`, { titulo: `Módulo ${mods.length + 1}` }).then(recarregar).catch(falha);
  const novaAula = (mid: number, tipo: "conteudo" | "prova") => cursosApi.post<{ id: number }>(`/admin/modulos/${mid}/aulas`, { tipo }).then((r) => navigate(`/cursos/admin/aula/${r.id}`)).catch(falha);
  const renomear = (mid: number, titulo: string) => cursosApi.put(`/admin/modulos/${mid}`, { titulo }).then(recarregar).catch(falha);
  const excluirModulo = (mid: number) => cursosApi.del(`/admin/modulos/${mid}`).then(recarregar).catch(falha);
  const excluirAula = (aid: number) => cursosApi.del(`/admin/aulas/${aid}`).then(recarregar).catch(falha);

  const soltar = (mi: number, ai: number | null) => {
    const a = arrasto.current; arrasto.current = null; setAlvo(null);
    if (!a) return;
    if (a.tipo === "modulo") { if (ai === null && a.mi !== mi) persistirOrdem(mover(mods, a.mi, mi)); return; }
    const copia = mods.map((m) => ({ ...m, aulas: [...m.aulas] }));
    const [aula] = copia[a.mi].aulas.splice(a.ai, 1);
    copia[mi].aulas.splice(ai ?? copia[mi].aulas.length, 0, aula);
    persistirOrdem(copia);
  };
  return (
    <div className="estrutura">
      {mods.map((m, mi) => (
        <section key={m.id} className={clsx("est-modulo", alvo === `m${mi}` && "alvo")}
          draggable onDragStart={(e) => { if ((e.target as HTMLElement).closest(".est-aula")) return; arrasto.current = { tipo: "modulo", mi }; }}
          onDragOver={(e) => { e.preventDefault(); setAlvo(`m${mi}`); }} onDragLeave={() => setAlvo(null)} onDrop={(e) => { e.preventDefault(); soltar(mi, null); }}>
          <header>
            <GripVertical size={16} className="alca" aria-hidden="true" />
            <input aria-label="Título do módulo" defaultValue={m.titulo} maxLength={200} onBlur={(e) => e.target.value !== m.titulo && e.target.value.trim() && renomear(m.id, e.target.value)} />
            <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir módulo" onClick={() => pedir("Excluir módulo", `“${m.titulo}” e as ${m.aulas.length} aula(s) dentro dele serão apagados.`, () => excluirModulo(m.id))}><Trash2 size={15} /></button>
          </header>
          <ul>
            {m.aulas.map((a, ai) => (
              <li key={a.id} className={clsx("est-aula", alvo === `a${mi}-${ai}` && "alvo")} draggable
                onDragStart={() => { arrasto.current = { tipo: "aula", mi, ai }; }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAlvo(`a${mi}-${ai}`); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); soltar(mi, ai); }}>
                <GripVertical size={15} className="alca" aria-hidden="true" />
                {a.tipo === "prova" ? <ClipboardCheck size={15} /> : <FileText size={15} />}
                <Link to={`/cursos/admin/aula/${a.id}`}>{a.titulo}</Link>
                {a.tipo === "prova" && <Badge tone="info">Avaliação</Badge>}
                {a.exige_anterior ? <small>exige a anterior</small> : null}
                <span className="grow" />
                <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir aula" onClick={() => pedir("Excluir aula", `“${a.titulo}” será apagada, junto com o progresso dos alunos nela.`, () => excluirAula(a.id))}><Trash2 size={14} /></button>
              </li>
            ))}
            {!m.aulas.length && <li className="mudo vazio-modulo">Arraste aulas para cá ou crie uma nova.</li>}
          </ul>
          <footer>
            <button className="btn btn--outline btn--sm" onClick={() => novaAula(m.id, "conteudo")}><Plus size={14} /> Aula</button>
            <button className="btn btn--outline btn--sm" onClick={() => novaAula(m.id, "prova")}><ClipboardCheck size={14} /> Avaliação</button>
          </footer>
        </section>
      ))}
      <button className="btn btn--soft" onClick={novoModulo}><Plus size={15} /> Novo módulo</button>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      {dialogo}
    </div>
  );
}

function Participantes({ d, base }: { d: Detalhe; base?: DadosBase }) {
  const [atrib, setAtrib] = useState(d.atribuicoes);
  const [novoTipo, setNovoTipo] = useState<"todos" | "setor" | "usuario">("setor");
  const [novoAlvo, setNovoAlvo] = useState(0);
  const [obrig, setObrig] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => setAtrib(d.atribuicoes), [d.atribuicoes]);
  const alunos = useCursosQuery<{ alunos: { usuario_id: number; nome: string; setor: string | null; obrigatorio: number; prazo_em: string | null; concluido_em: string | null; progresso: number; atrasado: boolean; melhor_nota: number | null }[] }>(["admin", "alunos-curso", d.curso.id], `/admin/cursos/${d.curso.id}/alunos`);
  const nomeAlvo = (t: string, id: number) => (t === "todos" ? "Todos os funcionários" : t === "setor" ? base?.setores.find((s) => s.id === id)?.nome ?? `Setor ${id}` : base?.usuarios.find((u) => u.id === id)?.nome ?? `Usuário ${id}`);
  const salvar = useCursosMutation(() => cursosApi.put(`/admin/cursos/${d.curso.id}/atribuicoes`, { atribuicoes: atrib.map((a) => ({ tipo: a.tipo, alvoId: a.alvo_id, obrigatorio: !!a.obrigatorio, prazoEm: a.prazo_em })) }), [["cursos", "admin"]], () => setMsg("Atribuições salvas."));
  const remover = useCursosMutation((uid: number) => cursosApi.del(`/admin/cursos/${d.curso.id}/matriculas/${uid}`), [["cursos", "admin", "alunos-curso"]]);
  const adicionar = () => {
    if (novoTipo !== "todos" && !novoAlvo) return;
    setAtrib((l) => [...l.filter((a) => !(a.tipo === novoTipo && a.alvo_id === (novoTipo === "todos" ? 0 : novoAlvo))), { tipo: novoTipo, alvo_id: novoTipo === "todos" ? 0 : novoAlvo, obrigatorio: obrig ? 1 : 0, prazo_em: prazo || null }]);
    setMsg("");
  };
  return (
    <div className="participantes">
      <Panel title="Quem recebe este curso">
        <p className="mudo">Os funcionários são matriculados automaticamente quando o curso está publicado. Qualquer pessoa pode estudar mesmo sem atribuição, a menos que o curso tenha pré-requisito.</p>
        <ul className="atribuicoes">
          {atrib.map((a, i) => (
            <li key={i}><strong>{nomeAlvo(a.tipo, a.alvo_id)}</strong>
              <small>{a.tipo === "setor" ? "Setor" : a.tipo === "usuario" ? "Pessoa" : "Todos"}{a.obrigatorio ? " · obrigatório" : ""}{a.prazo_em ? ` · prazo ${formatarData(a.prazo_em)}` : ""}</small>
              <button className="btn btn--ghost btn--icon-sm" aria-label="Remover atribuição" onClick={() => { setAtrib(atrib.filter((_, k) => k !== i)); setMsg(""); }}><Trash2 size={14} /></button></li>
          ))}
          {!atrib.length && <li className="mudo">Nenhuma atribuição. O curso fica livre no catálogo.</li>}
        </ul>
        <div className="atrib-nova">
          <select aria-label="Tipo" value={novoTipo} onChange={(e) => { setNovoTipo(e.target.value as typeof novoTipo); setNovoAlvo(0); }}><option value="setor">Por setor</option><option value="usuario">Pessoa</option><option value="todos">Todos</option></select>
          {novoTipo === "setor" && <select aria-label="Setor" value={novoAlvo} onChange={(e) => setNovoAlvo(Number(e.target.value))}><option value={0}>Escolha o setor</option>{base?.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>}
          {novoTipo === "usuario" && <select aria-label="Pessoa" value={novoAlvo} onChange={(e) => setNovoAlvo(Number(e.target.value))}><option value={0}>Escolha a pessoa</option>{base?.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.setor ? ` (${u.setor})` : ""}</option>)}</select>}
          <label className="campo-check"><input type="checkbox" checked={obrig} onChange={(e) => setObrig(e.target.checked)} /> Obrigatório</label>
          <input type="date" aria-label="Prazo" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          <button className="btn btn--outline btn--sm" onClick={adicionar}><Plus size={14} /> Adicionar</button>
        </div>
        <div className="form-rodape"><button className="btn btn--primary" disabled={salvar.isPending} onClick={() => salvar.mutate(undefined, { onError: (e) => setMsg(errorMessage(e)) })}>Salvar atribuições</button>{msg && <span className="ok-inline" role="status">{msg}</span>}</div>
      </Panel>
      <Panel title="Matriculados">
        {alunos.isLoading ? <Skeleton lines={3} /> : alunos.data?.alunos.length ? (
          <div className="tabela-admin" role="table">
            <div className="tr cab" role="row"><span>Funcionário</span><span>Progresso</span><span>Nota</span><span>Prazo</span><span>Situação</span><span /></div>
            {alunos.data.alunos.map((a) => (
              <div className="tr" role="row" key={a.usuario_id}>
                <span><strong>{a.nome}</strong><small>{a.setor ?? ""}</small></span><span>{a.progresso}%</span><span>{a.melhor_nota ?? "—"}</span><span>{a.prazo_em ? formatarData(a.prazo_em) : "—"}</span>
                <span>{a.concluido_em ? <Badge tone="ok">Concluído</Badge> : a.atrasado ? <Badge tone="crit">Atrasado</Badge> : <Badge tone="info">Em andamento</Badge>}</span>
                <span className="acoes"><button className="btn btn--ghost btn--icon-sm" aria-label="Remover matrícula" onClick={() => remover.mutate(a.usuario_id)}><UserMinus size={15} /></button></span>
              </div>
            ))}
          </div>
        ) : <p className="mudo">Ninguém matriculado ainda.</p>}
      </Panel>
    </div>
  );
}

export default function EditorCurso() {
  const { id } = useParams();
  const [aba, setAba] = useState<"info" | "estrutura" | "participantes">("estrutura");
  const detalhe = useCursosQuery<Detalhe>(["admin", "curso", id], `/admin/cursos/${id}`, undefined, { staleTime: 0 });
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base", undefined, { staleTime: 60000 });
  const [erro, setErro] = useState("");
  const situacao = useCursosMutation((status: string) => cursosApi.put(`/admin/cursos/${id}/status`, { status }), [["cursos", "admin"], ["cursos", "catalogo"], ["cursos", "painel"]]);
  const d = detalhe.data;
  const total = useMemo(() => d?.modulos.reduce((s, m) => s + m.aulas.length, 0) ?? 0, [d]);
  if (detalhe.isLoading) return <Skeleton lines={6} />;
  if (!d) return <EmptyState icon={FileText} title="Curso não encontrado"><Link to="/cursos/admin">Voltar</Link></EmptyState>;
  return (
    <div className="editor-curso">
      <div className="editor-topo">
        <Link to="/cursos/admin" className="voltar">← Cursos</Link>
        <h1>{d.curso.titulo}</h1>
        <Badge tone={d.curso.status === "publicado" ? "ok" : d.curso.status === "rascunho" ? "warn" : "neutral"}>{d.curso.status === "publicado" ? "Publicado" : d.curso.status === "rascunho" ? "Rascunho" : "Arquivado"}</Badge>
        <span className="grow" />
        <Link className="btn btn--outline" to={`/cursos/curso/${d.curso.id}`}><Eye size={15} /> Ver como aluno</Link>
        {d.curso.status === "publicado"
          ? <button className="btn btn--outline" onClick={() => situacao.mutate("rascunho", { onError: (e) => setErro(errorMessage(e)) })}>Despublicar</button>
          : <button className="btn btn--primary" onClick={() => situacao.mutate("publicado", { onError: (e) => setErro(errorMessage(e)) })}>Publicar</button>}
      </div>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      <nav className="abas" role="tablist">
        {([["estrutura", `Conteúdo (${total} aulas)`], ["info", "Informações"], ["participantes", "Participantes"]] as const).map(([k, r]) => <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? "on" : ""} onClick={() => setAba(k)}>{r}</button>)}
      </nav>
      {aba === "info" && <Informacoes d={d} base={base.data} />}
      {aba === "estrutura" && <Estrutura d={d} />}
      {aba === "participantes" && <Participantes d={d} base={base.data} />}
    </div>
  );
}
