import type { ServerConfig } from "./policy";

// Compatibility for links stored before the desktop migration. These addresses
// are resolved to local routes; they are never loaded or opened in a browser.
const legacyServices: Record<
  string,
  keyof Pick<ServerConfig, "chat" | "agenda" | "dashboard">
> = {
  "192.168.1.133:8600": "chat",
  "192.168.1.133:8500": "agenda",
  "192.168.1.133": "dashboard",
  "192.168.1.133:5000": "dashboard",
};
const aliases: Record<string, string> = {
  "/index.html": "/",
  "/antigo.html": "/dashboard",
  "/monitoramento-total": "/dashboard",
  "/noc/monitoramento-total": "/dashboard",
  "/agenda-tecnicos": "/agenda",
  "/noc/teste-conectividade-sites": "/teste-conectividade-sites",
  "/falhas-gerais": "/acesso-rapido/falhas-gerais",
  "/intranet/competicao-ccna": "/competicao-ccna",
  "/vendas": "/acesso-rapido/vendas",
};
const localRoutes = new Set([
  "/",
  "/resumo",
  "/contratacoes",
  "/lembretes",
  "/chat",
  "/agenda",
  "/dashboard",
  "/tools",
  "/notifications",
  "/profile",
  "/settings",
  "/login",
  "/teste-conectividade-sites",
  "/teste-perda-pacote",
  "/diagnostico-conexao-cliente",
  "/controle-operacional",
  "/acesso-rapido/falhas-gerais",
  "/notas-rapidas",
  "/wiki",
  "/busca-global",
  "/plantao-domingo",
  "/solicitacoes",
  "/solicitacoes-compras",
  "/solicitacoes-internas",
  "/boas-praticas-duvidas",
  "/textos-atendimento",
  "/acesso-rapido/vendas",
  "/acesso-rapido/calculadora-acordo",
  "/tools/dedicada",
  "/tools/semidedicado",
  "/tools/troca-plano",
  "/admin",
  "/admin/chat-historico",
  "/admin/permissoes-compras",
  "/admin/banner-home",
  "/admin/avisos-internos",
  "/avisos-internos",
  "/imagens",
  "/changelog",
  "/disparo",
  "/competicao-ccna",
  "/roleta-premios",
  "/assinaturas-email",
  "/boas-praticas-atendimento",
  "/acesso-rapido/efeitos-sonoros",
]);

export function resolveModuleTarget(
  value: string,
  config: ServerConfig,
): string | null {
  if (!value || /[\\\u0000-\u0020]/.test(value) || value.startsWith("//"))
    return null;
  try {
    const relative = value.startsWith("/") || value.startsWith("#/");
    const u = new URL(
      value.startsWith("#/") ? value.slice(1) : value,
      "app://workspace",
    );
    if (u.username || u.password) return null;
    let service: string | undefined;
    if (!relative && !(u.protocol === "app:" && u.host === "workspace")) {
      if (!["http:", "https:"].includes(u.protocol)) return null;
      service =
        (["chat", "agenda", "dashboard"] as const).find(
          (key) => config[key] && new URL(config[key]).origin === u.origin,
        ) || legacyServices[u.host];
      if (!service) return null;
    }
    let pathname = u.pathname.replace(/\/$/, "") || "/";
    pathname = aliases[pathname] || pathname;
    if (pathname === "/" && service)
      pathname =
        service === "chat"
          ? "/chat"
          : service === "dashboard"
            ? "/dashboard"
            : `/${service}`;
    if (!localRoutes.has(pathname) && !/^\/wiki\/[\w/-]+$/.test(pathname))
      return null;
    // Carry only navigation parameters, never old auth tokens or redirect URLs.
    const params = new URLSearchParams();
    const keys =
      pathname === "/chat"
        ? ["grupo", "conversa"]
        : pathname === "/agenda"
          ? ["data", "os", "chamado"]
          : ["search", "q"];
    for (const key of keys) {
      const v = u.searchParams.get(key);
      if (
        v &&
        (key === "data"
          ? /^\d{4}-\d{2}-\d{2}$/.test(v)
          : ["grupo", "conversa", "os", "chamado"].includes(key)
            ? /^\d+$/.test(v)
            : v.length <= 200)
      ) {
        params.set(key === "chamado" ? "os" : key, v);
      }
    }
    return pathname + (params.size ? `?${params}` : "");
  } catch {
    return null;
  }
}

/**
 * Accept only ordinary web links before handing a URL to the operating system.
 * Internal Workspace routes are resolved separately by resolveModuleTarget.
 */
export function resolveExternalUrl(value: string): string | null {
  if (!value || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value))
    return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
