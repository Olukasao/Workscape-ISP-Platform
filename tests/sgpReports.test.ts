import { describe, expect, it } from "vitest";
import { sgpReportKey, sgpReports } from "../electron/sgpReports";

describe("relatórios do SGP", () => {
  it("resolve os cartões do painel para chaves fixas", () => {
    expect(sgpReportKey("Suporte Técnico")).toBe("sgp-suporte-tecnico");
    expect(sgpReportKey("Atenuação")).toBe("sgp-atenuacao");
    expect(sgpReportKey("Retirada de Equipamento Suspensos")).toBe("sgp-retirada-suspensos");
    expect(sgpReportKey("Instalação")).toBe("sgp-instalacao");
    expect(sgpReportKey("Financeiro")).toBeNull();
  });
  it("só aponta para relatórios de ocorrência do SGP", () => {
    for (const url of Object.values(sgpReports)) expect(url).toMatch(/^https:\/\/acessanet\.sgp\.net\.br\/admin\/atendimento\/relatorios\/ocorrencia\/\?status=\d&tipo=\d+$/);
  });
});
