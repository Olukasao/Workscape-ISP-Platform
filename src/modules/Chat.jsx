import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Users, X, MessagesSquare, ExternalLink } from "lucide-react";
import { destacar, podeDestacar } from "../services/janelaDestacada";
import { useQueryClient } from "@tanstack/react-query";
import ConversasDiretas from "../legacy/components/Chat/ConversasDiretas";
import Grupos from "../legacy/components/Chat/Grupos";
import MensagensDiretas from "../legacy/components/Chat/MensagensDiretas";
import MensagensGrupo from "../legacy/components/Chat/MensagensGrupo";
import Disparo from "./Disparo";
import { useChatData, unreadCount } from "../services/data";
import { socket } from "../services/socket";
import { api, errorMessage } from "../services/api";
import { useSession } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { Skeleton, StatusDot } from "../components/ui/primitives";
import { isChatVisible } from "../services/realtime";
import styles from "../legacy/styles/Chat.module.css";
export default function Chat({ active }) {
  const { user, token } = useSession();
  const { conversations, groups, contacts } = useChatData();
  const query = useQueryClient(),
    loc = useLocation(),
    navigate = useNavigate();
  const [tab, setTab] = useState("diretas"),
    [search, setSearch] = useState(""),
    [selection, setSelection] = useState(null),
    [error, setError] = useState("");
  const unreadTotal =
    unreadCount(conversations.data || []) + unreadCount(groups.data || []);
  const select = (type, id) => {
    setSelection({ type, id: Number(id) });
    navigate(`/chat?${type === "group" ? "grupo" : "conversa"}=${id}`);
  };
  const souAdmin = user?.perfil === "admin";
  useEffect(() => {
    if (!active) return;
    const params = new URLSearchParams(loc.search),
      group = params.get("grupo"),
      direct = params.get("conversa");
    if (params.get("aba") === "disparo" && souAdmin) { setTab("disparo"); return; }
    const id = Number(group || direct);
    if (id > 0 && Number.isInteger(id))
      setSelection({ type: group ? "group" : "direct", id });
  }, [loc.search, active, souAdmin]);
  useEffect(() => {
    if (!active || !selection || !user || !isChatVisible()) return;
    if (selection.type === "group")
      socket.emit("mark_group_read", {
        grupo_id: selection.id,
        usuario_id: user.id,
      });
    else {
      const c = conversations.data?.find(
        (c) => Number(c.usuario_outro_id) === selection.id,
      );
      if (c)
        socket.emit("mark_conversa_read", {
          conversa_id: c.id,
          usuario_id: user.id,
        });
    }
    const timer = setTimeout(
      () => query.invalidateQueries({ queryKey: ["chat"] }),
      400,
    );
    return () => clearTimeout(timer);
  }, [active, selection, user, query]);
  const mutate = async (fn) => {
    try {
      setError("");
      await fn();
      await query.invalidateQueries({ queryKey: ["chat"] });
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  };
  const favorite = (payload) =>
    mutate(() =>
      api.patch("/chat/favoritos", {
        tipo: payload.tipo,
        referencia_id: payload.referenciaId,
        favorito: payload.favorito,
      }),
    );
  return (
    <div className="chat-layout">
      <aside className="chat-list" aria-label="Conversas">
        <div className="chat-list-title">
          <h2>Conversas</h2>
          {unreadTotal ? (
            <span className="chat-unread-chip">{unreadTotal} não lidas</span>
          ) : null}
          {podeDestacar() ? (
            <button
              type="button"
              className="chat-destacar"
              onClick={() => destacar("chat")}
              title="Abrir o chat em uma janela separada"
              aria-label="Destacar o chat em uma janela separada"
            >
              <ExternalLink size={15} />
            </button>
          ) : null}
        </div>
        {tab !== "disparo" && (
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Pesquisar conversas"
              placeholder="Pesquisar pessoas e grupos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                aria-label="Limpar pesquisa"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
        )}
        <div className="segmented segmented--fill">
          {[
            ["diretas", "Mensagens"],
            ["grupos", "Grupos"],
            ["pessoas", "Pessoas"],
            ...(souAdmin ? [["disparo", "Disparo"]] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
            >
              {label}
            </button>
          ))}
        </div>
        {(error ||
          conversations.isError ||
          groups.isError ||
          contacts.isError) && (
          <div className="inline-error" role="alert">
            {error || "Não foi possível sincronizar as conversas."}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => query.invalidateQueries({ queryKey: ["chat"] })}
            >
              Tentar novamente
            </Button>
          </div>
        )}
        <div className="chat-list-scroll">
          {tab === "disparo" ? (
            <p className="muted" style={{ padding: "12px" }}>
              Envie uma mensagem para várias pessoas de uma vez, pelo Chat Interno. Monte a mensagem ao lado e escolha os destinatários.
            </p>
          ) : conversations.isPending ? (
            <div className="chat-list-skeleton" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="chat-skeleton-row">
                  <Skeleton className="skeleton-avatar" />
                  <Skeleton lines={2} />
                </div>
              ))}
            </div>
          ) : tab === "grupos" ? (
            <Grupos
              grupos={groups.data || []}
              grupoSelecionado={
                selection?.type === "group" ? selection.id : null
              }
              onSelectGrupo={(g) =>
                g.tem_acesso !== false && select("group", g.id)
              }
              onToggleFavorito={favorite}
              busca={search}
            />
          ) : (
            <ConversasDiretas
              conversas={conversations.data || []}
              usuarios={contacts.data || []}
              conversaSelecionada={
                selection?.type === "direct" ? selection.id : null
              }
              onSelectConversa={(id) => select("direct", id)}
              onOcultarConversa={(c) =>
                mutate(() =>
                  api.delete(`/chat/conversas-diretas/${c.id}/ocultar`),
                )
              }
              onToggleFavorito={favorite}
              mostrarUsuarios={tab === "pessoas"}
              busca={search}
            />
          )}
        </div>
        <div className="chat-list-footer">
          <StatusDot tone="ok" />
          {contacts.data?.filter((c) => c.status === "online").length ??
            "—"}{" "}
          pessoas online
          <Users size={14} className="ml-auto" />
        </div>
      </aside>
      <div className={`chat-messages ${styles.chatArea}`}>
        {tab === "disparo" ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Disparo />
          </div>
        ) : selection?.type === "direct" ? (
          <MensagensDiretas
            key={`d${selection.id}`}
            usuario_id={selection.id}
            usuario_atual={user}
            socket={socket}
            token={token}
            onClearConversation={() => {
              setSelection(null);
              query.invalidateQueries({ queryKey: ["chat"] });
            }}
            onVoltarMobile={() => setSelection(null)}
            onOpenFavoriteOrigin={(m) =>
              select(m.origemTipo === "grupo" ? "group" : "direct", m.origemId)
            }
          />
        ) : selection?.type === "group" ? (
          <MensagensGrupo
            key={`g${selection.id}`}
            grupo_id={selection.id}
            usuario_atual={user}
            socket={socket}
            token={token}
            onClearConversation={() =>
              query.invalidateQueries({ queryKey: ["chat"] })
            }
            onVoltarMobile={() => setSelection(null)}
            onOpenFavoriteOrigin={(m) =>
              select(m.origemTipo === "grupo" ? "group" : "direct", m.origemId)
            }
          />
        ) : (
          <div className="empty chat-empty">
            <span className="empty-icon tone-info" aria-hidden="true">
              <MessagesSquare size={24} strokeWidth={1.7} />
            </span>
            <h2>Selecione uma conversa</h2>
            <p>
              Escolha uma pessoa ou um grupo à esquerda para ler e responder
              mensagens.
            </p>
            <p className="chat-empty-hint">
              <kbd className="kbd">Ctrl K</kbd> abre a busca do workspace
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
