import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import { createGateway } from "../gateway/gateway.mjs";
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    ),
  );
let chat, upstream, upstreamSocket, gateway, url, lastWrite;
beforeAll(async () => {
  chat = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const token = req.headers.authorization;
    if (!["Bearer admin-test", "Bearer viewer-test"].includes(token)) {
      res.statusCode = 401;
      res.end("{}");
      return;
    }
    res.end(
      JSON.stringify(
        req.url === "/api/me"
          ? {
              id: 1,
              perfil: token === "Bearer admin-test" ? "admin" : "usuario",
            }
          : { available: [{ id: "agenda" }] },
      ),
    );
  });
  const chatUrl = await listen(chat);
  upstream = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") {
      let raw = "";
      for await (const c of req) raw += c;
      lastWrite = { headers: req.headers, body: JSON.parse(raw) };
      res.end('{"sucesso":true}');
    } else
      res.end(
        req.url.endsWith("tecnicos-sgp")
          ? '{"podeTrocarTecnico":true}'
          : '{"tecnicos":["Origem","Destino"]}',
      );
  });
  upstreamSocket = new Server(upstream);
  upstreamSocket.on("connection", (socket) =>
    socket.on("filtrarData", (date) =>
      socket.emit("agenda", [
        { id: 1, tecnico: "Origem", cliente: "Fixture gateway", date },
      ]),
    ),
  );
  const upstreamUrl = await listen(upstream);
  gateway = createGateway({ chat: chatUrl, upstream: upstreamUrl });
  url = await listen(gateway.server);
});
afterAll(async () => {
  await gateway.close();
  await new Promise((r) => upstreamSocket.close(r));
  await new Promise((r) => chat.close(r));
});
describe("gateway compatível com a agenda legada", () => {
  it("recusa sessão ausente e não publica endpoints desconhecidos", async () => {
    expect((await fetch(`${url}/api/agenda-tecnicos/tecnicos`)).status).toBe(
      401,
    );
    expect(
      (await fetch(`${url}/api/agenda-tecnicos/coordenador-rota/debug`)).status,
    ).toBe(404);
  });
  it("não aceita perfil forjado pelo cliente", async () => {
    const r = await fetch(
      `${url}/api/agenda-tecnicos/ordens-servico/1/tecnico-responsavel`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer viewer-test",
          "x-user-role": "admin",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tecnicoDestino: "Destino" }),
      },
    );
    expect(r.status).toBe(403);
  });
  it("encaminha transferência apenas com identidade administrativa verificada", async () => {
    const r = await fetch(
      `${url}/api/agenda-tecnicos/ordens-servico/1/tecnico-responsavel`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-test",
          "x-user-role": "forjado",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tecnicoDestino: "Destino",
          tecnicoAnterior: "Origem",
          data: "2026-10-14",
        }),
      },
    );
    expect(r.status).toBe(200);
    expect(lastWrite.headers["x-user-role"]).toBe("admin");
    expect(lastWrite.body.tecnicoDestino).toBe("Destino");
  });
  it("oculta a capacidade de escrita para perfis de leitura", async () => {
    const r = await fetch(`${url}/api/agenda-tecnicos/tecnicos-sgp`, {
      headers: { Authorization: "Bearer viewer-test" },
    });
    expect((await r.json()).podeTrocarTecnico).toBe(false);
  });
  it("autentica Socket.IO e mantém o contrato filtrarData/agenda", async () => {
    const bad = io(url, {
      transports: ["websocket"],
      auth: { token: "invalid" },
      reconnection: false,
    });
    await new Promise((resolve) => bad.on("connect_error", resolve));
    bad.disconnect();
    const client = io(url, {
      transports: ["websocket"],
      auth: { token: "viewer-test" },
      reconnection: false,
    });
    const agenda = await new Promise((resolve, reject) => {
      client.on("connect", () => client.emit("filtrarData", "2026-10-14"));
      client.on("agenda", resolve);
      client.on("connect_error", reject);
    });
    expect(agenda[0].cliente).toBe("Fixture gateway");
    client.disconnect();
  });
});
