export const networkTools = [
  {
    id: "diagnostico-conexao-cliente",
    title: "Diagnóstico de clientes",
    path: "/diagnostico-conexao-cliente",
  },
  {
    id: "teste-conectividade-sites",
    title: "Conectividade",
    path: "/teste-conectividade-sites",
  },
  {
    id: "teste-conectividade-sites",
    title: "Perda de pacotes",
    path: "/teste-perda-pacote",
  },
  {
    id: "controle-operacional",
    title: "Controle operacional",
    path: "/controle-operacional",
  },
] as const;
export function canUseTool(
  tool: { id: string; admin?: boolean; authenticated?: boolean },
  allowed: Set<string>,
  profile?: string,
) {
  return tool.admin
    ? profile === "admin"
    : !!tool.authenticated || allowed.has(tool.id);
}
