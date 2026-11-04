import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock, FileText, LifeBuoy, MousePointerClick, RefreshCw, ShoppingCart, UserPlus, Users, Wifi } from "lucide-react";
import { clsx } from "clsx";
import { EmptyState, Panel, Skeleton } from "../../components/ui/primitives";
import { errorMessage } from "../../services/api";
import { useResumoSite, type Periodo, type Ponto, type ResumoSite } from "./siteApi";

const PERIODOS: [Periodo, string][] = [["today", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"], ["custom", "Personalizado"]];
const DISPOSITIVO: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet", unknown: "Não identificado" };
const STATUS_CONTRATO: Record<string, string> = { novo: "Novo", em_analise: "Em análise", sem_cobertura: "Sem cobertura", em_atendimento: "Em atendimento", agendado: "Agendado", contratado: "Contratado", cancelado: "Cancelado" };
const EVENTO_PAGINA: Record<string, string> = { login: "Login", home: "Início", tickets: "Chamados", invoices: "Faturas", billing: "Financeiro", connection: "Conexão", plan: "Plano", contracts: "Contratos", notices: "Avisos", logout: "Saída" };
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const dia = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);
const duracao = (s: number | null) => (s == null ? "—" : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
const rotulo = (mapa: Record<string, string>) => (p: Ponto) => ({ ...p, label: mapa[p.label] ?? mapa[p.label.toLowerCase()] ?? p.label });

function Kpi({ icone: Icone, valor, titulo, apoio }: { icone: typeof Users; valor: string; titulo: string; apoio?: string }) {
  return (
    <div className="mk-kpi"><span className="ic"><Icone size={17} /></span><b>{valor}</b><small>{titulo}</small>{apoio && <em>{apoio}</em>}</div>
  );
}

/** Colunas por dia, em SVG, com os tokens do tema. */
function Colunas({ pontos, vazio = "Sem dados no período." }: { pontos: Ponto[]; vazio?: string }) {
  if (!pontos.length) return <p className="mudo">{vazio}</p>;
  const max = Math.max(1, ...pontos.map((p) => p.value));
  const w = 560, h = 130, passo = w / pontos.length;
  const rot = (i: number) => i === 0 || i === pontos.length - 1 || (pontos.length > 8 && i === Math.floor(pontos.length / 2));
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} className="mk-serie" role="img" aria-label={`Gráfico: ${pontos.map((p) => `${dia(p.label)} ${p.value}`).join(", ")}`}>
      {pontos.map((p, i) => (
        <g key={p.label}>
          <rect x={i * passo + 2} y={h - (p.value / max) * h} width={Math.min(34, Math.max(2, passo - 4))} height={Math.max(1, (p.value / max) * h)} rx="2"><title>{`${dia(p.label)}: ${num(p.value)}`}</title></rect>
          {rot(i) && <text x={i * passo + 2} y={h + 17} textAnchor={i === pontos.length - 1 && pontos.length > 1 ? "end" : "start"}>{dia(p.label)}</text>}
        </g>
      ))}
    </svg>
  );
}

function Barras({ pontos, vazio = "Sem dados no período." }: { pontos: Ponto[]; vazio?: string }) {
  if (!pontos.length) return <p className="mudo">{vazio}</p>;
  const max = Math.max(1, ...pontos.map((p) => p.value));
  return <ul className="mk-barras">{pontos.map((p) => <li key={p.label}><span title={p.label}>{p.label}</span><div><i style={{ width: `${(p.value / max) * 100}%` }} /></div><b>{num(p.value)}</b></li>)}</ul>;
}

function Horas({ pontos }: { pontos: Ponto[] }) {
  const porHora = useMemo(() => Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), value: pontos.find((p) => Number(p.label) === h)?.value ?? 0 })), [pontos]);
  const max = Math.max(1, ...porHora.map((p) => p.value));
  return <div className="mk-horas" role="img" aria-label="Acessos por hora do dia (horário UTC)">{porHora.map((p) => <div key={p.label} title={`${p.label}h: ${num(p.value)}`}><i style={{ height: `${Math.max(3, (p.value / max) * 100)}%` }} /><small>{Number(p.label) % 6 === 0 ? p.label : ""}</small></div>)}</div>;
}

export default function SiteDashboard() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [de, setDe] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: d, isLoading, error, isFetching, refetch } = useResumoSite(periodo, de, ate);
  const mensagem = error ? errorMessage(error) : "";

  return (
    <div className="mk-site">
      <div className="mk-barra">
        <div className="mk-periodos" role="tablist" aria-label="Período">
          {PERIODOS.map(([id, r]) => <button key={id} role="tab" aria-selected={periodo === id} className={clsx(periodo === id && "on")} onClick={() => setPeriodo(id)}>{r}</button>)}
        </div>
        {periodo === "custom" && (
          <div className="mk-datas"><CalendarDays size={15} />
            <input type="date" aria-label="Data inicial" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /> até
            <input type="date" aria-label="Data final" value={ate} min={de} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setAte(e.target.value)} />
          </div>
        )}
        <span className="grow" />
        {d && <small className="mudo"><Clock size={12} /> Atualizado às {new Date(d.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={14} className={clsx(isFetching && "girando")} /> Atualizar</button>
      </div>

      {isLoading ? <Skeleton lines={8} /> : mensagem ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar os dados do site" tone="warn">{mensagem}</EmptyState>
      ) : d ? <Conteudo d={d} /> : null}
    </div>
  );
}

function Conteudo({ d }: { d: ResumoSite }) {
  const c = d.customers;
  return (
    <>
      <div className="mk-kpis">
        <Kpi icone={Users} valor={num(c.uniqueClients)} titulo="Clientes que acessaram" apoio={`${num(c.newClients)} novos · ${num(c.returningClients)} recorrentes`} />
        <Kpi icone={MousePointerClick} valor={num(c.accesses)} titulo="Acessos à Central" apoio={`${num(c.accessesToday)} hoje`} />
        <Kpi icone={Clock} valor={num(d.sessions.inRange)} titulo="Sessões" apoio={`duração média ${duracao(d.sessions.averageSeconds)}`} />
        <Kpi icone={UserPlus} valor={num(d.accounts.createdInRange)} titulo="Contas criadas" apoio={`${num(d.accounts.total)} no total`} />
        <Kpi icone={LifeBuoy} valor={num(d.tickets.openedInRange)} titulo="Chamados abertos pelo site" />
        <Kpi icone={ShoppingCart} valor={num(d.contracts.total)} titulo="Contratações online" apoio={`${num(d.planLeads.total)} pedidos de plano`} />
        <Kpi icone={Wifi} valor={num(d.wifi.visitorsInRange)} titulo="Visitantes do Wi-Fi público" apoio={`${num(d.wifi.sessionsInRange)} sessões`} />
        <Kpi icone={FileText} valor={num(d.forms.jobApplications)} titulo="Candidaturas (Trabalhe conosco)" />
      </div>

      <div className="mk-duas">
        <Panel title="Acessos por dia"><Colunas pontos={c.accessesByDay} /></Panel>
        <Panel title="Clientes únicos por dia"><Colunas pontos={c.uniqueClientsByDay} /></Panel>
      </div>
      <div className="mk-duas">
        <Panel title="Sessões iniciadas (logins) por dia"><Colunas pontos={d.sessions.loginsByDay} /></Panel>
        <Panel title="Contas criadas por dia"><Colunas pontos={d.accounts.createdByDay} vazio="Nenhuma conta criada no período." /></Panel>
      </div>
      <div className="mk-duas">
        <Panel title="Chamados abertos pelo site, por dia"><Colunas pontos={d.tickets.openedByDay} vazio="Nenhum chamado aberto no período." /></Panel>
        <Panel title="Autoatendimento no período">
          <ul className="mk-lista">
            <li><span>Segundas vias de fatura</span><b>{num(d.tickets.secondCopies)}</b></li>
            <li><span>Consultas de fatura e financeiro</span><b>{num(d.tickets.invoiceQueries)}</b></li>
            <li><span>Consultas de conexão</span><b>{num(d.tickets.connectionQueries)}</b></li>
            <li><span>Promessas de pagamento</span><b>{num(d.tickets.paymentPromises)}</b></li>
          </ul>
        </Panel>
      </div>
      <div className="mk-duas">
        <Panel title="Dispositivos"><Barras pontos={c.devices.map(rotulo(DISPOSITIVO))} /></Panel>
        <Panel title="Páginas mais acessadas"><Barras pontos={c.pages.map(rotulo(EVENTO_PAGINA))} /></Panel>
      </div>
      <Panel title="Acessos por hora do dia"><Horas pontos={c.accessesByHour} /></Panel>

      <div className="mk-duas">
        <Panel title="Contratações online por situação"><Barras pontos={d.contracts.byStatus.map(rotulo(STATUS_CONTRATO))} vazio="Nenhuma contratação no período." /></Panel>
        <Panel title="Planos mais procurados"><Barras pontos={[...d.contracts.byPlan, ...d.planLeads.byPlan].reduce<Ponto[]>((acc, p) => { const x = acc.find((a) => a.label === p.label); if (x) x.value += p.value; else acc.push({ ...p }); return acc; }, []).sort((a, b) => b.value - a.value).slice(0, 8)} vazio="Nenhum pedido de plano no período." /></Panel>
      </div>
      <div className="mk-duas">
        <Panel title="Cidades das contratações"><Barras pontos={d.contracts.byCity} vazio="Sem dados no período." /></Panel>
        <Panel title="Contratações por dia"><Colunas pontos={d.contracts.byDay} vazio="Nenhuma contratação no período." /></Panel>
      </div>
      <div className="mk-duas">
        <Panel title="Wi-Fi público: sessões por dia"><Colunas pontos={d.wifi.sessionsByDay} vazio="Nenhuma sessão no período." /></Panel>
        <Panel title="Wi-Fi público e marketing">
          <ul className="mk-lista">
            <li><span>Visitantes cadastrados (total)</span><b>{num(d.wifi.visitorsTotal)}</b></li>
            <li><span>Aceitaram receber ofertas</span><b>{num(d.wifi.marketingLeads)}</b></li>
            <li><span>Contratações com aceite de ofertas</span><b>{num(d.contracts.marketingOptIn)}</b></li>
            <li><span>Relatos de problema no site</span><b>{num(d.forms.bugReports)}</b></li>
          </ul>
        </Panel>
      </div>
      <p className="mk-nota">“Clientes” são pessoas que entraram na Central do Cliente do site. Visitas anônimas ao site institucional ainda não são medidas. As datas seguem o horário do servidor (UTC). Os números não incluem nomes, CPF, e-mail nem telefone.</p>
    </>
  );
}
