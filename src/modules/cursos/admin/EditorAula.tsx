import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Copy, Eye, GripVertical, History, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { clsx } from "clsx";
import { Badge, EmptyState, Skeleton } from "../../../components/ui/primitives";
import { cursosApi, errorMessage, formatarData, type ArquivoInfo, type Bloco, useCursosQuery } from "../api";
import { Blocos } from "../Blocos";
import { Campo, mover, novoId, useConfirmar, type DadosBase } from "./comum";
import EditorProva, { type ProvaEd } from "./EditorProva";

interface Carga { aula: { id: number; cursoId: number; titulo: string; tipo: "conteudo" | "prova"; duracaoMin: number; exigeAnterior: boolean; versao: number }; blocos: Bloco[]; prova: ProvaEd | null; arquivos: Record<string, ArquivoInfo> }

const PALETA: { grupo: string; itens: [string, string][] }[] = [
  { grupo: "Texto", itens: [["paragrafo", "Parágrafo"], ["titulo", "Título"], ["lista", "Lista"], ["tabela", "Tabela"], ["citacao", "Citação"], ["destaque", "Destaque"]] },
  { grupo: "Mídia", itens: [["imagem", "Imagem"], ["galeria", "Galeria"], ["video", "Vídeo"], ["audio", "Áudio"], ["pdf", "PDF"], ["download", "Arquivo p/ download"]] },
  { grupo: "Técnico", itens: [["codigo", "Código"], ["terminal", "Terminal"], ["diagrama", "Fluxograma"], ["tabela_tecnica", "Tabela técnica"]] },
  { grupo: "Interativo", itens: [["quiz", "Quiz rápido"], ["pergunta", "Pergunta e resposta"], ["checklist", "Checklist"], ["exercicio", "Exercício prático"], ["resposta_texto", "Resposta em texto"]] },
];
const NOME = Object.fromEntries(PALETA.flatMap((g) => g.itens));

function novoBloco(tipo: string): Bloco {
  const id = novoId();
  switch (tipo) {
    case "paragrafo": case "citacao": return { id, tipo, texto: "" };
    case "destaque": return { id, tipo, texto: "", tom: "info" };
    case "titulo": return { id, tipo, texto: "", nivel: 2 };
    case "lista": return { id, tipo, ordenada: false, itens: [""] };
    case "tabela": case "tabela_tecnica": return { id, tipo, cabecalho: ["Coluna 1", "Coluna 2"], linhas: [["", ""]] };
    case "imagem": return { id, tipo, arquivoId: null, legenda: "", alt: "" };
    case "galeria": return { id, tipo, arquivos: [] };
    case "video": return { id, tipo, arquivoId: null, url: "", legenda: "" };
    case "audio": case "pdf": return { id, tipo, arquivoId: null, legenda: "" };
    case "download": return { id, tipo, arquivoId: null, rotulo: "" };
    case "codigo": return { id, tipo, linguagem: "bash", codigo: "", legenda: "" };
    case "terminal": return { id, tipo, comandos: [""] };
    case "diagrama": return { id, tipo, etapas: [{ texto: "Início", decisao: false }, { texto: "", decisao: false }] };
    case "quiz": { const a = novoId(), b = novoId(); return { id, tipo, enunciado: "", opcoes: [{ id: a, texto: "" }, { id: b, texto: "" }], correta: a, explicacao: "" }; }
    case "pergunta": return { id, tipo, enunciado: "", resposta: "" };
    case "checklist": return { id, tipo, itens: [""] };
    case "exercicio": return { id, tipo, titulo: "", instrucoes: "" };
    default: return { id, tipo: "resposta_texto", enunciado: "" };
  }
}

const ACEITA: Record<string, string> = { imagem: "image/png,image/jpeg,image/webp,image/gif", galeria: "image/png,image/jpeg,image/webp,image/gif", video: "video/mp4,video/webm", audio: "audio/mpeg,audio/ogg,audio/wav", pdf: "application/pdf", download: ".pdf,.docx,.xlsx,.pptx,.zip,.txt,.csv" };

function Upload1({ tipo, cursoId, onArquivo, rotulo }: { tipo: string; cursoId: number; onArquivo: (a: ArquivoInfo) => void; rotulo?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"" | "enviando" | string>("");
  return (
    <>
      <input ref={ref} type="file" hidden accept={ACEITA[tipo]} multiple={tipo === "galeria"} onChange={async (e) => {
        const arquivos = [...(e.target.files ?? [])]; e.target.value = "";
        for (const f of arquivos) {
          setEstado("enviando");
          try { onArquivo(await cursosApi.upload(f, cursoId)); setEstado(""); } catch (er) { setEstado(errorMessage(er)); break; }
        }
      }} />
      <button type="button" className="btn btn--outline btn--sm" disabled={estado === "enviando"} onClick={() => ref.current?.click()}><Upload size={14} /> {estado === "enviando" ? "Enviando…" : rotulo ?? "Enviar arquivo"}</button>
      {estado && estado !== "enviando" && <span className="erro-inline" role="alert">{estado}</span>}
    </>
  );
}

function Lista({ itens, onChange, rotulo }: { itens: string[]; onChange: (i: string[]) => void; rotulo: string }) {
  return (
    <div className="ed-opcoes">
      {itens.map((t, i) => (
        <div className="linha" key={i}>
          <input value={t} placeholder={`${rotulo} ${i + 1}`} onChange={(e) => onChange(itens.map((x, k) => (k === i ? e.target.value : x)))} />
          <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover" disabled={itens.length <= 1} onClick={() => onChange(itens.filter((_, k) => k !== i))}><X size={14} /></button>
        </div>
      ))}
      <button type="button" className="btn btn--outline btn--sm" onClick={() => onChange([...itens, ""])}><Plus size={14} /> Adicionar</button>
    </div>
  );
}

function Tabela({ b, set }: { b: Bloco; set: (b: Bloco) => void }) {
  const cab: string[] = b.cabecalho; const linhas: string[][] = b.linhas;
  return (
    <div className="ed-tabela">
      <table>
        <thead><tr>{cab.map((c, i) => <th key={i}><input value={c} aria-label={`Título da coluna ${i + 1}`} onChange={(e) => set({ ...b, cabecalho: cab.map((x, k) => (k === i ? e.target.value : x)) })} /></th>)}<th /></tr></thead>
        <tbody>{linhas.map((l, r) => (
          <tr key={r}>{cab.map((_, c) => <td key={c}><input value={l[c] ?? ""} aria-label={`Linha ${r + 1}, coluna ${c + 1}`} onChange={(e) => set({ ...b, linhas: linhas.map((x, k) => (k === r ? cab.map((__, j) => (j === c ? e.target.value : x[j] ?? "")) : x)) })} /></td>)}
            <td><button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover linha" onClick={() => set({ ...b, linhas: linhas.filter((_, k) => k !== r) })}><X size={13} /></button></td></tr>
        ))}</tbody>
      </table>
      <div className="linha-acoes">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...b, linhas: [...linhas, cab.map(() => "")] })}><Plus size={14} /> Linha</button>
        <button type="button" className="btn btn--outline btn--sm" disabled={cab.length >= 12} onClick={() => set({ ...b, cabecalho: [...cab, `Coluna ${cab.length + 1}`], linhas: linhas.map((l) => [...l, ""]) })}><Plus size={14} /> Coluna</button>
        <button type="button" className="btn btn--outline btn--sm" disabled={cab.length <= 1} onClick={() => set({ ...b, cabecalho: cab.slice(0, -1), linhas: linhas.map((l) => l.slice(0, -1)) })}>− Coluna</button>
      </div>
    </div>
  );
}

function EditorBloco({ b, set, cursoId, arquivos, addArquivo, linguagens }: { b: Bloco; set: (b: Bloco) => void; cursoId: number; arquivos: Record<string, ArquivoInfo>; addArquivo: (a: ArquivoInfo) => void; linguagens: string[] }) {
  const arq = b.arquivoId ? arquivos[String(b.arquivoId)] : undefined;
  const so = (a: ArquivoInfo, campos: Record<string, unknown>) => { addArquivo(a); set({ ...b, ...campos }); };
  switch (b.tipo) {
    case "paragrafo": case "citacao":
      return <><textarea rows={4} value={b.texto} maxLength={5000} placeholder={b.tipo === "citacao" ? "Citação" : "Escreva o texto. Use **negrito**, *itálico*, __sublinhado__, `código` e [texto](https://link)."} onChange={(e) => set({ ...b, texto: e.target.value })} /></>;
    case "destaque":
      return <><select aria-label="Tipo de destaque" value={b.tom} onChange={(e) => set({ ...b, tom: e.target.value })}><option value="info">Informação</option><option value="aviso">Atenção</option><option value="ok">Boa prática</option><option value="perigo">Perigo</option></select><textarea rows={3} value={b.texto} placeholder="Texto do destaque" onChange={(e) => set({ ...b, texto: e.target.value })} /></>;
    case "titulo":
      return <div className="linha"><select aria-label="Nível" value={b.nivel} onChange={(e) => set({ ...b, nivel: Number(e.target.value) })}><option value={1}>Título 1</option><option value={2}>Título 2</option><option value={3}>Título 3</option></select><input value={b.texto} maxLength={300} placeholder="Texto do título" onChange={(e) => set({ ...b, texto: e.target.value })} /></div>;
    case "lista": return <><label className="campo-check"><input type="checkbox" checked={b.ordenada} onChange={(e) => set({ ...b, ordenada: e.target.checked })} /> Lista numerada</label><Lista itens={b.itens} rotulo="Item" onChange={(itens) => set({ ...b, itens })} /></>;
    case "tabela": case "tabela_tecnica": return <Tabela b={b} set={set} />;
    case "checklist": return <Lista itens={b.itens} rotulo="Tarefa" onChange={(itens) => set({ ...b, itens })} />;
    case "terminal": return <Lista itens={b.comandos} rotulo="Comando" onChange={(comandos) => set({ ...b, comandos })} />;
    case "codigo":
      return <><div className="linha"><select aria-label="Linguagem" value={b.linguagem} onChange={(e) => set({ ...b, linguagem: e.target.value })}>{linguagens.map((l) => <option key={l} value={l}>{l}</option>)}</select><input value={b.legenda} placeholder="Legenda (opcional)" onChange={(e) => set({ ...b, legenda: e.target.value })} /></div><textarea className="mono" rows={8} spellCheck={false} value={b.codigo} onChange={(e) => set({ ...b, codigo: e.target.value })} /></>;
    case "diagrama":
      return (
        <div className="ed-opcoes">{(b.etapas as { texto: string; decisao: boolean }[]).map((et, i) => (
          <div className="linha" key={i}><b>{i + 1}.</b><input value={et.texto} placeholder="Etapa" onChange={(e) => set({ ...b, etapas: b.etapas.map((x: any, k: number) => (k === i ? { ...x, texto: e.target.value } : x)) })} />
            <label className="campo-check"><input type="checkbox" checked={et.decisao} onChange={(e) => set({ ...b, etapas: b.etapas.map((x: any, k: number) => (k === i ? { ...x, decisao: e.target.checked } : x)) })} /> Decisão</label>
            <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover etapa" disabled={b.etapas.length <= 2} onClick={() => set({ ...b, etapas: b.etapas.filter((_: unknown, k: number) => k !== i) })}><X size={14} /></button></div>
        ))}<button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...b, etapas: [...b.etapas, { texto: "", decisao: false }] })}><Plus size={14} /> Etapa</button></div>
      );
    case "imagem": case "audio": case "pdf":
      return <div className="ed-midia">{arq && <small>{arq.nome}</small>}<Upload1 tipo={b.tipo} cursoId={cursoId} rotulo={arq ? "Trocar arquivo" : "Enviar arquivo"} onArquivo={(a) => so(a, { arquivoId: a.id })} />
        <input value={b.legenda} placeholder="Legenda (opcional)" onChange={(e) => set({ ...b, legenda: e.target.value })} />{b.tipo === "imagem" && <input value={b.alt} placeholder="Descrição para leitores de tela" onChange={(e) => set({ ...b, alt: e.target.value })} />}</div>;
    case "download":
      return <div className="ed-midia">{arq && <small>{arq.nome}</small>}<Upload1 tipo="download" cursoId={cursoId} onArquivo={(a) => so(a, { arquivoId: a.id })} /><input value={b.rotulo} placeholder="Texto do botão (opcional)" onChange={(e) => set({ ...b, rotulo: e.target.value })} /></div>;
    case "galeria":
      return <div className="ed-galeria">{(b.arquivos as number[]).map((id) => <span key={id} className="mini">{arquivos[String(id)]?.nome ?? id}<button type="button" aria-label="Remover imagem" onClick={() => set({ ...b, arquivos: b.arquivos.filter((x: number) => x !== id) })}><X size={12} /></button></span>)}
        <Upload1 tipo="galeria" cursoId={cursoId} rotulo="Adicionar imagens" onArquivo={(a) => { addArquivo(a); set({ ...b, arquivos: [...b.arquivos, a.id] }); }} /></div>;
    case "video":
      return <div className="ed-midia"><input value={b.url ?? ""} placeholder="Link do YouTube ou Vimeo" onChange={(e) => set({ ...b, url: e.target.value, arquivoId: e.target.value ? null : b.arquivoId })} /><span className="mudo">ou</span>{arq && !b.url && <small>{arq.nome}</small>}
        <Upload1 tipo="video" cursoId={cursoId} rotulo="Enviar vídeo (MP4/WebM)" onArquivo={(a) => so(a, { arquivoId: a.id, url: "" })} /><input value={b.legenda} placeholder="Legenda (opcional)" onChange={(e) => set({ ...b, legenda: e.target.value })} /></div>;
    case "quiz":
      return (
        <><input value={b.enunciado} placeholder="Pergunta" onChange={(e) => set({ ...b, enunciado: e.target.value })} />
          <div className="ed-opcoes">{(b.opcoes as { id: string; texto: string }[]).map((o, i) => (
            <div className="linha" key={o.id}><input type="radio" name={`q-${b.id}`} checked={b.correta === o.id} onChange={() => set({ ...b, correta: o.id })} aria-label={`Alternativa ${i + 1} é a correta`} />
              <input value={o.texto} placeholder={`Alternativa ${i + 1}`} onChange={(e) => set({ ...b, opcoes: b.opcoes.map((x: any) => (x.id === o.id ? { ...x, texto: e.target.value } : x)) })} />
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover" disabled={b.opcoes.length <= 2} onClick={() => set({ ...b, opcoes: b.opcoes.filter((x: any) => x.id !== o.id), correta: b.correta === o.id ? b.opcoes.find((x: any) => x.id !== o.id)?.id : b.correta })}><X size={14} /></button></div>
          ))}<button type="button" className="btn btn--outline btn--sm" disabled={b.opcoes.length >= 8} onClick={() => set({ ...b, opcoes: [...b.opcoes, { id: novoId(), texto: "" }] })}><Plus size={14} /> Alternativa</button></div>
          <input value={b.explicacao} placeholder="Explicação mostrada após responder (opcional)" onChange={(e) => set({ ...b, explicacao: e.target.value })} /></>
      );
    case "pergunta": return <><input value={b.enunciado} placeholder="Pergunta" onChange={(e) => set({ ...b, enunciado: e.target.value })} /><textarea rows={2} value={b.resposta} placeholder="Resposta (o aluno clica para ver)" onChange={(e) => set({ ...b, resposta: e.target.value })} /></>;
    case "exercicio": return <><input value={b.titulo} placeholder="Título do exercício" onChange={(e) => set({ ...b, titulo: e.target.value })} /><textarea rows={4} value={b.instrucoes} placeholder="Instruções" onChange={(e) => set({ ...b, instrucoes: e.target.value })} /></>;
    case "resposta_texto": return <input value={b.enunciado} placeholder="Pergunta para o aluno responder por escrito" onChange={(e) => set({ ...b, enunciado: e.target.value })} />;
    default: return null;
  }
}

const vazio = (b: Bloco) => !JSON.stringify({ ...b, id: 0, tipo: 0, nivel: 0, tom: 0, ordenada: 0, linguagem: 0 }).replace(/["{}:,\[\]0]|null|false|true|texto|itens|legenda|alt/g, "").length;

export default function EditorAula() {
  const { id } = useParams();
  const { data, isLoading, error } = useCursosQuery<Carga>(["admin", "aula", id], `/admin/aulas/${id}`, undefined, { staleTime: Infinity });
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base", undefined, { staleTime: 60000 });
  const [titulo, setTitulo] = useState("");
  const [duracao, setDuracao] = useState(0);
  const [exige, setExige] = useState(false);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [prova, setProva] = useState<ProvaEd | null>(null);
  const [arquivos, setArquivos] = useState<Record<string, ArquivoInfo>>({});
  const [versao, setVersao] = useState(1);
  const [estado, setEstado] = useState<"salvo" | "pendente" | "salvando" | "erro">("salvo");
  const [msg, setMsg] = useState("");
  const [previa, setPrevia] = useState(false);
  const [paleta, setPaleta] = useState<number | null>(null);
  const [historico, setHistorico] = useState(false);
  const [alvo, setAlvo] = useState<number | null>(null);
  const arrasto = useRef<number | null>(null);
  const iniciado = useRef(false);
  const { pedir, dialogo } = useConfirmar();

  useEffect(() => {
    if (!data) return;
    setTitulo(data.aula.titulo); setDuracao(data.aula.duracaoMin); setExige(data.aula.exigeAnterior); setBlocos(data.blocos ?? []); setProva(data.prova); setArquivos(data.arquivos ?? {}); setVersao(data.aula.versao);
    iniciado.current = false; setEstado("salvo");
  }, [data]);

  const alterar = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setEstado("pendente"); iniciado.current = true; };
  const aulaId = Number(id);
  const salvar = useCallback(async () => {
    setEstado("salvando"); setMsg("");
    try {
      const r = await cursosApi.put<{ versao: number }>(`/admin/aulas/${aulaId}`, { versao, titulo, duracaoMin: duracao, exigeAnterior: exige, ...(data?.aula.tipo === "prova" ? { prova } : { blocos }) });
      setVersao(r.versao); setEstado("salvo");
    } catch (e) { setEstado("erro"); setMsg(errorMessage(e)); }
  }, [aulaId, versao, titulo, duracao, exige, blocos, prova, data?.aula.tipo]);
  // Salvamento automático 2 s depois da última alteração.
  const salvarRef = useRef(salvar); salvarRef.current = salvar;
  useEffect(() => {
    if (estado !== "pendente") return;
    const t = setTimeout(() => void salvarRef.current(), 2000);
    return () => clearTimeout(t);
  }, [estado, titulo, duracao, exige, blocos, prova]);
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (estado === "pendente" || estado === "erro") e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [estado]);

  const addArquivo = (a: ArquivoInfo) => setArquivos((m) => ({ ...m, [String(a.id)]: a }));
  const setBloco = (i: number, b: Bloco) => alterar(setBlocos)(blocos.map((x, k) => (k === i ? b : x)));
  const [gerando, setGerando] = useState(false);
  const gerarQuiz = async () => {
    setGerando(true); setMsg("");
    try {
      const r = await cursosApi.post<{ blocos: Bloco[] }>("/admin/ia/quiz", { titulo, blocos, quantidade: 4 });
      alterar(setBlocos)([...blocos, ...r.blocos]);
    } catch (e) { setMsg(errorMessage(e)); } finally { setGerando(false); }
  };
  const inserir = (tipo: string, em: number) => { alterar(setBlocos)([...blocos.slice(0, em), novoBloco(tipo), ...blocos.slice(em)]); setPaleta(null); };
  const soltar = (para: number) => { const de = arrasto.current; arrasto.current = null; setAlvo(null); if (de !== null && de !== para) alterar(setBlocos)(mover(blocos, de, para)); };

  if (isLoading) return <Skeleton lines={6} />;
  if (error || !data) return <EmptyState icon={Pencil} title="Aula não encontrada"><Link to="/cursos/admin">Voltar</Link></EmptyState>;
  const ehProva = data.aula.tipo === "prova";
  const Paleta = ({ em }: { em: number }) => (
    <div className="paleta" role="menu">
      {PALETA.map((g) => <div key={g.grupo}><h4>{g.grupo}</h4>{g.itens.map(([k, r]) => <button key={k} type="button" role="menuitem" onClick={() => inserir(k, em)}>{r}</button>)}</div>)}
    </div>
  );
  return (
    <div className="editor-aula">
      <div className="editor-topo">
        <Link to={`/cursos/admin/curso/${data.aula.cursoId}`} className="voltar">← Curso</Link>
        <input className="titulo-aula" aria-label="Título da aula" value={titulo} maxLength={200} onChange={(e) => alterar(setTitulo)(e.target.value)} />
        <Badge tone={estado === "salvo" ? "ok" : estado === "erro" ? "crit" : "warn"}>{estado === "salvo" ? <><Check size={11} /> Salvo</> : estado === "erro" ? "Erro ao salvar" : "Salvando…"}</Badge>
        {estado === "erro" && <button className="btn btn--outline btn--sm" onClick={() => void salvar()}>Tentar de novo</button>}
        <button className="btn btn--outline btn--sm" onClick={() => setHistorico(true)}><History size={14} /> Versões</button>
        {!ehProva && <button className="btn btn--outline btn--sm" aria-pressed={previa} onClick={() => setPrevia((v) => !v)}><Eye size={14} /> {previa ? "Voltar a editar" : "Pré-visualizar"}</button>}
        <Link className="btn btn--soft btn--sm" to={`/cursos/aula/${aulaId}`}>Ver como aluno</Link>
      </div>
      {msg && <p className="erro-inline" role="alert">{msg}</p>}
      <div className="editor-opcoes">
        <Campo rotulo="Duração estimada (min)"><input type="number" min={0} value={duracao} onChange={(e) => alterar(setDuracao)(Number(e.target.value))} /></Campo>
        {!ehProva && <button type="button" className="btn btn--soft btn--sm" disabled={gerando || blocos.length === 0} onClick={() => void gerarQuiz()} title="A IA cria 4 perguntas a partir do texto da aula. Revise antes de publicar."><Sparkles size={14} /> {gerando ? "Gerando perguntas…" : "Gerar perguntas com IA"}</button>}
        <label className="campo-check"><input type="checkbox" checked={exige} onChange={(e) => alterar(setExige)(e.target.checked)} /> Só libera depois de concluir a aula anterior</label>
      </div>
      {ehProva && prova ? <EditorProva prova={prova} onChange={alterar(setProva)} /> : previa ? (
        <div className="aula-miolo previa"><Blocos blocos={blocos} arquivos={arquivos} /></div>
      ) : (
        <div className="blocos-editor">
          {blocos.map((b, i) => (
            <div key={b.id}>
              <div className={clsx("bloco-ed", alvo === i && "alvo")} draggable onDragStart={(e) => { if (!(e.target as HTMLElement).classList.contains("bloco-ed")) { e.preventDefault(); return; } arrasto.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setAlvo(i); }} onDragLeave={() => setAlvo(null)} onDrop={(e) => { e.preventDefault(); soltar(i); }}>
                <header>
                  <GripVertical size={15} className="alca" aria-hidden="true" /><span className="tipo">{NOME[b.tipo] ?? b.tipo}</span><span className="grow" />
                  <button className="btn btn--ghost btn--icon-sm" aria-label="Subir bloco" disabled={i === 0} onClick={() => alterar(setBlocos)(mover(blocos, i, i - 1))}><ArrowUp size={14} /></button>
                  <button className="btn btn--ghost btn--icon-sm" aria-label="Descer bloco" disabled={i === blocos.length - 1} onClick={() => alterar(setBlocos)(mover(blocos, i, i + 1))}><ArrowDown size={14} /></button>
                  <button className="btn btn--ghost btn--icon-sm" aria-label="Duplicar bloco" onClick={() => alterar(setBlocos)([...blocos.slice(0, i + 1), { ...JSON.parse(JSON.stringify(b)), id: novoId() }, ...blocos.slice(i + 1)])}><Copy size={14} /></button>
                  <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir bloco" onClick={() => (vazio(b) ? alterar(setBlocos)(blocos.filter((x) => x.id !== b.id)) : pedir("Excluir bloco", `Excluir este bloco (${NOME[b.tipo]})?`, () => alterar(setBlocos)(blocos.filter((x) => x.id !== b.id))))}><Trash2 size={14} /></button>
                </header>
                <EditorBloco b={b} set={(n) => setBloco(i, n)} cursoId={data.aula.cursoId} arquivos={arquivos} addArquivo={addArquivo} linguagens={base.data?.linguagens ?? ["texto", "bash", "javascript", "python", "sql"]} />
              </div>
              <div className="inserir"><button type="button" aria-label="Inserir bloco aqui" aria-expanded={paleta === i + 1} onClick={() => setPaleta(paleta === i + 1 ? null : i + 1)}><Plus size={14} /></button></div>
              {paleta === i + 1 && <Paleta em={i + 1} />}
            </div>
          ))}
          {!blocos.length && <div className="mudo vazio-modulo">Esta aula está vazia. Adicione o primeiro bloco.</div>}
          <div className="novo-bloco">
            <button type="button" className="btn btn--primary" aria-expanded={paleta === (blocos.length ? -1 : 0)} onClick={() => setPaleta(paleta === (blocos.length ? -1 : 0) ? null : blocos.length ? -1 : 0)}><Plus size={15} /> Adicionar bloco</button>
          </div>
          {(paleta === -1 || (paleta === 0 && !blocos.length)) && <Paleta em={blocos.length} />}
        </div>
      )}
      {historico && <Versoes aulaId={aulaId} onFechar={() => setHistorico(false)} onRestaurado={() => { setHistorico(false); window.location.reload(); }} />}
      {dialogo}
    </div>
  );
}

function Versoes({ aulaId, onFechar, onRestaurado }: { aulaId: number; onFechar: () => void; onRestaurado: () => void }) {
  const { data, isLoading } = useCursosQuery<{ versoes: { id: number; versao: number; titulo: string; criado_em: string; autor: string | null }[] }>(["admin", "versoes", aulaId], `/admin/aulas/${aulaId}/versoes`, undefined, { staleTime: 0 });
  const [erro, setErro] = useState("");
  const { pedir, dialogo } = useConfirmar();
  return (
    <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Histórico de versões" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Versões anteriores</h3>
        {isLoading ? <Skeleton lines={3} /> : data?.versoes.length ? (
          <ul className="versoes">{data.versoes.map((v) => (
            <li key={v.id}><span><strong>Versão {v.versao}</strong><small>{formatarData(v.criado_em)} · {v.autor ?? "—"}</small></span>
              <button className="btn btn--outline btn--sm" onClick={() => pedir("Restaurar versão", `O conteúdo atual volta para a versão ${v.versao}. A versão atual fica guardada no histórico.`, () => cursosApi.post(`/admin/aulas/${aulaId}/restaurar/${v.id}`).then(onRestaurado).catch((e) => setErro(errorMessage(e))))}>Restaurar</button></li>
          ))}</ul>
        ) : <p className="mudo">Ainda não há versões anteriores. Elas são criadas a cada alteração salva.</p>}
        {erro && <p className="erro-inline">{erro}</p>}
        <div className="modal-acoes"><button className="btn btn--outline" onClick={onFechar}>Fechar</button></div>
        {dialogo}
      </div>
    </div>
  );
}
