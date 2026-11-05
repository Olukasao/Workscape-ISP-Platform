import { describe, expect, it, vi } from "vitest";
import { criarRenovador, tokenAindaValido, vencimentoDoToken } from "../src/services/agendaWebSessao";

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

describe("validade do token da agenda", () => {
  const tk = (exp: number) => `agenda.${btoa(JSON.stringify({ id: 1, exp })).replace(/=/g, "")}.sig`;
  const agora = Date.parse("2026-11-05T13:00:00Z");
  it("lê o vencimento", () => expect(vencimentoDoToken(tk(1000))).toBe(1_000_000));
  it("recusa token vencido ou perto de vencer", () => {
    expect(tokenAindaValido(tk(agora / 1000 - 10), agora)).toBe(false);
    expect(tokenAindaValido(tk(agora / 1000 + 60), agora)).toBe(false);
  });
  it("aceita token com folga e o que não dá para ler", () => {
    expect(tokenAindaValido(tk(agora / 1000 + 86400), agora)).toBe(true);
    expect(tokenAindaValido("agenda.xx", agora)).toBe(true);
  });
});
