import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, SquareTerminal, X, Pencil, Trash2, Plug, KeyRound, RefreshCw, FolderTree } from "lucide-react";
import { clsx } from "clsx";
import { useSession } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { errorMessage } from "../services/api";
import { lerEnderecoRapido, portaPadrao, type EquipamentoForm, type EquipamentoTerminal, type ProtocoloTerminal } from "../services/terminal";
import { abrirSessao, ativarSessao, fecharSessao, useSessoesTerminal, type Sessao } from "../services/terminalSessoes";

const vazio = (): EquipamentoForm => ({ nome: "", grupo: "", protocolo: "ssh", host: "", porta: 22, usuario: "", senha: "", guardarSenha: false });

/** Terminal SSH/Telnet dentro do Workspace: lista de equipamentos à esquerda e sessões em abas. */
export default function Terminal({ active }: { active: boolean }) {
  const usuario = useSession((s) => s.user);
  const dono = String(usuario?.id ?? "");
  const { sessoes, ativa } = useSessoesTerminal();
  const [equipamentos, setEquipamentos] = useState<EquipamentoTerminal[]>([]);
  const [busca, setBusca] = useState("");
  const [rapido, setRapido] = useState("");
  const [erro, setErro] = useState("");
  const [edicao, setEdicao] = useState<EquipamentoForm | null>(null);
  const [pedirSenha, setPedirSenha] = useState<{ titulo: string; confirmar: (senha?: string) => void } | null>(null);

  const carregar = async () => {
    try { setEquipamentos(await window.desktop!.terminalListar(dono)); } catch (e) { setErro(errorMessage(e)); }
  };
  useEffect(() => { if (dono && window.desktop) void carregar(); }, [dono]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = equipamentos.filter((e) => !q || `${e.nome} ${e.host} ${e.grupo}`.toLowerCase().includes(q));
    const mapa = new Map<string, EquipamentoTerminal[]>();
    for (const e of filtrados) mapa.set(e.grupo || "Sem pasta", [...(mapa.get(e.grupo || "Sem pasta") ?? []), e]);
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [equipamentos, busca]);

  const conectar = (e: EquipamentoTerminal) => {
    const abrir = (senha?: string) => void abrirSessao(dono, e.nome, `${e.usuario ? e.usuario + "@" : ""}${e.host}:${e.porta}`, { equipamentoId: e.id }, senha);
    if (e.protocolo === "ssh" && !e.temSenha) setPedirSenha({ titulo: `Senha de ${e.usuario || "acesso"} em ${e.nome}`, confirmar: abrir });
    else abrir();
  };
  const conectarRapido = () => {
    const r = lerEnderecoRapido(rapido);
    if (!r) { setErro("Endereço inválido. Exemplos: 10.0.0.1, admin@10.0.0.1:2222, telnet://10.0.0.1"); return; }
    setErro("");
    const abrir = (senha?: string) => {
      void abrirSessao(dono, r.host, `${r.usuario ? r.usuario + "@" : ""}${r.host}:${r.porta}`, { rapido: r }, senha);
      setRapido("");
    };
    if (r.protocolo === "ssh") setPedirSenha({ titulo: `Senha de ${r.usuario || "acesso"} em ${r.host}`, confirmar: abrir });
    else abrir();
  };
  const reconectar = (s: Sessao) => {
    const e = s.origem.equipamentoId ? equipamentos.find((i) => i.id === s.origem.equipamentoId) : undefined;
    const refazer = (senha?: string) => void abrirSessao(dono, s.titulo, s.detalhe, s.origem, senha, s.id);
    const ssh = e ? e.protocolo === "ssh" && !e.temSenha : s.origem.rapido?.protocolo === "ssh";
    if (ssh) setPedirSenha({ titulo: `Senha para reconectar em ${s.titulo}`, confirmar: refazer });
    else refazer();
  };
  const salvar = async () => {
    if (!edicao) return;
    try {
      setErro("");
      await window.desktop!.terminalSalvar({ dono, equipamento: { ...edicao, senha: edicao.senha || undefined } });
      setEdicao(null);
      await carregar();
    } catch (e) { setErro(errorMessage(e)); }
  };
  const excluir = async (e: EquipamentoTerminal) => {
    if (!window.confirm(`Excluir "${e.nome}" da lista? A senha salva também será apagada.`)) return;
    await window.desktop!.terminalExcluir({ dono, id: e.id });
    await carregar();
  };

  if (!window.desktop) return <div className="term-vazio"><SquareTerminal size={28} /><p>O terminal só funciona no aplicativo do Workspace para Windows.</p></div>;
  const atual = sessoes.find((s) => s.id === ativa);

  return (
    <div className="term">
      <aside className="term-lista">
        <div className="term-lista-topo">
          <label className="term-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipamento" aria-label="Buscar equipamento" /></label>
          <Button size="sm" onClick={() => setEdicao(vazio())} title="Adicionar equipamento"><Plus size={15} />Novo</Button>
        </div>
        <div className="term-lista-corpo">
          {!equipamentos.length ? <p className="muted term-dica">Nenhum equipamento salvo ainda. Use “Novo” ou a conexão rápida acima das abas.</p> : null}
          {grupos.map(([grupo, itens]) => (
            <div key={grupo} className="term-grupo">
              <div className="term-grupo-nome"><FolderTree size={13} />{grupo}</div>
              {itens.map((e) => (
                <div key={e.id} className="term-equip">
                  <button type="button" className="term-equip-abrir" onDoubleClick={() => conectar(e)} onClick={() => conectar(e)} title={`Conectar em ${e.host}:${e.porta}`}>
                    <Plug size={14} /><span><b>{e.nome}</b><small>{e.protocolo.toUpperCase()} · {e.host}</small></span>
                  </button>
                  <button type="button" aria-label={`Editar ${e.nome}`} title="Editar" onClick={() => setEdicao({ ...e, senha: "", guardarSenha: e.temSenha })}><Pencil size={13} /></button>
                  <button type="button" aria-label={`Excluir ${e.nome}`} title="Excluir" onClick={() => void excluir(e)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="term-principal">
        <div className="term-barra">
          <div className="term-abas" role="tablist">
            {sessoes.map((s) => (
              <div key={s.id} role="tab" aria-selected={s.id === ativa} className={clsx("term-aba", s.id === ativa && "ativa")} onClick={() => ativarSessao(s.id)} title={s.detalhe}>
                <i className={clsx("term-ponto", s.estado)} aria-hidden="true" />
                <span>{s.titulo}</span>
                <button type="button" aria-label={`Fechar ${s.titulo}`} onClick={(e) => { e.stopPropagation(); fecharSessao(s.id); }}><X size={13} /></button>
              </div>
            ))}
          </div>
          <form className="term-rapido" onSubmit={(e) => { e.preventDefault(); conectarRapido(); }}>
            <input value={rapido} onChange={(e) => setRapido(e.target.value)} placeholder="Conexão rápida: usuario@10.0.0.1:22" aria-label="Conexão rápida" />
            <Button type="submit" size="sm" disabled={!rapido.trim()}>Conectar</Button>
          </form>
        </div>
        {erro && !edicao ? <p className="term-erro" role="alert">{erro}</p> : null}
        <TelaSessoes sessoes={sessoes} ativa={ativa} visivel={active} />
        {!atual ? (
          <div className="term-vazio"><SquareTerminal size={32} /><p>Escolha um equipamento na lista ou digite um endereço na conexão rápida.</p></div>
        ) : atual.estado === "fechado" || atual.estado === "erro" ? (
          <div className="term-reconectar"><Button size="sm" onClick={() => reconectar(atual)}><RefreshCw size={14} />Reconectar</Button></div>
        ) : null}
      </section>
      {edicao ? (
        <div className="term-modal" role="dialog" aria-modal="true" aria-label="Equipamento">
          <form className="term-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
            <h3>{edicao.id ? "Editar equipamento" : "Novo equipamento"}</h3>
            <label>Nome<input required value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} placeholder="OLT Centro" autoFocus /></label>
            <label>Pasta (opcional)<input value={edicao.grupo} onChange={(e) => setEdicao({ ...edicao, grupo: e.target.value })} placeholder="OLTs" /></label>
            <div className="term-form-linha">
              <label>Protocolo
                <select value={edicao.protocolo} onChange={(e) => { const protocolo = e.target.value as ProtocoloTerminal; setEdicao({ ...edicao, protocolo, porta: portaPadrao(protocolo), guardarSenha: protocolo === "ssh" && edicao.guardarSenha }); }}>
                  <option value="ssh">SSH</option>
                  <option value="telnet">Telnet</option>
                </select>
              </label>
              <label>Porta<input type="number" min={1} max={65535} required value={edicao.porta} onChange={(e) => setEdicao({ ...edicao, porta: Number(e.target.value) })} /></label>
            </div>
            <label>Endereço (IP ou nome)<input required value={edicao.host} onChange={(e) => setEdicao({ ...edicao, host: e.target.value })} placeholder="10.0.0.1" /></label>
            <label>Usuário<input value={edicao.usuario} onChange={(e) => setEdicao({ ...edicao, usuario: e.target.value })} autoComplete="off" /></label>
            {edicao.protocolo === "ssh" ? (
              <>
                <label className="term-check"><input type="checkbox" checked={edicao.guardarSenha} onChange={(e) => setEdicao({ ...edicao, guardarSenha: e.target.checked })} />Guardar a senha neste computador (cifrada pelo Windows)</label>
                {edicao.guardarSenha ? <label>Senha<input type="password" value={edicao.senha ?? ""} onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })} placeholder={edicao.id ? "Deixe em branco para manter a atual" : ""} autoComplete="new-password" /></label> : <small className="muted">Sem guardar, a senha é pedida a cada conexão.</small>}
              </>
            ) : <small className="muted">No Telnet a senha é digitada no próprio terminal e nunca é guardada.</small>}
            {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
            <div className="term-form-acoes">
              {edicao.id ? <Button type="button" variant="ghost" size="sm" onClick={() => void window.desktop!.terminalEsquecerChave({ host: edicao.host, porta: edicao.porta }).then(() => setErro("Chave do servidor esquecida; a próxima conexão guarda a nova."))} title="Use depois de trocar o equipamento">Esquecer chave do servidor</Button> : <span />}
              <span>
                <Button type="button" variant="outline" onClick={() => { setEdicao(null); setErro(""); }}>Cancelar</Button>{" "}
                <Button type="submit">Salvar</Button>
              </span>
            </div>
          </form>
        </div>
      ) : null}
      {pedirSenha ? <PedidoSenha titulo={pedirSenha.titulo} onCancelar={() => setPedirSenha(null)} onConfirmar={(s) => { const f = pedirSenha.confirmar; setPedirSenha(null); f(s || undefined); }} /> : null}
    </div>
  );
}

function PedidoSenha({ titulo, onCancelar, onConfirmar }: { titulo: string; onCancelar: () => void; onConfirmar: (senha: string) => void }) {
  const [senha, setSenha] = useState("");
  return (
    <div className="term-modal" role="dialog" aria-modal="true" aria-label="Senha">
      <form className="term-form" onSubmit={(e) => { e.preventDefault(); onConfirmar(senha); }}>
        <h3><KeyRound size={16} /> {titulo}</h3>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus autoComplete="off" /></label>
        <div className="term-form-acoes"><span /><span><Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>{" "}<Button type="submit">Conectar</Button></span></div>
      </form>
    </div>
  );
}

/** Mantém o elemento do xterm de cada sessão dentro da área e ajusta o tamanho ao espaço disponível. */
function TelaSessoes({ sessoes, ativa, visivel }: { sessoes: Sessao[]; ativa: string | null; visivel: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raiz = area.current;
    if (!raiz) return;
    for (const s of sessoes) {
      if (s.el.parentElement !== raiz) raiz.appendChild(s.el);
      s.el.style.display = s.id === ativa && visivel ? "block" : "none";
    }
    const atual = sessoes.find((s) => s.id === ativa);
    const ajustar = () => { if (atual && visivel) { try { atual.fit.fit(); } catch { /* sem tamanho ainda */ } } };
    ajustar();
    if (atual && visivel) atual.term.focus();
    const obs = new ResizeObserver(ajustar);
    obs.observe(raiz);
    return () => obs.disconnect();
  }, [sessoes, ativa, visivel]);
  return <div className="term-area" ref={area} hidden={!sessoes.length} />;
}
