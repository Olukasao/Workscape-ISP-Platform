import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createDashboardFeed } from "../electron/dashboardFeed";

let http: HttpServer | undefined;
let io: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => { io?.close(() => resolve()); if (!io) resolve(); });
  http = undefined;
  io = undefined;
});
async function servidor() {
  http = createServer();
  io = new Server(http, { cors: { origin: "*" } });
  await new Promise<void>((resolve) => http!.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, io: io! };
}
const espera = (cond: () => boolean, ms = 5000) =>
  new Promise<void>((resolve, reject) => {
    const inicio = Date.now();
    const t = setInterval(() => {
      if (cond()) { clearInterval(t); resolve(); }
      else if (Date.now() - inicio > ms) { clearInterval(t); reject(new Error("tempo esgotado")); }
    }, 20);
  });

describe("conexão do Painel NOC pelo processo principal", () => {
  it("repassa update e clientes do servidor e informa o estado da conexão", async () => {
    const { url, io } = await servidor();
    io.on("connection", (s) => {
      s.emit("update", { grupos: { OFFLINE: 3 } });
      s.emit("clientes", { total: 10, ativos: 8 });
    });
    const send = vi.fn();
    const feed = createDashboardFeed(() => url, send);
    feed.start();
    await espera(() => send.mock.calls.some(([c]) => c === "dashboard:clientes"));
    expect(send).toHaveBeenCalledWith("dashboard:update", { grupos: { OFFLINE: 3 } });
    expect(send).toHaveBeenCalledWith("dashboard:clientes", { total: 10, ativos: 8 });
    expect(send).toHaveBeenCalledWith("dashboard:status", { connected: true, status: "Conectado", detail: "" });
    expect(send).toHaveBeenCalledWith("dashboard:diagnostics", expect.objectContaining({
      origin: url, connected: true, lastUpdateAt: expect.any(String), lastCustomersAt: expect.any(String),
    }));
    feed.stop();
  });

  it("reentrega a última leitura sem depender de request_update nem abrir outro socket", async () => {
    const { url, io } = await servidor();
    const requests: string[] = [];
    let connections = 0;
    io.on("connection", (s) => {
      connections++;
      s.onAny((event) => requests.push(event));
      s.emit("update", { grupos: { OFFLINE: 3 }, atualizado: 1792590496708 });
      s.emit("clientes", { total: 10, atualizado: 1792590496708 });
    });
    const send = vi.fn();
    const feed = createDashboardFeed(() => url, send);
    try {
      feed.start();
      await espera(() => send.mock.calls.some(([c]) => c === "dashboard:clientes"));
      send.mockClear();
      feed.start();
      expect(send).toHaveBeenCalledWith("dashboard:clientes", { total: 10, atualizado: 1792590496708 });
      expect(send).toHaveBeenCalledWith("dashboard:update", { grupos: { OFFLINE: 3 }, atualizado: 1792590496708 });
      expect(connections).toBe(1);
      expect(requests).toEqual([]);
    } finally { feed.stop(); }
  });

  it("conecta por polling se o servidor não aceita WebSocket", async () => {
    const { url, io } = await servidor();
    io.engine.opts.transports = ["polling"];
    io.on("connection", (s) => s.emit("update", { grupos: { ALTA: 2 } }));
    const send = vi.fn();
    const feed = createDashboardFeed(() => url, send);
    try {
      feed.start();
      await espera(() => send.mock.calls.some(([c]) => c === "dashboard:update"));
      expect(send).toHaveBeenCalledWith("dashboard:update", { grupos: { ALTA: 2 } });
    } finally { feed.stop(); }
  });

  it("explica a falha quando o servidor não responde e não abre conexão sem origem configurada", async () => {
    const send = vi.fn();
    const semOrigem = createDashboardFeed(() => "", send);
    semOrigem.start();
    expect(send).toHaveBeenCalledWith("dashboard:status", { connected: false, status: "Não configurado", detail: "" });
    const feed = createDashboardFeed(() => "http://127.0.0.1:9", send);
    feed.start();
    await espera(() => send.mock.calls.some(([, p]) => p?.status === "Não foi possível conectar ao Dashboard"));
    const erro = send.mock.calls.map(([, p]) => p).find((p) => p?.status === "Não foi possível conectar ao Dashboard");
    expect(erro.connected).toBe(false);
    expect(erro.detail).not.toBe("");
    expect(send).toHaveBeenCalledWith("dashboard:diagnostics", expect.objectContaining({
      origin: "http://127.0.0.1:9", connected: false, lastError: expect.any(String),
    }));
    feed.stop();
  });
});
