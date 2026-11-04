import { describe, expect, it } from "vitest";
import { formatarTelefone, iniciais, identificarChamador, nivelParaAnel } from "../src/services/chamador";

const equipe = new Map([["1003", "Ana Souza"], ["204", "João Lima"]]);

describe("identificar quem ligou", () => {
  it("ramal da equipe: usa o nome do diretório, mesmo que a central mande outro nome", () => {
    expect(identificarChamador("1003", "", equipe)).toEqual({ titulo: "Ana Souza", sub: "Ramal 1003", ramal: "1003", externo: false });
    expect(identificarChamador("1003", "Ramal 1003", equipe).titulo).toBe("Ana Souza");
  });
  it("ramal interno que não está no diretório: mostra o nome da central, ou o próprio ramal", () => {
    expect(identificarChamador("1050", "Plantão", equipe)).toMatchObject({ titulo: "Plantão", sub: "Ramal 1050", ramal: "1050" });
    expect(identificarChamador("1050", "", equipe)).toMatchObject({ titulo: "Ramal 1050", sub: "Ramal interno" });
  });
  it("número externo é formatado e marcado como externo", () => {
    expect(identificarChamador("24999991234", "", equipe)).toEqual({ titulo: "(24) 99999-1234", sub: "Número externo", ramal: "", externo: true });
    expect(identificarChamador("+5524999991234", "Maria", equipe)).toMatchObject({ titulo: "Maria", sub: "(24) 99999-1234", externo: true });
  });
  it("sem número nem nome: 'Número desconhecido'", () => {
    expect(identificarChamador("", "", equipe).titulo).toBe("Número desconhecido");
    expect(identificarChamador("", "Anônimo", equipe).titulo).toBe("Anônimo");
  });
  it("formata telefones brasileiros", () => {
    expect(formatarTelefone("2433331234")).toBe("(24) 3333-1234");
    expect(formatarTelefone("05524999991234".slice(1))).toBe("(24) 99999-1234");
    expect(formatarTelefone("0024999991234")).toBe("0024999991234"); // formato desconhecido: não inventa
  });

  it("iniciais do avatar", () => {
    expect(iniciais("Ana Souza")).toBe("AS");
    expect(iniciais("João da Silva Lima")).toBe("JL");
    expect(iniciais("Plantão")).toBe("PL");
    expect(iniciais("Érica")).toBe("ÉR");
    expect(iniciais("(24) 99999-1234")).toBe("");
    expect(iniciais("Ramal 1050")).toBe("");
    expect(iniciais("Número desconhecido")).toBe("");
    expect(iniciais("")).toBe("");
  });

  it("anel do avatar: silêncio vazio, fala normal visível, limite em 1", () => {
    expect(nivelParaAnel(0)).toBe(0);
    expect(nivelParaAnel(255)).toBe(1);
    expect(nivelParaAnel(40)).toBeGreaterThan(0.4); // fala baixa já aparece
    expect(nivelParaAnel(9999)).toBe(1);
    expect(nivelParaAnel(-5)).toBe(0);
  });
});
