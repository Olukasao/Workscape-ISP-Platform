import { describe, expect, it } from "vitest";
import {
  resolveExternalUrl,
  resolveModuleTarget,
} from "../electron/moduleNavigation";
import { defaultConfig } from "../electron/policy";
const config = {
  ...defaultConfig,
  chat: "https://chat.example.org",
  agenda: "https://agenda.example.org",
  dashboard: "https://noc.example.org",
};
describe("navegação local dos módulos", () => {
  it.each([
    ["https://chat.example.org/", "/chat"],
    ["https://noc.example.org/", "/dashboard"],
    ["https://noc.example.org/antigo.html", "/dashboard"],
    [
      "https://agenda.example.org/?data=2026-10-19&chamado=501#coordenador-rota",
      "/agenda?data=2026-10-19&os=501",
    ],
    ["http://192.168.1.133/", "/dashboard"],
    ["https://192.168.1.133:8500/", "/agenda"],
    ["http://192.168.1.133:8600/chat?conversa=2", "/chat?conversa=2"],
    ["/monitoramento-total", "/dashboard"],
    ["#/teste-conectividade-sites", "/teste-conectividade-sites"],
    [
      "/chat?grupo=7&token=antigo&redirect=https://evil.example",
      "/chat?grupo=7",
    ],
    ["/wiki/curso/3/aula/introducao", "/wiki/curso/3/aula/introducao"],
  ])("converte %s em %s", (input, expected) =>
    expect(resolveModuleTarget(input, config)).toBe(expected),
  );
  it.each([
    "https://192.168.1.133:8501/",
    "/instalacao",
    "/agenda-tecnicos-instalacao",
    "https://evil.example/chat",
    "https://chat.example.org.evil.example/",
    "//chat.example.org/",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:password@chat.example.org/",
    "/api/me",
    "/uploads/chat/file.txt",
    "https://agenda.example.org/login.html",
    "/nao-migrado",
    "/chat\\evil",
    "/chat\n",
  ])("recusa %s sem transformar página desconhecida em atalho", (input) =>
    expect(resolveModuleTarget(input, config)).toBeNull(),
  );
});

describe("links externos", () => {
  it.each([
    ["https://example.org/ajuda?q=teste#topo", "https://example.org/ajuda?q=teste#topo"],
    ["http://192.168.1.20/manual", "http://192.168.1.20/manual"],
  ])("aceita links web %s", (input, expected) => {
    expect(resolveExternalUrl(input)).toBe(expected);
  });

  it.each([
    "/chat",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "mailto:suporte@example.org",
    "https://user:secret@example.org/",
    "https://example.org/\nmalicioso",
  ])("recusa destino externo inseguro %s", (input) => {
    expect(resolveExternalUrl(input)).toBeNull();
  });
});
