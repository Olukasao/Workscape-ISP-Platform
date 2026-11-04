import { describe, expect, it } from "vitest";
import { nomeComExtensao } from "../src/legacy/utils/baixarArquivo";

describe("nomeComExtensao", () => {
  const url = "http://x/uploads/chat/1/abc123.png";
  it("mantém o nome que já tem extensão", () => {
    expect(nomeComExtensao("print.png", url)).toBe("print.png");
    expect(nomeComExtensao("relatorio.pdf", "http://x/uploads/chat/1/q.pdf")).toBe("relatorio.pdf");
  });
  it("acrescenta a extensão do endereço quando falta", () => {
    expect(nomeComExtensao("imagem", url)).toBe("imagem.png");
    expect(nomeComExtensao("foto de hoje", "http://x/uploads/chat/1/a.JPG")).toBe("foto de hoje.jpg");
  });
  it("não deixa o nome ser só a extensão", () => {
    expect(nomeComExtensao(" .png", url)).toBe("imagem.png");
    expect(nomeComExtensao("", url)).toBe("imagem.png");
  });
  it("troca caracteres inválidos do Windows", () => {
    expect(nomeComExtensao("a/b:c?.png", url)).toBe("a_b_c_.png");
  });
});
