import { describe, expect, it, vi } from "vitest";
import { criarRenovador } from "../src/services/agendaWebSessao";

describe("renovador da sessão da agenda", () => {
  it("pede o token, entrega à página e avisa o sucesso", async () => {
    const entregar = vi.fn(async () => {});
    const aoSucesso = vi.fn();
    const renovar = criarRenovador({ obterToken: async () => "agenda.abc", entregar, aoSucesso });
    expect(await renovar()).toBe(true);
    expect(entregar).toHaveBeenCalledWith("agenda.abc");
    expect(aoSucesso).toHaveBeenCalledTimes(1);
  });

  it("avisa a falha sem lançar erro e tenta de novo na vez seguinte", async () => {
    let falhar = true;
    const aoFalhar = vi.fn();
    const entregar = vi.fn(async () => {});
    const renovar = criarRenovador({
      obterToken: async () => { if (falhar) throw new Error("sem sessão"); return "agenda.ok"; },
      entregar, aoFalhar,
    });
    expect(await renovar()).toBe(false);
    expect(aoFalhar).toHaveBeenCalledTimes(1);
    expect(entregar).not.toHaveBeenCalled();
    falhar = false;
    expect(await renovar()).toBe(true);
    expect(entregar).toHaveBeenCalledWith("agenda.ok");
  });

  it("não roda duas renovações ao mesmo tempo", async () => {
    let liberar!: () => void;
    let chamadas = 0;
    const obterToken = vi.fn(() => (++chamadas === 1 ? new Promise<string>((r) => { liberar = () => r("agenda.x"); }) : Promise.resolve("agenda.y")));
    const renovar = criarRenovador({ obterToken, entregar: async () => {} });
    const a = renovar();
    const b = renovar();
    expect(obterToken).toHaveBeenCalledTimes(1);
    liberar();
    await Promise.all([a, b]);
    await renovar();
    expect(obterToken).toHaveBeenCalledTimes(2);
  });
});
