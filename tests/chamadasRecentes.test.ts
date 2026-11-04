import { describe, expect, it } from "vitest";
import { contarPerdidasNovas, duracaoCurta, foiPerdida, rotuloDaChamada, textoPerdidas, type ChamadaRecente } from "../src/services/chamadasRecentes";

const c = (p: Partial<ChamadaRecente>): ChamadaRecente => ({ id: 1, direcao: "in", numero: "1003", resultado: "nao_atendida", duracaoSeg: 0, inicio: "2026-10-27T12:00:00", ...p });

describe("chamadas recentes", () => {
  it("só conta como perdida a recebida que não foi atendida", () => {
    expect(foiPerdida(c({}))).toBe(true);
    expect(foiPerdida(c({ resultado: "atendida" }))).toBe(false);
    expect(foiPerdida(c({ resultado: "rejeitada" }))).toBe(false); // recusou de propósito
    expect(foiPerdida(c({ direcao: "out", resultado: "nao_atendida" }))).toBe(false); // ligou e ninguém atendeu
  });

  it("conta só as perdidas depois da última visita", () => {
    const lista = [c({ id: 1, inicio: "2026-10-27T10:00:00" }), c({ id: 2, inicio: "2026-10-27T13:00:00" }), c({ id: 3, inicio: "2026-10-27T14:00:00", resultado: "atendida" })];
    expect(contarPerdidasNovas(lista, new Date("2026-10-27T11:00:00").getTime())).toBe(1);
    expect(contarPerdidasNovas(lista, 0)).toBe(2);
    expect(contarPerdidasNovas([], 0)).toBe(0);
  });

  it("rótulos de data legíveis", () => {
    const agora = new Date("2026-10-27T15:00:00");
    expect(rotuloDaChamada("2026-10-27T09:05:00", agora)).toBe("Hoje 09:05");
    expect(rotuloDaChamada("2026-10-26T23:59:00", agora)).toBe("Ontem 23:59");
    expect(rotuloDaChamada("2026-10-23T08:00:00", agora)).toBe("sex 08:00");
    expect(rotuloDaChamada("2026-10-01T08:00:00", agora)).toBe("01/10 08:00");
    expect(rotuloDaChamada("lixo", agora)).toBe("");
  });

  it("duração e textos", () => {
    expect(duracaoCurta(0)).toBe("");
    expect(duracaoCurta(7)).toBe("7 s");
    expect(duracaoCurta(125)).toBe("2 min 05 s");
    expect(textoPerdidas(1)).toBe("1 chamada perdida");
    expect(textoPerdidas(3)).toBe("3 chamadas perdidas");
  });
});
