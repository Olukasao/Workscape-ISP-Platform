import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) },
}));
const { tileLayout, workspaceSchema } = await import("../electron/workspaces");

const sobrepoe = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("workspaces personalizados", () => {
  it("distribui 1, 2, 3 e 4+ painéis sem sobrepor e dentro da tela", () => {
    const kinds = ["dashboard", "rede", "agenda", "chat", "resumo", "navegador"] as const;
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const itens = tileLayout([...kinds].slice(0, n), { pinned: true, compact: false });
      expect(itens).toHaveLength(n);
      for (const i of itens) {
        expect(i.x).toBeGreaterThanOrEqual(0);
        expect(i.y).toBeGreaterThanOrEqual(0);
        expect(i.x + i.width).toBeLessThanOrEqual(1920 + 1);
        expect(i.y + i.height).toBeLessThanOrEqual(1040 + 1);
        expect(i.pinned).toBe(true);
      }
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) expect(sobrepoe(itens[a], itens[b])).toBe(false);
    }
  });
  it("com 3 painéis o primeiro ocupa a metade esquerda inteira", () => {
    const [a, b, c] = tileLayout(["dashboard", "rede", "chat"], { pinned: false, compact: true });
    expect(a).toMatchObject({ x: 0, y: 0, width: 960, height: 1040, compact: true });
    expect(b.x).toBe(960);
    expect(c.x).toBe(960);
    expect(b.y).toBeLessThan(c.y);
  });
  it("recusa dados inválidos (painel desconhecido, tamanho absurdo, sem janelas)", () => {
    const base = { id: "1", owner: "7", name: "Sala", createdAt: 1, items: [{ kind: "rede", x: 0, y: 0, width: 800, height: 600, pinned: false, compact: false }] };
    expect(workspaceSchema.safeParse(base).success).toBe(true);
    expect(workspaceSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...base, items: [{ ...base.items[0], kind: "hack" }] }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...base, items: [{ ...base.items[0], width: 99999 }] }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });
});
