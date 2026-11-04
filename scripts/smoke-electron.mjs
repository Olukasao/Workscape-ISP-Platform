import { _electron as electron } from "@playwright/test";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const electronExecutable = require("electron");
function exited(process, timeout = 20000) {
  return new Promise((resolve, reject) => {
    if (process.exitCode !== null) return resolve(process.exitCode);
    const timer = setTimeout(() => reject(new Error("Processo nao encerrou no prazo de atualizacao")), timeout);
    process.once("error", (error) => { clearTimeout(timer); reject(error); });
    process.once("exit", (code) => { clearTimeout(timer); resolve(code); });
  });
}
const profile = await mkdtemp(path.join(tmpdir(), "acessa-workspace-test-"));
const fixtures = spawn(process.execPath, ["tests/fixtures/server.mjs"], {
  stdio: ["ignore", "pipe", "inherit"],
});
let desktop;
let desktopProcess;
const electronEnv = {
  ...process.env,
  WORKSPACE_TEST_USER_DATA: profile,
  WORKSPACE_DEV_URL: "",
};
delete electronEnv.ELECTRON_RUN_AS_NODE;
try {
  await new Promise((resolve, reject) => {
    fixtures.stdout.on("data", resolve);
    fixtures.on("error", reject);
    fixtures.on("exit", (code) => {
      if (code) reject(new Error("Fixture server failed"));
    });
  });
  const config = {
    chat: "http://127.0.0.1:14179",
    agenda: "http://127.0.0.1:14180",
    dashboard: "http://127.0.0.1:14182",
    allowInsecureLan: false,
    launchAtLogin: false,
    closeToTray: true,
    authorizedAgendaGateway: false,
  };
  await writeFile(path.join(profile, "config.json"), JSON.stringify(config));
  desktop = await electron.launch({
    args: [".", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env: electronEnv,
    timeout: 30000,
  });
  desktopProcess = desktop.process();
  const page = await desktop.firstWindow();
  await page.waitForURL("app://workspace/index.html");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await page.getByRole("heading", { name: "Olá, Pessoa." }).waitFor();
  const prefs = await desktop.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      sandbox: p.sandbox,
      webSecurity: p.webSecurity,
      backgroundThrottling:
        BrowserWindow.getAllWindows()[0].webContents.getBackgroundThrottling(),
    };
  });
  assert.deepEqual(prefs, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    backgroundThrottling: false,
  });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(
    await page.evaluate(() => typeof window.desktop.openExternal),
    "undefined",
  );
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("heading", { name: "Painel NOC", exact: true })
    .waitFor();
  await page
    .getByRole("region", { name: "Base de clientes" })
    .getByText("1.234", { exact: true })
    .waitFor();
  assert.equal(await page.locator("iframe, webview").count(), 0);
  await page.screenshot({ path: "docs/preview-dashboard-electron.png" });
  // Exercise the main-process boundary: a legacy window.open becomes a local
  // route, without opening another BrowserWindow or loading its frontend.
  await page.evaluate(() => window.open("https://192.168.1.133:8500/"));
  await page
    .getByRole("heading", { name: "Agenda de técnicos", exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => location.origin), "app://workspace");
  assert.equal(await page.evaluate(() => localStorage.getItem("token")), null);
  await assert.rejects(
    page.evaluate(() =>
      window.desktop.request({
        service: "chat",
        path: "//example.org/api/me",
        method: "GET",
      }),
    ),
  );
  await assert.rejects(
    page.evaluate(() =>
      window.desktop.notify({
        title: "Teste",
        body: "Teste",
        target: "https://example.org",
      }),
    ),
  );
  await assert.rejects(
    page.evaluate(() => window.desktop.openExternal("file:///etc/passwd")),
  );
  await assert.rejects(
    page.evaluate(() =>
      window.desktop.request({
        service: "agenda",
        path: "/api/agenda-tecnicos/almocos",
        method: "POST",
        body: {},
      }),
    ),
  );
  await assert.rejects(
    page.evaluate(() =>
      window.desktop.download({
        url: "https://example.org/file.txt",
        name: "arquivo",
      }),
    ),
  );
  const upload = await page.evaluate(() =>
    window.desktop.request({
      service: "chat",
      path: "/api/chat/upload",
      method: "POST",
      token: sessionStorage.getItem("token"),
      files: [
        {
          name: "arquivo",
          filename: "teste.txt",
          type: "text/plain",
          bytes: new Uint8Array([65, 66, 67]),
        },
      ],
    }),
  );
  assert.equal(upload.status, 200);
  const target = path.join(profile, "download-test.txt");
  await desktop.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);
  await page.evaluate(() =>
    window.desktop.download({
      url: "/uploads/chat/test.txt",
      name: "teste.txt",
      token: sessionStorage.getItem("token"),
    }),
  );
  assert.equal(await readFile(target, "utf8"), "arquivo de teste local");
  const asset = await page.evaluate(
    async () => await (await fetch("/uploads/chat/test.txt")).text(),
  );
  assert.equal(asset, "arquivo de teste local");
  await page.evaluate(() => window.open("https://example.org/"));
  assert.equal(
    await desktop.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
    1,
  );
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await page.getByText("Colega de Teste", { exact: true }).first().click();
  await page
    .locator(".chat-messages")
    .getByText("Mensagem do ambiente de teste", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Agenda de Técnicos", exact: true })
    .click();
  await page
    .getByText("Cliente de Teste Manutenção", { exact: true })
    .waitFor();
  await page.evaluate(() => window.desktop.unread(3));
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 650),
  );
  await page
    .getByRole("heading", { name: "Agenda de técnicos", exact: true })
    .waitFor();
  await page.evaluate(() => window.desktop.window("close"));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  await fetch("http://127.0.0.1:14179/__test/message", { method: "POST" });
  await new Promise((r) => setTimeout(r, 600));
  const state = await (
    await fetch("http://127.0.0.1:14179/__test/state")
  ).json();
  assert.equal(state.sockets, 1);
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].show(),
  );
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await page
    .locator(".chat-messages")
    .getByText("Evento recebido em segundo plano", { exact: true })
    .waitFor();
  await page.screenshot({ path: "docs/preview-electron.png" });
  assert.deepEqual(errors, []);
  const savedConfiguration = await readFile(path.join(profile, "config.json"), "utf8");
  const sentinel = path.join(profile, "update-preserve.txt");
  await writeFile(sentinel, "preserve-user-settings");
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  const primaryExit = exited(desktopProcess);
  const quitHelper = spawn(electronExecutable, [".", "--quit-for-update", ...(process.platform === "linux" ? ["--no-sandbox"] : [])], { env: electronEnv, stdio: "ignore" });
  const [primaryCode, helperCode] = await Promise.all([primaryExit, exited(quitHelper)]);
  assert.equal(primaryCode, 0);
  assert.equal(helperCode, 0);
  assert.equal(await readFile(path.join(profile, "config.json"), "utf8"), savedConfiguration);
  assert.equal(await readFile(sentinel, "utf8"), "preserve-user-settings");
  // With no running app the same argument must exit without opening a new app.
  const idleHelper = spawn(electronExecutable, [".", "--quit-for-update", ...(process.platform === "linux" ? ["--no-sandbox"] : [])], { env: electronEnv, stdio: "ignore" });
  assert.equal(await exited(idleHelper), 0);
  await writeFile(
    "docs/desktop-test.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        checks: [
          "local app protocol",
          "real IPC HTTP adapter and login",
          "contextIsolation/nodeIntegration/sandbox/webSecurity",
          "renderer has no require",
          "reject unauthorized IPC destinations",
          "reject agenda writes without gateway",
          "legacy chat rendering",
          "agenda rendering",
          "window resizing",
          "close to tray and background socket reception",
          "no plaintext localStorage token",
          "multipart upload over IPC",
          "download with origin validation and native save dialog",
          "same-origin proxy for uploaded media",
          "external popups blocked",
          "dashboard production chunk rendered from app://workspace",
          "legacy system window.open converted to local React agenda",
          "openExternal absent from preload",
          "quit-for-update closes existing tray instance cleanly",
          "quit-for-update with no running app exits without starting UI",
          "update quit preserves stored configuration and userData",
        ],
        preferences: prefs,
      },
      null,
      2,
    ),
  );
  console.log(
    "Electron smoke aprovado: Dashboard local, links legados internos, IPC, chat e agendas com serviços isolados.",
  );
} finally {
  if (desktop && desktopProcess?.exitCode === null) await desktop.close();
  fixtures.kill();
  await rm(profile, { recursive: true, force: true });
}
