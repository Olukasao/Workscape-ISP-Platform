import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowUpRight, Search, Shield, Wrench, X } from "lucide-react";
import {
  toolItems,
  toolGroups,
  findTool,
  usePermittedTools,
} from "./toolCatalog";
import { Button } from "../components/ui/button";
import MeuAcessoRapido from "./MeuAcessoRapido";
import { useTelefone } from "../stores/telefone";
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  Skeleton,
} from "../components/ui/primitives";

export const toolPaths = toolItems.map((i) => i.path);

const normalize = (s) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function ToolIndex() {
  const { access, tools } = usePermittedTools();
  const [filter, setFilter] = useState("");
  const abrirTelefone = useTelefone((s) => s.abrir);
  const [menuAberto, setMenuAberto] = useState(null);
  // A janelinha do Pré-cadastro fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuAberto) return undefined;
    const fora = (e) => {
      if (!e.target.closest?.(".chat-home-shortcut-menu-wrap")) setMenuAberto(null);
    };
    const esc = (e) => e.key === "Escape" && setMenuAberto(null);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAberto]);
  const visible = useMemo(() => {
    const q = normalize(filter.trim());
    return q
      ? tools.filter((t) => normalize(`${t.title} ${t.description}`).includes(q))
      : tools;
  }, [tools, filter]);
  return (
    <div className="page tools-page">
      <PageHeader
        icon={Wrench}
        title="Ferramentas"
        description="Recursos da intranet integrados ao workspace, liberados conforme suas permissões."
        meta={
          !access.isPending ? (
            <span className="heading-meta">
              {tools.length} disponíve{tools.length === 1 ? "l" : "is"}
            </span>
          ) : null
        }
      />
      <MeuAcessoRapido />
      <div className="tools-toolbar">
        <label className="search-box search-box--lg">
          <Search size={16} />
          <input
            aria-label="Filtrar ferramentas"
            placeholder="Filtrar por nome ou finalidade"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter ? (
            <button
              type="button"
              className="search-clear"
              aria-label="Limpar filtro"
              onClick={() => setFilter("")}
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>
      {access.isError && (
        <p className="inline-error" role="alert">
          Não foi possível consultar suas permissões. Tente novamente após
          reconectar.
        </p>
      )}
      {access.isPending ? (
        <div className="tool-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : visible.length ? (
        toolGroups.map(([group, label]) => {
          const list = visible.filter((t) => t.group === group);
          if (!list.length) return null;
          return (
            <section className="tool-group" key={group} aria-label={label}>
              <h2 className="group-label">
                {label}
                <span>{list.length}</span>
              </h2>
              <div className="tool-grid">
                {list.map((i) => {
                  const conteudo = (
                    <>
                      <span className="tool-icon">
                        <i.icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="tool-copy">
                        <strong>{i.title}</strong>
                        <small>{i.description}</small>
                      </span>
                      <ArrowUpRight size={15} className="tool-arrow" />
                    </>
                  );
                  // Cartão com janelinha (ex.: Pré-cadastro > Pessoa física / Pessoa jurídica).
                  if (i.menu) {
                    const aberto = menuAberto === i.path;
                    return (
                      <div className={`chat-home-shortcut-menu-wrap ${aberto ? "is-open" : ""}`} key={i.path}>
                        <button
                          type="button"
                          className="tool-card"
                          aria-expanded={aberto}
                          onClick={() => setMenuAberto(aberto ? null : i.path)}
                        >
                          {conteudo}
                        </button>
                        {aberto ? (
                          <div className="chat-home-agenda-menu" role="menu">
                            {i.menu.map((opcao) => (
                              <button
                                key={opcao.url}
                                type="button"
                                role="menuitem"
                                className="chat-home-agenda-option"
                                onClick={() => {
                                  setMenuAberto(null);
                                  void window.desktop?.openSgpLink(opcao.url);
                                }}
                              >
                                <opcao.icon size={15} />
                                {opcao.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  // O Telefone abre um card flutuante, não uma página.
                  return i.acao === "telefone" ? (
                    <button type="button" className="tool-card" key={i.path} onClick={abrirTelefone}>
                      {conteudo}
                    </button>
                  ) : (
                    <Link className="tool-card" to={i.path} key={i.path}>
                      {conteudo}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <EmptyState icon={Search} title="Nenhuma ferramenta encontrada">
          Nenhum recurso liberado para sua conta corresponde a “{filter}”.
        </EmptyState>
      )}
      <p className="data-footnote">
        A lista reflete as permissões retornadas pelo servidor. A autorização
        final de cada ação é feita na API.
      </p>
    </div>
  );
}

export default function Tools() {
  const { pathname } = useLocation();
  const { access, permitted } = usePermittedTools();
  if (pathname === "/tools") return <ToolIndex />;
  const item = findTool(pathname);
  if (!item)
    return (
      <div className="page">
        <EmptyState
          icon={Wrench}
          title="Recurso ainda não integrado"
          action={
            <Button asChild variant="outline">
              <Link to="/tools">Voltar às ferramentas</Link>
            </Button>
          }
        >
          Esta página depende da adaptação do módulo original.
        </EmptyState>
      </div>
    );
  // Itens que só abrem links (pré-cadastro) não têm página própria.
  if (item.menu) return <Navigate to="/tools" replace />;
  if (access.isPending) return <PageSkeleton />;
  if (!permitted(item))
    return (
      <div className="page">
        <EmptyState
          icon={Shield}
          tone="warn"
          title="Acesso indisponível"
          action={
            <Button asChild variant="outline">
              <Link to="/tools">Ver ferramentas liberadas</Link>
            </Button>
          }
        >
          O servidor não liberou este recurso para sua conta.
        </EmptyState>
      </div>
    );
  const C = item.component;
  return (
    <div
      className="legacy-module"
      data-tool={item.path}
      data-theme-support={item.lightTheme ? "adaptive" : "dark"}
    >
      <Suspense fallback={<PageSkeleton />}>
        {item.framed ? (
          <div className="page legacy-frame">
            <C embedded={item.embedded} />
          </div>
        ) : (
          <C embedded={item.embedded} />
        )}
      </Suspense>
    </div>
  );
}
