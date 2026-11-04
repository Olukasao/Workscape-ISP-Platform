// Testa o preview ativo: autenticação isolada em fixtures e dashboard corporativo somente de leitura.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = "http://192.168.1.133:5180";
const component = "src/components/LiveEnvironment.tsx";
const original = await readFile(component, "utf8");
const fixtures = spawn(process.execPath, ["tests/fixtures/server.mjs"], { stdio: ["ignore", "pipe", "inherit"] });
let browser;
let changed = false;
try {
  await new Promise((resolve, reject) => {
    fixtures.stdout.once("data", resolve);
    fixtures.once("error", reject);
    fixtures.once("exit", (code) => reject(new Error(`Fixtures encerraram: ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/__workspace/dashboard/")) requests.push(request.url()); });
  page.on("websocket", (socket) => { if (socket.url().includes("/__workspace/dashboard/")) requests.push(socket.url()); });
  for (const [service, port] of [["chat", 14179], ["agenda", 14180]]) {
    await page.route(`${base}/__workspace/${service}/**`, async (route) => {
      const pathname = route.request().url().replace(`${base}/__workspace/${service}`, "");
      await route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${port}${pathname}` }) });
    });
    await page.routeWebSocket(new RegExp(`/__workspace/${service}/socket.io`), (socket) => socket.close());
  }
  await page.addInitScript(() => {
    localStorage.setItem("workspace-servers-v1", JSON.stringify({
      chat: "http://192.168.1.133:8600", agenda: "https://192.168.1.133:8500", dashboard: "http://192.168.1.133",
      allowInsecureLan: true, launchAtLogin: false, closeToTray: false, authorizedAgendaGateway: false,
    }));
  });
  await page.goto(base);
  await expect(page.getByLabel("Ambiente de teste em tempo real")).toBeVisible();
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await expect(resumo).toContainText("Servidor conectado", { timeout: 20000 });
  await expect(resumo).toContainText("ocorrências abertas", { timeout: 20000 });
  await page.getByText("Diagnóstico da conexão · conectado", { exact: true }).click();
  await expect(page.locator(".dashboard-connection")).toContainText("http://192.168.1.133:5000");
  assert(requests.length > 0, "O navegador não usou o proxy do dashboard");
  await page.evaluate(() => { window.__workspaceHmrProbe = "preservado"; });
  changed = true;
  await writeFile(component, original.replace("TESTE EM TEMPO REAL</strong>", "TESTE EM TEMPO REAL · validação HMR</strong>"));
  await expect(page.getByLabel("Ambiente de teste em tempo real")).toContainText("validação HMR", { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__workspaceHmrProbe), "preservado", "Houve recarga completa em vez de atualização HMR");
  await writeFile(component, original);
  changed = false;
  await expect(page.getByLabel("Ambiente de teste em tempo real")).not.toContainText("validação HMR");
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("workspace:noc-ultimo") || "null"));
  assert.equal(snapshot.origin, "http://192.168.1.133:5000");
  assert.deepEqual(errors, []);
  const status = await (await fetch(`${base}/__workspace/status`)).json();
  const report = { passed: true, generated: new Date().toISOString(), base, hmr: true, legacyOriginMigrated: true, dashboardProxy: true, sourceTotal: snapshot.payload.total, status, errors, authentication: "fixture local; sem conta de produção" };
  await page.screenshot({ path: "docs/live-preview.png", fullPage: true });
  await writeFile("docs/live-preview.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (changed) await writeFile(component, original);
  if (browser) await browser.close();
  fixtures.kill();
}
