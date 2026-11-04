// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const { nomeProvedor, saudeDe, totais } = await import("../src/components/ControleIA");

describe("controle da IA", () => {
  it("dá nome legível aos provedores", () => {
    expect(nomeProvedor("gemini/gemini-3.1-flash-lite-preview")).toBe("Gemini · gemini-3.1-flash-lite-preview");
    expect(nomeProvedor("cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast")).toBe("Cloudflare · llama-3.3-70b-instruct-fp8-fast");
    expect(nomeProvedor("serper")).toBe("Busca · Serper");
  });
  it("classifica a saúde pela taxa de falha", () => {
    expect(saudeDe({ ok: 0, falha: 0, taxaFalha: 0 })).toBe("sem-uso");
    expect(saudeDe({ ok: 95, falha: 5, taxaFalha: 5 })).toBe("bom");
    expect(saudeDe({ ok: 7, falha: 3, taxaFalha: 30 })).toBe("atencao");
    expect(saudeDe({ ok: 1, falha: 9, taxaFalha: 90 })).toBe("ruim");
  });
  it("soma o uso", () => {
    const u = { id: 1, nome: "A", setor: null, perguntas: 4, resumos: 0, imagens: 0, pesquisas: 0, dados: 0, falhas: 1, ultimo_dia: "" };
    expect(totais([u, { ...u, id: 2, perguntas: 6, falhas: 0 }])).toEqual({ pessoas: 2, perguntas: 10, falhas: 1 });
  });
});
