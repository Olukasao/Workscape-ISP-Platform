import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Download, FileText, Info, AlertTriangle, CircleCheck, OctagonAlert, PlayCircle, TerminalSquare } from "lucide-react";
import { clsx } from "clsx";
import { cursosApi, errorMessage, urlDoServidor, type ArquivoInfo, type Bloco } from "./api";

/** Formatação inline mínima e segura: **negrito**, *itálico*, __sublinhado__, `código` e [texto](https://link). Nunca HTML. */
export function TextoRico({ texto }: { texto: string }) {
  const partes = useMemo(() => {
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
    return texto.split(re).filter((p) => p !== "");
  }, [texto]);
  return (
    <>
      {partes.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("__") && p.endsWith("__") && p.length > 4) return <u key={i}>{p.slice(2, -2)}</u>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p);
        if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
const Paragrafos = ({ texto }: { texto: string }) => (
  <>{texto.split(/\n{2,}/).map((p, i) => <p key={i}><TextoRico texto={p} /></p>)}</>
);

// Realce de sintaxe leve (sem dependências): comentários, textos, números e palavras-chave comuns.
const PALAVRAS = new Set("if else elif for while return function const let var class import from export def async await try catch except finally new null true false none in is not and or do then fi done echo sudo select where insert update delete create table interface router ip show configure enable".split(" "));
function realcar(codigo: string, linguagem: string): ReactNode[] {
  const comentario = ["bash", "powershell", "python", "yaml", "cisco"].includes(linguagem) ? "#.*|!.*" : linguagem === "sql" ? "--.*" : "//.*|/\\*[\\s\\S]*?\\*/";
  const re = new RegExp(`(${comentario})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Za-z_][\\w-]*\\b)`, "g");
  const saida: ReactNode[] = [];
  let ultimo = 0;
  for (const m of codigo.matchAll(re)) {
    if (m.index! > ultimo) saida.push(codigo.slice(ultimo, m.index));
    const [txt, com, str, num, pal] = m;
    if (com) saida.push(<span key={m.index} className="tk-com">{txt}</span>);
    else if (str) saida.push(<span key={m.index} className="tk-str">{txt}</span>);
    else if (num) saida.push(<span key={m.index} className="tk-num">{txt}</span>);
    else if (pal && PALAVRAS.has(pal.toLowerCase())) saida.push(<span key={m.index} className="tk-kw">{txt}</span>);
    else saida.push(txt);
    ultimo = m.index! + txt.length;
  }
  saida.push(codigo.slice(ultimo));
  return saida;
}
function Copiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="cb-copiar" onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1600); }); }}>
      {ok ? <Check size={14} /> : <Copy size={14} />}{ok ? "Copiado" : rotulo}
    </button>
  );
}

function Fluxo({ etapas }: { etapas: { texto: string; decisao: boolean }[] }) {
  return (
    <ol className="cb-fluxo">
      {etapas.map((e, i) => <li key={i} className={clsx(e.decisao && "decisao")}><span>{e.texto}</span></li>)}
    </ol>
  );
}

function Quiz({ bloco, aulaId }: { bloco: Bloco; aulaId?: number }) {
  const [escolha, setEscolha] = useState("");
  const [res, setRes] = useState<{ acertou: boolean; correta: string; explicacao: string } | null>(null);
  const [erro, setErro] = useState("");
  const conferir = async () => {
    if (!aulaId || !escolha) return;
    try { setRes(await cursosApi.post(`/aula/${aulaId}/quiz`, { blocoId: bloco.id, resposta: escolha })); setErro(""); } catch (e) { setErro(errorMessage(e)); }
  };
  return (
    <div className="cb-interativo">
      <strong>{bloco.enunciado}</strong>
      <div className="cb-opcoes">
        {(bloco.opcoes as { id: string; texto: string }[]).map((o) => (
          <label key={o.id} className={clsx("cb-opcao", res && o.id === res.correta && "certa", res && escolha === o.id && !res.acertou && "errada")}>
            <input type="radio" name={`q-${bloco.id}`} disabled={!!res} checked={escolha === o.id} onChange={() => setEscolha(o.id)} />{o.texto}
          </label>
        ))}
      </div>
      {!res && <button type="button" className="btn btn--soft btn--sm" disabled={!escolha || !aulaId} onClick={conferir}>Conferir</button>}
      {res && <p className={clsx("cb-retorno", res.acertou ? "ok" : "erro")}>{res.acertou ? "Correto!" : "Não foi dessa vez."} {res.explicacao}</p>}
      {erro && <p className="cb-retorno erro">{erro}</p>}
    </div>
  );
}

function Pergunta({ bloco }: { bloco: Bloco }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="cb-interativo">
      <strong>{bloco.enunciado}</strong>
      {ver ? <p className="cb-retorno ok">{bloco.resposta}</p> : <button type="button" className="btn btn--soft btn--sm" onClick={() => setVer(true)}>Mostrar resposta</button>}
    </div>
  );
}
function Checklist({ bloco, aulaId }: { bloco: Bloco; aulaId?: number }) {
  // Marcações do aluno ficam só neste aparelho: são apoio de estudo, não registro de progresso.
  const chave = `cursos:check:${aulaId ?? 0}:${bloco.id}`;
  const [marcados, setMarcados] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(chave) || "[]"); } catch { return []; } });
  const alternar = (i: number) => setMarcados((m) => {
    const n = m.includes(i) ? m.filter((x) => x !== i) : [...m, i];
    try { localStorage.setItem(chave, JSON.stringify(n)); } catch { /* sem armazenamento */ }
    return n;
  });
  return (
    <ul className="cb-checklist">
      {(bloco.itens as string[]).map((t, i) => (
        <li key={i}><label><input type="checkbox" checked={marcados.includes(i)} onChange={() => alternar(i)} /><span><TextoRico texto={t} /></span></label></li>
      ))}
    </ul>
  );
}
function RespostaTexto({ bloco, aulaId }: { bloco: Bloco; aulaId?: number }) {
  const chave = `cursos:resp:${aulaId ?? 0}:${bloco.id}`;
  const [v, setV] = useState(() => { try { return localStorage.getItem(chave) || ""; } catch { return ""; } });
  return (
    <div className="cb-interativo">
      <strong>{bloco.enunciado}</strong>
      <textarea rows={4} value={v} placeholder="Escreva sua resposta (fica salva neste computador, para você revisar)." onChange={(e) => { setV(e.target.value); try { localStorage.setItem(chave, e.target.value); } catch { /* ignore */ } }} />
    </div>
  );
}

const tamanho = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Mostra o conteúdo de uma aula. Os blocos já foram validados no servidor; aqui nada vira HTML. */
export function Blocos({ blocos, arquivos = {}, aulaId }: { blocos: Bloco[]; arquivos?: Record<string, ArquivoInfo>; aulaId?: number }) {
  const arq = (id?: number | null) => (id ? arquivos[String(id)] : undefined);
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <div className="blocos">
      {blocos.map((b) => {
        const a = arq(b.arquivoId);
        switch (b.tipo) {
          case "titulo": { const T = (`h${b.nivel}` as "h1" | "h2" | "h3"); return <T key={b.id} className={`cb-h${b.nivel}`}>{b.texto}</T>; }
          case "paragrafo": return <div key={b.id} className="cb-texto"><Paragrafos texto={b.texto} /></div>;
          case "citacao": return <blockquote key={b.id} className="cb-citacao"><Paragrafos texto={b.texto} /></blockquote>;
          case "destaque": {
            const Icone = { info: Info, aviso: AlertTriangle, ok: CircleCheck, perigo: OctagonAlert }[b.tom as string] ?? Info;
            return <aside key={b.id} className={clsx("cb-destaque", b.tom)}><Icone size={18} /><div><Paragrafos texto={b.texto} /></div></aside>;
          }
          case "lista": { const L = b.ordenada ? "ol" : "ul"; return <L key={b.id} className="cb-lista">{(b.itens as string[]).map((i, k) => <li key={k}><TextoRico texto={i} /></li>)}</L>; }
          case "tabela":
          case "tabela_tecnica":
            return (
              <div key={b.id} className={clsx("cb-tabela", b.tipo === "tabela_tecnica" && "tecnica")}>
                <table>
                  {b.cabecalho?.length ? <thead><tr>{(b.cabecalho as string[]).map((c, i) => <th key={i}>{c}</th>)}</tr></thead> : null}
                  <tbody>{(b.linhas as string[][]).map((l, i) => <tr key={i}>{l.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case "imagem":
            return a ? <figure key={b.id} className="cb-figura"><img src={urlDoServidor(a.url)} alt={b.alt || b.legenda || ""} loading="lazy" onClick={() => setZoom(a.url)} />{b.legenda && <figcaption>{b.legenda}</figcaption>}</figure> : null;
          case "galeria":
            return (
              <div key={b.id} className="cb-galeria">
                {(b.arquivos as number[]).map((id) => arq(id) && <img key={id} src={urlDoServidor(arq(id)!.url)} alt="" loading="lazy" onClick={() => setZoom(arq(id)!.url)} />)}
              </div>
            );
          case "video":
            return (
              <figure key={b.id} className="cb-video">
                {/* O CSP do app não permite páginas incorporadas (frame-src 'none'): vídeos de YouTube/Vimeo abrem na janela externa. */}
                {b.embed ? (
                  <a className="cb-download" href={b.embed.replace("youtube-nocookie.com/embed/", "youtube.com/watch?v=").replace("player.vimeo.com/video/", "vimeo.com/")} target="_blank" rel="noopener noreferrer">
                    <PlayCircle size={22} /><span><strong>{b.legenda || "Assistir ao vídeo"}</strong><small>Abre no navegador</small></span>
                  </a>
                ) : a ? <video src={urlDoServidor(a.url)} controls preload="metadata" /> : null}
                {b.legenda && <figcaption>{b.legenda}</figcaption>}
              </figure>
            );
          case "audio":
            return a ? <figure key={b.id} className="cb-audio"><audio src={urlDoServidor(a.url)} controls preload="metadata" />{b.legenda && <figcaption>{b.legenda}</figcaption>}</figure> : null;
          case "pdf":
            return a ? (
              <a key={b.id} className="cb-download" href={urlDoServidor(a.url)} target="_blank" rel="noopener noreferrer">
                <FileText size={20} /><span><strong>{b.legenda || a.nome}</strong><small>Documento PDF · {tamanho(a.tamanho)} · abre no leitor de PDF</small></span>
              </a>
            ) : null;
          case "download":
            return a ? (
              <a key={b.id} className="cb-download" href={urlDoServidor(a.url)} target="_blank" rel="noopener noreferrer">
                <Download size={18} /><span><strong>{b.rotulo || a.nome}</strong><small>{a.nome} · {tamanho(a.tamanho)}</small></span>
              </a>
            ) : null;
          case "codigo":
            return (
              <div key={b.id} className="cb-codigo">
                <div className="cb-codigo-topo"><span>{b.legenda || b.linguagem}</span><Copiar texto={b.codigo} /></div>
                <pre><code>{realcar(b.codigo, b.linguagem)}</code></pre>
              </div>
            );
          case "terminal":
            return (
              <div key={b.id} className="cb-terminal">
                <div className="cb-codigo-topo"><span><TerminalSquare size={14} /> Terminal</span><Copiar texto={(b.comandos as string[]).join("\n")} rotulo="Copiar tudo" /></div>
                {(b.comandos as string[]).map((c, i) => <div key={i} className="cb-cmd"><span aria-hidden="true">$</span><code>{c}</code><Copiar texto={c} rotulo="" /></div>)}
              </div>
            );
          case "diagrama": return <Fluxo key={b.id} etapas={b.etapas} />;
          case "quiz": return <Quiz key={b.id} bloco={b} aulaId={aulaId} />;
          case "pergunta": return <Pergunta key={b.id} bloco={b} />;
          case "checklist": return <Checklist key={b.id} bloco={b} aulaId={aulaId} />;
          case "exercicio": return <div key={b.id} className="cb-exercicio"><span className="cb-selo">Exercício prático</span><strong>{b.titulo}</strong><Paragrafos texto={b.instrucoes} /></div>;
          case "resposta_texto": return <RespostaTexto key={b.id} bloco={b} aulaId={aulaId} />;
          default: return null;
        }
      })}
      {zoom && <div className="cb-zoom" role="dialog" aria-label="Imagem ampliada" onClick={() => setZoom(null)}><img src={urlDoServidor(zoom)} alt="" /></div>}
    </div>
  );
}
