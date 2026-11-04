import { describe, expect, it } from "vitest";
import sourceFields from "./fixtures/dashboard-source-fields.json";
import {
  countTone,
  dashboardSections,
  groupTotal,
  networkStatus,
  normalizeGroups,
  parseCustomerCounts,
  parseDashboardUpdate,
  dashboardTimestamp,
} from "../src/services/dashboardModel";
describe("migração das regras reais do Dashboard", () => {
  it("interpreta datas numéricas da produção e preserva erros das consultas SGP", () => {
    const stamp = 1792590496708;
    const parsed = parseDashboardUpdate({
      total: 871,
      grupos: { OFFLINE: 12 },
      atualizado: stamp,
      pedidosAbertos: { vendasEmExecucao: 7, atualizado: stamp, desatualizado: true, erro: "timeout" },
      emAndamento: { total: 9, chamados: [], atualizado: stamp, erro: "timeout" },
    })!;
    expect(parsed.total).toBe(871);
    expect(parsed.updated).toBe(new Date(stamp).toISOString());
    expect(parsed.running?.updated).toBe(parsed.updated);
    expect(parsed.salesUpdated).toBe(parsed.updated);
    expect(parsed.salesStale).toBe(true);
    expect(parsed.running?.stale).toBe(true);
    expect(parseDashboardUpdate({ grupos: { OFFLINE: 12, ALTA: 3 } })?.total).toBe(15);
    expect(dashboardTimestamp("inválida")).toBeNull();
    expect(dashboardTimestamp(null)).toBeNull();
    expect(dashboardTimestamp(1e20)).toBeNull();
    expect(dashboardTimestamp(new Date(stamp).toISOString())).toBe(parsed.updated);
  });
  it("preserva cada campo do mapa de /var/www/html/index.html", () => {
    const migrated = new Set(
      dashboardSections.flatMap((s) => s.fields.map(([key]) => key)),
    );
    expect(sourceFields.filter((key) => !migrated.has(key))).toEqual([]);
  });
  it("soma aliases sem contar duas vezes variações de acento", () => {
    const groups = normalizeGroups({
      "SUPORTE TÉCNICO": 2,
      "SUPER TECNICO 97": 3,
      "SUPORTE TECNICO 97": "4",
      N1: 5,
    });
    expect(groupTotal(groups, "SUPORTE TÉCNICO")).toBe(9);
    expect(groupTotal(groups, "SUPORTE N1")).toBe(5);
  });
  it("mostra estado vazio antes de qualquer resposta", () => {
    expect(groupTotal(null, "OFFLINE")).toBeNull();
    expect(networkStatus(null).state).toBe("waiting");
    expect(parseDashboardUpdate(null)).toBeNull();
    expect(parseDashboardUpdate({ grupos: [] })).toBeNull();
    expect(parseCustomerCounts({})).toBeNull();
    expect(parseCustomerCounts({ ativos: 2 })?.total).toBeNull();
  });
  it("preserva exatamente os limiares e as três regiões usadas no status", () => {
    expect(networkStatus(normalizeGroups({ OFFLINE: 25 })).state).toBe("ok");
    expect(networkStatus(normalizeGroups({ OFFLINE: 26 })).state).toBe(
      "warning",
    );
    expect(networkStatus(normalizeGroups({ OFFLINE: 60 })).state).toBe(
      "warning",
    );
    expect(networkStatus(normalizeGroups({ OFFLINE: 61 })).state).toBe(
      "critical",
    );
    expect(
      networkStatus(normalizeGroups({ "BACKBONE GPON ACESSANET | DAS": 6 }))
        .state,
    ).toBe("critical");
    expect(
      networkStatus(normalizeGroups({ "BACKBONE GPON ACESSANET | PV": 60 }))
        .state,
    ).toBe("ok");
    expect(countTone(3, "RETENÇÃO")).toBe("warning");
    expect(countTone(5, "RETENÇÃO")).toBe("critical");
    expect(countTone(30, "ALTA")).toBe("warning");
    expect(countTone(31, "ALTA")).toBe("critical");
  });
  it("preserva contagens, pedidos em execução e detalhes SGP", () => {
    const payload = {
      grupos: { ALTA: 7 },
      contagens: { vendasEmExecucao: 8 },
      pedidosAbertos: { vendasEmExecucao: 9 },
      emAndamento: {
        total: 1,
        chamados: [{ idOrdemServico: 501, tecnico: "Pessoa" }],
        desatualizado: true,
      },
    };
    const parsed = parseDashboardUpdate(payload)!;
    expect(parsed.salesRunning).toBe(9);
    expect(parsed.running?.orders[0].idOrdemServico).toBe(501);
    expect(parsed.running?.stale).toBe(true);
    expect(parseDashboardUpdate({ grupos: {} })?.running).toBeNull();
  });
  it("recusa números inválidos em vez de exibir indicadores fictícios", () => {
    expect(normalizeGroups({ OFFLINE: NaN, ALTA: -5, REGULAR: true })).toEqual(
      {},
    );
    expect(
      parseCustomerCounts({ total: "123", ativos: {}, suspensos: null }),
    ).toMatchObject({ total: 123, ativos: null, suspensos: null });
  });
});
