import { propsRelatorio } from "../services/sgpLinks";
import BotaoDestacar from "../components/BotaoDestacar";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Clock,
  MapPin,
  Maximize2,
  Minimize2,
  Search,
  Truck,
  X,
} from "lucide-react";
import { reconectarDashboard, useDashboard } from "../services/dashboard";
import DashboardResumido from "./DashboardResumido";
import IndicadoresAtendimento from "./IndicadoresAtendimento";
import DashboardConnection from "../components/DashboardConnection";
import {
  countTone,
  dashboardSections,
  groupTotal,
  networkStatus,
  type RunningOrder,
} from "../services/dashboardModel";
import { today, useAgendaFeed } from "../services/agenda";
import { useAccess, allowedIds } from "../services/access";
import { useSession } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { networkTools, canUseTool } from "./networkTools";
import { toolItems } from "./toolCatalog";
import {
  Badge,
  EmptyState,
  PageHeader,
  StatusDot,
  type Tone,
} from "../components/ui/primitives";
import { orderTone } from "./agendaStatus";
import "../styles/dashboard.css";

const format = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR");
const time = (s: string | null | undefined) =>
  s && Number.isFinite(Date.parse(s))
    ? new Date(s).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
function elapsed(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60000),
  );
  return minutes < 1
    ? "menos de 1 min"
    : minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}
function agendaTarget(order: RunningOrder) {
  const params = new URLSearchParams();
  if (/^\d{4}-\d{2}-\d{2}$/.test(order.dataAgendamento || ""))
    params.set("data", order.dataAgendamento!);
  if (/^\d+$/.test(String(order.idOrdemServico || "")))
    params.set("os", String(order.idOrdemServico));
  return `/agenda${params.size ? `?${params}` : ""}`;
}
function AgendaSummary({ date }: { date: string }) {
  const feed = useAgendaFeed("agenda", [date]);
  return (
    <section
      className="panel dashboard-agenda"
      aria-label="Resumo da manutenção"
    >
      <div className="panel-heading">
        <div className="panel-title">
          <CalendarDays size={16} strokeWidth={1.9} />
          <h2>Agenda de Técnicos</h2>
          {feed.loaded ? <span className="panel-count">{feed.items.length}</span> : null}
        </div>
        <Link className="panel-link" to="/agenda">
          Ver agenda completa <ChevronRight size={14} />
        </Link>
      </div>
      {feed.items.length ? (
        <ul className="agenda-summary-list">
          {feed.items.slice(0, 6).map((order, index) => (
            <li key={`${order.idOrdemServico || order.id}-${index}`}>
              <Link
                to={`/agenda?os=${encodeURIComponent(String(order.idOrdemServico || order.id || ""))}&data=${date}`}
              >
                <span className="time-label">{order.hora || "Sem horário"}</span>
                <span className="upcoming-info">
                  <strong>{order.cliente || "Cliente não informado"}</strong>
                  <small>{order.tecnico}</small>
                </span>
                <Badge tone={orderTone(order.status)} dot>
                  {order.status || "Sem status"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={Clock} title={
          !feed.configured
            ? "Serviço não configurado."
            : feed.loaded
              ? "Nenhum atendimento retornado para hoje."
              : "Aguardando dados da agenda."
        } />
      )}
    </section>
  );
}
const toneOf: Record<string, Tone> = {
  critical: "crit",
  warning: "warn",
  ok: "ok",
  waiting: "neutral",
};
export default function Dashboard() {
  const { snapshot, customers, connected, status, customersUpdated } =
    useDashboard();
  const user = useSession((s) => s.user);
  const access = useAccess();
  const allowed = allowedIds(access.data);
  const agendaAllowed =
    user?.perfil === "admin" ||
    allowed.has("agenda") ||
    allowed.has("agenda-tecnicos");
  const network = networkStatus(snapshot?.groups || null);
  const search = useDashboard((s) => s.filter);
  const compact = useDashboard((s) => s.compact);
  const [date, setDate] = useState(today);
  const [, tick] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      tick((v) => v + 1);
      setDate(today());
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const sections = dashboardSections
    .map((section) => ({
      ...section,
      fields: section.fields.filter(
        ([, label]) =>
          !search ||
          label
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
      ),
    }))
    .filter((section) => section.fields.length);
  const current =
    customers &&
    [customers.ativos, customers.reduzido, customers.suspensos].every(
      (v) => v !== null,
    )
      ? customers.ativos! + customers.reduzido! + customers.suspensos!
      : null;
  const share = (v: number | null | undefined) =>
    current && v != null ? `${(v / current) * 100}%` : "0%";
  const tools = networkTools.filter((tool) =>
    canUseTool(tool, allowed, user?.perfil),
  );
  const toggleButton = (
    <Button
              variant={compact ? "soft" : "outline"}
              size="sm"
              aria-pressed={compact}
              title={compact ? "Mostrar todos os indicadores, ferramentas e agendas" : "Mostrar só os números principais"}
              onClick={() => {
                try { localStorage.setItem("workspace:dashboard:compact", compact ? "0" : "1"); } catch { /* Sem armazenamento. */ }
                useDashboard.setState({ compact: !compact });
              }}
            >
              {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              {compact ? "Visão completa" : "Visão resumida"}
            </Button>
  );
  return (
    <div
      className={`page dashboard-page ${compact ? "dashboard-compact" : ""}`}
    >
      {compact ? (
        <div className="noc-toolbar">
          {toggleButton}
          <BotaoDestacar kind="dashboard" />
        </div>
      ) : (
        <PageHeader
          icon={ChartNoAxesCombined}
          title="Painel NOC"
          description="Operação, clientes e ocorrências em tempo real."
          actions={<>{toggleButton}<BotaoDestacar kind="dashboard" /></>}
          meta={
            <span
              className={`connection ${connected ? "online" : ""}`}
              role="status"
            >
              <i />
              {status}
              {snapshot ? <span> · {format(snapshot.total)} ocorrências abertas</span> : null}
              {snapshot ? (
                <span className="connection-time">
                  {" "}
                  · {time(snapshot.updated)}
                </span>
              ) : null}
            </span>
          }
        />
      )}
      {snapshot?.salesStale ? (
        <p className="inline-error" role="alert">
          Instalações: a última consulta ao SGP falhou. Exibindo a última contagem recebida
          {snapshot.salesUpdated ? ` às ${time(snapshot.salesUpdated)}` : ""}.
        </p>
      ) : null}
      {snapshot?.running?.stale ? (
        <p className="inline-error" role="alert">
          Chamados em andamento: a última consulta ao SGP falhou. Os dados podem estar desatualizados.
        </p>
      ) : null}
      {compact ? (
        <DashboardResumido onOpenRunning={() => dialog.current?.showModal()} />
      ) : (
        <>
          {tools.length ? (
            <nav className="dashboard-tools" aria-label="Ferramentas do Dashboard">
              {tools.map((tool) => {
                const meta = toolItems.find((t) => t.path === tool.path);
                const Icon = meta?.icon;
                return (
                  <Link key={tool.path} to={tool.path}>
                    {Icon ? <Icon size={15} strokeWidth={1.9} /> : null}
                    {tool.title}
                    <ChevronRight size={14} className="chip-arrow" />
                  </Link>
                );
              })}
            </nav>
          ) : null}
          {!connected ? (
            <p className="inline-error" role="alert">
              {snapshot
                ? "Sem conexão com o servidor. Os números são da última atualização recebida e podem estar desatualizados."
                : "Aguardando conexão com o servidor do dashboard."}
              {" "}<button type="button" onClick={reconectarDashboard}>Tentar novamente</button>
            </p>
          ) : null}
          <div className="dashboard-overview">
            <section
              className={`panel network-state ${network.state}`}
              aria-label="Situação da rede"
            >
              <div className="network-state-head">
                <span className="band-signal" aria-hidden="true">
                  <Activity size={20} strokeWidth={2} />
                </span>
                <span className="band-label">Situação da rede</span>
              </div>
              <h2>{network.label}</h2>
              <dl>
                <div>
                  <dt>Offline</dt>
                  <dd>{format(network.offline)}</dd>
                </div>
                <div>
                  <dt>Massivos</dt>
                  <dd>{format(network.massive)}</dd>
                </div>
              </dl>
              <p className="network-state-foot">
                Última atualização: {time(snapshot?.updated)}
              </p>
            </section>
            <section
              className="panel customer-counts"
              aria-label="Base de clientes"
            >
              <div className="panel-heading">
                <div className="panel-title">
                  <h2>Base de clientes</h2>
                </div>
                <span className="muted text-xs">
                  {customersUpdated
                    ? `Base recebida às ${time(customersUpdated)}`
                    : "Aguardando atualização da base de clientes."}
                </span>
              </div>
              <dl>
                {(
                  [
                    ["Total de clientes", customers?.total, "neutral"],
                    ["Total atualmente", current, "info"],
                    ["Ativos", customers?.ativos, "ok"],
                    ["V. Reduzida", customers?.reduzido, "warn"],
                    ["Suspensos", customers?.suspensos, "crit"],
                    ["Cancelados", customers?.cancelados, "neutral"],
                  ] as const
                ).map(([label, value, tone]) => (
                  <div key={label} data-tone={tone}>
                    <dt>
                      <StatusDot tone={tone} />
                      {label}
                    </dt>
                    <dd>{format(value)}</dd>
                  </div>
                ))}
              </dl>
              <div
                className="composition-bar"
                role="img"
                aria-label="Composição da base atual: ativos, velocidade reduzida e suspensos"
              >
                <span className="tone-ok" style={{ width: share(customers?.ativos) }} />
                <span className="tone-warn" style={{ width: share(customers?.reduzido) }} />
                <span className="tone-crit" style={{ width: share(customers?.suspensos) }} />
              </div>
            </section>
          </div>
          <div className="dashboard-controls">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Filtrar indicadores"
                placeholder="Filtrar indicadores"
                value={search}
                onChange={(e) => useDashboard.setState({ filter: e.target.value })}
              />
              {search ? (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Limpar filtro"
                  onClick={() => useDashboard.setState({ filter: "" })}
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
          </div>
          <div className="dashboard-sections">
            {sections.map((section) => (
              <section
                key={section.title}
                className="panel indicator-panel"
                aria-label={section.title}
              >
                <h2>{section.title}</h2>
                <dl>
                  {section.fields.map(([key, label]) => {
                    const value = groupTotal(snapshot?.groups || null, key);
                    const tone = countTone(value, key);
                    return (
                      <div key={`${key}-${label}`} data-tone={tone} {...propsRelatorio(label)}>
                        <dt>
                          <StatusDot tone={toneOf[tone]} />
                          {label}
                        </dt>
                        <dd>{format(value)}</dd>
                      </div>
                    );
                  })}
                </dl>
                {section.title === "Campo" ? (
                  <button
                    className="dashboard-running"
                    disabled={!snapshot?.running}
                    onClick={() => dialog.current?.showModal()}
                  >
                    <Truck size={15} strokeWidth={1.9} />
                    Em Andamento <strong>{format(snapshot?.running?.total)}</strong>
                    <ChevronRight size={16} />
                  </button>
                ) : null}
                {section.title === "Comercial" ? (
                  <div
                    className="dashboard-sales"
                    data-tone={
                      snapshot?.salesRunning != null && snapshot.salesRunning > 10
                        ? "critical"
                        : "ok"
                    }
                  >
                    Em andamento <strong>{format(snapshot?.salesRunning)}</strong>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
          {!sections.length ? (
            <EmptyState icon={Search} title="Nenhum indicador corresponde à busca." />
          ) : null}
          {agendaAllowed ? (
            <div className="dashboard-agendas">
              <AgendaSummary date={date} />
            </div>
          ) : null}
        </>
      )}
      <DashboardConnection />
      {agendaAllowed ? <IndicadoresAtendimento modo={compact ? "resumido" : "completo"} /> : null}
      <dialog
        className="running-dialog"
        ref={dialog}
        aria-labelledby="running-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <header>
          <div>
            <h2 id="running-title">Chamados em andamento</h2>
            <p className="muted">
              Atualização SGP: {time(snapshot?.running?.updated)}
              {snapshot?.running?.stale || !connected
                ? " · Dados podem estar desatualizados"
                : ""}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar detalhes"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        <div className="running-orders">
          {snapshot?.running?.orders.length ? (
            snapshot.running.orders.map((order, index) => (
              <article key={`${order.idOrdemServico || order.id}-${index}`}>
                <div className="running-order-head">
                  <h3>
                    <span className="mono">
                      #{order.protocolo || order.idOrdemServico || order.id || "—"}
                    </span>{" "}
                    {order.cliente || "Cliente não informado"}
                  </h3>
                  <Badge tone={orderTone(order.status) === "neutral" ? "live" : orderTone(order.status)} dot>
                    {order.status || "Em andamento"}
                  </Badge>
                </div>
                <dl>
                  {[
                    ["Técnico", order.tecnico],
                    ["Equipe", order.equipe],
                    ["Tipo", order.tipo],
                    ["Status", order.status],
                    ["Check-in", order.checkin],
                    ["Início", order.inicioExecucao || order.inicioExecucaoISO],
                    ["Tempo", elapsed(order.inicioExecucaoISO)],
                    ["Região", order.bairro || order.regiao],
                    ["Endereço", order.endereco],
                    ["Localização", order.localizacao],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {agendaAllowed ? (
                  <Link className="running-link" to={agendaTarget(order)}>
                    <CalendarDays size={15} />
                    Abrir na Agenda
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState
              compact
              icon={MapPin}
              title="Nenhum chamado em atendimento retornado pelo servidor."
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
