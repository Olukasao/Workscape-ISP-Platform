import { defineConfig, mergeConfig, type ProxyOptions } from "vite";
import { Agent } from "node:https";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { io } from "socket.io-client";
import base from "./vite.config.ts";
import { chatOrigin, agendaOrigin, dashboardOrigin, agendaCertificateSha256 } from "./electron/agendaDeployment.ts";

const cert = readFileSync(new URL("./deploy/dev/agenda-public.crt", import.meta.url));
if (new X509Certificate(cert).fingerprint256.replaceAll(":", "") !== agendaCertificateSha256)
  throw new Error("O certificado público do proxy de agenda não corresponde ao servidor autorizado.");
const agent = new Agent({
  ca: cert,
  checkServerIdentity(_hostname, peer) {
    return peer.fingerprint256?.replaceAll(":", "") === agendaCertificateSha256
      ? undefined : new Error("Certificado da agenda não autorizado.");
  },
});
function proxy(service: string, target: string): ProxyOptions {
  return {
    target, changeOrigin: true, ws: true,
    ...(service === "agenda" ? { agent } : {}),
    rewrite: (url) => url.replace(`/__workspace/${service}`, ""),
  };
}

export default mergeConfig(base, defineConfig({
  server: {
    host: "0.0.0.0", port: 5180, strictPort: true,
    allowedHosts: ["192.168.1.133", "localhost", "127.0.0.1"],
    proxy: {
      "/__workspace/chat": proxy("chat", chatOrigin),
      "/__workspace/dashboard": proxy("dashboard", dashboardOrigin),
      "/__workspace/agenda": proxy("agenda", agendaOrigin),
      "/uploads": { target: chatOrigin, changeOrigin: true },
      "/sounds": { target: chatOrigin, changeOrigin: true },
    },
  },
  plugins: [{
    name: "workspace-live-status",
    configureServer(server) {
      const dashboard = io(dashboardOrigin, { transports: ["polling", "websocket"], tryAllTransports: true });
      const state = {
        environment: "live", dashboardOrigin, connected: false, transport: "",
        lastUpdate: null as string | null, lastCustomers: null as string | null,
        occurrences: null as number | null, customers: null as number | null,
        error: null as string | null,
      };
      dashboard.on("connect", () => { state.connected = true; state.error = null; state.transport = dashboard.io.engine.transport.name; });
      dashboard.on("disconnect", (reason) => { state.connected = false; state.error = reason; });
      dashboard.on("connect_error", (error) => { state.connected = false; state.error = error.message; });
      dashboard.on("update", (p) => { state.lastUpdate = new Date().toISOString(); state.occurrences = typeof p?.total === "number" ? p.total : null; });
      dashboard.on("clientes", (p) => { state.lastCustomers = new Date().toISOString(); state.customers = typeof p?.total === "number" ? p.total : null; });
      server.httpServer?.once("close", () => { dashboard.removeAllListeners(); dashboard.disconnect(); agent.destroy(); });
      server.middlewares.use("/__workspace/status", (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ ...state, generated: new Date().toISOString() }, null, 2));
      });
    },
  }],
}));
