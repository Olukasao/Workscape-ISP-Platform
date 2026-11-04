import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Activity, Bot, CheckCircle2, Newspaper, RefreshCw, Send, Users } from "lucide-react";
import { clsx } from "clsx";
import { api, errorMessage } from "../services/api";

// Administração da inteligência artificial: o que cada setor pode consultar, quanto cada pessoa usa (só contagens,
// nunca o conteúdo das conversas), a saúde dos provedores gratuitos e o briefing automático das 8h.
export interface FonteIA { id: string; rotulo: string; grupo: "dados" | "recurso" }
export interface SetorIA { id: number; nome: string; bloqueadas: string[] }
export interface UsoPessoa { id: number; nome: string; setor: string | null; perguntas: number; resumos: number; imagens: number; pesquisas: number; dados: number; falhas: number; ultimo_dia: string }
export interface ProvedorIA { provedor: string; ok: number; falha: number; taxaFalha: number; ultimo_erro: string; ultimo_em: string | null }
export interface PessoaBriefing { id: number; nome: string; perfil: string; setor: string | null; setor_id: number | null }
export interface BriefingIA { ativo: boolean; hora: string; dias: number[]; destinatarios: { id: number; nome: string }[]; escolhidos: number[]; pessoas: PessoaBriefing[] }
interface Resposta {
  fontes: FonteIA[]; setores: SetorIA[]; uso: UsoPessoa[]; porDia: { dia: string; perguntas: number; resumos: number; falhas: number; pessoas: number }[];
  dias: number; provedores: ProvedorIA[]; saldos: { serper: { creditos: number } | null }; busca: string[]; briefing: BriefingIA;
}

const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));

/** "gemini/gemini-3.1-flash-lite" -> "Gemini · gemini-3.1-flash-lite"; busca vira "Busca · serper". */
export function nomeProvedor(id: string): string {
  const [casa, ...resto] = id.split("/");
  const nomes: Record<string, string> = { gemini: "Gemini", cf: "Cloudflare", searxng: "SearXNG", serper: "Serper", tavily: "Tavily", brave: "Brave" };
  if (!resto.length) return nomes[id] ? `Busca · ${nomes[id]}` : id;
  return `${nomes[casa] ?? casa} · ${resto.join("/").split("/").pop()}`;
}

export type Saude = "bom" | "atencao" | "ruim" | "sem-uso";
/** Verde até 10% de falhas, amarelo até 40%, vermelho acima disso. */
export function saudeDe(p: Pick<ProvedorIA, "ok" | "falha" | "taxaFalha">): Saude {
  if (p.ok + p.falha === 0) return "sem-uso";
  return p.taxaFalha <= 10 ? "bom" : p.taxaFalha <= 40 ? "atencao" : "ruim";
}

export function totais(uso: UsoPessoa[]) {
  return uso.reduce((t, u) => ({ pessoas: t.pessoas + 1, perguntas: t.perguntas + u.perguntas, falhas: t.falhas + u.falhas }), { pessoas: 0, perguntas: 0, falhas: 0 });
}

/** Quem recebe o briefing: sem escolha, os administradores; com escolha, só as pessoas marcadas. */
function DestinatariosBriefing({ briefing, salvando, onSalvar }: { briefing: BriefingIA; salvando: boolean; onSalvar: (ids: number[]) => void }) {
  const [marcados, setMarcados] = useState<number[]>(briefing.escolhidos);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const setores = useMemo(() => [...new Set(briefing.pessoas.map((p) => p.setor).filter((x): x is string => !!x))].sort(), [briefing.pessoas]);
  const lista = briefing.pessoas.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  const igual = marcados.length === briefing.escolhidos.length && marcados.every((id) => briefing.escolhidos.includes(id));
  const alternar = (id: number) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <div className="iaadm-destinos">
      <button type="button" className="versoes-filtros-botao" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <Users size={14} aria-hidden="true" /> Escolher quem recebe ({marcados.length ? `${marcados.length} pessoas` : "administradores"})
      </button>
      {aberto ? (
        <div className="iaadm-destinos-caixa">
          <div className="iaadm-linha">
            <input type="search" className="versoes-mensagem" placeholder="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pessoa" />
            <select aria-label="Adicionar um setor inteiro" value="" onChange={(e) => {
              const ids = briefing.pessoas.filter((p) => p.setor === e.target.value).map((p) => p.id);
              setMarcados((m) => [...new Set([...m, ...ids])]);
            }}>
              <option value="">Adicionar setor…</option>
              {setores.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button type="button" className="versoes-filtros-botao" onClick={() => setMarcados(briefing.pessoas.filter((p) => p.perfil === "admin").map((p) => p.id))}>Só administradores</button>
            <button type="button" className="versoes-filtros-botao" onClick={() => setMarcados([])}>Limpar</button>
          </div>
          <ul className="iaadm-destinos-lista">
            {lista.map((p) => (
              <li key={p.id}>
                <label><input type="checkbox" checked={marcados.includes(p.id)} onChange={() => alternar(p.id)} /> {p.nome} <small className="muted">{p.setor ?? "sem setor"}{p.perfil === "admin" ? " · admin" : ""}</small></label>
              </li>
            ))}
          </ul>
          <p className="muted iaadm-nota">Sem ninguém marcado, o briefing vai só para os administradores.</p>
          <button type="button" className="versoes-confirmar" disabled={salvando || igual} onClick={() => onSalvar(marcados)}>{salvando ? "Salvando…" : "Salvar destinatários"}</button>
        </div>
      ) : null}
    </div>
  );
}

export default function ControleIA() {
  const cliente = useQueryClient();
  const chave = ["admin", "ia"];
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const dados = useQuery({ queryKey: chave, queryFn: async () => (await api.get<Resposta>("/admin/ia")).data, refetchInterval: 60000 });
  const d = dados.data;

  const fonte = useMutation({
    mutationFn: async (v: { setorId: number; fonte: string; permitido: boolean }) => { await api.put("/admin/ia/fontes", v); },
    onMutate: async (v) => {
      await cliente.cancelQueries({ queryKey: chave });
      const antes = cliente.getQueryData<Resposta>(chave);
      if (antes) cliente.setQueryData<Resposta>(chave, { ...antes, setores: antes.setores.map((s) => s.id !== v.setorId ? s : { ...s, bloqueadas: v.permitido ? s.bloqueadas.filter((f) => f !== v.fonte) : [...new Set([...s.bloqueadas, v.fonte])] }) });
      return { antes };
    },
    onError: (e, _v, ctx) => { if (ctx?.antes) cliente.setQueryData(chave, ctx.antes); setErro(msgDe(e)); },
    onSettled: () => void cliente.invalidateQueries({ queryKey: chave }),
  });
  const briefing = useMutation({
    mutationFn: async (v: Partial<{ ativo: boolean; hora: string; dias: number[]; usuarios: number[] }>) => { await api.put("/admin/ia/briefing", v); },
    onSuccess: () => { setErro(""); void cliente.invalidateQueries({ queryKey: chave }); },
    onError: (e) => setErro(msgDe(e)),
  });
  const enviarAgora = useMutation({
    mutationFn: async () => (await api.post<{ enviados: number }>("/admin/ia/briefing/enviar")).data,
    onSuccess: (r) => { setErro(""); setAviso(r.enviados ? `Briefing enviado para ${r.enviados} ${r.enviados === 1 ? "pessoa" : "pessoas"}.` : "Ninguém para receber: escolha os destinatários."); },
    onError: (e) => { setAviso(""); setErro(msgDe(e)); },
  });
  const testar = useMutation({
    mutationFn: async () => (await api.post<{ enviados: number }>("/admin/ia/briefing/testar")).data,
    onSuccess: () => { setErro(""); setAviso("Enviei o briefing para você no chat. Abra a conversa com o Assistente Acessa."); },
    onError: (e) => { setAviso(""); setErro(msgDe(e)); },
  });

  const resumo = useMemo(() => totais(d?.uso ?? []), [d?.uso]);
  const fontesDados = d?.fontes.filter((f) => f.grupo === "dados") ?? [];
  const recursos = d?.fontes.filter((f) => f.grupo === "recurso") ?? [];
  const maxDia = Math.max(1, ...(d?.porDia ?? []).map((x) => x.perguntas));

  return (
    <section className="versoes iaadm" aria-labelledby="iaadm-titulo">
      <header className="versoes-topo">
        <div>
          <h2 id="iaadm-titulo"><Bot size={18} aria-hidden="true" /> Inteligência artificial</h2>
          <p className="muted">O que cada setor pode usar, quem está usando e como estão os provedores gratuitos. As conversas não são guardadas aqui, só contagens.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Atualizar" onClick={() => void dados.refetch()}><RefreshCw size={16} className={dados.isFetching ? "animate-spin" : ""} /></button>
      </header>

      {erro ? <p role="alert" className="iaadm-erro">{erro}</p> : null}
      {dados.isError ? <p role="alert" className="iaadm-erro">{msgDe(dados.error)}</p> : null}

      <div className="versoes-cartoes">
        <div><span>Pessoas usando ({d?.dias ?? 30} dias)</span><strong>{resumo.pessoas}</strong></div>
        <div><span>Perguntas</span><strong>{resumo.perguntas}</strong></div>
        <div className={clsx(resumo.falhas && "alerta")}><span>Falhas</span><strong>{resumo.falhas}</strong></div>
        <div><span>Créditos do Serper</span><strong>{d?.saldos.serper ? d.saldos.serper.creditos.toLocaleString("pt-BR") : "—"}</strong></div>
      </div>

      <h3 className="iaadm-h"><Activity size={15} aria-hidden="true" /> Provedores (últimos 7 dias)</h3>
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Provedor</th><th>Respostas</th><th>Falhas</th><th>Situação</th><th>Último erro</th></tr></thead>
          <tbody>
            {(d?.provedores ?? []).map((p) => (
              <tr key={p.provedor}>
                <td>{nomeProvedor(p.provedor)}</td><td>{p.ok}</td><td>{p.falha}</td>
                <td><span className={clsx("iaadm-saude", saudeDe(p))}>{{ bom: "Saudável", atencao: "Instável", ruim: "Com problemas", "sem-uso": "Sem uso" }[saudeDe(p)]} · {p.taxaFalha}%</span></td>
                <td className="muted">{p.ultimo_erro || "—"}</td>
              </tr>
            ))}
            {d && !d.provedores.length ? <tr><td colSpan={5} className="muted">Ainda sem uso registrado. Os números aparecem a partir da próxima pergunta ao Assistente.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h3 className="iaadm-h"><Users size={15} aria-hidden="true" /> O que cada setor pode usar</h3>
      <p className="muted iaadm-nota">Marcado = liberado. Quem não tem setor usa tudo. A mudança vale na próxima pergunta, sem reiniciar nada.</p>
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela iaadm-matriz">
          <thead>
            <tr>
              <th>Setor</th>
              {[...fontesDados, ...recursos].map((f) => <th key={f.id} title={f.rotulo}>{f.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {(d?.setores ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.nome}</td>
                {[...fontesDados, ...recursos].map((f) => (
                  <td key={f.id}>
                    <input type="checkbox" aria-label={`${f.rotulo} para ${s.nome}`} checked={!s.bloqueadas.includes(f.id)}
                      onChange={(e) => fonte.mutate({ setorId: s.id, fonte: f.id, permitido: e.target.checked })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="iaadm-h"><Bot size={15} aria-hidden="true" /> Uso por pessoa</h3>
      {d?.porDia.length ? (
        <div className="iaadm-barras" role="img" aria-label="Perguntas por dia">
          {d.porDia.map((x) => <span key={x.dia} title={`${x.dia}: ${x.perguntas} perguntas, ${x.pessoas} pessoas`} style={{ height: `${Math.max(4, (x.perguntas / maxDia) * 100)}%` }} />)}
        </div>
      ) : null}
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Pessoa</th><th>Setor</th><th>Perguntas</th><th>Resumos</th><th>Pesquisas</th><th>Imagens</th><th>Com dados</th><th>Falhas</th></tr></thead>
          <tbody>
            {(d?.uso ?? []).map((u) => (
              <tr key={u.id}><td>{u.nome}</td><td className="muted">{u.setor ?? "—"}</td><td>{u.perguntas}</td><td>{u.resumos}</td><td>{u.pesquisas}</td><td>{u.imagens}</td><td>{u.dados}</td><td>{u.falhas}</td></tr>
            ))}
            {d && !d.uso.length ? <tr><td colSpan={8} className="muted">Ninguém usou o Assistente neste período.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h3 className="iaadm-h"><Newspaper size={15} aria-hidden="true" /> Briefing automático no chat</h3>
      {d ? (
        <div className="versoes-forcar-painel">
          <p className="muted iaadm-nota">No horário combinado, cada gestor recebe no chat uma mensagem do “Assistente Acessa” com as filas, os alertas da rede e a agenda do dia.</p>
          <label className="versoes-opcao">
            <input type="checkbox" checked={d.briefing.ativo} onChange={(e) => briefing.mutate({ ativo: e.target.checked })} />
            <span><b>Enviar o briefing todos os dias marcados</b><small>Quem recebe: {d.briefing.destinatarios.map((x) => x.nome).join(", ") || "ninguém ainda"} {d.briefing.escolhidos.length ? "" : "(os administradores)"}</small></span>
          </label>
          <div className="iaadm-linha">
            <label>Horário <input type="time" className="versoes-mensagem iaadm-hora" value={d.briefing.hora} onChange={(e) => e.target.value && briefing.mutate({ hora: e.target.value })} /></label>
            <div className="versoes-filtros" role="group" aria-label="Dias da semana">
              {NOMES_DIAS.map((n, i) => (
                <button key={n} type="button" className={clsx(d.briefing.dias.includes(i) && "on")} aria-pressed={d.briefing.dias.includes(i)}
                  onClick={() => briefing.mutate({ dias: d.briefing.dias.includes(i) ? d.briefing.dias.filter((x) => x !== i) : [...d.briefing.dias, i].sort() })}>{n}</button>
              ))}
            </div>
          </div>
          <DestinatariosBriefing briefing={d.briefing} salvando={briefing.isPending} onSalvar={(usuarios) => briefing.mutate({ usuarios })} />
          <div className="versoes-forcar-botoes">
            <button type="button" className="versoes-confirmar" disabled={testar.isPending} onClick={() => { setAviso(""); testar.mutate(); }}>
              <Send size={14} aria-hidden="true" /> {testar.isPending ? "Enviando…" : "Enviar um teste para mim"}
            </button>
            <button type="button" className="versoes-confirmar" disabled={enviarAgora.isPending}
              onClick={() => { if (window.confirm(`Enviar o briefing agora para ${d.briefing.destinatarios.length} ${d.briefing.destinatarios.length === 1 ? "pessoa" : "pessoas"}?`)) { setAviso(""); enviarAgora.mutate(); } }}>
              <Send size={14} aria-hidden="true" /> {enviarAgora.isPending ? "Enviando…" : "Enviar agora para os destinatários"}
            </button>
          </div>
          {aviso ? <p role="status" className="versoes-feito"><CheckCircle2 size={15} aria-hidden="true" /> {aviso}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
