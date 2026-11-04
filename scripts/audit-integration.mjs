import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const manifest = JSON.parse(
  await readFile("dist/local-integration.json", "utf8"),
);
const required = [
  "src/modules/Chat.jsx",
  "src/legacy/components/Chat/MensagensDiretas.jsx",
  "src/legacy/components/Chat/MensagensGrupo.jsx",
  "src/modules/Agenda.tsx",
  "src/modules/Dashboard.tsx",
  "src/services/dashboardModel.ts",
  "src/legacy/pages/ConnectivityTestSites.jsx",
  "src/legacy/pages/PacketLossTest.jsx",
  "src/legacy/pages/DiagnosticoConexaoCliente/index.jsx",
  "src/legacy/pages/ControleOperacional.jsx",
];
const included = new Set(manifest.chunks.flatMap((chunk) => chunk.modules));
const modules = [];
for (const file of required) {
  assert(included.has(file), `Código ausente do bundle de produção: ${file}`);
  const data = await readFile(file);
  modules.push({
    file,
    sha256: createHash("sha256").update(data).digest("hex"),
    chunks: manifest.chunks
      .filter((chunk) => chunk.modules.includes(file))
      .map((chunk) => chunk.file),
  });
}
for (const file of [
  "src/modules/Dashboard.tsx",
  "src/modules/Agenda.tsx",
  "src/modules/Chat.jsx",
]) {
  const source = await readFile(file, "utf8");
  assert(
    !/<(?:iframe|webview)\b/i.test(source),
    `Incorporação de página encontrada: ${file}`,
  );
  assert(
    !/window\.open\s*\(|location\.(?:href\s*=|assign\(|replace\()/.test(source),
    `Atalho de navegação encontrado: ${file}`,
  );
}
const main = await readFile("electron/main.ts", "utf8");
const preload = await readFile("electron/preload.ts", "utf8");
const sgpFile = await readFile("electron/sgpReports.ts", "utf8");
const navigationFile = await readFile("electron/moduleNavigation.ts", "utf8");
const sgpChamadosFile = await readFile("electron/sgpChamados.ts", "utf8");
// Links de mensagens podem abrir no navegador, mas passam pelo processo principal
// e aceitam somente HTTP(S), sem credenciais ou caracteres de controle.
assert(
  (main.match(/shell\.openExternal\(/g) || []).length === 3 &&
    /z\.enum\(\["painel-contratacoes", \.\.\.sgpReportKeys\]\)/.test(main) &&
    main.includes('"https://acessanet.com.br/admin/contratacoes"') &&
    (sgpFile.match(/"sgp-[a-z0-9-]+": `\$\{base\}\?status=\d&tipo=\d+`/g) || []).length === (sgpFile.match(/"sgp-[a-z0-9-]+":/g) || []).length - 0 &&
    sgpFile.includes('const base = "https://acessanet.sgp.net.br/admin/atendimento/relatorios/ocorrencia/"') &&
    (preload.match(/"external:open"/g) || []).length === 1 &&
    main.includes("const external = resolveExternalUrl(url)") &&
    main.includes("if (external) void shell.openExternal(external)") &&
    navigationFile.includes('!["http:", "https:"].includes(url.protocol)') &&
    navigationFile.includes("url.username") &&
    navigationFile.includes("url.password") &&
    navigationFile.includes("/[\\u0000-\\u001f\\u007f]/"),
  "Abertura externa sem validação HTTP(S) no processo principal",
);
// Link de uma linha lida da tabela do SGP (Chamados > SGP): só abre se continuar no
// domínio fixo do SGP, em HTTPS, e a leitura da tabela só acontece numa janela isolada
// (mesma sessão do Navegador > SGP), nunca com o IPC/API do Workspace.
assert(
  (preload.match(/"external:open-sgp-link"/g) || []).length === 1 &&
    main.includes('url.hostname !== "acessanet.sgp.net.br"') &&
    main.includes('url.protocol !== "https:"') &&
    /z\.enum\(sgpReportKeys\)/.test(main) &&
    sgpChamadosFile.includes("contextIsolation: true") &&
    sgpChamadosFile.includes("nodeIntegration: false") &&
    sgpChamadosFile.includes("sandbox: true"),
  "Leitura da tabela do SGP sem as mesmas travas de segurança",
);
assert(
  main.includes('"app://workspace/index.html"'),
  "Interface local não configurada",
);
assert(main.includes("frame-src 'none'"), "CSP permite páginas incorporadas");
assert(main.includes("setWindowOpenHandler"), "Novas janelas não protegidas");
assert(
  main.includes("sandbox: true") &&
    main.includes("contextIsolation: true") &&
    main.includes("nodeIntegration: false"),
  "Isolamento do Electron incompleto",
);
for (const chunk of manifest.chunks) await stat(`dist/${chunk.file}`);
const report = {
  passed: true,
  generated: new Date().toISOString(),
  modules,
  checks: [
    "Componentes dos três sistemas presentes em chunks reais de produção",
    "Módulos Chat/Agenda/Dashboard sem iframe, webview ou abertura de navegador",
    "Electron inicia interface empacotada em app://workspace",
    "Links externos limitados a HTTP(S), sem credenciais, e abertos pelo processo principal",
    "Leitura da tabela do SGP (Chamados > SGP) isolada e só abre link no domínio do SGP",
    "CSP proíbe frames; navegação e janelas interceptadas",
    "Isolamento e sandbox preservados",
  ],
  limits: [
    "Auditoria estática e de build; não substitui os testes de interface nem a homologação dos serviços reais.",
  ],
};
await writeFile(
  "docs/local-integration-build.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Integração local verificada: ${modules.length} módulos presentes no bundle; nenhum atalho externo nos três módulos principais.`,
);
