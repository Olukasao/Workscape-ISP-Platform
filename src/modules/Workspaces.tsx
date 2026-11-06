import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, Globe, LayoutDashboard, LayoutGrid, MessageSquare, Phone, Pin, Play, RadioTower, Save, SquareTerminal, Trash2, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge, EmptyState, PageHeader } from "../components/ui/primitives";
import { errorMessage } from "../services/api";
import { MINIAPPS, type JanelaKind } from "../services/janelaDestacada";
import { useSession } from "../stores/workspace";
import type { Workspace, WorkspaceItem } from "../../electron/workspaces";

const ICONES: Record<JanelaKind, typeof Globe> = {
  agenda: CalendarDays,
  chat: MessageSquare,
  navegador: Globe,
  rede: RadioTower,
  dashboard: ChartNoAxesCombined,
  resumo: LayoutDashboard,
  terminal: SquareTerminal,
  telefone: Phone,
};
const ORDEM: JanelaKind[] = ["dashboard", "rede", "agenda", "chat", "resumo", "navegador"];

export default function Workspaces() {
  const user = useSession((s) => s.user);
  const owner = String(user?.id ?? "");
  const desktop = window.desktop;
  const [lista, setLista] = useState<Workspace[]>([]);
  const [abertas, setAbertas] = useState<WorkspaceItem[]>([]);
  const [escolhidos, setEscolhidos] = useState<JanelaKind[]>(["dashboard", "rede"]);
  const [porCima, setPorCima] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!desktop?.workspacesList || !owner) return;
    try {
      const r = await desktop.workspacesList(owner);
      setLista(r.lista);
      setAbertas(r.abertas);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [desktop, owner]);
  useEffect(() => {
    void carregar();
    // Abrir ou fechar uma janela destacada muda o que dá para salvar.
    return desktop?.onDetachedState?.(() => void carregar());
  }, [carregar, desktop]);

  const executar = async (acao: () => Promise<unknown>) => {
    setErro("");
    setOcupado(true);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(errorMessage(e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setOcupado(false);
    }
  };
  const alternar = (k: JanelaKind) => setEscolhidos((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const nomeValido = nome.trim().length > 0;

  if (!desktop?.workspacesList)
    return (
      <div className="page">
        <PageHeader icon={LayoutGrid} title="Workspaces" description="Conjuntos de painéis em janelas próprias." />
        <EmptyState icon={LayoutGrid} title="Disponível no aplicativo do Windows">Os workspaces abrem janelas do aplicativo instalado.</EmptyState>
      </div>
    );

  return (
    <div className="page workspaces-page">
      <PageHeader
        icon={LayoutGrid}
        title="Workspaces"
        description="Monte seu conjunto de painéis em janelas próprias, deixe-os por cima das outras janelas e abra tudo com um clique."
        actions={
          abertas.length ? (
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void executar(() => desktop.workspacesCloseAll())}>
              <XCircle size={15} /> Fechar {abertas.length} janela{abertas.length === 1 ? "" : "s"}
            </Button>
          ) : undefined
        }
      />
      {erro ? <div className="inline-error" role="alert">{erro}</div> : null}

      <section className="panel ws-montar" aria-labelledby="ws-montar-titulo">
        <h2 id="ws-montar-titulo">Montar um workspace</h2>
        <p className="muted">Escolha os painéis. Eles abrem lado a lado na tela principal; depois você pode mover e redimensionar cada janela, inclusive para outro monitor, e salvar a disposição.</p>
        <div className="ws-paineis" role="group" aria-label="Painéis">
          {ORDEM.map((k) => {
            const Icone = ICONES[k];
            const on = escolhidos.includes(k);
            return (
              <button key={k} type="button" className={on ? "ws-painel on" : "ws-painel"} aria-pressed={on} onClick={() => alternar(k)}>
                <Icone size={18} />
                <span>{MINIAPPS[k].titulo}</span>
              </button>
            );
          })}
        </div>
        <div className="ws-opcoes">
          <label className="settings-check"><input type="checkbox" checked={porCima} onChange={(e) => setPorCima(e.target.checked)} /><span>Manter por cima das outras janelas (flutuante)</span></label>
          <label className="settings-check"><input type="checkbox" checked={compacto} onChange={(e) => setCompacto(e.target.checked)} /><span>Modo compacto (menos textos e espaços)</span></label>
        </div>
        <div className="ws-acoes">
          <Button disabled={ocupado || !escolhidos.length} onClick={() => void executar(() => desktop.workspacesTile({ kinds: escolhidos, pinned: porCima, compact: compacto }))}>
            <Play size={15} /> Abrir lado a lado
          </Button>
          <input
            className="ws-nome"
            aria-label="Nome do workspace"
            placeholder="Nome para salvar (ex.: Sala de controle)"
            maxLength={60}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={ocupado || !nomeValido || !abertas.length}
            title={abertas.length ? "Guarda a posição, o tamanho e as opções das janelas abertas agora" : "Abra os painéis antes de salvar"}
            onClick={() => void executar(async () => { await desktop.workspacesSave({ owner, name: nome.trim() }); setNome(""); })}
          >
            <Save size={15} /> Salvar disposição atual
          </Button>
        </div>
      </section>

      <section aria-labelledby="ws-meus-titulo">
        <h2 id="ws-meus-titulo" className="ws-secao">Meus workspaces</h2>
        {!lista.length ? (
          <EmptyState icon={LayoutGrid} compact title="Nenhum workspace salvo ainda">
            Abra alguns painéis, arrume as janelas como quiser e use “Salvar disposição atual”.
          </EmptyState>
        ) : (
          <ul className="ws-lista">
            {lista.map((w) => (
              <li key={w.id} className="panel ws-card">
                <div className="ws-card-topo">
                  <h3>{w.name}</h3>
                  {w.items.some((i) => i.pinned) ? <Badge tone="info"><Pin size={11} /> Por cima</Badge> : null}
                </div>
                <ul className="ws-chips" aria-label="Painéis">
                  {w.items.map((i) => {
                    const Icone = ICONES[i.kind];
                    return <li key={i.kind}><Icone size={14} /> {MINIAPPS[i.kind].titulo}{i.compact ? " · compacto" : ""}</li>;
                  })}
                </ul>
                <div className="ws-acoes">
                  <Button size="sm" disabled={ocupado} onClick={() => void executar(() => desktop.workspacesOpen({ owner, id: w.id }))}>
                    <Play size={14} /> Abrir
                  </Button>
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => void executar(() => desktop.workspacesDelete({ owner, id: w.id }))}>
                    <Trash2 size={14} /> Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
