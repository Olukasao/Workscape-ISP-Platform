import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Phone, PhoneOff, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { api, errorMessage } from "../services/api";

// Administração do Workscape Phone: ligar um ramal SIP a cada funcionário, desativar contas e consultar histórico e auditoria.
// A senha SIP só é enviada ao salvar; o servidor a guarda cifrada e nunca a devolve a esta tela.
interface Conta { usuarioId: number; nome: string; ramal: string; sipUser: string; sipDomain: string; sipServer: string; sipPort: number; transport: "udp" | "tcp"; displayName: string; ativo: boolean }
interface Resposta { configurada: boolean; contas: Conta[]; pessoas: { id: number; nome: string }[] }
interface Chamada { id: number; usuarioId: number; nome: string; direcao: "in" | "out"; numero: string; resultado: string; duracaoSeg: number; inicio: string }
interface Evento { id: number; acao: string; detalhe: string; criado_em: string; ator: string | null; alvo: string | null }

const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const ACOES: Record<string, string> = { conta_criada: "Conta criada", conta_editada: "Conta editada", conta_desativada: "Conta desativada", conta_reativada: "Conta ativada de novo", conta_excluida: "Conta excluída", historico_consultado: "Histórico consultado" };
const RESULTADOS: Record<string, string> = { atendida: "Atendida", nao_atendida: "Não atendida", rejeitada: "Rejeitada", falhou: "Falhou" };
const duracao = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const quando = (v: string) => new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const VAZIO = { usuarioId: 0, ramal: "", sipUser: "", sipDomain: "", sipServer: "", sipPort: 5060, transport: "udp" as "udp" | "tcp", displayName: "", senha: "", ativo: true };

export default function ControleTelefone() {
  const cliente = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const dados = useQuery({ queryKey: ["admin", "phone"], queryFn: async () => (await api.get<Resposta>("/admin/phone")).data });
  const historico = useQuery({ queryKey: ["admin", "phone", "chamadas"], queryFn: async () => (await api.get<{ chamadas: Chamada[] }>("/admin/phone/chamadas")).data.chamadas });
  const auditoria = useQuery({ queryKey: ["admin", "phone", "auditoria"], queryFn: async () => (await api.get<{ eventos: Evento[] }>("/admin/phone/auditoria")).data.eventos });
  const atualizar = () => { void cliente.invalidateQueries({ queryKey: ["admin", "phone"] }); };

  const salvar = useMutation({
    mutationFn: async () => {
      const { usuarioId, senha, ...resto } = form;
      await api.put(`/admin/phone/${usuarioId}`, { ...resto, sipUser: form.sipUser || form.ramal, sipServer: form.sipServer || form.sipDomain, ...(senha ? { senha } : {}) });
    },
    onSuccess: () => { setAviso("Conta salva."); setErro(""); setForm(VAZIO); setEditando(false); atualizar(); },
    onError: (e) => { setErro(msgDe(e)); setAviso(""); },
  });
  const desativar = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/admin/phone/${id}`); },
    onSuccess: () => { setAviso("Conta desativada."); atualizar(); },
    onError: (e) => setErro(msgDe(e)),
  });

  const reativar = useMutation({
    mutationFn: async (id: number) => { await api.post(`/admin/phone/${id}/reativar`); },
    onSuccess: () => { setAviso("Conta ativada."); setErro(""); atualizar(); },
    onError: (e) => { setErro(msgDe(e)); setAviso(""); },
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/admin/phone/${id}/definitivo`); },
    onSuccess: () => { setAviso("Ramal excluído."); setErro(""); setForm(VAZIO); setEditando(false); atualizar(); void auditoria.refetch(); },
    onError: (e) => { setErro(msgDe(e)); setAviso(""); },
  });

  const d = dados.data;
  const enviar = (e: FormEvent) => { e.preventDefault(); setErro(""); setAviso(""); if (!form.usuarioId) { setErro("Escolha a pessoa."); return; } salvar.mutate(); };
  const campo = (rotulo: string, el: React.ReactNode) => <label className="telefoneadm-campo"><span>{rotulo}</span>{el}</label>;

  return (
    <section className="versoes iaadm" aria-labelledby="telefoneadm-titulo">
      <header className="versoes-topo">
        <div>
          <h2 id="telefoneadm-titulo">Workscape Phone</h2>
          <p className="muted">Ligue cada ramal da central a um funcionário. A senha é guardada cifrada e nunca volta para esta tela.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Atualizar" onClick={() => { atualizar(); void historico.refetch(); void auditoria.refetch(); }}>
          <RefreshCw size={16} className={dados.isFetching ? "animate-spin" : ""} />
        </button>
      </header>
      {d && !d.configurada ? <p role="alert" className="iaadm-erro">O servidor ainda não tem a chave de cifra do telefone (PHONE_SECRET_KEY). Não é possível salvar contas.</p> : null}
      {erro ? <p role="alert" className="iaadm-erro">{erro}</p> : null}
      {dados.isError ? <p role="alert" className="iaadm-erro">{msgDe(dados.error)}</p> : null}
      {aviso ? <p role="status" className="muted iaadm-nota">{aviso}</p> : null}

      <h3 className="iaadm-h">Contas</h3>
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Pessoa</th><th>Ramal</th><th>Central</th><th>Transporte</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {d?.contas.map((c) => (
              <tr key={c.usuarioId}>
                <td>{c.nome}</td>
                <td>{c.ramal}</td>
                <td className="muted">{c.sipServer}:{c.sipPort}</td>
                <td>{c.transport.toUpperCase()}</td>
                <td>{c.ativo ? "Ativa" : "Desativada"}</td>
                <td>
                  <button type="button" className="versoes-filtros-botao" onClick={() => { setForm({ ...VAZIO, ...c, senha: "" }); setEditando(true); setErro(""); setAviso(""); }}>Editar</button>{" "}
                  {c.ativo
                    ? <button type="button" className="versoes-filtros-botao" disabled={desativar.isPending} onClick={() => { if (window.confirm(`Desativar o ramal de ${c.nome}?`)) desativar.mutate(c.usuarioId); }}><PhoneOff size={13} aria-hidden="true" /> Desativar</button>
                    : <button type="button" className="versoes-filtros-botao" disabled={reativar.isPending} onClick={() => reativar.mutate(c.usuarioId)}><Phone size={13} aria-hidden="true" /> Ativar</button>}{" "}
                  <button type="button" className="versoes-filtros-botao" disabled={excluir.isPending} onClick={() => { if (window.confirm(`Excluir de vez o ramal ${c.ramal} de ${c.nome}? Para voltar a usar, será preciso cadastrar de novo.`)) excluir.mutate(c.usuarioId); }}><Trash2 size={13} aria-hidden="true" /> Excluir</button>
                </td>
              </tr>
            ))}
            {d && !d.contas.length ? <tr><td colSpan={6} className="muted">Nenhum ramal cadastrado ainda.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h3 className="iaadm-h">{editando ? "Editar conta" : "Nova conta"}</h3>
      <form className="telefoneadm-form" onSubmit={enviar}>
        {campo("Pessoa", (
          <select value={form.usuarioId} disabled={editando} onChange={(e) => setForm({ ...form, usuarioId: Number(e.target.value) })}>
            <option value={0}>Escolha…</option>
            {d?.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        ))}
        {campo("Ramal", <input inputMode="numeric" value={form.ramal} onChange={(e) => setForm({ ...form, ramal: e.target.value.replace(/\D/g, "") })} required />)}
        {campo("Usuário SIP", <input value={form.sipUser} placeholder="igual ao ramal" onChange={(e) => setForm({ ...form, sipUser: e.target.value })} />)}
        {campo("Domínio SIP", <input value={form.sipDomain} placeholder="sip.exemplo.com.br" onChange={(e) => setForm({ ...form, sipDomain: e.target.value })} required />)}
        {campo("Servidor (se diferente)", <input value={form.sipServer} placeholder="igual ao domínio" onChange={(e) => setForm({ ...form, sipServer: e.target.value })} />)}
        {campo("Porta", <input type="number" min={1} max={65535} value={form.sipPort} onChange={(e) => setForm({ ...form, sipPort: Number(e.target.value) })} />)}
        {campo("Transporte", (
          <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as "udp" | "tcp" })}>
            <option value="udp">UDP</option><option value="tcp">TCP</option>
          </select>
        ))}
        {campo("Nome de exibição", <input value={form.displayName} maxLength={100} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />)}
        {campo(editando ? "Nova senha (vazio mantém a atual)" : "Senha SIP", <input type="password" autoComplete="new-password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required={!editando} />)}
        <div className="telefoneadm-acoes">
          <button type="submit" className="versoes-confirmar" disabled={salvar.isPending || (d ? !d.configurada : true)}>{salvar.isPending ? "Salvando…" : "Salvar conta"}</button>
          {editando ? <button type="button" className="versoes-filtros-botao" onClick={() => { setForm(VAZIO); setEditando(false); }}>Cancelar</button> : null}
        </div>
      </form>

      <h3 className="iaadm-h">Chamadas recentes</h3>
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Quando</th><th>Pessoa</th><th>Tipo</th><th>Número</th><th>Resultado</th><th>Duração</th></tr></thead>
          <tbody>
            {historico.data?.slice(0, 40).map((c) => (
              <tr key={c.id}><td>{quando(c.inicio)}</td><td>{c.nome}</td><td>{c.direcao === "in" ? "Recebida" : "Feita"}</td><td>{c.numero}</td><td>{RESULTADOS[c.resultado] ?? c.resultado}</td><td>{duracao(c.duracaoSeg)}</td></tr>
            ))}
            {historico.data && !historico.data.length ? <tr><td colSpan={6} className="muted">Nenhuma chamada registrada ainda.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h3 className="iaadm-h"><ShieldCheck size={15} aria-hidden="true" /> Auditoria</h3>
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Sobre</th><th>Detalhe</th></tr></thead>
          <tbody>
            {auditoria.data?.slice(0, 40).map((a) => (
              <tr key={a.id}><td>{quando(a.criado_em)}</td><td>{a.ator ?? "—"}</td><td>{ACOES[a.acao] ?? a.acao}</td><td>{a.alvo ?? "—"}</td><td className="muted">{a.detalhe || "—"}</td></tr>
            ))}
            {auditoria.data && !auditoria.data.length ? <tr><td colSpan={5} className="muted">Sem eventos ainda.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
