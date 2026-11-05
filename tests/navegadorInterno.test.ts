// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { abrirSgpNoWorkspace, EVENTO_SITE_NAVEGADOR } from "../src/services/navegadorInterno";

// Ambiente sem DOM: simula só o que o serviço usa (window.desktop e eventos).
const alvo = new EventTarget();
(globalThis as any).window = Object.assign(alvo, { desktop: undefined as any });
(globalThis as any).CustomEvent = class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } };
const url = "https://acessanet.sgp.net.br/public/precadastro/F/";
describe("abrir o SGP dentro do Workspace", () => {
  it("manda a página para o Navegador, troca para a aba SGP e navega até lá", async () => {
    const browserOpenSgp = vi.fn(async () => {});
    const openSgpLink = vi.fn(async () => {});
    (window as any).desktop = { browserOpenSgp, openSgpLink };
    const navigate = vi.fn();
    const aoTrocar = vi.fn();
    window.addEventListener(EVENTO_SITE_NAVEGADOR, (e) => aoTrocar((e as CustomEvent).detail));
    await abrirSgpNoWorkspace(url, navigate);
    expect(browserOpenSgp).toHaveBeenCalledWith(url);
    expect(aoTrocar).toHaveBeenCalledWith("sgp");
    expect(navigate).toHaveBeenCalledWith("/navegador");
    expect(openSgpLink).not.toHaveBeenCalled();
  });
  it("se falhar, abre no navegador do computador como antes", async () => {
    const openSgpLink = vi.fn(async () => {});
    (window as any).desktop = { browserOpenSgp: vi.fn(async () => { throw new Error("x"); }), openSgpLink };
    const navigate = vi.fn();
    await abrirSgpNoWorkspace(url, navigate);
    expect(openSgpLink).toHaveBeenCalledWith(url);
    expect(navigate).not.toHaveBeenCalled();
  });
});
