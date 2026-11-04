import { useEffect, useState } from "react";
import BotaoDestacar from "../components/BotaoDestacar";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../services/dashboard";
import { networkStatus } from "../services/dashboardModel";
import {
  ArrowUpRight,
  CalendarDays,
  MessageSquare,
  Users,
  Wrench,
  Radio,
  Activity,
  CircleCheck,
  Clock,
  Server,
  ChevronRight,
  LayoutDashboard,
  ClipboardCheck,
} from "lucide-react";
import { useChatData, unreadCount } from "../services/data";
import { useAgendaFeed, today } from "../services/agenda";
import { useServers, useNotices } from "../stores/workspace";
import { Button } from "../components/ui/button";
import {
  Avatar,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  StatusDot,
  type Tone,
} from "../components/ui/primitives";
import { orderTone } from "./agendaStatus";
import { useContratacoes } from "../services/contratacoes";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR");
const stateTone: Record<string, Tone> = {
  ok: "ok",
  warning: "warn",
  critical: "crit",
  waiting: "neutral",
};

function NetworkBand() {
  const navigate = useNavigate();
  const { snapshot, connected, status } = useDashboard();
  const configured = !!useServers((s) => s.config.dashboard);
  const network = networkStatus(snapshot?.groups || null);
  const tone = stateTone[network.state] || "neutral";
  return (
    <section
      className="network-band"
      data-state={network.state}
      aria-label="Situação da rede"
    >
      <div className="network-band-state">
        <span className={`band-signal tone-${tone}`} aria-hidden="true">
          <Activity size={20} strokeWidth={2} />
        </span>
        <div>
          <span className="band-label">Situação da rede</span>
          <strong>
            {configured || snapshot ? network.label : "Dashboard não configurado"}
          </strong>
        </div>
      </div>
      <dl className="network-band-stats">
        <div>
          <dt>Offline</dt>
          <dd>{fmt(network.offline)}</dd>
        </div>
        <div>
          <dt>Massivos</dt>
          <dd>{fmt(network.massive)}</dd>
        </div>
        <div>
          <dt>Em campo</dt>
          <dd>{fmt(snapshot?.running?.total)}</dd>
        </div>
        <div>
          <dt>Atualizado</dt>
          <dd className="is-time">
            {snapshot
              ? new Date(snapshot.updated).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </dd>
        </div>
      </dl>
      <div className="network-band-side">
        <span className="band-conn">
          <StatusDot tone={connected ? "live" : "warn"} pulse={connected} />
          {status}
        </span>
        <Button size="sm" onClick={() => navigate("/dashboard")}>
          Abrir painel NOC
          <ChevronRight size={15} />
        </Button>
      </div>
    </section>
  );
}

function OperationalDashboard() {
  const { snapshot, connected, status } = useDashboard();
  const url = useServers((s) => s.config.dashboard);
  const data = snapshot?.groups || null;
  const updated = snapshot
    ? new Date(snapshot.updated).toLocaleTimeString("pt-BR")
    : "";
  const entries = data ? Object.entries(data).slice(0, 12) : [];
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Panel
      title="Pulso da operação"
      icon={Activity}
      actions={
        <span className={`connection ${connected ? "online" : ""}`}>
          <i />
          {status}
        </span>
      }
    >
      {data ? (
        <div className="operational-metrics">
          {entries.map(([key, value]) => (
            <div key={key} className="op-row">
              <span title={key}>{key}</span>
              <div className="metric-track" aria-hidden="true">
                <div style={{ width: `${(value / max) * 100}%` }} />
              </div>
              <strong>{value}</strong>
            </div>
          ))}
          <small className="muted">
            Última resposta às {updated}
            {!connected ? " · conexão interrompida" : ""}
          </small>
        </div>
      ) : (
        <EmptyState
          compact
          icon={Radio}
          title={url ? "Aguardando indicadores" : "Seus indicadores, conectados."}
        >
          {url
            ? "Os valores aparecem após a resposta do dashboard."
            : "Configure o serviço de dashboard para acompanhar a operação."}
        </EmptyState>
      )}
    </Panel>
  );
}

export default function Resumo() {
  const navigate = useNavigate(),
    notices = useNotices((s) => s.items);
  const { conversations, groups, contacts } = useChatData();
  const [date, setDate] = useState(today);
  useEffect(() => {
    const t = setInterval(() => setDate(today()), 60000);
    return () => clearInterval(t);
  }, []);
  const maintenance = useAgendaFeed("agenda", [date]);
  const contratacoes = useContratacoes();
  const unread =
    conversations.data && groups.data
      ? unreadCount(conversations.data) + unreadCount(groups.data)
      : null;
  const cards = [
    {
      label: "Pessoas online",
      value: contacts.data?.filter((c) => c.status === "online").length,
      icon: Users,
      path: "/chat",
      note: contacts.isError
        ? "Serviço indisponível"
        : "Conectadas ao Chat Interno",
      tone: "ok",
    },
    {
      label: "Mensagens não lidas",
      value: unread,
      icon: MessageSquare,
      path: "/chat",
      note:
        conversations.isError || groups.isError
          ? "Sincronização indisponível"
          : "Conversas e grupos",
      tone: "info",
    },
    {
      label: "Atendimentos hoje",
      value: maintenance.loaded ? maintenance.items.length : null,
      icon: Wrench,
      path: "/agenda",
      note: maintenance.configured
        ? "Agenda de manutenção"
        : "Servidor não configurado",
      tone: "warn",
    },
    {
      label: "Contratações aguardando",
      value: contratacoes.recebido ? contratacoes.pendentes : null,
      icon: ClipboardCheck,
      path: "/contratacoes",
      note: !contratacoes.recebido
        ? "Aguardando o Chat Interno"
        : contratacoes.conectado
          ? "Pedidos do site acessanet.com.br"
          : "Site indisponível · última lista",
      tone: "info",
    },
  ];
  const upcoming = [
    ...maintenance.items.map((i) => ({ ...i, path: "/agenda" })),
  ]
    .sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"))
    .slice(0, 6);
  return (
    <div className="page home-page">
      <PageHeader
        icon={LayoutDashboard}
        title="Resumo"
        actions={<BotaoDestacar kind="resumo" />}
        description="Rede, conversas e atendimentos do dia em uma visão."
        meta={
          <span className="date-pill">
            <CalendarDays size={14} />
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "America/Sao_Paulo",
            }).format(new Date())}
          </span>
        }
      />
      <NetworkBand />
      <div className="metric-grid">
        {cards.map((c) => (
          <button
            className="metric-card"
            data-tone={c.tone}
            key={c.label}
            onClick={() => navigate(c.path)}
          >
            <span className="metric-icon">
              <c.icon size={17} strokeWidth={1.9} />
            </span>
            <span className="metric-body">
              <span className="metric-label">{c.label}</span>
              <strong>{c.value ?? "—"}</strong>
              <small>{c.note}</small>
            </span>
            <ArrowUpRight size={16} className="metric-arrow" />
          </button>
        ))}
      </div>
      <div className="home-grid">
        <Panel
          title="Na agenda de hoje"
          icon={CalendarDays}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate("/agenda")}>
              Ver agenda
              <ArrowUpRight size={14} />
            </Button>
          }
        >
          {upcoming.length ? (
            <ol className="upcoming-list">
              {upcoming.map((o, i) => (
                <li key={`${o.path}${o.id || i}`}>
                  <button onClick={() => navigate(o.path)}>
                    <span className="time-label">{o.hora || "—"}</span>
                    <span className="upcoming-info">
                      <strong>{o.cliente}</strong>
                      <small>
                        {o.tecnico} · {o.bairro || "Endereço não informado"}
                      </small>
                    </span>
                    <Badge tone={orderTone(o.status)} dot>
                      {o.status || "Sem status"}
                    </Badge>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              compact
              icon={Clock}
              title={
                maintenance.loaded
                  ? "Nenhum atendimento retornado"
                  : "Aguardando sua operação"
              }
            >
              Os agendamentos aparecem quando os serviços respondem.
            </EmptyState>
          )}
        </Panel>
        <OperationalDashboard />
      </div>
      <div className="home-grid">
        <Panel
          title="Últimas notificações"
          icon={MessageSquare}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/notifications")}
            >
              Ver todas
              <ArrowUpRight size={14} />
            </Button>
          }
        >
          {notices.length ? (
            <div className="notice-preview">
              {notices.slice(0, 3).map((n) => (
                <button key={n.id} onClick={() => navigate(n.target)}>
                  <Avatar name={n.title} size="sm" />
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                  </div>
                  <time>
                    {new Date(n.time).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={CircleCheck} tone="ok" title="Tudo tranquilo por aqui">
              As novas mensagens serão reunidas neste espaço.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Seu próximo passo" className="shortcuts-panel">
          {[
            [MessageSquare, "Converse com sua equipe", "Mensagens e arquivos", "/chat"],
            [CalendarDays, "Organize a operação", "Agendas de campo", "/agenda"],
            [Server, "Conecte seu ambiente", "Serviços e preferências", "/settings"],
          ].map(([Icon, title, subtitle, path]) => {
            const I = Icon as typeof Users;
            return (
              <button
                className="shortcut-row"
                key={String(path)}
                onClick={() => navigate(String(path))}
              >
                <span className="shortcut-icon">
                  <I size={17} strokeWidth={1.9} />
                </span>
                <span>
                  <strong>{String(title)}</strong>
                  <small>{String(subtitle)}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </Panel>
      </div>
      <p className="data-footnote">
        Dados dos serviços conectados. “—” indica informação ainda
        indisponível.
      </p>
    </div>
  );
}
