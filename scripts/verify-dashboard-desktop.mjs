// Perfil e autenticação de teste isolados. --live lê somente o socket corporativo;
// sem a opção, todos os dados vêm das fixtures locais.
import { _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const live = process.argv.includes("--live");
const { version } = JSON.parse(await (await import("node:fs/promises")).readFile("package.json", "utf8"));
if (process.platform === "linux" && !process.env.DISPLAY)
  throw new Error("O teste Electron precisa de DISPLAY. Execute em uma sessão gráfica ou com xvfb-run.");
const profile = await mkdtemp(path.join(tmpdir(), "workspace-dashboard-"));
const dashboard = live ? "http://192.168.1.133:5000" : "http://127.0.0.1:14182";
const env = { ...process.env, WORKSPACE_TEST_USER_DATA: profile, WORKSPACE_DEV_URL: "" };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
const fixtures = spawn(process.execPath, ["tests/fixtures/server.mjs"], {
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, ...(live ? { WORKSPACE_TEST_DASHBOARD_SOURCE: dashboard } : {}) },
});
try {
  await new Promise((resolve, reject) => {
    fixtures.stdout.once("data", resolve);
    fixtures.once("error", reject);
    fixtures.once("exit", (code) => reject(new Error(`Fixtures encerraram: ${code}`)));
  });
  await writeFile(path.join(profile, "config.json"), JSON.stringify({
    chat: "http://127.0.0.1:14179", agenda: "http://127.0.0.1:14180", dashboard,
    allowInsecureLan: false, launchAtLogin: false, closeToTray: false, authorizedAgendaGateway: false,
  }));
  desktop = await electron.launch({
    args: [".", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env, timeout: 30000,
  });
  const page = await desktop.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForURL("app://workspace/index.html");
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await expect(resumo).toContainText("Servidor conectado", { timeout: 20000 });
  await expect(resumo).toContainText("ocorrências abertas", { timeout: 20000 });
  if (live) {
    await page.getByText("Diagnóstico da conexão · conectado", { exact: true }).click();
    await expect(page.locator(".dashboard-connection")).toContainText("HTTP autenticado · Chromium");
    await page.getByText("Diagnóstico da conexão · conectado", { exact: true }).click();
  }
  console.log(live ? "Electron real: indicadores recebidos por HTTP autenticado via Chromium." : "Electron real: Socket.IO de teste conectado e indicadores renderizados.");
  await expect.poll(() => page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("workspace:noc-clientes") || "null");
    return c?.data?.total;
  }), { timeout: live ? 225000 : 10000, intervals: [1000] }).toEqual(expect.any(Number));
  const readings = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("workspace:noc-clientes"));
    const u = JSON.parse(localStorage.getItem("workspace:noc-ultimo"));
    return { origin: c.origin, userId: c.userId, customers: c.data.total, total: u.payload.total, updated: u.payload.atualizado, runningUpdated: u.payload.emAndamento?.atualizado };
  });
  assert.equal(readings.origin, dashboard);
  assert.equal(readings.userId, 1);
  await resumo.getByRole("button", { name: "Abrir chamados em andamento" }).click();
  await expect(page.getByRole("dialog")).toContainText("Atualização SGP:");
  await expect(page.getByRole("dialog")).not.toContainText("Atualização SGP: —");
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByRole("button", { name: "Visão completa", exact: true }).click();
  await expect(page.getByRole("region", { name: "Base de clientes" })).toContainText(readings.customers.toLocaleString("pt-BR"));
  assert.equal(await page.locator("iframe, webview").count(), 0);
  assert.deepEqual(errors, []);
  await mkdir("docs", { recursive: true });
  await page.screenshot({ path: `docs/dashboard-desktop-${version}.png`, fullPage: true });
  await writeFile(`docs/dashboard-desktop-${version}.json`, JSON.stringify({ passed: true, live, transport: live ? "HTTP autenticado via Chromium; upstream Socket.IO no servidor de teste" : "Socket.IO direto (servidor personalizado de teste)", platform: process.platform, generated: new Date().toISOString(), ...readings, errors, authentication: "fixture local; nenhuma sessão de produção" }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, live, ...readings }));
} finally {
  if (desktop) await desktop.close();
  fixtures.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
