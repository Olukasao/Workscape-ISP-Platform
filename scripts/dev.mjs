import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { context } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const devNonce = randomBytes(16).toString("base64url");
const env = { ...process.env, WORKSPACE_CSP_NONCE: devNonce };
const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5178", "--strictPort"], { cwd: root, stdio: "inherit", env });
let desktop;
let ready = false;
let stopping = false;
let restarting = false;
let pending = false;
const { default: electron } = await import("electron");
const electronEnv = {
  ...env, WORKSPACE_DEV_URL: "http://127.0.0.1:5178",
  WORKSPACE_TEST_USER_DATA: process.env.WORKSPACE_TEST_USER_DATA || path.join(root, ".workspace-dev/profile"),
};
delete electronEnv.ELECTRON_RUN_AS_NODE;

async function restart() {
  if (!ready || stopping) return;
  pending = true;
  if (restarting) return;
  restarting = true;
  try {
    while (pending && !stopping) {
      pending = false;
      if (desktop && desktop.exitCode === null && desktop.signalCode === null) {
        const old = desktop;
        const exited = once(old, "exit");
        old.kill();
        const killTimer = setTimeout(() => old.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(killTimer);
      }
      if (stopping) break;
      console.log("[desktop] Código Electron atualizado; iniciando com perfil de desenvolvimento isolado.");
      desktop = spawn(electron, [".", ...process.argv.slice(2)], { cwd: root, stdio: "inherit", env: electronEnv });
      const current = desktop;
      current.on("error", (error) => { console.error(error.message); void stop(1); });
      current.on("exit", (code) => {
        if (!restarting && desktop === current && !stopping) void stop(code || 0);
      });
    }
  } finally { restarting = false; }
}

const ctx = await context({
  absWorkingDir: root, entryPoints: ["electron/main.ts", "electron/preload.ts"],
  outdir: "dist-electron", outExtension: { ".js": ".cjs" }, bundle: true,
  platform: "node", format: "cjs", target: "node22", external: ["electron"],
  plugins: [{ name: "restart-electron", setup(build) {
    build.onEnd((result) => { if (!result.errors.length) void restart(); });
  } }],
});
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  desktop?.kill();
  vite.kill();
  await ctx.dispose();
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
vite.on("error", (error) => { console.error(error.message); void stop(1); });
vite.on("exit", (code) => { if (!stopping) void stop(code || 1); });
await ctx.watch();
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    const response = await fetch("http://127.0.0.1:5178");
    if (response.ok) { ready = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 150));
}
if (!ready) { console.error("Vite indisponível"); await stop(1); }
await ctx.rebuild();
