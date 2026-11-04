// Explicit read-only validation of the corporate agenda; login uses only a
// local test identity. No write, SGP mutation or production login is performed.
import { _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const profile = await mkdtemp(path.join(tmpdir(), "acessa-live-agenda-"));
const fixtures = spawn(process.execPath, ["tests/fixtures/server.mjs"], {
  stdio: ["ignore", "pipe", "inherit"],
});
let desktop;
try {
  await new Promise((resolve, reject) => {
    fixtures.stdout.once("data", resolve);
    fixtures.once("error", reject);
    fixtures.once("exit", (code) => {
      if (code) reject(new Error("Fixtures não iniciaram"));
    });
  });
  const config = {
    chat: "http://127.0.0.1:14179",
    agenda: "",
    dashboard: "http://127.0.0.1:14182",
    allowInsecureLan: false,
    launchAtLogin: false,
    closeToTray: false,
    authorizedAgendaGateway: false,
    instalacao: "https://192.168.1.133:8501",
  };
  await writeFile(path.join(profile, "config.json"), JSON.stringify(config));
  const env = {
    ...process.env,
    WORKSPACE_TEST_USER_DATA: profile,
    WORKSPACE_DEV_URL: "",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await electron.launch({
    args: [".", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env,
  });
  const page = await desktop.firstWindow();
  const sockets = [];
  page.on("websocket", (s) => sockets.push(s.url()));
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await page.getByRole("heading", { name: "Olá, Pessoa." }).waitFor();
  const active = await page.evaluate(() => window.desktop.getConfig());
  assert.equal(active.agenda, "https://192.168.1.133:8500");
  assert.equal("instalacao" in active, false);
  const metadata = await page.evaluate(() =>
    window.desktop.request({
      service: "agenda",
      path: "/api/agenda-tecnicos/tecnicos",
      method: "GET",
    }),
  );
  assert.equal(
    metadata.status,
    200,
    "HTTP da agenda real não respondeu com sucesso",
  );
  await page
    .getByRole("button", { name: "Agenda de Técnicos", exact: true })
    .click();
  await page.locator(".schedule-day").first().waitFor({ timeout: 60000 });
  await expect(page.locator(".agenda-page")).not.toContainText(
    "Não foi possível conectar à agenda",
  );
  const orders = await page.locator(".work-order").count();
  assert(sockets.some((s) => s.startsWith("wss://192.168.1.133:8500/")));
  assert(!sockets.some((s) => s.includes(":8501")));
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("region", { name: "Resumo da manutenção" }).waitFor();
  await expect(
    page.getByRole("region", { name: "Resumo das instalações" }),
  ).toHaveCount(0);
  const report = {
    passed: true,
    version: "0.2.1",
    origin: active.agenda,
    observed: new Date().toISOString(),
    realAgendaHttpStatus: metadata.status,
    technicianRecords: Array.isArray(metadata.data?.tecnicos)
      ? metadata.data.tecnicos.length
      : null,
    workOrdersRendered: orders,
    realSecureWebSocket: true,
    installationRemoved: true,
    productionWrites: false,
    login: "isolated local fixture; production agenda read-only",
    personalDetailsStored: false,
  };
  await writeFile(
    "docs/agenda-live-0.2.1.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  if (desktop) await desktop.close();
  fixtures.kill();
  await rm(profile, { recursive: true, force: true });
}
