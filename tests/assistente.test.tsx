// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "../src/modules/assistente/Markdown";

const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
});
vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const conversar = vi.fn();
const coletar = vi.fn(async () => [] as { titulo: string; texto: string }[]);
const apagarMemoria = vi.fn(async () => {});
vi.mock("../src/services/assistenteNet", () => ({ assistenteConversar: (...a: unknown[]) => conversar(...a), apagarMemoria: (...a: unknown[]) => apagarMemoria(...a) }));

vi.mock("../src/modules/assistente/dados", async (original) => ({
  ...(await original<typeof import("../src/modules/assistente/dados")>()),
  coletarDados: (...a: unknown[]) => coletar(...a),
}));
const { useAssistente, agruparPorData } = await import("../src/modules/assistente/store");

describe("Markdown do Assistente", () => {
  it("renderiza negrito, listas, código e links http(s)", () => {
    const html = renderToStaticMarkup(<Markdown texto={"**oi** `x`\n\n- a\n- b\n\n1. um\n\n```\ncodigo\n```\n\n[site](https://a.com)"} />);
    expect(html).toContain("<strong>oi</strong>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(html).toContain("<ol><li>um</li></ol>");
    expect(html).toContain("<pre><code>codigo</code></pre>");
    expect(html).toContain('href="https://a.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("nunca deixa passar HTML bruto nem links perigosos", () => {
    const html = renderToStaticMarkup(<Markdown texto={'<img src=x onerror=alert(1)> [clique](javascript:alert(1)) <script>x</script>'} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('href="javascript');
  });
});

describe("agruparPorData", () => {
  it("separa em Hoje, Ontem, Últimos 7 dias e Anteriores", () => {
    const agora = new Date(2026, 9, 24, 12, 0, 0);
    const dia = 86_400_000;
    const c = (id: string, atras: number) => ({ id, titulo: id, criada: 0, atualizada: agora.getTime() - atras, mensagens: [] });
    const grupos = agruparPorData([c("a", 0), c("b", dia), c("c", 4 * dia), c("d", 30 * dia)], agora);
    expect(grupos.map((g) => g.rotulo)).toEqual(["Hoje", "Ontem", "Últimos 7 dias", "Anteriores"]);
  });
});

describe("store do Assistente", () => {
  beforeEach(() => {
    memoria.clear();
    conversar.mockReset();
    useAssistente.setState({ usuario: "", conversas: [], ativaId: null, enviando: null, erro: null, aviso: null, modelo: "auto", pesquisar: true, usarDados: true, usarMemoria: true });
  });

  it("cria a conversa na primeira pergunta, salva e guarda a resposta com as fontes", async () => {
    conversar.mockResolvedValue({ resposta: "Brasília", fontes: [{ titulo: "T", url: "https://t.com" }], busca: "ok", modelo: "m1" });
    useAssistente.getState().carregar("7");
    await useAssistente.getState().enviar("Qual a capital do Brasil?", true);
    const s = useAssistente.getState();
    expect(s.conversas).toHaveLength(1);
    expect(s.conversas[0].titulo).toBe("Qual a capital do Brasil?");
    expect(s.conversas[0].mensagens.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(s.conversas[0].mensagens[1].fontes).toHaveLength(1);
    expect(conversar).toHaveBeenCalledWith([{ role: "user", content: "Qual a capital do Brasil?" }], true, "auto", [], true, []);
    const salvo = JSON.parse(memoria.get("workspace-assistente-v1:7")!);
    expect(salvo.conversas[0].mensagens).toHaveLength(2);
  });

  it("com dados do Workspace ligado, lê as fontes da pergunta e manda os blocos junto", async () => {
    coletar.mockResolvedValueOnce([{ titulo: "Agenda de técnicos, hoje", texto: "Carlos 5 OS" }]);
    conversar.mockResolvedValue({ resposta: "Carlos", fontes: [], busca: "nao_pedida", dadosUsados: ["Agenda de técnicos, hoje"] });
    useAssistente.getState().carregar("8");
    await useAssistente.getState().enviar("qual técnico tem mais OS?", false, true);
    expect(coletar).toHaveBeenCalledWith("qual técnico tem mais OS?");
    expect(conversar).toHaveBeenCalledWith(expect.anything(), false, "auto", [{ titulo: "Agenda de técnicos, hoje", texto: "Carlos 5 OS" }], true, []);
    expect(useAssistente.getState().conversas[0].mensagens[1].dados).toEqual(["Agenda de técnicos, hoje"]);
    expect(useAssistente.getState().coletando).toBe(false);
  });

  it("não lê dados do Workspace quando o interruptor está desligado", async () => {
    coletar.mockClear();
    conversar.mockResolvedValue({ resposta: "ok", fontes: [], busca: "nao_pedida" });
    useAssistente.getState().carregar("9");
    await useAssistente.getState().enviar("quantas OS hoje?", false, false);
    expect(coletar).not.toHaveBeenCalled();
  });

  it("guarda o aviso 'Memorizei' na resposta, manda a preferência de memória e permite desfazer", async () => {
    conversar.mockResolvedValue({ resposta: "ok", fontes: [], busca: "nao_pedida", memorizado: [{ id: 5, texto: "Atende o N2." }] });
    useAssistente.getState().carregar("10");
    await useAssistente.getState().enviar("eu atendo o N2", false, false);
    const conv = useAssistente.getState().conversas[0];
    expect(conv.mensagens[1].memorizado).toEqual([{ id: 5, texto: "Atende o N2." }]);
    expect(conversar).toHaveBeenLastCalledWith(expect.anything(), false, "auto", [], true, []);
    await useAssistente.getState().desfazerMemoria(conv.id, 5);
    expect(apagarMemoria).toHaveBeenCalledWith(5);
    expect(useAssistente.getState().conversas[0].mensagens[1].memorizado).toEqual([]);
    useAssistente.getState().setUsarMemoria(false);
    await useAssistente.getState().enviar("outra", false, false);
    expect(conversar).toHaveBeenLastCalledWith(expect.anything(), false, "auto", [], false, []);
  });

  it("envia as imagens anexadas ao servidor, guarda só a miniatura e usa um texto padrão se vier só a imagem", async () => {
    conversar.mockResolvedValue({ resposta: "É um erro 504.", fontes: [], busca: "nao_pedida" });
    useAssistente.getState().carregar("11");
    const img = { id: "1", tipo: "image/png", dados: "AAAA", miniatura: "data:image/jpeg;base64,BBBB", nome: "print.png" };
    await useAssistente.getState().enviar("", false, false, [img]);
    const conv = useAssistente.getState().conversas[0];
    expect(conv.mensagens[0].content).toBe("Explique esta imagem.");
    expect(conv.mensagens[0].miniaturas).toEqual(["data:image/jpeg;base64,BBBB"]);
    expect(conversar).toHaveBeenLastCalledWith([{ role: "user", content: "Explique esta imagem." }], false, "auto", [], true, [{ tipo: "image/png", dados: "AAAA" }]);
    expect(JSON.stringify(memoria.get("workspace-assistente-v1:11"))).not.toContain("AAAA");
  });

  it("sem texto e sem imagem não envia nada", async () => {
    conversar.mockClear();
    useAssistente.getState().carregar("12");
    await useAssistente.getState().enviar("   ", false, false, []);
    expect(conversar).not.toHaveBeenCalled();
  });

  it("separa o histórico por usuário e recarrega do armazenamento", async () => {
    conversar.mockResolvedValue({ resposta: "ok", fontes: [], busca: "nao_pedida" });
    useAssistente.getState().carregar("1");
    await useAssistente.getState().enviar("pergunta do usuário 1", false);
    useAssistente.getState().carregar("2");
    expect(useAssistente.getState().conversas).toHaveLength(0);
    useAssistente.getState().carregar("1");
    expect(useAssistente.getState().conversas).toHaveLength(1);
  });

  it("guarda o erro na conversa certa e libera o envio", async () => {
    conversar.mockRejectedValue(new Error("falhou"));
    useAssistente.getState().carregar("3");
    await useAssistente.getState().enviar("oi", false);
    const s = useAssistente.getState();
    expect(s.erro?.texto).toBe("falhou");
    expect(s.erro?.conversaId).toBe(s.conversas[0].id);
    expect(s.enviando).toBeNull();
  });

  it("renomeia, apaga e inicia nova conversa", async () => {
    conversar.mockResolvedValue({ resposta: "ok", fontes: [], busca: "nao_pedida" });
    useAssistente.getState().carregar("4");
    await useAssistente.getState().enviar("primeira", false);
    const id = useAssistente.getState().conversas[0].id;
    useAssistente.getState().renomear(id, "Meu nome");
    expect(useAssistente.getState().conversas[0].titulo).toBe("Meu nome");
    useAssistente.getState().nova();
    expect(useAssistente.getState().ativaId).toBeNull();
    await useAssistente.getState().enviar("segunda", false);
    expect(useAssistente.getState().conversas).toHaveLength(2);
    useAssistente.getState().apagar(id);
    expect(useAssistente.getState().conversas).toHaveLength(1);
  });

  it("continua a mesma conversa e manda o histórico e o modelo escolhido", async () => {
    conversar.mockResolvedValue({ resposta: "r", fontes: [], busca: "nao_pedida" });
    useAssistente.getState().carregar("5");
    useAssistente.getState().setModelo("gemini/x");
    await useAssistente.getState().enviar("um", false);
    await useAssistente.getState().enviar("dois", false);
    expect(useAssistente.getState().conversas).toHaveLength(1);
    expect(conversar).toHaveBeenLastCalledWith(
      [{ role: "user", content: "um" }, { role: "assistant", content: "r" }, { role: "user", content: "dois" }],
      false,
      "gemini/x",
      [],
      true,
      [],
    );
  });
});

describe("dados do Workspace para a IA", async () => {
  const dados = await import("../src/modules/assistente/dados");

  it("nomeCurto mantém nome e sobrenome e descarta documentos e números", () => {
    expect(dados.nomeCurto("Maria da Silva Souza")).toBe("Maria Souza");
    expect(dados.nomeCurto("João Pereira")).toBe("João Pereira");
    expect(dados.nomeCurto("123.456.789-09")).toBe("");
    expect(dados.nomeCurto("Ana 11999998888")).toBe("Ana");
  });

  it("limparTexto apaga CPF, telefone e e-mail", () => {
    const t = dados.limparTexto("Cliente 123.456.789-09 fone (24) 99876-5432 mail a@b.com instalar");
    expect(t).not.toMatch(/123\.456|99876|a@b\.com/);
    expect(t).toContain("instalar");
  });

  it("detectarFontes escolhe as fontes e os dias pela pergunta", () => {
    const hoje = "2026-10-24";
    expect(dados.detectarFontes("qual técnico está com mais demanda hoje?", hoje)).toMatchObject({ agenda: true, chamados: false, dias: [hoje] });
    expect(dados.detectarFontes("quais as OS de amanhã?", hoje).dias).toEqual(["2026-10-25"]);
    expect(dados.detectarFontes("o que mudou na agenda?", hoje)).toMatchObject({ mudancas: true, agenda: true });
    expect(dados.detectarFontes("quantos chamados na fila N2?", hoje)).toMatchObject({ chamados: true, agenda: false });
    expect(dados.detectarFontes("tem alguma PON caída ou queda de energia?", hoje).rede).toBe(true);
    expect(dados.detectarFontes("me dá o resumo do dia", hoje).painel).toBe(true);
    expect(dados.detectarFontes("como configuro uma VLAN?", hoje)).toMatchObject({ agenda: false, chamados: false, painel: false, rede: false });
  });

  it("resumirAgenda conta por técnico e nunca inclui endereço, telefone, CPF nem coordenadas", () => {
    const bloco = dados.resumirAgenda("2026-10-24", [
      { id: 1, tecnico: "Carlos", cliente: "Maria da Silva Souza", hora: "08:00", status: "Agendado", motivo: "Sem sinal, fone 24998765432", bairro: "Centro", enderecoCompleto: "Rua Secreta 123", latitude: -22.1, longitude: -43.2, telefone: "24998765432", cpf: "123.456.789-09" },
      { id: 2, tecnico: "Carlos", cliente: "João Lima", hora: "10:00", status: "Concluído", bairro: "Centro" },
      { id: 3, tecnico: "Ana", cliente: "Paulo Dias", hora: "09:00", status: "Agendado", bairro: "Vila" },
    ] as never);
    expect(bloco.texto).toContain("Total de OS: 3.");
    expect(bloco.texto).toMatch(/Carlos 2 \(/);
    expect(bloco.texto).toContain("Maria Souza");
    expect(bloco.texto).not.toMatch(/Rua Secreta|24998765432|123\.456|-22\.1|da Silva/);
    expect(bloco.titulo).toContain("2026-10-24");
  });
});
