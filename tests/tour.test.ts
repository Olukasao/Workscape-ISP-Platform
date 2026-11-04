// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v), removeItem: (k: string) => void memoria.delete(k) });
const { posicionarBalao, vizinho, jaViu, marcarVisto, useTour } = await import("../src/tour/tour");
const { passosTourIA, TOUR_IA } = await import("../src/tour/passosIA");

const tela = { w: 1280, h: 800 };
const balao = { w: 380, h: 220 };

describe("posição do balão do tour", () => {
  it("sem elemento (passo de texto) fica no centro da tela", () => {
    const p = posicionarBalao(null, balao, tela);
    expect(p.lado).toBe("centro");
    expect(p.left).toBe((1280 - 380) / 2);
    expect(p.top).toBe((800 - 220) / 2);
  });

  it("prefere embaixo do elemento, centralizado nele, e a seta aponta para o meio do elemento", () => {
    const alvo = { x: 500, y: 100, w: 200, h: 50 };
    const p = posicionarBalao(alvo, balao, tela);
    expect(p.lado).toBe("baixo");
    expect(p.top).toBe(100 + 50 + 14);
    expect(p.left).toBe(600 - 190);
    expect(p.left + p.seta).toBe(600);
  });

  it("se não cabe embaixo, vai para cima", () => {
    const p = posicionarBalao({ x: 500, y: 700, w: 200, h: 60 }, balao, tela);
    expect(p.lado).toBe("cima");
    expect(p.top).toBe(700 - 14 - 220);
  });

  it("respeita o lado pedido quando ele cabe (menu lateral → balão à direita)", () => {
    const p = posicionarBalao({ x: 8, y: 150, w: 230, h: 38 }, balao, tela, "direita");
    expect(p.lado).toBe("direita");
    expect(p.left).toBe(8 + 230 + 14);
    expect(p.top + p.seta).toBeCloseTo(150 + 19, 0);
  });

  it("nunca sai da tela, mesmo com o elemento colado na borda", () => {
    for (const alvo of [{ x: 0, y: 0, w: 40, h: 40 }, { x: 1240, y: 760, w: 40, h: 40 }, { x: 1240, y: 0, w: 40, h: 40 }, { x: 0, y: 760, w: 40, h: 40 }]) {
      const p = posicionarBalao(alvo, balao, tela);
      expect(p.left).toBeGreaterThanOrEqual(12);
      expect(p.top).toBeGreaterThanOrEqual(12);
      expect(p.left + balao.w).toBeLessThanOrEqual(1280 - 12);
      expect(p.top + balao.h).toBeLessThanOrEqual(800 - 12);
    }
  });

  it("elemento enorme: o balão ainda aparece inteiro na tela", () => {
    const p = posicionarBalao({ x: 0, y: 0, w: 1280, h: 800 }, balao, tela);
    expect(p.left + balao.w).toBeLessThanOrEqual(1280);
    expect(p.top + balao.h).toBeLessThanOrEqual(800);
  });
});

describe("passos e memória do tour", () => {
  it("vizinho pula os opcionais que não existem, nos dois sentidos, e devolve -1 no fim", () => {
    const passos = [
      { id: "a", titulo: "A", texto: "." },
      { id: "b", titulo: "B", texto: ".", opcional: true, alvo: "x" },
      { id: "c", titulo: "C", texto: "." },
    ];
    expect(vizinho(passos, 0, 1, () => false)).toBe(2);
    expect(vizinho(passos, 0, 1, () => true)).toBe(1);
    expect(vizinho(passos, 2, -1, () => false)).toBe(0);
    expect(vizinho(passos, 2, 1, () => true)).toBe(-1);
    expect(vizinho(passos, 0, -1, () => true)).toBe(-1);
  });

  it("lembra, por usuário, que já viu o tour e o convite, de forma independente", () => {
    memoria.clear();
    expect(jaViu("ia", 7)).toBe(false);
    marcarVisto("ia", 7, "convite");
    expect(jaViu("ia", 7, "convite")).toBe(true);
    expect(jaViu("ia", 7, "visto")).toBe(false);
    expect(jaViu("ia", 8, "convite")).toBe(false);
    marcarVisto("ia", 7);
    expect(jaViu("ia", 7)).toBe(true);
  });

  it("o estado inicia, avança e encerra; sem passos não ativa", () => {
    useTour.getState().iniciar("t", []);
    expect(useTour.getState().ativo).toBeNull();
    useTour.getState().iniciar("t", [{ id: "a", titulo: "A", texto: "." }]);
    expect(useTour.getState().ativo?.id).toBe("t");
    useTour.getState().ir(1);
    expect(useTour.getState().passo).toBe(1);
    useTour.getState().encerrar();
    expect(useTour.getState().ativo).toBeNull();
    expect(useTour.getState().passo).toBe(0);
  });
});

describe("roteiro do tour da IA", () => {
  beforeEach(() => memoria.clear());
  it("tem ids únicos, textos preenchidos e termina com um passo de texto (regras)", () => {
    const ids = passosTourIA.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of passosTourIA) { expect(p.titulo.length).toBeGreaterThan(3); expect(p.texto.length).toBeGreaterThan(20); }
    const ultimo = passosTourIA.at(-1)!;
    expect(ultimo.alvo).toBeUndefined();
    expect(ultimo.texto).toMatch(/CPF/);
    expect(TOUR_IA).toBe("ia-v1");
  });

  it("os passos obrigatórios são só o menu, a pergunta, o modelo, o botão Workspace e as regras", () => {
    const obrigatorios = passosTourIA.filter((p) => !p.opcional).map((p) => p.id);
    expect(obrigatorios).toEqual(["menu", "pergunta", "modelo", "workspace", "regras"]);
  });
});

describe("zoom por CSS", () => {
  it("converte pixels da tela para pixels do CSS e não mexe quando não há zoom", async () => {
    const { paraPixelsCss } = await import("../src/tour/tour");
    expect(paraPixelsCss({ x: 70, y: 140, w: 35, h: 14 }, 0.7)).toEqual({ x: 100, y: 200, w: 50, h: 20 });
    const r = { x: 5, y: 6, w: 7, h: 8 };
    expect(paraPixelsCss(r, 1)).toBe(r);
  });
});
