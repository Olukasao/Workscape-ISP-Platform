import { useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Paperclip, Send, Sparkles, X } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { useSession } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { Avatar, PageHeader } from "../components/ui/primitives";
import harry404 from "../assets/harry-404.webp";
import ednesio from "../assets/ednesio.webp";
import { clsx } from "clsx";

interface Pessoa { id: number; status?: string; nome: string; setor_id: number | null; setor_nome: string | null; avatar?: string | null }
interface Setor { id: number; nome: string }
interface Grupo { id: number; nome: string; total_membros: number }
interface Resultado { enviados: number; falhas: { id: number; erro: string }[] }

const tipoDoArquivo = (mime: string) => (mime.startsWith("image/") ? "imagem" : mime.startsWith("audio/") ? "audio" : "arquivo");
const LIMITE_MB = 500;
const IMAGENS_PRONTAS = [
  { id: "harry404", nome: "Harry 404", src: harry404 },
  { id: "ednesio", nome: "Ed, o Tecladista", src: ednesio },
];

export default function Disparo() {
  const user = useSession((s) => s.user);
  const pessoas = useQuery({ queryKey: ["disparo", "pessoas"], queryFn: async () => (await api.get<Pessoa[]>("/admin/usuarios")).data, enabled: user?.perfil === "admin" });
  const setores = useQuery({ queryKey: ["disparo", "setores"], queryFn: async () => (await api.get<Setor[]>("/admin/setores")).data, enabled: user?.perfil === "admin" });
  const grupos = useQuery({ queryKey: ["disparo", "grupos"], queryFn: async () => (await api.get<Grupo[]>("/admin/grupos")).data, enabled: user?.perfil === "admin" });
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  // Quem aparece como remetente: a própria pessoa ou a conta do Assistente Acessa (que também envia imagens prontas).
  const [comoAssistente, setComoAssistente] = useState(false);
  const [imagemPronta, setImagemPronta] = useState<string | null>(null);
  const [mostrarImagens, setMostrarImagens] = useState(false);
  // Escrever com IA: a pessoa conta a ideia e a IA monta (ou melhora) o texto, que continua editável.
  const [iaAberta, setIaAberta] = useState(false);
  const [pedidoIa, setPedidoIa] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  const lista = useMemo(() => (pessoas.data || []).filter((p) => p.id !== user?.id), [pessoas.data, user?.id]);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? lista.filter((p) => `${p.nome} ${p.setor_nome || ""}`.toLocaleLowerCase("pt-BR").includes(termo)) : lista;
  }, [lista, busca]);

  if (user && user.perfil !== "admin") return <Navigate to="/" replace />;

  const alterar = (ids: number[], marcar: boolean) =>
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      for (const id of ids) marcar ? novo.add(id) : novo.delete(id);
      return novo;
    });
  const porSetor = (id: number) => alterar(lista.filter((p) => p.setor_id === id).map((p) => p.id), true);
  const porGrupo = async (id: number) => {
    try {
      const { data } = await api.get<(Pessoa & { membro: number | boolean })[]>(`/admin/grupos/${id}/membros`);
      alterar(data.filter((p) => p.membro && p.id !== user?.id).map((p) => p.id), true);
    } catch (e) { setErro(errorMessage(e)); }
  };
  const escolherArquivo = (f?: File | null) => {
    setErro("");
    if (f && f.size > LIMITE_MB * 1024 * 1024) { setErro(`O arquivo passa de ${LIMITE_MB} MB.`); return; }
    setArquivo(f || null);
  };
  const escreverComIa = async () => {
    setErro(""); setEscrevendo(true);
    try {
      const { data } = await api.post<{ texto: string }>("/admin/ia/disparo/redigir", { pedido: pedidoIa.trim(), rascunho: texto.trim() }, { timeout: 90000 });
      setTexto(data.texto);
      setPedidoIa("");
    } catch (e) { setErro(errorMessage(e)); }
    finally { setEscrevendo(false); }
  };
  const pronto = (texto.trim() || arquivo || imagemPronta) && escolhidos.size > 0;

  const enviar = async () => {
    setConfirmando(false); setErro(""); setResultado(null);
    const ids = [...escolhidos];
    setEnviando({ feitos: 0, total: ids.length });
    try {
      let anexo: { url: string; nome: string; mime: string } | null = null;
      if (arquivo && !(comoAssistente && imagemPronta)) {
        const form = new FormData();
        form.append("arquivo", arquivo);
        const { data } = await api.post("/chat/upload", form);
        anexo = { url: data.url, nome: data.nome || arquivo.name, mime: data.mime || arquivo.type || "application/octet-stream" };
      }
      if (comoAssistente) {
        const { data } = await api.post<Resultado>("/admin/ia/disparo", { usuarios: ids, mensagem: texto.trim(), imagem: imagemPronta || undefined, anexo: imagemPronta ? undefined : anexo || undefined });
        setResultado({ enviados: data.enviados, falhas: data.falhas || [] });
        if (!data.falhas?.length) { setTexto(""); setArquivo(null); setImagemPronta(null); setMostrarImagens(false); setEscolhidos(new Set()); }
        else setEscolhidos(new Set(data.falhas.map((f) => f.id)));
        return;
      }
      const falhas: Resultado["falhas"] = [];
      let enviados = 0, feitos = 0;
      const fila = [...ids];
      const trabalhador = async () => {
        for (let id = fila.shift(); id !== undefined; id = fila.shift()) {
          try {
            if (texto.trim()) await api.post("/chat/enviar-direto", { usuario_id: id, mensagem: texto.trim(), tipo_mensagem: "texto" });
            if (anexo) await api.post("/chat/enviar-direto", { usuario_id: id, mensagem: anexo.url, tipo_mensagem: tipoDoArquivo(anexo.mime), anexo_nome: anexo.nome, anexo_mime: anexo.mime });
            enviados++;
          } catch (e) { falhas.push({ id, erro: errorMessage(e) }); }
          setEnviando({ feitos: ++feitos, total: ids.length });
        }
      };
      await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
      setResultado({ enviados, falhas });
      if (!falhas.length) { setTexto(""); setArquivo(null); setEscolhidos(new Set()); }
      else setEscolhidos(new Set(falhas.map((f) => f.id)));
    } catch (e) { setErro(errorMessage(e)); }
    finally { setEnviando(null); }
  };

  const nomeDe = (id: number) => lista.find((p) => p.id === id)?.nome || `Usuário ${id}`;
  return (
    <div className="page disparo-page">
      <PageHeader icon={Send} title="Disparo de mensagens" description="Envie uma mensagem e um arquivo, pelo Chat Interno, para as pessoas que escolher." />
      <section className="panel disparo-form">
        <div className="disparo-remetente" role="group" aria-label="Enviar como">
          <button type="button" className={clsx(!comoAssistente && "on")} aria-pressed={!comoAssistente} onClick={() => { setComoAssistente(false); setImagemPronta(null); setMostrarImagens(false); }} disabled={!!enviando}>Enviar como eu</button>
          <button type="button" className={clsx(comoAssistente && "on")} aria-pressed={comoAssistente} onClick={() => setComoAssistente(true)} disabled={!!enviando}>Enviar como Assistente Acessa</button>
        </div>
        <label htmlFor="disparo-texto">Mensagem</label>
        <textarea id="disparo-texto" rows={5} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a mensagem" disabled={!!enviando} />
        <div className="disparo-ia">
          <Button type="button" variant={iaAberta ? "soft" : "outline"} size="sm" aria-expanded={iaAberta} onClick={() => setIaAberta((v) => !v)} disabled={!!enviando}>
            <Sparkles size={14} /> Escrever com IA
          </Button>
          {iaAberta ? (
            <div className="disparo-ia-caixa">
              <input type="text" maxLength={600} value={pedidoIa} onChange={(e) => setPedidoIa(e.target.value)} placeholder={texto.trim() ? "Como melhorar? Ex.: mais curto e mais animado" : "O que a mensagem precisa dizer? Ex.: avisar que a reunião de amanhã é às 14h"}
                aria-label="Pedido para a IA" onKeyDown={(e) => { if (e.key === "Enter" && !escrevendo && (pedidoIa.trim().length >= 3 || texto.trim())) { e.preventDefault(); void escreverComIa(); } }} />
              <Button type="button" size="sm" disabled={escrevendo || (pedidoIa.trim().length < 3 && !texto.trim())} onClick={() => void escreverComIa()}>
                {escrevendo ? "Escrevendo…" : texto.trim() ? "Melhorar o texto" : "Gerar mensagem"}
              </Button>
              <small className="muted">A IA escreve um rascunho; confira e edite antes de enviar. Não coloque CPF, telefone ou dados de clientes.</small>
            </div>
          ) : null}
        </div>
        {comoAssistente ? (
          <Button type="button" variant={mostrarImagens || imagemPronta ? "soft" : "outline"} size="sm" className="disparo-imagens-botao" aria-expanded={mostrarImagens} onClick={() => setMostrarImagens((v) => !v)} disabled={!!enviando}>
            <ImagePlus size={14} /> {imagemPronta ? "Imagem escolhida" : "Adicionar imagem pronta"}
          </Button>
        ) : null}
        {comoAssistente && (mostrarImagens || imagemPronta) ? (
          <div className="disparo-imagens" role="group" aria-label="Imagens prontas">
            {IMAGENS_PRONTAS.map((i) => (
              <button key={i.id} type="button" className={clsx(imagemPronta === i.id && "on")} aria-pressed={imagemPronta === i.id} disabled={!!enviando} onClick={() => setImagemPronta(imagemPronta === i.id ? null : i.id)}>
                <img src={i.src} alt="" /><span>{i.nome}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="disparo-arquivo">
          <input ref={seletor} type="file" hidden onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" onClick={() => seletor.current?.click()} disabled={!!enviando}><Paperclip size={14} /> {arquivo ? "Trocar arquivo" : "Anexar arquivo"}</Button>
          {arquivo ? <span>{arquivo.name} · {(arquivo.size / 1048576).toFixed(1)} MB <button type="button" className="icon-button" aria-label="Remover arquivo" onClick={() => setArquivo(null)}><X size={14} /></button></span> : null}
        </div>
      </section>
      <section className="panel disparo-destinos" aria-label="Destinatários">
        <h2>Para quem enviar <span className="muted">({escolhidos.size} selecionados)</span></h2>
        <div className="disparo-atalhos">
          <Button type="button" size="sm" variant="outline" onClick={() => alterar(lista.map((p) => p.id), true)}>Todos</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEscolhidos(new Set())}>Limpar</Button>
          <select aria-label="Adicionar um setor" value="" onChange={(e) => e.target.value && porSetor(Number(e.target.value))}>
            <option value="">Adicionar setor…</option>
            {(setores.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select aria-label="Adicionar um grupo" value="" onChange={(e) => e.target.value && void porGrupo(Number(e.target.value))}>
            <option value="">Adicionar grupo…</option>
            {(grupos.data || []).map((g) => <option key={g.id} value={g.id}>{g.nome} ({g.total_membros})</option>)}
          </select>
        </div>
        <input type="search" placeholder="Buscar por nome ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pessoa" />
        <ul className="disparo-pessoas">
          {visiveis.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" checked={escolhidos.has(p.id)} onChange={(e) => alterar([p.id], e.target.checked)} />
                <Avatar name={p.nome} src={p.avatar} size="xs" />
                <span>{p.nome}</span>
                {p.setor_nome ? <small className="muted">{p.setor_nome}</small> : null}
              </label>
            </li>
          ))}
          {pessoas.isLoading ? <li className="muted">Carregando pessoas…</li> : null}
          {!pessoas.isLoading && !visiveis.length ? <li className="muted">Ninguém encontrado.</li> : null}
        </ul>
        {visiveis.length ? (
          <div className="disparo-atalhos">
            <Button type="button" size="sm" variant="ghost" onClick={() => alterar(visiveis.map((p) => p.id), true)}>Marcar os {visiveis.length} da lista</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => alterar(visiveis.map((p) => p.id), false)}>Desmarcar os da lista</Button>
          </div>
        ) : null}
      </section>
      {erro ? <p role="alert" className="form-error">{erro}</p> : null}
      {enviando ? <p role="status">Enviando… {enviando.feitos} de {enviando.total}</p> : null}
      {resultado ? (
        <div role="status" className="panel disparo-resultado">
          <p>{resultado.enviados} enviado(s){resultado.falhas.length ? `, ${resultado.falhas.length} com falha.` : "."}</p>
          {resultado.falhas.length ? (
            <>
              <ul>{resultado.falhas.map((f) => <li key={f.id}>{nomeDe(f.id)}: {f.erro}</li>)}</ul>
              <p className="muted">Quem falhou continua selecionado para você tentar de novo.</p>
            </>
          ) : null}
        </div>
      ) : null}
      {confirmando ? (
        <div role="alertdialog" aria-label="Confirmar envio" className="panel disparo-confirma">
          <p>Enviar {arquivo || imagemPronta ? "a mensagem e o arquivo" : "a mensagem"}{comoAssistente ? " como Assistente Acessa" : ""} para <strong>{escolhidos.size}</strong> pessoa(s)? Não dá para desfazer em massa.</p>
          <Button type="button" onClick={() => void enviar()}>Sim, enviar</Button>
          <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button type="button" disabled={!pronto || !!enviando} onClick={() => setConfirmando(true)}><Send size={14} /> Enviar para {escolhidos.size || "…"}</Button>
      )}
    </div>
  );
}
