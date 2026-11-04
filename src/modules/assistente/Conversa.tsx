import { useEffect, useRef, useState } from "react";
import { Brain, Check, Copy, Database, Globe, ImagePlus, LoaderCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { useAssistenteInternet } from "../../services/assistenteNet";
import BotaoDitado from "../../components/BotaoDitado";
import { useAssistente, type Msg } from "./store";
import type { ImagemFixa } from "./respostasFixas";
import Markdown from "./Markdown";
import harry404 from "../../assets/harry-404.webp";
import ednesio from "../../assets/ednesio.webp";
import { imagensDe, MAX_IMAGENS, prepararImagem, type ImagemAnexa } from "./imagens";

const SUGESTOES = [
  "Como explico para um cliente que o Wi-Fi fica lento à noite?",
  "O que significa perda de pacotes e como identificar a causa?",
  "Quais as notícias de hoje sobre internet no Brasil?",
];

const IMAGENS_FIXAS: Record<ImagemFixa, { src: string; alt: string }> = {
  harry404: { src: harry404, alt: "Harry mexendo na agenda, com um 404 ao fundo" },
  ednesio: { src: ednesio, alt: "Ed, o Tecladista, com o teclado mais barulhento" },
};

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="assistente-copiar"
      aria-label="Copiar resposta"
      title="Copiar"
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {});
      }}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Balao({ m, nomeModelo, conversaId }: { m: Msg; nomeModelo: (id?: string) => string; conversaId: string }) {
  const desfazer = useAssistente((s) => s.desfazerMemoria);
  if (m.role === "user")
    return (
      <div className="assistente-msg eu">
        {m.miniaturas?.length ? (
          <div className="assistente-miniaturas">
            {m.miniaturas.map((src, i) => <img key={i} src={src} alt={`Imagem anexada ${i + 1}`} />)}
          </div>
        ) : null}
        {m.content}
      </div>
    );
  return (
    <div className="assistente-msg ia">
      <Markdown texto={m.content} />
      {m.imagem ? <img className="assistente-imagem-fixa" src={IMAGENS_FIXAS[m.imagem].src} alt={IMAGENS_FIXAS[m.imagem].alt} /> : null}
      {m.fontes?.length ? (
        <ol className="assistente-fontes" aria-label="Fontes">
          {m.fontes.map((f, n) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" title={f.url}>[{n + 1}] {f.titulo || f.url}</a>
            </li>
          ))}
        </ol>
      ) : null}
      {m.dados?.length ? <p className="assistente-dados" title="Dados do Workspace que a IA recebeu para responder"><Database size={12} aria-hidden="true" /> Dados usados: {m.dados.join(" · ")}</p> : null}
      {m.memorizado?.length ? (
        <p className="assistente-dados memorizei">
          <Brain size={12} aria-hidden="true" /> Memorizei: {m.memorizado.map((x) => (
            <span key={x.id}>{x.texto} <button type="button" onClick={() => void desfazer(conversaId, x.id)}>Desfazer</button></span>
          ))}
        </p>
      ) : null}
      <div className="assistente-rodape-msg">
        {m.modelo ? <span>{nomeModelo(m.modelo)}</span> : null}
        <Copiar texto={m.content} />
      </div>
    </div>
  );
}

/** Mensagens e caixa de texto; usado na página cheia e no painel flutuante. */
export default function Conversa({ compacto = false }: { compacto?: boolean }) {
  const status = useAssistenteInternet();
  const { conversas, ativaId, modelo, pesquisar, usarDados, coletando, enviando, erro, aviso, setModelo, setPesquisar, setUsarDados, enviar } = useAssistente();
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<ImagemAnexa[]>([]);
  const [erroAnexo, setErroAnexo] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const modelos = status.data?.modelos ?? [];
  const buscaDisponivel = status.data?.busca === true;
  const ativa = conversas.find((c) => c.id === ativaId);
  const mensagens = ativa?.mensagens ?? [];
  const aguardando = !!ativa && enviando === ativa.id;
  const nomeModelo = (id?: string) => modelos.find((m) => m.id === id)?.nome || id || "";

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, aguardando, ativaId]);
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [texto]);
  // O modelo salvo pode ter saído da lista do servidor: volta ao automático.
  useEffect(() => {
    if (modelos.length && modelo !== "auto" && !modelos.some((m) => m.id === modelo)) setModelo("auto");
  }, [modelos, modelo, setModelo]);

  const aceitaImagens = status.data?.imagens === true;
  // "Automático" escolhe um modelo que lê imagens; um modelo específico precisa ser desse tipo.
  const modeloLeImagem = modelo === "auto" || modelos.find((m) => m.id === modelo)?.visao === true;

  const anexar = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    setErroAnexo("");
    const vagas = MAX_IMAGENS - anexos.length;
    if (vagas <= 0) { setErroAnexo(`No máximo ${MAX_IMAGENS} imagens por pergunta.`); return; }
    try {
      const prontas = await Promise.all(arquivos.slice(0, vagas).map(prepararImagem));
      setAnexos((atuais) => [...atuais, ...prontas].slice(0, MAX_IMAGENS));
      if (arquivos.length > vagas) setErroAnexo(`Só coube ${vagas}: o limite é ${MAX_IMAGENS} imagens por pergunta.`);
    } catch (e) {
      setErroAnexo(e instanceof Error ? e.message : "Não foi possível anexar a imagem.");
    }
  };

  const podeEnviar = (!!texto.trim() || anexos.length > 0) && !enviando && (anexos.length === 0 || modeloLeImagem);
  const enviarTexto = (t = texto) => {
    if ((!t.trim() && !anexos.length) || enviando) return;
    if (anexos.length && !modeloLeImagem) return;
    const imagens = anexos;
    setTexto("");
    setAnexos([]);
    setErroAnexo("");
    void enviar(t, buscaDisponivel && pesquisar, usarDados, imagens);
  };

  return (
    <div className={clsx("assistente-conversa", compacto && "compacto")}>
      <div className="assistente-mensagens" aria-live="polite">
        <div className="assistente-coluna">
          {!mensagens.length ? (
            <div className="assistente-vazio">
              <Sparkles size={compacto ? 20 : 26} aria-hidden="true" />
              <p>Em que posso ajudar?</p>
              <div className="assistente-sugestoes">
                {SUGESTOES.map((s) => (
                  <button key={s} type="button" disabled={!!enviando} onClick={() => enviarTexto(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            mensagens.map((m) => <Balao key={m.hora + m.role} m={m} nomeModelo={nomeModelo} conversaId={ativa!.id} />)
          )}
          {aguardando ? (
            <div className="assistente-msg ia pensando">
              <LoaderCircle size={14} className="animate-spin" /> {coletando ? "Lendo os dados do Workspace..." : buscaDisponivel && pesquisar ? "Pesquisando e pensando..." : "Pensando..."}
            </div>
          ) : null}
          {erro && erro.conversaId === ativaId ? <p role="alert" className="form-error">{erro.texto}</p> : null}
          {aviso && aviso.conversaId === ativaId ? <p role="status" className="assistente-aviso">{aviso.texto}</p> : null}
          <div ref={fim} />
        </div>
      </div>
      <form
        className={clsx("assistente-compositor", arrastando && "arrastando")}
        data-tour="assistente-compositor"
        onSubmit={(e) => { e.preventDefault(); enviarTexto(); }}
        onDragOver={aceitaImagens ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } } : undefined}
        onDragLeave={() => setArrastando(false)}
        onDrop={aceitaImagens ? (e) => { e.preventDefault(); setArrastando(false); void anexar(imagensDe(e.dataTransfer.items)); } : undefined}
      >
        {anexos.length ? (
          <div className="assistente-anexos" aria-label="Imagens anexadas">
            {anexos.map((a) => (
              <span key={a.id} className="assistente-anexo">
                <img src={a.miniatura} alt={a.nome} />
                <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => setAnexos((atuais) => atuais.filter((x) => x.id !== a.id))}><X size={12} /></button>
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          ref={campo}
          rows={1}
          maxLength={8000}
          placeholder={compacto ? "Pergunte qualquer coisa…" : aceitaImagens ? "Pergunte qualquer coisa… (cole um print com Ctrl+V)" : "Pergunte qualquer coisa… (Enter envia, Shift+Enter quebra a linha)"}
          aria-label="Sua pergunta"
          value={texto}
          disabled={!!enviando}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={aceitaImagens ? (e) => { const fotos = imagensDe(e.clipboardData?.items); if (fotos.length) { e.preventDefault(); void anexar(fotos); } } : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              enviarTexto();
            }
          }}
        />
        <div className="assistente-barra">
          <select data-tour="assistente-modelo" aria-label="Modelo de IA" value={modelo} onChange={(e) => setModelo(e.target.value)} title="Escolha qual IA responde">
            <option value="auto">Automático</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.visao ? " · lê imagens" : ""}</option>)}
          </select>
          {aceitaImagens ? (
            <>
              <input ref={arquivoRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { void anexar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <button type="button" className="assistente-chip" data-tour="assistente-anexo" onClick={() => arquivoRef.current?.click()} disabled={!!enviando || anexos.length >= MAX_IMAGENS} title="Anexar um print ou uma foto (também dá para colar com Ctrl+V ou arrastar)" aria-label="Anexar imagem">
                <ImagePlus size={14} aria-hidden="true" /> Imagem
              </button>
            </>
          ) : null}
          <button
            type="button"
            data-tour="assistente-pesquisar"
            className={clsx("assistente-chip", buscaDisponivel && pesquisar && "on")}
            aria-pressed={buscaDisponivel && pesquisar}
            disabled={!buscaDisponivel}
            onClick={() => setPesquisar(!pesquisar)}
            title={buscaDisponivel ? "Pesquisa na internet antes de responder" : "A pesquisa na internet não está configurada no servidor"}
          >
            <Globe size={14} aria-hidden="true" /> Pesquisar
          </button>
          <button
            type="button"
            data-tour="assistente-workspace"
            className={clsx("assistente-chip", usarDados && "on")}
            aria-pressed={usarDados}
            onClick={() => setUsarDados(!usarDados)}
            title="Deixa a IA ler (só leitura) agenda, chamados, painel e rede quando a pergunta falar disso. Nome e sobrenome do cliente podem ir; CPF, telefone e endereço nunca."
          >
            <Database size={14} aria-hidden="true" /> Workspace
          </button>
          <BotaoDitado disabled={!!enviando} aoTexto={(t) => { setTexto((x) => (x.trim() ? `${x.trim()} ${t}` : t).slice(0, 8000)); campo.current?.focus(); }} />
          <button type="submit" className="assistente-enviar" disabled={!podeEnviar} aria-label="Enviar pergunta">
            <SendHorizontal size={16} />
          </button>
        </div>
      </form>
      {erroAnexo ? <p role="alert" className="assistente-erro-anexo">{erroAnexo}</p> : null}
      {anexos.length && !modeloLeImagem ? <p role="alert" className="assistente-erro-anexo">Este modelo não lê imagens. Escolha o Automático ou um modelo marcado com "lê imagens".</p> : null}
      <p className="assistente-legenda">Suas perguntas, imagens e os dados do Workspace lidos para respondê-las passam por serviços externos. Não envie CPF, telefone, senhas nem prints com dados de clientes. A IA pode errar.</p>
    </div>
  );
}
