// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dentroDaJanela, posicaoAposRedimensionar } from "../src/components/useArrastar";

const GRANDE = { w: 1440, h: 1000 };
const padrao = { x: 1440 - 320 - 32, y: 1000 - 520 - 32 }; // canto inferior direito
const base = { w: 320, h: 520, padrao };

describe("posição dos cartões flutuantes depois de mudar o tamanho da janela", () => {
  it("janela minimizada (160 x 28): não mexe em nada, e assim não prende o cartão no canto", () => {
    expect(posicaoAposRedimensionar({ ...base, janela: { w: 160, h: 28 }, escolhida: null })).toBeNull();
    expect(posicaoAposRedimensionar({ ...base, janela: { w: 1440, h: 120 }, escolhida: { x: 50, y: 50 } })).toBeNull();
  });

  it("sem posição escolhida: acompanha o canto padrão da janela atual", () => {
    expect(posicaoAposRedimensionar({ ...base, janela: GRANDE, escolhida: null })).toEqual(padrao);
  });

  it("posição que a pessoa arrastou volta exatamente ao lugar", () => {
    expect(posicaoAposRedimensionar({ ...base, janela: GRANDE, escolhida: { x: 510, y: 167 } })).toEqual({ x: 510, y: 167 });
  });

  it("janela realmente menor: o cartão fica inteiro dentro da tela, com margem", () => {
    const p = posicaoAposRedimensionar({ ...base, janela: { w: 700, h: 560 }, escolhida: { x: 900, y: 900 } })!;
    expect(p.x + 320).toBeLessThanOrEqual(700 - 12);
    expect(p.y).toBeGreaterThanOrEqual(12);
  });

  it("cartão maior que a janela vai para a margem em vez de sumir", () => {
    expect(dentroDaJanela({ x: 500, y: 500 }, 400, 600, { w: 350, h: 350 })).toEqual({ x: 12, y: 12 });
  });
});
