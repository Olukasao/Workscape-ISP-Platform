import { describe, expect, it } from "vitest";
import { respostaFixa } from "../src/modules/assistente/respostasFixas";

describe("resposta fixa: agenda fora do ar", () => {
  it.each([
    "a agenda ta offline?",
    "A agenda de técnicos não está funcionando",
    "agenda caiu de novo",
    "Tá com problema na agenda técnica, não carrega",
    "a agenda está fora do ar?",
    "agenda tá lenta demais, deu erro",
    "A agenda não abre",
  ])("responde com o Harry: %s", (p) => {
    expect(respostaFixa(p)?.imagem).toBe("harry404");
    expect(respostaFixa(p)?.content).toMatch(/Harry/);
  });
  it.each([
    "como cadastro uma OS na agenda?",
    "quais técnicos têm OS na agenda hoje?",
    "a rede está offline em Caieiras?",
    "o painel NOC não carrega",
    "resuma o meu dia",
  ])("não interfere em outras perguntas: %s", (p) => {
    expect(respostaFixa(p)).toBeNull();
  });
});

describe("resposta fixa: teclado barulhento", () => {
  it.each(["qual o teclado mais barulhento?", "Qual teclado faz mais barulho aqui?", "de quem é o teclado mais barulhento da empresa"])("responde com o Ed: %s", (p) => {
    expect(respostaFixa(p)?.imagem).toBe("ednesio");
    expect(respostaFixa(p)?.content).toMatch(/Ed, o Tecladista/);
  });
  it("não interfere em outras perguntas sobre teclado", () => {
    expect(respostaFixa("como troco o teclado do notebook?")).toBeNull();
  });
});
