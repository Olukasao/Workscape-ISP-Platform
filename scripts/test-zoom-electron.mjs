// Exercita o zoom nativo com perfil temporário, sem autenticar ou acessar produção.
import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const profile = await mkdtemp(path.join(tmpdir(), "workspace-zoom-"));
const env = { ...process.env, WORKSPACE_TEST_USER_DATA: profile, WORKSPACE_DEV_URL: "" };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({
    args: [".", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    env,
    timeout: 20000,
  });
  const page = await desktop.firstWindow();
  await page.waitForURL("app://workspace/index.html");
  await page.evaluate(() => { location.hash = "/settings"; });
  const slider = page.getByRole("slider", { name: "Zoom geral" });
  await expect(slider).toHaveValue("70");
  const factor = () => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("index.html")).webContents.getZoomFactor());
  await slider.fill("80");
  await expect.poll(factor).toBeCloseTo(0.8);
  await page.keyboard.press("Control+-");
  await expect(slider).toHaveValue("75");
  await expect.poll(factor).toBeCloseTo(0.75);
  await page.reload();
  await expect(slider).toHaveValue("75");
  await expect.poll(factor).toBeCloseTo(0.75);
  await page.keyboard.press("Control+0");
  await expect(slider).toHaveValue("70");
  await expect.poll(factor).toBeCloseTo(0.7);
  await page.keyboard.press("Control+=");
  await expect(slider).toHaveValue("75");
  await expect.poll(factor).toBeCloseTo(0.75);
  for (const invalid of [0, -1, 201, "80", null]) {
    await assert.rejects(page.evaluate((value) => window.desktop.setZoom(value), invalid));
  }
  await slider.fill("50");
  await expect.poll(factor).toBeCloseTo(0.5);
  await page.keyboard.press("Control+-");
  await expect(slider).toHaveValue("50");
  await slider.fill("200");
  await expect.poll(factor).toBeCloseTo(2);
  await page.keyboard.press("Control+=");
  await expect(slider).toHaveValue("200");
  await page.keyboard.press("Control+0");
  await expect.poll(factor).toBeCloseTo(1);
  // Entrada enviada pelo Electron também passa pela interceptação do menu.
  await desktop.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    contents.sendInputEvent({ type: "keyDown", keyCode: "-", modifiers: ["control"] });
    contents.sendInputEvent({ type: "keyUp", keyCode: "-", modifiers: ["control"] });
  });
  await expect(slider).toHaveValue("95");
  await expect.poll(factor).toBeCloseTo(0.95);
  await writeFile("docs/zoom-desktop-test.json", JSON.stringify({ passed: true, platform: process.platform, checks: ["zoom nativo Chromium", "controle de escala", "atalhos nativos sem conflito com menu", "persistência após recarga", "restaurar padrão 70%", "limites 50–200%", "validação IPC"] }, null, 2) + "\n");
  console.log("Zoom Electron aprovado: escala nativa, atalhos, persistência e limites.");
} finally {
  if (desktop) await desktop.close();
  await rm(profile, { recursive: true, force: true });
}
