import { describe, expect, it } from "vitest";
import { extensaoDoTipo, nomeParaSalvar } from "../electron/nomeArquivo";

describe("nomeParaSalvar", () => {
  it("mantém o que já está certo", () => {
    expect(nomeParaSalvar("print.png", "/uploads/chat/1/a.png")).toBe("print.png");
  });
  it("completa a extensão pelo endereço e, se faltar, pelo tipo do servidor", () => {
    expect(nomeParaSalvar("imagem", "/uploads/chat/1/abc.jpg")).toBe("imagem.jpg");
    expect(nomeParaSalvar("Maria Helena", "/uploads/chat/1/1793-Maria-Helena", "image/png")).toBe("Maria Helena.png");
    expect(nomeParaSalvar("foto", "/uploads/chat/1/x", "image/jpeg; charset=binary")).toBe("foto.jpg");
  });
  it("nunca deixa o nome só com a extensão", () => {
    expect(nomeParaSalvar(" .png", "/uploads/x.png")).toBe("arquivo.png");
    expect(nomeParaSalvar("", "/uploads/x.png")).toBe("arquivo.png");
  });
  it("limpa caracteres inválidos e caminhos", () => {
    expect(nomeParaSalvar("a:b?.png", "/u/x.png")).toBe("a_b_.png");
    expect(nomeParaSalvar("../../segredo.png", "/u/x.png")).toBe("segredo.png");
  });
  it("tipos desconhecidos ficam sem extensão extra", () => {
    expect(extensaoDoTipo("application/x-qualquer")).toBe("");
    expect(nomeParaSalvar("dados", "/u/x", "application/x-qualquer")).toBe("dados");
  });
});
