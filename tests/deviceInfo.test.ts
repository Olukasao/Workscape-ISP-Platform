// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() } }));
const { lerOuCriarIdDispositivo } = await import("../electron/deviceInfo");

describe("identificador do computador", () => {
  it("cria um id válido na primeira vez e devolve sempre o mesmo depois", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "dev-"));
    const arquivo = path.join(pasta, "sub", "device.json");
    const a = lerOuCriarIdDispositivo(arquivo);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(lerOuCriarIdDispositivo(arquivo, () => "00000000-0000-0000-0000-000000000000")).toBe(a);
    expect(JSON.parse(fs.readFileSync(arquivo, "utf8")).id).toBe(a);
  });

  it("recria o id se o arquivo estiver corrompido ou com valor inválido", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "dev-"));
    const arquivo = path.join(pasta, "device.json");
    fs.writeFileSync(arquivo, "{ lixo");
    const novo = lerOuCriarIdDispositivo(arquivo, () => "11111111-1111-4111-8111-111111111111");
    expect(novo).toBe("11111111-1111-4111-8111-111111111111");
    fs.writeFileSync(arquivo, JSON.stringify({ id: "nao-e-um-uuid" }));
    expect(lerOuCriarIdDispositivo(arquivo, () => "22222222-2222-4222-8222-222222222222")).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("funciona mesmo sem conseguir gravar (o id vale só nesta execução)", () => {
    // Um arquivo comum no lugar de uma pasta: gravar embaixo dele sempre falha (ENOTDIR).
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "dev-"));
    const arquivoComum = path.join(pasta, "arquivo");
    fs.writeFileSync(arquivoComum, "x");
    const id = lerOuCriarIdDispositivo(path.join(arquivoComum, "sub", "device.json"), () => "33333333-3333-4333-8333-333333333333");
    expect(id).toBe("33333333-3333-4333-8333-333333333333");
  });
});
