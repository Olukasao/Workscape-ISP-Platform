// Relatórios do SGP abertos pelos cartões do Painel NOC. O renderizador envia só a chave; a URL fica aqui.
const base = "https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/";
export const sgpReports = {
  "sgp-suporte-tecnico": `${base}?status=0&tipo=10000`,
  "sgp-n1": `${base}?status=0&tipo=1063`,
  "sgp-n2": `${base}?status=0&tipo=2314`,
  "sgp-n3": `${base}?status=0&tipo=2315`,
  "sgp-regular": `${base}?status=0&tipo=2323`,
  "sgp-baixa": `${base}?status=0&tipo=2322`,
  "sgp-alta": `${base}?status=0&tipo=2324`,
  "sgp-roteador": `${base}?status=0&tipo=1923`,
  "sgp-atenuacao": `${base}?status=0&tipo=1922`,
  "sgp-instalacao": `${base}?status=0&tipo=14`,
  "sgp-em-instalacao": `${base}?status=2&tipo=14`,
  "sgp-offline": `${base}?status=0&tipo=1931`,
  "sgp-retirada": `${base}?status=0&tipo=2034`,
  "sgp-retirada-suspensos": `${base}?status=0&tipo=2130`,
  "sgp-mudanca-endereco": `${base}?status=0&tipo=1928`,
  "sgp-mudanca-ponto": `${base}?status=0&tipo=1925`,
} as const;
export type SgpReportKey = keyof typeof sgpReports;
export const sgpReportKeys = Object.keys(sgpReports) as [SgpReportKey, ...SgpReportKey[]];

const porRotulo: Record<string, SgpReportKey> = {
  "SUPORTE TECNICO": "sgp-suporte-tecnico",
  "SUPORTE N1": "sgp-n1",
  "SUPORTE N2": "sgp-n2",
  "SUPORTE N3": "sgp-n3",
  REGULAR: "sgp-regular",
  BAIXA: "sgp-baixa",
  ALTA: "sgp-alta",
  ROTEADOR: "sgp-roteador",
  ATENUACAO: "sgp-atenuacao",
  INSTALACAO: "sgp-instalacao",
  "EM INSTALACAO": "sgp-em-instalacao",
  OFFLINE: "sgp-offline",
  "RETIRADA DE EQUIPAMENTO": "sgp-retirada",
  "RETIRADA DE EQUIPAMENTO SUSPENSOS": "sgp-retirada-suspensos",
  "MUDANCA DE ENDERECO": "sgp-mudanca-endereco",
  "MUDANCA DE PONTO INTERNO": "sgp-mudanca-ponto",
};

export function sgpReportKey(rotulo: string): SgpReportKey | null {
  const n = rotulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  return porRotulo[n] || null;
}
