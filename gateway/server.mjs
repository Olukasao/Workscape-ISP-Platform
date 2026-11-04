import { createGateway } from "./gateway.mjs";
const chat = process.env.CHAT_ORIGIN;
const maintenance = process.env.AGENDA_ORIGIN;
const installation = process.env.INSTALLATION_ORIGIN;
if (!chat || !maintenance || !installation)
  throw new Error(
    "Configure CHAT_ORIGIN, AGENDA_ORIGIN e INSTALLATION_ORIGIN. Nenhuma credencial de banco ou segredo JWT é necessário.",
  );
const host = process.env.GATEWAY_HOST || "127.0.0.1";
const instances = [
  {
    upstream: maintenance,
    port: Number(process.env.AGENDA_GATEWAY_PORT || 9410),
    installation: false,
  },
  {
    upstream: installation,
    port: Number(process.env.INSTALLATION_GATEWAY_PORT || 9411),
    installation: true,
  },
].map((c) => {
  const g = createGateway({
    chat,
    upstream: c.upstream,
    installation: c.installation,
  });
  g.server.listen(c.port, host, () =>
    console.log(
      `Gateway ${c.installation ? "instalação" : "manutenção"} pronto em ${host}:${c.port}`,
    ),
  );
  return g;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await Promise.all(instances.map((g) => g.close()));
    process.exit(0);
  });
