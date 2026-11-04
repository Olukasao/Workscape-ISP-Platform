import { Bell, CheckCheck, ChevronRight, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotices, type Notice } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { Avatar, EmptyState, PageHeader } from "../components/ui/primitives";

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayTitle(iso: string) {
  const d = new Date(iso),
    now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function Notifications() {
  const { items, readAll } = useNotices(),
    navigate = useNavigate();
  const unread = items.filter((n) => !n.read).length;
  const groups = items.reduce<[string, Notice[]][]>((acc, n) => {
    const last = acc.at(-1);
    if (last && last[0] === dayKey(n.time)) last[1].push(n);
    else acc.push([dayKey(n.time), [n]]);
    return acc;
  }, []);
  return (
    <div className="page notifications-page">
      <PageHeader
        icon={Bell}
        title="Notificações"
        description="Mensagens recebidas durante esta sessão, mesmo com outro módulo aberto."
        meta={
          unread ? (
            <span className="heading-meta">{unread} não vistas</span>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" onClick={readAll} disabled={!unread}>
            <CheckCheck size={15} />
            Marcar como vistas
          </Button>
        }
      />
      {items.length ? (
        groups.map(([key, list]) => (
          <section className="notification-group" key={key}>
            <h2 className="group-label">{dayTitle(list[0].time)}</h2>
            <div className="panel panel--flush">
              {list.map((n) => (
                <button
                  className={`notification-row ${n.read ? "read" : ""}`}
                  key={n.id}
                  onClick={() => navigate(n.target)}
                >
                  <Avatar name={n.title} size="md" />
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
                  <ChevronRight size={16} className="row-arrow" />
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="panel">
          <EmptyState icon={BellOff} title="Você está em dia">
            Novas notificações aparecem aqui, mesmo quando você está em outro
            módulo.
          </EmptyState>
        </div>
      )}
    </div>
  );
}
