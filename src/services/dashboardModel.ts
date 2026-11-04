// Port of /var/www/html/index.html: map, mapAliases, normalizarDescricao,
// obterTotalGrupo, atualizarUI and aplicarCoresCards. Backend remains central.
export const dashboardSections = [
  {
    title: "Suporte",
    fields: [
      ["SUPORTE TÉCNICO", "Suporte Técnico"],
      ["SUPORTE N1", "Suporte N1"],
      ["SUPORTE N2", "Suporte N2"],
      ["SUPORTE N3", "Suporte N3"],
    ],
  },
  {
    title: "Prioridade",
    fields: [
      ["BAIXA", "Baixa"],
      ["REGULAR", "Regular"],
      ["ALTA", "Alta"],
    ],
  },
  {
    title: "Rede e equipamentos",
    fields: [
      ["OFFLINE", "Offline"],
      ["ROTEADOR", "Roteador"],
      ["ATENUAÇÃO", "Atenuação"],
      ["RETIRADA DE EQUIPAMENTO", "Retirada de Equipamento"],
      [
        "RETIRADA DE EQUIPAMENTO - SUSPENSOS",
        "Retirada de Equipamento Suspensos",
      ],
    ],
  },
  {
    title: "Campo",
    fields: [
      ["ATIVAÇÃO DE CONTRATO - COMUM", "Instalação"],
      ["ATIVAÇÃO DE CONTRATO - MUDANÇA DE ENDEREÇO", "Mudança de Endereço"],
      ["MUDANÇA DE PONTO INTERNO", "Mudança de Ponto interno"],
    ],
  },
  {
    title: "Massivos",
    fields: ["MRT", "DAS", "SRP", "PV", "LRJ"].map((region) => [
      `BACKBONE GPON ACESSANET | ${region}`,
      `Backbone GPON ${region}`,
    ]),
  },
  {
    title: "Comercial",
    fields: [
      ["ATIVAÇÃO DE CONTRATO - COMUM", "Vendas"],
      ["COMERCIAL CONTRATAÇÃO", "Comercial Contratação"],
      ["COMERCIAL PENDENTE DOC", "Comercial Pendente DOC"],
    ],
  },
  {
    title: "Financeiro",
    fields: [
      ["FINANCEIRO", "Financeiro"],
      ["RETENÇÃO", "Retenção"],
      ["CANCELAMENTO CONTRATO", "Cancelamentos"],
      ["ACORDO/ NEGOCIAÇÃO", "Acordo Negociação"],
      ["CONGELAMENTO", "Congelamento"],
    ],
  },
  {
    title: "Órgãos e reputação",
    fields: [
      ["PROCON", "Procon"],
      ["ANATEL", "Anatel"],
      ["RECLAME AQUI", "Reclame aqui"],
    ],
  },
  { title: "Almoxarifado", fields: [["ALMOXARIFADO", "Almoxarifado"]] },
];
const aliases: Record<string, string[]> = {
  "SUPORTE TÉCNICO": ["SUPER TÉCNICO 97", "SUPORTE TÉCNICO 97"],
  "SUPORTE N1": ["N1"],
  "SUPORTE N2": ["N2"],
  "SUPORTE N3": ["N3"],
};
export const normalizeDescription = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
export function numeric(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function normalizeGroups(groups: Record<string, unknown>) {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(groups)) {
    const k = normalizeDescription(key);
    const n = numeric(value);
    if (n !== null) normalized[k] = (normalized[k] || 0) + n;
  }
  return normalized;
}
export function groupTotal(
  groups: Record<string, number> | null,
  key: string,
): number | null {
  if (!groups) return null;
  return [
    ...new Set([key, ...(aliases[key] || [])].map(normalizeDescription)),
  ].reduce((sum, k) => sum + (groups[k] || 0), 0);
}
export function networkStatus(groups: Record<string, number> | null) {
  if (!groups)
    return {
      state: "waiting",
      label: "Aguardando dados",
      offline: null,
      massive: null,
    };
  const offline = groupTotal(groups, "OFFLINE")!;
  const massive = ["DAS", "MRT", "SRP"].reduce(
    (sum, region) =>
      sum + groupTotal(groups, `BACKBONE GPON ACESSANET | ${region}`)!,
    0,
  );
  return {
    offline,
    massive,
    ...(massive > 5 || offline > 60
      ? { state: "critical", label: "Massivo detectado" }
      : offline > 25
        ? { state: "warning", label: "Instabilidade detectada" }
        : { state: "ok", label: "Rede operacional" }),
  };
}
export function countTone(value: number | null, key: string) {
  if (value === null) return "waiting";
  return key === "RETENÇÃO"
    ? value >= 5
      ? "critical"
      : value >= 3
        ? "warning"
        : "ok"
    : value > 30
      ? "critical"
      : value >= 20
        ? "warning"
        : "ok";
}
export interface RunningOrder {
  id?: string | number;
  idOrdemServico?: string | number;
  protocolo?: string;
  cliente?: string;
  tecnico?: string;
  equipe?: string;
  tipo?: string;
  status?: string;
  checkin?: string;
  inicioExecucao?: string;
  inicioExecucaoISO?: string;
  bairro?: string;
  regiao?: string;
  endereco?: string;
  localizacao?: string;
  dataAgendamento?: string;
}
export interface DashboardSnapshot {
  total: number;
  groups: Record<string, number>;
  salesRunning: number | null;
  salesStale: boolean;
  salesUpdated: string | null;
  running: {
    total: number;
    orders: RunningOrder[];
    updated: string | null;
    stale: boolean;
  } | null;
  updated: string;
}
/** O SGP central envia milissegundos; gateways anteriores também enviam ISO. */
export function dashboardTimestamp(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function parseDashboardUpdate(value: unknown): DashboardSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, any>;
  if (!p.grupos || typeof p.grupos !== "object" || Array.isArray(p.grupos))
    return null;
  const orders: RunningOrder[] = Array.isArray(p.emAndamento?.chamados)
    ? p.emAndamento.chamados.filter(
        (o: unknown) => o && typeof o === "object" && !Array.isArray(o),
      )
    : [];
  const groups = normalizeGroups(p.grupos);
  return {
    total: numeric(p.total) ?? Object.values(groups).reduce((sum, n) => sum + n, 0),
    groups,
    salesRunning: numeric(
      p.pedidosAbertos?.vendasEmExecucao ?? p.contagens?.vendasEmExecucao,
    ),
    salesStale: Boolean(p.pedidosAbertos?.desatualizado || p.pedidosAbertos?.erro),
    salesUpdated: dashboardTimestamp(p.pedidosAbertos?.atualizado),
    running:
      p.emAndamento && typeof p.emAndamento === "object"
        ? {
            total: numeric(p.emAndamento.total) ?? orders.length,
            orders,
            updated: dashboardTimestamp(p.emAndamento.atualizado),
            stale: Boolean(p.emAndamento.desatualizado || p.emAndamento.erro),
          }
        : null,
    updated: dashboardTimestamp(p.atualizado) ?? new Date().toISOString(),
  };
}
export const customerFields = [
  "total",
  "ativos",
  "reduzido",
  "suspensos",
  "cancelados",
] as const;
export type CustomerCounts = Record<
  (typeof customerFields)[number],
  number | null
>;
export function parseCustomerCounts(value: unknown): CustomerCounts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!customerFields.some((key) => numeric(p[key]) !== null)) return null;
  return Object.fromEntries(
    customerFields.map((key) => [key, numeric(p[key])]),
  ) as CustomerCounts;
}
