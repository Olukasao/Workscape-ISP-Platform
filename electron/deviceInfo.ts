import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

// Identificador estável deste computador, para o painel de versões da Administração. Não é um dado pessoal:
// é um número aleatório gerado na primeira vez e guardado na pasta do app; reinstalar o app não o apaga
// (fica na pasta de dados do usuário), mas apagar essa pasta gera um novo.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const arquivo = () => path.join(app.getPath("userData"), "device.json");

export function lerOuCriarIdDispositivo(caminho = arquivo(), gerar: () => string = randomUUID): string {
  try {
    const salvo = JSON.parse(fs.readFileSync(caminho, "utf8"))?.id;
    if (typeof salvo === "string" && UUID.test(salvo)) return salvo.toLowerCase();
  } catch {
    /* ainda não existe, ou está ilegível: cria um novo */
  }
  const id = gerar();
  try {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, JSON.stringify({ id }), { mode: 0o600 });
  } catch {
    /* sem gravar, o id vale só nesta execução */
  }
  return id;
}

export function deviceInfo() {
  return { id: lerOuCriarIdDispositivo(), nome: os.hostname().slice(0, 80) };
}
