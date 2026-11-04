import { useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  LogOut,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRound,
} from "lucide-react";
import { clsx } from "clsx";
import { useNotices, usePreferences, type User } from "../../stores/workspace";
import { signOut } from "../../services/session";
import { Avatar, Kbd, StatusDot } from "../../components/ui/primitives";
import TelefoneTopo from "../../components/TelefoneTopo";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

function NoticesMenu() {
  const navigate = useNavigate();
  const { items, readAll } = useNotices();
  const unread = items.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className={clsx("icon-button", open && "is-open")}
        aria-label={unread ? `Abrir notificações (${unread} não lidas)` : "Abrir notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} strokeWidth={1.8} />
        {unread > 0 && (
          <b className="notification-count" key={unread}>
            {unread > 99 ? "99+" : unread}
          </b>
        )}
      </button>
      {open && (
        <div className="popover notices-popover" role="dialog" aria-label="Notificações recentes">
          <div className="popover-head">
            <strong>Notificações</strong>
            {unread ? (
              <button className="text-button" onClick={readAll}>
                <CheckCheck size={14} />
                Marcar como vistas
              </button>
            ) : null}
          </div>
          {items.length ? (
            <ul className="popover-list">
              {items.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button
                    className={clsx(!n.read && "is-unread")}
                    onClick={() => {
                      setOpen(false);
                      navigate(n.target);
                    }}
                  >
                    <Avatar name={n.title} size="sm" />
                    <span>
                      <strong>{n.title}</strong>
                      <small>{n.body}</small>
                    </span>
                    <time>{clock(n.time)}</time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="popover-empty">
              Nenhuma notificação nesta sessão.
            </p>
          )}
          <button
            className="popover-foot"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            Ver todas as notificações
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const navigate = useNavigate(),
    query = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };
  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className={clsx("avatar-button", open && "is-open")}
        aria-label="Menu do usuário"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={user?.nome} src={user?.avatar} brand size="sm" />
      </button>
      {open && (
        <div className="popover user-popover" role="menu">
          <div className="user-popover-head">
            <Avatar name={user?.nome} src={user?.avatar} brand size="lg" />
            <span>
              <strong>{user?.nome}</strong>
              <small>{user?.email}</small>
            </span>
          </div>
          <button role="menuitem" onClick={() => go("/profile")}>
            <UserRound size={15} />
            Meu perfil
          </button>
          <button role="menuitem" onClick={() => go("/settings")}>
            <Settings2 size={15} />
            Conexões e preferências
          </button>
          <hr />
          <button
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              signOut(query);
            }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({
  section,
  sectionIcon: SectionIcon,
  page,
  onSectionClick,
  status,
  onSearch,
  user,
}: {
  section: string;
  sectionIcon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  page?: string;
  onSectionClick?: () => void;
  status: string;
  onSearch: () => void;
  user: User | null;
}) {
  const { theme, setTheme } = usePreferences();
  const live = status === "Conectado";
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Você está em">
        {SectionIcon ? (
          <span className="crumb-icon" aria-hidden="true">
            <SectionIcon size={15} strokeWidth={1.9} />
          </span>
        ) : null}
        {page ? (
          <>
            <button className="crumb-link" onClick={onSectionClick}>
              {section}
            </button>
            <ChevronRight size={14} className="crumb-sep" aria-hidden="true" />
            <strong aria-current="page">{page}</strong>
          </>
        ) : (
          <strong aria-current="page">{section}</strong>
        )}
      </nav>
      <button className="command-trigger" onClick={onSearch}>
        <Search size={15} />
        <span>Buscar módulos e ferramentas</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <div className="topbar-actions">
        <span
          className={clsx("live-chip", live && "is-live")}
          title="Conexão em tempo real com o Chat Interno"
        >
          <StatusDot tone={live ? "live" : "warn"} pulse={live} />
          {live ? "Tempo real" : status}
        </span>
        <TelefoneTopo />
        <button
          className="icon-button"
          aria-label="Alternar tema"
          title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun size={17} strokeWidth={1.8} />
          ) : (
            <Moon size={17} strokeWidth={1.8} />
          )}
        </button>
        <NoticesMenu />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
