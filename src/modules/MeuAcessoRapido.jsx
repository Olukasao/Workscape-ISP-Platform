import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Plus, Search, Settings2, X } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { useServers, useSession } from "../stores/workspace";
import { useTelefone } from "../stores/telefone";
import { resolveModuleTarget } from "../../electron/moduleNavigation";
import { Button } from "../components/ui/button";
import { EmptyState, Skeleton } from "../components/ui/primitives";

const CALCULATOR_MENU_ID = "calculadoras-intranet";
const CALCULATOR_IDS = [
  "calculadora-internet-dedicada",
  "calculadora-semi-dedicado",
  "calculadora-acordo",
  "calculadora-troca-plano",
];
const PRESENTATION = {
  "falhas-gerais": { badge: "Crítico", description: "Sites úteis para diagnosticar indisponibilidades", variant: "critical" },
  "plantao-domingo": { badge: "Escala" },
  "monitoramento-total": { description: "Visão geral dos painéis de monitoramento" },
  "solicitacoes-compras": { badge: "Novo", description: "Solicitações de materiais e acompanhamento" },
  "roleta-premios": { badge: "Prêmios", description: "Giros, histórico e resgates da campanha ativa" },
  "teste-conectividade-sites": { description: "Teste rápido de HTTP, HTTPS e DNS" },
  "diagnostico-conexao-cliente": { badge: "NOC", description: "Sessão, consumo atual, qualidade e histórico" },
  "controle-operacional": { badge: "Admin", description: "Auditoria da agenda, chat e operação", variant: "critical" },
  dashboards: { description: "Painel NOC em tempo real" },
  imagens: { description: "Imagens compartilhadas pela administração" },
  "efeitos-sonoros": { badge: "Restrito", description: "Efeitos remotos para usuários online" },
};
// Calculadoras que no chat abriam em modal têm página própria no workspace.
const MODAL_ROUTES = {
  "calculadora-link-dedicado": "/tools/dedicada",
  "calculadora-semi-dedicado": "/tools/semidedicado",
  "calculadora-troca-plano": "/tools/troca-plano",
};
// A agenda de instalação foi retirada do workspace (versão 0.2.1).
const HIDDEN_IDS = new Set(["agenda-instalacao"]);

const presentation = (item) => ({
  title: item.label,
  badge: "",
  description: item.subtitle || "",
  variant: "",
  ...(PRESENTATION[item.id] || {}),
});
const describe = (item) => {
  if (item.subtitle) return item.subtitle;
  if (item.type === "internal") return "Página interna";
  if (item.type === "external") return "Link externo";
  if (item.type === "modal") return "Ferramenta do workspace";
  if (item.type === "protocol") return "Aplicativo do computador";
  if (item.type === "menu") return "Menu de opções";
  return "Acesso rápido";
};
const visible = (item) => item && item.label && !HIDDEN_IDS.has(item.id);
const isSgpLink = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "acessanet.sgp.net.br";
  } catch {
    return false;
  }
};


function QuickCard({ item, onRun, scope, openMenu, setOpenMenu }) {
  const p = presentation(item);
  const external = item.type === "external" || item.type === "protocol";
  const className = [
    "chat-home-shortcut-card",
    p.description ? "chat-home-shortcut-card-with-subtitle" : "",
    p.variant ? `chat-home-shortcut-card-${p.variant}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <span className="chat-home-shortcut-icon">{item.icon}</span>
      <span className="chat-home-shortcut-copy">
        <span className="chat-home-shortcut-title-row">
          <strong>{p.title}</strong>
          {p.badge ? (
            <span
              className={`chat-home-shortcut-badge ${
                p.variant ? `chat-home-shortcut-badge-${p.variant}` : ""
              }`.trim()}
            >
              {p.badge}
            </span>
          ) : null}
        </span>
        {p.description ? <em>{p.description}</em> : null}
      </span>
      {item.type === "menu" ? (
        <ChevronDown size={15} className="chat-home-shortcut-arrow" />
      ) : external ? (
        <ExternalLink size={14} className="chat-home-shortcut-arrow" />
      ) : (
        <ArrowRight size={15} className="chat-home-shortcut-arrow" />
      )}
    </>
  );
  if (item.type === "menu") {
    const key = `${scope}-${item.id}`;
    const open = openMenu === key;
    const children = (item.children || []).filter(visible);
    return (
      <div className={`chat-home-shortcut-menu-wrap ${open ? "is-open" : ""}`}>
        <button
          type="button"
          className={className}
          aria-expanded={open}
          onClick={() => setOpenMenu(open ? null : key)}
        >
          {content}
        </button>
        {open ? (
          <div className="chat-home-agenda-menu" role="menu">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                role="menuitem"
                className="chat-home-agenda-option"
                onClick={() => {
                  setOpenMenu(null);
                  onRun(child);
                }}
              >
                <span>{child.icon}</span>
                {child.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={external ? `${p.title} · abre fora do workspace` : p.title}
      onClick={() => onRun(item)}
    >
      {content}
    </button>
  );
}

/** "Meu acesso rápido": a pessoa escolhe, ordena e remove os atalhos que quer fixar. Fica no topo de Ferramentas. */
export default function MeuAcessoRapido() {
  const navigate = useNavigate(),
    query = useQueryClient();
  const config = useServers((s) => s.config);
  const user = useSession((s) => s.user);
  const quick = useQuery({
    queryKey: ["home", "quick-access"],
    enabled: !!user,
    staleTime: 60000,
    queryFn: async () => (await api.get("/me/quick-access")).data,
  });
  const [openMenu, setOpenMenu] = useState(null);
  const [manager, setManager] = useState(false);
  const [saving, setSaving] = useState([]);
  const [toast, setToast] = useState("");
  const [managerError, setManagerError] = useState("");
  const toastTimer = useRef(0);
  const notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!openMenu) return;
    const close = (e) => {
      if (!e.target.closest?.(".chat-home-shortcut-menu-wrap")) setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenu]);

  const available = (quick.data?.available || []).filter(visible);
  const selected = (quick.data?.selected || []).filter(visible);
  const selectedIds = new Set(selected.map((i) => i.id));

  const managerItems = available.some((i) => i.id === CALCULATOR_MENU_ID)
    ? available.filter((i) => i.id === CALCULATOR_MENU_ID || !CALCULATOR_IDS.includes(i.id))
    : available;

  // O workspace não abre navegador: links internos viram rotas; os demais
  // são copiados para a área de transferência.
  const run = async (item) => {
    if (!item) return;
    const target = String(item.target || "");
    if (item.type === "modal" && MODAL_ROUTES[target]) {
      navigate(MODAL_ROUTES[target]);
      return;
    }
    if (item.type === "internal" && target) {
      navigate(resolveModuleTarget(target, config) || target);
      return;
    }
    if (item.type === "external" && target) {
      const local = resolveModuleTarget(target, config);
      if (local) {
        navigate(local);
        return;
      }
      // Links do SGP (ex.: pré-cadastro PF/PJ) abrem no navegador do computador; o processo principal só aceita
      // https://acessanet.sgp.net.br. Os demais links externos continuam sendo copiados.
      if (isSgpLink(target) && window.desktop?.openSgpLink) {
        try {
          await window.desktop.openSgpLink(target);
        } catch {
          notify(`Não foi possível abrir ${item.label}.`);
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(target);
        notify(`Link de ${item.label} copiado. Cole no navegador para abrir.`);
      } catch {
        notify(`${item.label} abre fora do workspace: ${target}`);
      }
      return;
    }
    if (item.type === "protocol") {
      if (item.id === "microsip") {
        useTelefone.getState().abrir();
        return;
      }
      notify(`${item.label} é um aplicativo do computador. Abra-o pelo menu Iniciar.`);
    }
  };

  const mutate = async (id, request, done) => {
    setSaving((s) => [...s, id]);
    setManagerError("");
    try {
      const { data } = await request();
      query.setQueryData(["home", "quick-access"], data);
      notify(done);
    } catch (e) {
      setManagerError(e?.response?.data?.error || errorMessage(e));
    } finally {
      setSaving((s) => s.filter((x) => x !== id));
    }
  };
  const add = (id) =>
    mutate(id, () => api.post("/me/quick-access", { quick_access_id: id }), "Acesso adicionado.");
  const remove = (id) =>
    mutate(id, () => api.delete(`/me/quick-access/${id}`), "Acesso removido.");
  const move = (id, dir) => {
    const i = selected.findIndex((x) => x.id === id),
      j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const order = [...selected];
    [order[i], order[j]] = [order[j], order[i]];
    mutate(
      id,
      () => api.put("/me/quick-access/order", { quick_access_ids: order.map((x) => x.id) }),
      "Ordem atualizada.",
    );
  };


  return (
    <>
      {toast ? (
        <div className="home-toast" role="status">
          <Copy size={14} />
          {toast}
        </div>
      ) : null}

      <section className="panel home-shortcuts" aria-label="Meu acesso rápido">
        <div className="panel-heading">
          <div className="home-section-title">
            <h2>Meu acesso rápido</h2>
            <span>Atalhos escolhidos para o seu usuário</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setManager(true)}>
            <Settings2 size={15} />
            Gerenciar meus acessos
          </Button>
        </div>
        {quick.isPending ? (
          <div className="chat-home-shortcuts-grid">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : selected.length ? (
          <div className="chat-home-shortcuts-grid">
            {selected.map((item) => (
              <div key={item.id} className="chat-home-personal-shortcut">
                <QuickCard item={item} onRun={run} scope="personal" openMenu={openMenu} setOpenMenu={setOpenMenu} />
                <button
                  type="button"
                  className="chat-home-shortcut-remove"
                  onClick={() => remove(item.id)}
                  disabled={saving.includes(item.id)}
                  title={`Remover ${item.label}`}
                  aria-label={`Remover ${item.label}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-shortcuts-empty">
            <p>Você ainda não adicionou acessos rápidos.</p>
            <Button size="sm" onClick={() => setManager(true)}>
              <Plus size={15} />
              Escolher acessos
            </Button>
          </div>
        )}
      </section>

      {manager ? (
        <div className="modal-backdrop" onClick={() => setManager(false)}>
          <section
            className="confirm-dialog home-dialog home-manager"
            role="dialog"
            aria-modal="true"
            aria-label="Gerenciar meus acessos"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="home-dialog-head">
              <div>
                <h2>Gerenciar meus acessos</h2>
                <p>Escolha os atalhos que aparecem em Meu acesso rápido.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setManager(false)}>
                <X size={18} />
              </button>
            </div>
            {managerError ? <p className="inline-error" role="alert">{managerError}</p> : null}
            <div className="home-manager-list">
              {managerItems.map((item) => {
                const on = selectedIds.has(item.id);
                const busy = saving.includes(item.id);
                const index = selected.findIndex((x) => x.id === item.id);
                return (
                  <div key={item.id} className={`home-manager-item ${on ? "is-selected" : ""}`}>
                    <button
                      type="button"
                      className="home-manager-toggle"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => (on ? remove(item.id) : add(item.id))}
                    >
                      <span className="home-manager-check">{on ? <Check size={13} /> : null}</span>
                      <span className="chat-home-shortcut-icon">{item.icon}</span>
                      <span className="home-manager-copy">
                        <strong>{item.label}</strong>
                        <small>{describe(item)}</small>
                      </span>
                    </button>
                    {on ? (
                      <div className="home-manager-order">
                        <button type="button" className="icon-button" aria-label={`Mover ${item.label} para cima`} disabled={busy || index <= 0} onClick={() => move(item.id, "up")}>
                          <ChevronUp size={15} />
                        </button>
                        <button type="button" className="icon-button" aria-label={`Mover ${item.label} para baixo`} disabled={busy || index >= selected.length - 1} onClick={() => move(item.id, "down")}>
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!managerItems.length ? (
                <EmptyState compact icon={Search} title="Nenhum acesso disponível para o seu perfil." />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

    </>
  );
}
