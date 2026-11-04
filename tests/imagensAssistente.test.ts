// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bytesDoBase64, imagensDe, LADO_MAXIMO, reduzir, tipoAceito } from "../src/modules/assistente/imagens";

describe("imagens do Assistente", () => {
  it("aceita só PNG, JPG, WEBP e GIF", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/gif", "IMAGE/PNG"]) expect(tipoAceito(t)).toBe(true);
    for (const t of ["image/svg+xml", "application/pdf", "text/plain", "image/bmp", ""]) expect(tipoAceito(t)).toBe(false);
  });

  it("reduz mantendo a proporção e nunca amplia", () => {
    expect(reduzir(3200, 1600)).toEqual({ w: LADO_MAXIMO, h: 800 });
    expect(reduzir(1000, 4000)).toEqual({ w: 400, h: LADO_MAXIMO });
    expect(reduzir(800, 600)).toEqual({ w: 800, h: 600 });
    expect(reduzir(1920, 1080, 160)).toEqual({ w: 160, h: 90 });
    expect(reduzir(0, 0)).toEqual({ w: 1, h: 1 });
    expect(reduzir(-5, 10)).toEqual({ w: 1, h: 1 });
  });

  it("calcula o tamanho real de um base64", () => {
    expect(bytesDoBase64("QUJD")).toBe(3);
    expect(bytesDoBase64("QUI=")).toBe(2);
    expect(bytesDoBase64("QQ==")).toBe(1);
  });

  it("pega só os arquivos de imagem de um evento de colar, ignorando texto", () => {
    const arq = (nome: string, tipo: string) => ({ name: nome, type: tipo }) as unknown as File;
    const itens = [
      { kind: "string", type: "text/plain", getAsFile: () => null },
      { kind: "file", type: "image/png", getAsFile: () => arq("a.png", "image/png") },
      { kind: "file", type: "application/pdf", getAsFile: () => arq("b.pdf", "application/pdf") },
      { kind: "file", type: "image/jpeg", getAsFile: () => null },
    ];
    expect(imagensDe(itens).map((f) => f.name)).toEqual(["a.png"]);
    expect(imagensDe(null)).toEqual([]);
    expect(imagensDe(undefined)).toEqual([]);
  });
});
