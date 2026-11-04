// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const { validadeDoToken, precisaRenovar, RENOVAR_QUANDO_FALTAR_MS } = await import("../src/services/sessaoRenovacao");

const jwt = (exp: number | null) => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(exp === null ? { id: 1 } : { id: 1, exp })}.assinatura`;
};
const agora = 1_900_000_000_000;
const emDias = (d: number) => Math.floor((agora + d * 86_400_000) / 1000);

describe("renovação silenciosa da sessão", () => {
  it("lê a validade do token (em ms) e devolve null para token estranho", () => {
    expect(validadeDoToken(jwt(emDias(5)))).toBe(emDias(5) * 1000);
    expect(validadeDoToken(jwt(null))).toBeNull();
    expect(validadeDoToken("lixo")).toBeNull();
    expect(validadeDoToken("")).toBeNull();
    expect(validadeDoToken(null)).toBeNull();
    expect(validadeDoToken("a.%%%.c")).toBeNull();
  });

  it("renova quando faltam menos de 3 dias, e só então", () => {
    expect(RENOVAR_QUANDO_FALTAR_MS).toBe(3 * 86_400_000);
    expect(precisaRenovar(jwt(emDias(6)), agora)).toBe(false);
    expect(precisaRenovar(jwt(emDias(2.9)), agora)).toBe(true);
    expect(precisaRenovar(jwt(emDias(0.1)), agora)).toBe(true);
  });

  it("token já vencido ou ilegível não dispara renovação (só entrando de novo resolve)", () => {
    expect(precisaRenovar(jwt(emDias(-1)), agora)).toBe(false);
    expect(precisaRenovar("lixo", agora)).toBe(false);
    expect(precisaRenovar(null, agora)).toBe(false);
  });
});

describe("renovarSessao: a troca de verdade", () => {
  it("troca o token em tudo (sessão, socket e sessão guardada) e não repete chamadas simultâneas", async () => {
    vi.resetModules();
    const post = vi.fn(async () => ({ data: { token: "NOVO.TOKEN.AQUI", exp: 1 } }));
    vi.doMock("../src/services/api", () => ({ clients: { chat: { post } } }));
    const authSocket = vi.fn();
    vi.doMock("../src/services/socket", () => ({ configureSocketAuth: authSocket }));
    const salvar = vi.fn(async () => {});
    vi.stubGlobal("window", { desktop: { saveSession: salvar } });
    const { useSession } = await import("../src/stores/workspace");
    const { renovarSessao } = await import("../src/services/sessaoRenovacao");
    useSession.setState({ token: "VELHO", user: { id: 1, nome: "A", email: "a@a", perfil: "usuario", empresa_id: 1 } });
    const [a, b] = await Promise.all([renovarSessao(), renovarSessao()]);
    expect(a && b).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(useSession.getState().token).toBe("NOVO.TOKEN.AQUI");
    expect(authSocket).toHaveBeenCalledWith("NOVO.TOKEN.AQUI");
    expect(salvar).toHaveBeenCalledWith({ token: "NOVO.TOKEN.AQUI" });
  });

  it("se o servidor falhar, mantém o token atual e devolve false sem lançar erro", async () => {
    vi.resetModules();
    vi.doMock("../src/services/api", () => ({ clients: { chat: { post: vi.fn(async () => { throw new Error("rede"); }) } } }));
    vi.doMock("../src/services/socket", () => ({ configureSocketAuth: vi.fn() }));
    vi.stubGlobal("window", { desktop: undefined });
    const { useSession } = await import("../src/stores/workspace");
    const { renovarSessao } = await import("../src/services/sessaoRenovacao");
    useSession.setState({ token: "VELHO", user: { id: 1, nome: "A", email: "a@a", perfil: "usuario", empresa_id: 1 } });
    expect(await renovarSessao()).toBe(false);
    expect(useSession.getState().token).toBe("VELHO");
  });

  it("sem ninguém conectado não pede nada", async () => {
    vi.resetModules();
    const post = vi.fn();
    vi.doMock("../src/services/api", () => ({ clients: { chat: { post } } }));
    vi.doMock("../src/services/socket", () => ({ configureSocketAuth: vi.fn() }));
    vi.stubGlobal("window", {});
    const { useSession } = await import("../src/stores/workspace");
    const { renovarSessao } = await import("../src/services/sessaoRenovacao");
    useSession.setState({ token: null, user: null });
    expect(await renovarSessao()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
