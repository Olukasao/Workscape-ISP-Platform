// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const { rotuloEmpresaSobLogo } = await import("../src/app/shell/Sidebar");

describe("nome da empresa embaixo do logo", () => {
  it("não repete a marca do próprio logo, em qualquer grafia", () => {
    for (const nome of ["AcessaNet", "ACESSANET", "acessanet", "Acessa Net", "Acessa.Net", "  AcessaNet  ", "Acessa-Net"]) {
      expect(rotuloEmpresaSobLogo(nome)).toBe("");
    }
  });

  it("sem nome de empresa, não mostra nada (nem texto genérico)", () => {
    expect(rotuloEmpresaSobLogo("")).toBe("");
    expect(rotuloEmpresaSobLogo(null)).toBe("");
    expect(rotuloEmpresaSobLogo(undefined)).toBe("");
  });

  it("mostra o nome quando é outra empresa", () => {
    expect(rotuloEmpresaSobLogo("Provedor Exemplo")).toBe("Provedor Exemplo");
    expect(rotuloEmpresaSobLogo("AcessaNet Resende")).toBe("AcessaNet Resende");
  });
});
