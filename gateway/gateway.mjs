// Optional server-side compatibility layer. Never runs inside the desktop client.
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
const readPaths = new Set([
  "/api/technician-absences",
  "/api/technician-team-colors",
  "/api/agenda-tecnicos/almocos",
  "/api/agenda-tecnicos/tecnicos",
  "/api/agenda-tecnicos/tecnicos-sgp",
  "/api/agenda-tecnicos/horarios-semana",
  "/api/agenda-tecnicos-instalacao/almocos",
]);
const writePath =
  /^\/api\/agenda-tecnicos\/ordens-servico\/[0-9]+\/tecnico-responsavel$/;
function origin(value) {
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error("Use a server origin without credentials or path.");
  return u.origin;
}
export function createGateway({ chat, upstream, installation = false }) {
  chat = origin(chat);
  upstream = origin(upstream);
  async function identity(token) {
    if (typeof token !== "string" || !token || token.length > 16384)
      throw Object.assign(new Error("Sessão ausente."), { status: 401 });
    const headers = { Authorization: `Bearer ${token}` };
    const me = await fetch(`${chat}/api/me`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!me.ok)
      throw Object.assign(new Error("Sessão inválida ou expirada."), {
        status: me.status === 401 ? 401 : 503,
      });
    const user = await me.json();
    if (!user.id)
      throw Object.assign(new Error("Identidade inválida."), { status: 401 });
    if (user.perfil !== "admin") {
      const access = await fetch(`${chat}/api/me/quick-access`, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!access.ok)
        throw Object.assign(new Error("Permissões indisponíveis."), {
          status: 403,
        });
      const data = await access.json();
      if (
        !(data.available || []).some(
          (i) =>
            i.id === "agenda" ||
            (i.children || []).some((c) => /agenda/.test(c.id)),
        )
      )
        throw Object.assign(new Error("Acesso à agenda não autorizado."), {
          status: 403,
        });
    }
    return user;
  }
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://gateway.local");
      if (url.pathname === "/health" && req.method === "GET")
        return json(200, {
          status: "ok",
          service: installation ? "instalacao" : "agenda",
        });
      const read = req.method === "GET" && readPaths.has(url.pathname);
      const write =
        !installation && req.method === "POST" && writePath.test(url.pathname);
      if (!read && !write)
        return json(404, { erro: "Rota não publicada pelo gateway." });
      if (installation && url.pathname.startsWith("/api/agenda-tecnicos/"))
        return json(404, { erro: "Rota de outro serviço." });
      if (
        !installation &&
        url.pathname.startsWith("/api/agenda-tecnicos-instalacao/")
      )
        return json(404, { erro: "Rota de outro serviço." });
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      const user = await identity(token);
      if (write && user.perfil !== "admin")
        return json(403, {
          erro: "Transferências exigem administrador autenticado.",
        });
      const headers = {
        Authorization: `Bearer ${token}`,
        "x-user-role": user.perfil,
        "x-user-id": String(user.id),
        "Content-Type": "application/json",
      };
      let body;
      if (write) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 16384)
            return json(413, { erro: "Payload excede o limite." });
        }
        const input = JSON.parse(raw || "{}");
        if (
          typeof input.tecnicoDestino !== "string" ||
          !input.tecnicoDestino.trim() ||
          input.tecnicoDestino.length > 160
        )
          return json(400, { erro: "Técnico de destino inválido." });
        body = JSON.stringify({
          tecnicoDestino: input.tecnicoDestino,
          tecnicoAnterior: String(input.tecnicoAnterior || "").slice(0, 160),
          responsavelAnteriorSgp: String(
            input.responsavelAnteriorSgp || "",
          ).slice(0, 160),
          data: String(input.data || "").slice(0, 10),
        });
      }
      const response = await fetch(`${upstream}${url.pathname}${url.search}`, {
        method: req.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (url.pathname.endsWith("/tecnicos-sgp"))
        data.podeTrocarTecnico =
          user.perfil === "admin" && data.podeTrocarTecnico === true;
      json(response.status, data);
    } catch (error) {
      json(error.status || 502, {
        erro: error.status
          ? error.message
          : "O serviço corporativo não respondeu corretamente.",
      });
    }
  });
  const sockets = new Server(server, {
    transports: ["websocket"],
    maxHttpBufferSize: 16384,
  });
  sockets.use(async (socket, next) => {
    try {
      socket.data.user = await identity(socket.handshake.auth.token);
      next();
    } catch {
      next(new Error("Acesso à agenda não autorizado."));
    }
  });
  sockets.on("connection", (socket) => {
    const remote = connect(upstream, {
      transports: ["websocket"],
      reconnection: true,
    });
    const permitted = new Set([
      "agenda",
      "agendaAtualizada",
      "agendaSemAlteracao",
      "agendaErro",
      "almocosUpdate",
      "plantao_atualizado",
      "agendaOsTecnicoAlterado",
      "agendaTecnicosAlmocosUpdate",
      "agendaTecnicosInstalacaoAlmocosUpdate",
      "technicianAbsencesUpdate",
      "rastreame:posicoes_atualizadas",
    ]);
    remote.onAny((event, ...args) => {
      if (permitted.has(event)) socket.emit(event, ...args);
    });
    remote.on("connect_error", () =>
      socket.emit("agendaErro", { erro: "Serviço de agenda indisponível." }),
    );
    socket.on("filtrarData", async (date) => {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      try {
        await identity(socket.handshake.auth.token);
        remote.emit("filtrarData", date);
      } catch {
        socket.disconnect(true);
      }
    });
    socket.on("disconnect", () => remote.disconnect());
  });
  return {
    server,
    sockets,
    close: () =>
      new Promise((resolve) =>
        sockets.close(() => server.close(() => resolve())),
      ),
  };
}
