// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const { vistoEm, contar, filtrar } = await import("../src/components/VersoesWorkspace");
type D = Parameters<typeof contar>[0][number];

const base = (o: Partial<D> & { id: number }): D => ({
  computador: "PC", ip: "10.0.0.1", usuario: { id: 1, nome: "Ana Paula", email: "a@a.com", setor: "Suporte" },
  versao: "0.5.58", situacao: "atualizado", online: false, primeiro_visto: "2026-10-01T10:00:00Z", ultimo_visto: "2026-10-24T10:00:00Z", ...o,
});
const lista = [
  base({ id: 1, computador: "NOC-01", online: true }),
  base({ id: 2, computador: "FIN-02", situacao: "desatualizado", versao: "0.5.50", usuario: { id: 2, nome: "João Lima", email: "j@a.com", setor: "Financeiro" } }),
  base({ id: 3, computador: "ANTIGO", situacao: "desconhecida", versao: null, ip: "192.168.2.108" }),
];

describe("painel de versões", () => {
  it("conta atualizados, desatualizados, online e total", () => {
    expect(contar(lista)).toEqual({ total: 3, atualizados: 1, desatualizados: 1, online: 1 });
    expect(contar([])).toEqual({ total: 0, atualizados: 0, desatualizados: 0, online: 0 });
  });

  it("filtra por situação e por conexão", () => {
    expect(filtrar(lista, "desatualizados", "").map((d) => d.id)).toEqual([2]);
    expect(filtrar(lista, "online", "").map((d) => d.id)).toEqual([1]);
    expect(filtrar(lista, "offline", "").map((d) => d.id)).toEqual([2, 3]);
    expect(filtrar(lista, "todos", "")).toHaveLength(3);
  });

  it("busca por pessoa, computador, IP e setor, sem diferenciar acento nem maiúscula", () => {
    expect(filtrar(lista, "todos", "joao").map((d) => d.id)).toEqual([2]);
    expect(filtrar(lista, "todos", "fin-02").map((d) => d.id)).toEqual([2]);
    expect(filtrar(lista, "todos", "2.108").map((d) => d.id)).toEqual([3]);
    expect(filtrar(lista, "todos", "FINANCEIRO").map((d) => d.id)).toEqual([2]);
    expect(filtrar(lista, "desatualizados", "noc")).toHaveLength(0);
  });

  it("descreve o último contato do jeito que se fala", () => {
    const agora = Date.parse("2026-10-24T12:00:00Z");
    expect(vistoEm("2026-10-24T11:59:40Z", agora)).toBe("agora há pouco");
    expect(vistoEm("2026-10-24T11:55:00Z", agora)).toBe("há 5 min");
    expect(vistoEm("2026-10-24T09:00:00Z", agora)).toBe("há 3 h");
    expect(vistoEm("2026-10-23T09:00:00Z", agora)).toBe("ontem");
    expect(vistoEm("2026-10-20T12:00:00Z", agora)).toBe("há 4 dias");
    expect(vistoEm("2026-09-01T12:00:00Z", agora)).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(vistoEm("lixo", agora)).toBe("—");
  });
});
