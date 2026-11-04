import { test, expect, type Page } from "@playwright/test";

test("desktop corporativo recebe dados por HTTP autenticado mesmo com Socket.IO direto indisponível", async ({ page, request }) => {
  const directSockets: string[] = [];
  page.on("websocket", (s) => { if (s.url().includes(":5000")) directSockets.push(s.url()); });
  await page.addInitScript((config) => {
    (window as any).__directStarts = 0;
    window.desktop = {
      getConfig: async () => ({ ...config, dashboard: "http://192.168.1.133:5000" }),
      getSession: async () => null,
      saveSession: async (session: { token: string }) => { (window as any).__savedSession = session; },
      clearSession: async () => {},
      notify: async () => {}, unread: async () => {}, setZoom: async () => {},
      onZoomStep: () => () => {}, onNavigate: () => () => {},
      updateStatus: async () => ({ phase: "idle", currentVersion: "0.5.13", message: "ok" }),
      onUpdateStatus: () => () => {},
      request: async (r: any) => {
        const response = await fetch((config as any)[r.service] + r.path, {
          method: r.method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + r.token },
          body: r.body ? JSON.stringify(r.body) : undefined,
        });
        return { status: response.status, data: await response.json() };
      },
      dashboardStart: async () => { (window as any).__directStarts++; throw new Error("socket hang up ECONNRESET"); },
      dashboardStop: async () => {}, dashboardRefresh: async () => { throw new Error("ECONNRESET"); },
      onDashboardEvent: () => () => {},
    } as any;
  }, { chat: "http://127.0.0.1:14179", agenda: "http://127.0.0.1:14180", allowInsecureLan: false, launchAtLogin: false, closeToTray: false, authorizedAgendaGateway: false });
  await login(page, { resumido: true });
  await expect.poll(() => page.evaluate(() => (window as any).__savedSession?.token)).toBeTruthy();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await expect(resumo).toContainText("Servidor conectado");
  await expect(resumo).toContainText("1.234");
  expect(await page.evaluate(() => (window as any).__directStarts)).toBe(0);
  expect(directSockets).toEqual([]);
  await page.getByText("Diagnóstico da conexão · conectado", { exact: true }).click();
  await expect(page.locator(".dashboard-connection")).toContainText("HTTP autenticado · Chromium");
  await request.post("http://127.0.0.1:14179/__test/dashboard", { data: { total: 11, grupos: { OFFLINE: 11 }, atualizado: Date.now() } });
  await page.getByRole("button", { name: "Reconectar dashboard", exact: true }).click();
  await expect(resumo).toContainText("11 ocorrências abertas");
});
const servers = {
  chat: "http://127.0.0.1:14179",
  agenda: "http://127.0.0.1:14180",
  dashboard: "http://127.0.0.1:14182",
  allowInsecureLan: false,
  launchAtLogin: false,
  closeToTray: true,
  authorizedAgendaGateway: false,
};
async function login(page: Page, opts: { resumido?: boolean } = {}) {
  await page.addInitScript(
    (config) =>
      localStorage.setItem("workspace-servers-v1", JSON.stringify(config)),
    servers,
  );
  // O Painel NOC abre na visão resumida; os testes do layout completo escolhem a completa.
  if (!opts.resumido)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("__dash-init")) {
        localStorage.setItem("workspace:dashboard:compact", "0");
        sessionStorage.setItem("__dash-init", "1");
      }
    });
  await page.goto("/");
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
}
test("Dashboard React usa o contrato completo com frontends antigos desligados e uma conexão compartilhada", async ({
  page,
  request,
}) => {
  const documents: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(r.url());
  });
  for (const origin of [servers.chat, servers.dashboard, servers.agenda]) {
    expect((await request.get(origin)).status()).toBe(503);
  }
  await login(page);
  const before = await (
    await request.get(`${servers.chat}/__test/state`)
  ).json();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Painel NOC", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Base de clientes" }),
  ).toContainText("1.234");
  await expect(
    page.getByRole("region", { name: "Suporte", exact: true }),
  ).toContainText("4");
  await expect(
    page.getByRole("region", { name: "Comercial", exact: true }),
  ).toContainText("8");
  await expect(
    page.getByRole("region", { name: "Resumo da manutenção" }),
  ).toContainText("Cliente de Teste Manutenção");
  await expect(page.locator("iframe, webview")).toHaveCount(0);
  await page.getByLabel("Filtrar indicadores").fill("Retenção");
  await page
    .getByRole("button", { name: "Visão resumida", exact: true })
    .click();
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Visão completa", exact: true }).click();
  await expect(page.getByLabel("Filtrar indicadores")).toHaveValue("Retenção");
  const after = await (
    await request.get(`${servers.chat}/__test/state`)
  ).json();
  expect(after.dashboardConnections).toBe(before.dashboardConnections);
  await page.getByLabel("Filtrar indicadores").clear();
  await request.post(`${servers.chat}/__test/dashboard`, {
    data: { grupos: { OFFLINE: 61 }, emAndamento: { total: 0, chamados: [] } },
  });
  await expect(
    page.getByRole("heading", { name: "Massivo detectado" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/preview-dashboard-local.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 820, height: 650 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", Math.floor(820 / 0.7));
  expect(
    documents.every((url) => new URL(url).origin === "http://127.0.0.1:15178"),
  ).toBe(true);
  expect(page.context().pages()).toHaveLength(1);
  expect(errors).toEqual([]);
});
test("chamado do Dashboard abre os detalhes da Agenda local sem iframe nem navegador", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Em Andamento", exact: false })
    .click();
  const dialog = page.getByRole("dialog", { name: "Chamados em andamento" });
  await expect(dialog).toContainText("Cliente em execução de Teste");
  await dialog.getByRole("link", { name: "Abrir na Agenda" }).click();
  await expect(page).toHaveURL(/#\/agenda\?.*os=501/);
  await expect(
    page.getByRole("dialog", { name: "Detalhes do chamado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Detalhes do chamado" }),
  ).toContainText("Cliente de Teste Manutenção");
  await expect(page.locator("iframe, webview")).toHaveCount(0);
});
test("links antigos dos três sistemas são convertidos em navegação React interna", async ({
  page,
}) => {
  await login(page);
  for (const [url, heading] of [
    ["http://192.168.1.133/", "Painel NOC"],
    ["https://192.168.1.133:8500/", "Agenda de técnicos"],
  ]) {
    await page.evaluate((href) => {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.textContent = "Link legado de teste";
      a.id = "legacy-test-link";
      document.body.append(a);
    }, url);
    await page.locator("#legacy-test-link").click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await page.locator("#legacy-test-link").evaluate((e) => e.remove());
  }
  expect(page.context().pages()).toHaveLength(1);
  await expect(page.locator("iframe, webview")).toHaveCount(0);
});
test("conectividade, perda de pacotes e diagnóstico renderizam componentes e consultam APIs locais", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Ferramentas do Dashboard" })
    .getByRole("link", { name: "Conectividade", exact: true })
    .click();
  await expect(
    page.getByRole("table").getByText("Site QA", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/teste-perda-pacote");
  await expect(
    page.getByRole("table").getByText("Destino QA", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/diagnostico-conexao-cliente");
  await expect(
    page.getByRole("heading", { name: "Cliente", exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Nome, CPF/CNPJ, contrato, PPPoE, IP, MAC ou telefone")
    .fill("Cliente QA");
  await expect(
    page.getByText("Cliente QA Diagnóstico", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("iframe, webview")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("agenda de instalação removida da Home, Dashboard, configurações, rotas e conexões", async ({
  page,
  request,
}) => {
  const connections: string[] = [];
  page.on("websocket", (socket) => connections.push(socket.url()));
  await login(page);
  await expect(
    page.getByRole("button", { name: "Agenda de Instalações", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Instalações hoje", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Resumo da manutenção" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resumo das instalações" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(page.getByRole("textbox")).toHaveCount(3);
  await page.goto("/#/instalacao");
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
  const state = await (
    await request.get(`${servers.chat}/__test/state`)
  ).json();
  expect(state.installationConnections).toBe(0);
  expect(state.installationRequests).toBe(0);
  expect(
    connections.some((url) => url.includes(":14181") || url.includes(":8501")),
  ).toBe(false);
});

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:14179/__test/reset");
});
test("login, indicadores reais do contrato, agendas, filtros, semana e redimensionamento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  // A Home é a do Chat Interno: saudação e carrossel, sem acessos rápidos.
  await expect(
    page.getByRole("button", { name: /Avisos internos/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Acessos rápidos" }),
  ).toHaveCount(0);
  // O resumo operacional (antiga Home) fica na aba Resumo.
  await page.getByRole("button", { name: "Resumo", exact: true }).click();
  await expect(page.getByText("Cliente de Teste Manutenção")).toBeVisible();
  await page
    .getByRole("button", { name: "Agenda de Técnicos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agenda de técnicos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cliente de Teste Manutenção", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Almoço · 12:00–13:00")).toBeVisible();
  await page.getByLabel("Pesquisar chamados").fill("não-existe");
  await expect(
    page.getByText("Cliente de Teste Manutenção", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Pesquisar chamados").clear();
  await page.getByRole("button", { name: "7 dias", exact: true }).click();
  await expect(page.locator(".schedule-day")).toHaveCount(7);
  await page.setViewportSize({ width: 820, height: 650 });
  await expect(
    page.getByRole("heading", { name: "Agenda de técnicos", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", Math.floor(820 / 0.7));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Início", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/preview-home.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("chat original, leitura somente na conversa, estado preservado e evento deduplicado em segundo plano", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await page.getByText("Colega de Teste", { exact: true }).first().click();
  await expect(
    page.getByText("Mensagem do ambiente de teste", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agenda de Técnicos", exact: true })
    .click();
  await expect(
    page.getByText("Cliente de Teste Manutenção", { exact: true }),
  ).toBeVisible();
  const before = await (
    await request.get("http://127.0.0.1:14179/__test/state")
  ).json();
  await request.post("http://127.0.0.1:14179/__test/message");
  await expect
    .poll(async () => await page.locator(".nav-badge").allTextContents())
    .toContain("1");
  const after = await (
    await request.get("http://127.0.0.1:14179/__test/state")
  ).json();
  expect(after.readEvents).toBe(before.readEvents);
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await expect(page.locator(".notification-row")).toHaveCount(1);
  await expect(
    page.getByText("Evento recebido em segundo plano", { exact: true }).last(),
  ).toBeVisible();
  await page.locator(".notification-row").click();
  await expect(
    page
      .locator(".chat-messages")
      .getByText("Evento recebido em segundo plano", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/preview-chat.png", fullPage: true });
});
test("reconecta o socket e restaura identidade e grupos", async ({
  page,
  request,
}) => {
  await login(page);
  await expect(page.locator(".sidebar-status")).toContainText("Conectado");
  await request.post("http://127.0.0.1:14179/__test/disconnect");
  await expect(page.locator(".sidebar-status")).toContainText("Conectado", {
    timeout: 15000,
  });
  await expect
    .poll(async () => {
      const state = await (
        await request.get("http://127.0.0.1:14179/__test/state")
      ).json();
      return state.events.filter(
        (e: { event: string }) => e.event === "join_user_groups",
      ).length;
    })
    .toBeGreaterThanOrEqual(2);
});
test("sem internet, tema persistente e saída limpa", async ({
  page,
  context,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "claro");
  await context.setOffline(true);
  await expect(
    page.getByText("Sem conexão com a rede. Reconectaremos automaticamente."),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText("Sem conexão com a rede. Reconectaremos automaticamente."),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByRole("button", { name: "Sair do Workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar no Workspace" }),
  ).toBeVisible();
  // Cumprimenta pelo nome e já traz o e-mail do último acesso; sair por vontade própria não mostra "sessão expirou".
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Pessoa\.$/);
  await expect(page.getByLabel("E-mail corporativo")).toHaveValue("teste@example.test");
  await expect(page.getByText("Sua sessão expirou")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("token"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
test("401 encerra sessão e permissões escondem ferramentas", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Ferramentas", exact: true }).click();
  await expect(page.getByRole("link", { name: /Notas rápidas/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Materiais de vendas/ }),
  ).toHaveCount(0);
  await request.post("http://127.0.0.1:14179/__test/expire");
  await request.post("http://127.0.0.1:14179/__test/message");
  await expect(
    page.getByRole("button", { name: "Entrar no Workspace" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Sua sessão expirou. Entre de novo para continuar.")).toBeVisible();
});
test("valida configuração de URL e recusa credenciais na origem", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page
    .getByText("Chat Interno", { exact: true })
    .locator("..")
    .getByRole("textbox")
    .fill("https://user:secret@example.org");
  await page.getByRole("button", { name: "Salvar e reconectar" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "sem caminho ou credenciais",
  );
});

test("envio de mensagem, rascunho preservado e histórico de grupo original", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await page.getByText("Colega de Teste", { exact: true }).first().click();
  const editor = page.getByRole("textbox", {
    name: "Mensagem...",
    exact: true,
  });
  await editor.fill("Rascunho preservado");
  await page
    .getByRole("button", { name: "Agenda de Técnicos", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Agenda de técnicos", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Chat Interno", exact: true }).click();
  await expect(editor).toHaveText("Rascunho preservado");
  await editor.press("Enter");
  await expect(editor).toHaveText("");
  await expect(
    page
      .locator(".chat-messages")
      .getByText("Rascunho preservado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Grupos", exact: true }).click();
  await page.getByText("Grupo de Teste", { exact: true }).first().click();
  await expect(
    page
      .locator(".chat-messages")
      .getByText("Histórico do grupo de teste", { exact: true }),
  ).toBeVisible();
});

test("preserva sessão ao abrir sem acesso ao servidor e recupera ao tentar novamente", async ({
  page,
}) => {
  await page.addInitScript((config) => {
    localStorage.setItem("workspace-servers-v1", JSON.stringify(config));
    sessionStorage.setItem("token", "test-session-local-only");
  }, servers);
  await page.route("**/api/me", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível validar sua sessão. Ela foi preservada para reconectar.",
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("token"))).toBe(
    "test-session-local-only",
  );
  await page.unroute("**/api/me");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
});

test("contratações do site chegam pelo socket do chat e aparecem no workspace", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Contratações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Contratações do site", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cliente Contratação QA", { exact: true })).toBeVisible();
  await expect(page.getByText("QA-2026-0011", { exact: true })).toBeVisible();
  await page.getByLabel("Buscar contratação").fill("Caieiras");
  await expect(page.getByText("Cliente Contratação QA", { exact: true })).toHaveCount(0);
});


test("agenda separa manutenção e instalação em abas com equipes e horários próprios", async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await login(page);
  await page.getByRole("button", { name: "Agenda de Técnicos", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Agenda Manutenção", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Cliente de Teste Manutenção", { exact: true })).toBeVisible();
  await expect.poll(
    () => requests.filter((url) => url.includes(":14180/api/agenda-instalacao/agenda")).length,
  ).toBeGreaterThan(0);
  await page.getByLabel("Filtrar técnico").selectOption("Técnico de Teste");
  await page.getByRole("tab", { name: "Agenda Instalação", exact: true }).click();
  await expect(page.getByLabel("Filtrar técnico")).toHaveValue("");
  await expect(page.getByText("Cliente Instalação Separada", { exact: true })).toBeVisible();
  await expect(page.getByText("Cliente de Teste Manutenção", { exact: true })).not.toBeVisible();
  await expect(page.locator(".tg-head")).toHaveCount(1);
  await expect(page.locator(".tg-head")).toContainText("Técnico Instalação");
  await expect(page.locator(".tg-head")).toContainText("Férias");
  await expect(page.getByText("Almoço · 13:00–14:00")).toBeVisible();
  await expect(page.getByText("Almoço · 12:00–13:00")).not.toBeVisible();
  await page.getByText("Cliente Instalação Separada", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes do chamado" })).toContainText("601");
  await page.keyboard.press("Escape");
  await page.getByLabel("Pesquisar chamados").fill("inexistente");
  await expect(page.getByText("Cliente Instalação Separada", { exact: true })).not.toBeVisible();
  await page.getByLabel("Pesquisar chamados").clear();
  await page.getByRole("button", { name: "7 dias", exact: true }).click();
  await expect(page.locator(".schedule-day")).toHaveCount(7);
  await expect(page.getByText("Cliente Instalação Separada", { exact: true })).toHaveCount(7);
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  await page.getByRole("tab", { name: "Agenda Manutenção", exact: true }).click();
  await expect(page.getByText("Cliente de Teste Manutenção", { exact: true })).toBeVisible();
  await expect(page.getByText("Cliente Instalação Separada", { exact: true })).not.toBeVisible();
  expect(requests.some((url) => url.includes(":14180/api/agenda-instalacao/agenda"))).toBe(true);
  expect(requests.some((url) => url.includes(":8501") || url.includes(":14181"))).toBe(false);
  expect(errors).toEqual([]);
});

test("zoom geral é imediato, persiste por usuário e aceita atalhos e restauração", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Zoom geral" });
  await expect(slider).toHaveValue("70");
  await slider.fill("80");
  await expect(slider).toHaveValue("80");
  await expect(page.locator("html")).toHaveCSS("zoom", "0.8");
  const windowHeight = await page.evaluate(() => innerHeight);
  const workspace = await page.locator(".workspace").boundingBox();
  expect(Math.abs(workspace!.y + workspace!.height - windowHeight)).toBeLessThan(2);
  await page.reload();
  await expect(slider).toHaveValue("80");
  await page.keyboard.press("Control+-");
  await expect(slider).toHaveValue("75");
  await page.keyboard.press("Control+=");
  await expect(slider).toHaveValue("80");
  await page.getByRole("button", { name: "Início", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Pessoa." })).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("zoom", "0.8");
  await page.keyboard.press("Control+0");
  await expect(page.locator("html")).toHaveCSS("zoom", "0.7");
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await slider.fill("50");
  await expect(page.getByRole("button", { name: "Diminuir zoom", exact: true })).toBeDisabled();
  await page.keyboard.press("Control+-");
  await expect(slider).toHaveValue("50");
  await slider.fill("200");
  await expect(page.getByRole("button", { name: "Aumentar zoom", exact: true })).toBeDisabled();
  await page.keyboard.press("Control+=");
  await expect(slider).toHaveValue("200");
  await page.getByRole("button", { name: "Restaurar padrão (70%)", exact: true }).click();
  await expect(slider).toHaveValue("70");
  await slider.fill("80");
  // Outra conta no mesmo computador começa em 70%, com sua própria preferência.
  await page.route(`${servers.chat}/api/me`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), id: 22 } });
  });
  await page.reload();
  await expect(slider).toHaveValue("70");
  await slider.fill("90");
  await page.reload();
  await expect(slider).toHaveValue("90");
  await page.unroute(`${servers.chat}/api/me`);
  await page.reload();
  await expect(slider).toHaveValue("80");
  expect(errors).toEqual([]);
});

test("primeiro acesso preenche os três servidores e permite entrar sem configuração manual", async ({ page }) => {
  // Usa configuração antiga vazia e bloqueia qualquer acesso à rede corporativa.
  await page.addInitScript(() => localStorage.setItem("workspace-servers-v1", JSON.stringify({
    chat: "", agenda: "", dashboard: "", allowInsecureLan: false,
    launchAtLogin: false, closeToTray: true, authorizedAgendaGateway: false,
  })));
  await page.route("http://192.168.1.133:8600/**", (route) => route.abort());
  await page.routeWebSocket("ws://192.168.1.133:8600/**", (socket) => socket.close());
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar no Workspace" })).toBeEnabled();
  await expect(page.getByText("Configure o servidor para acessar sua conta.")).toHaveCount(0);
  await page.getByRole("button", { name: "Configurar conexão" }).click();
  await expect(page.getByLabel("Chat Interno", { exact: true })).toHaveValue("http://192.168.1.133:8600");
  await expect(page.getByLabel("Agenda de Técnicos", { exact: true })).toHaveValue("https://192.168.1.133:8500");
  await expect(page.getByLabel("Dashboard operacional · Socket.IO", { exact: true })).toHaveValue("http://192.168.1.133:5000");
  await expect(page.getByRole("checkbox", { name: /Permitir HTTP para serviços legados/ })).not.toBeChecked();
});

test("configurações mostram versão, progresso e reinício da atualização sem alterar servidores", async ({ page }) => {
  await page.addInitScript((config) => {
    let status = { phase: "idle", currentVersion: "0.5.0", message: "Atualizações automáticas habilitadas." };
    const listeners: ((value: any) => void)[] = [];
    (window as any).__updateInstalls = 0;
    window.desktop = {
      getConfig: async () => config,
      getSession: async () => null,
      setZoom: async () => {},
      unread: async () => {},
      onZoomStep: () => () => {},
      updateStatus: async () => status,
      onUpdateStatus: (listener: any) => { listeners.push(listener); return () => {}; },
      checkForUpdates: async () => {
        status = { phase: "ready", currentVersion: "0.5.0", message: "Atualização pronta para instalar." };
        listeners.forEach((listener) => listener(status)); return status;
      },
      installUpdate: async () => { (window as any).__updateInstalls++; },
    } as any;
  }, servers);
  await page.goto('/#/settings');
  await expect(page.getByText('Versão instalada: 0.5.0')).toBeVisible();
  await page.getByRole('button', { name: 'Verificar atualizações', exact: true }).click();
  await expect(page.getByText('Atualização pronta para instalar.')).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar e atualizar', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__updateInstalls)).toBe(1);
  await expect(page.getByLabel('Chat Interno', { exact: true })).toHaveValue(servers.chat);
});

test("gerenciar agenda registra ausência, cor de equipe e bloqueio com a sessão do chat", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Agenda de Técnicos", exact: true }).click();
  await page.getByRole("button", { name: "Gerenciar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Gerenciar agenda" });
  await expect(dialog.getByText("Folga · Fixture local")).toBeVisible();
  await dialog.getByLabel("Técnico").selectOption("Outro Técnico");
  await dialog.getByLabel("Motivo").selectOption("medico");
  await dialog.getByLabel("Observação").fill("Consulta");
  await dialog.getByRole("button", { name: "Registrar ausência" }).click();
  await dialog.getByRole("group", { name: "Seção" }).getByRole("button", { name: "Equipes" }).click();
  await dialog.getByRole("group", { name: "Cor da equipe de Outro Técnico" }).getByRole("button", { name: "roxo" }).click();
  await dialog.getByRole("group", { name: "Seção" }).getByRole("button", { name: "Bloqueios" }).click();
  await dialog.getByLabel("Técnico").selectOption("Técnico de Teste");
  await dialog.getByLabel("Tipo").selectOption("reuniao");
  await dialog.getByLabel("Início").fill("14:00");
  await dialog.getByLabel("Fim").fill("15:00");
  await dialog.getByLabel("Descrição").fill("Alinhamento");
  await dialog.getByRole("button", { name: "Adicionar bloqueio" }).click();
  await expect.poll(async () => (await (await page.request.get("http://127.0.0.1:14180/api/__writes")).json()).length).toBe(3);
  const writes = await (await page.request.get("http://127.0.0.1:14180/api/__writes")).json();
  expect(writes.every((w: { session: string }) => w.session === "agenda.teste.assinatura")).toBe(true);
  expect(writes[0]).toMatchObject({ method: "POST", path: "/api/technician-absences", body: { technician_id: "Outro Técnico", absence_reason: "medico", absence_note: "Consulta" } });
  expect(writes[1]).toMatchObject({ method: "POST", path: "/api/technician-team-colors", body: { technician_id: "Outro Técnico", team_color: "roxo" } });
  expect(writes[2]).toMatchObject({ method: "POST", path: "/api/agenda-tecnicos/almocos", body: { tecnicoId: "Técnico de Teste", tipo: "reuniao", horaInicio: "14:00", horaFim: "15:00", descricao: "Alinhamento" } });
  expect(errors).toEqual([]);
});

test("botão flutuante mostra as contratações pendentes, abre a lista e pode ser movido", async ({ page }) => {
  await login(page);
  const bolha = page.getByRole("button", { name: "2 contratações pendentes no site" });
  await expect(bolha).toBeVisible();
  await expect(bolha).toContainText("2");
  await bolha.click();
  const painel = page.getByLabel("Contratações pendentes", { exact: true });
  await expect(painel.getByText("Cliente Contratação QA")).toBeVisible();
  await expect(painel.getByText("Segundo Pedido QA")).toBeVisible();
  await painel.getByRole("button", { name: "Fechar" }).click();
  const antes = await bolha.boundingBox();
  await page.mouse.move(antes!.x + 20, antes!.y + 20);
  await page.mouse.down();
  await page.mouse.move(antes!.x - 180, antes!.y - 160, { steps: 6 });
  await page.mouse.up();
  const depois = await bolha.boundingBox();
  expect(Math.abs(depois!.x - antes!.x)).toBeGreaterThan(100);
  await expect(painel).toHaveCount(0);
  await page.reload();
  const recarregada = await page.getByRole("button", { name: /contratações pendentes no site/ }).boundingBox();
  expect(Math.abs(recarregada!.x - depois!.x)).toBeLessThan(2);
  await bolha.click();
  await painel.getByRole("button", { name: "Abrir contratações do site" }).click();
  await expect(page.getByRole("heading", { name: "Contratações do site", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /contratações pendentes no site/ })).toHaveCount(0);
});

test("atualização comum é silenciosa (sem aviso) e só a obrigatória aparece e exige atualizar", async ({ page }) => {
  await page.addInitScript((config) => {
    let status: any = { phase: "idle", currentVersion: "0.5.5", message: "ok" };
    const listeners: ((value: any) => void)[] = [];
    (window as any).__installs = 0;
    (window as any).__notifications = [];
    (window as any).__push = (value: any) => { status = value; listeners.forEach((l) => l(status)); };
    window.desktop = {
      getConfig: async () => config,
      getSession: async () => null,
      setZoom: async () => {},
      unread: async () => {},
      onZoomStep: () => () => {},
      onNavigate: () => () => {},
      notify: async (n: any) => { (window as any).__notifications.push(n); },
      updateStatus: async () => status,
      onUpdateStatus: (l: any) => { listeners.push(l); return () => {}; },
      installUpdate: async () => { (window as any).__installs++; },
    } as any;
  }, servers);
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).__push === "function");
  await page.evaluate(() => (window as any).__push({ phase: "ready", currentVersion: "0.5.5", nextVersion: "0.5.6", message: "pronta" }));
  // Atualização comum (ou forçada sem "obrigatória"): nenhum aviso, nenhuma notificação; o app aplica sozinho.
  const aviso = page.getByRole("status").filter({ hasText: "Atualização disponível" });
  await page.waitForTimeout(500);
  await expect(aviso).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__notifications.length)).toBe(0);
  await page.evaluate(() => (window as any).__push({ phase: "ready", currentVersion: "0.5.5", nextVersion: "0.5.6", message: "pronta", forced: { obrigatoria: false } }));
  await page.waitForTimeout(300);
  await expect(aviso).toHaveCount(0);
  await page.evaluate(() => (window as any).__push({ phase: "ready", currentVersion: "0.5.5", nextVersion: "0.5.6", message: "pronta", forced: { obrigatoria: true, mensagem: "Atualização obrigatória da TI" } }));
  const obrigatorio = page.getByRole("alertdialog", { name: "Atualização obrigatória" });
  await expect(obrigatorio).toContainText("Atualização obrigatória da TI");
  await expect(obrigatorio.getByRole("button", { name: "Depois" })).toHaveCount(0);
  await obrigatorio.getByRole("button", { name: "Atualizar agora" }).click();
  expect(await page.evaluate(() => (window as any).__installs)).toBe(1);
});

test("coordenador de rota filtra por status e motivo no servidor, pesquisa técnicos e lista alertas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Agenda de Técnicos", exact: true }).click();
  await page.getByRole("tab", { name: /Coordenador|Rota/ }).first().click();
  await expect(page.getByRole("complementary", { name: "Técnicos no mapa" }).getByRole("button", { name: /Outro Técnico/ })).toBeVisible();
  await page.getByLabel("Status do chamado").selectOption("Aberta");
  await page.getByLabel("Motivo do chamado").selectOption("OFFLINE");
  await expect.poll(async () => {
    const queries = await (await page.request.get("http://127.0.0.1:14180/api/__route")).json();
    return queries.at(-1);
  }).toMatchObject({ status: "Aberta", motivo: "OFFLINE" });
  await page.getByLabel("Pesquisar técnico").fill("atendimento");
  await expect(page.getByRole("button", { name: /Outro Técnico/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Técnico de Teste/ })).toHaveCount(0);
  await page.getByText("Alertas e pendências").click();
  await expect(page.getByText("Cliente Sem Local · Outro Técnico")).toBeVisible();
  await page.getByRole("button", { name: /Limpar filtros/ }).click();
  await expect(page.getByLabel("Status do chamado")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("administração do chat fica no menu lateral para administradores e abre as páginas administrativas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Administração", exact: true }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  await page.goto("/#/tools");
  await expect(page.getByRole("link", { name: /Roleta de prêmios \(admin\)/ })).toBeVisible();
  await page.goto("/#/admin/usuarios/7/mensagens");
  await expect(page.getByText("Histórico do usuário").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("aba Changelog lista as versões do Workspace e mantém o histórico antigo acessível", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Changelog", exact: true }).first().click();
  await expect(page).toHaveURL(/#\/changelog$/);
  await expect(page.getByRole("heading", { name: "Changelog", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Versão 0.5.10" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Versão 0.5.1", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Abrir o histórico da intranet" }).click();
  await expect(page).toHaveURL(/#\/changelog-intranet$/);
  expect(errors).toEqual([]);
});

test("agenda: clicar no cabeçalho e na grade registra ausência, equipe e bloqueios como no app antigo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Agenda de Técnicos", exact: true }).click();
  await expect(page.getByText("Cliente de Teste Manutenção", { exact: true })).toBeVisible();
  const cabecalho = page.locator(".tg-head").filter({ hasText: "Outro Técnico" });
  // Ausência: clicar na etiqueta do técnico, escolher o motivo.
  await cabecalho.getByRole("button", { name: "Ausência" }).click();
  const menu = page.getByRole("menu", { name: "Motivo da ausência" });
  await menu.getByLabel("Observação curta").fill("Consulta");
  await menu.getByRole("button", { name: "Médico", exact: true }).click();
  // Equipe: clicar na etiqueta e escolher a cor.
  await cabecalho.getByRole("button", { name: "Equipe" }).click();
  await page.getByRole("menu", { name: "Cor da equipe" }).getByRole("button", { name: "Roxo" }).click();
  // Bloqueio: clicar num horário vazio da coluna do técnico e escolher o tipo.
  const alvo = page.locator(".tg").evaluateHandle((grade) => {
    const cabecalhos = [...grade.querySelectorAll(".tg-head")];
    const indice = cabecalhos.findIndex((c) => c.textContent?.includes("Outro Técnico"));
    const horas = [...grade.querySelectorAll(".tg-hour")].findIndex((h) => h.textContent?.trim() === "14:00");
    const colunas = cabecalhos.length;
    return grade.querySelectorAll(".tg-cell:not(.is-sem)")[(horas - 1) * colunas + indice] as HTMLElement;
  });
  const elemento = (await alvo).asElement()!;
  await elemento.scrollIntoViewIfNeeded();
  const caixa = (await elemento.boundingBox())!;
  await page.mouse.click(caixa.x + 20, caixa.y + 2);
  const novo = page.getByRole("menu", { name: "Adicionar ao horário" });
  await expect(novo).toContainText("Outro Técnico · 14:00");
  await novo.getByRole("button", { name: /Reunião/ }).click();
  const modal = page.getByRole("dialog", { name: "Adicionar bloqueio" });
  await modal.getByLabel("Descrição").fill("Alinhamento");
  await modal.getByRole("button", { name: "1h30" }).click();
  await expect(modal.getByLabel("Fim")).toHaveValue("15:30");
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => (await (await page.request.get("http://127.0.0.1:14180/api/__writes")).json()).length).toBeGreaterThanOrEqual(3);
  const writes = await (await page.request.get("http://127.0.0.1:14180/api/__writes")).json();
  const tail = writes.slice(-3);
  expect(tail[0]).toMatchObject({ method: "POST", path: "/api/technician-absences", body: { technician_id: "Outro Técnico", absence_reason: "medico", absence_note: "Consulta" } });
  expect(tail[1]).toMatchObject({ method: "POST", path: "/api/technician-team-colors", body: { technician_id: "Outro Técnico", team_color: "roxo" } });
  expect(tail[2]).toMatchObject({ method: "POST", path: "/api/agenda-tecnicos/almocos", body: { tecnicoId: "Outro Técnico", tipo: "reuniao", horaInicio: "14:00", horaFim: "15:30", descricao: "Alinhamento" } });
  expect(errors).toEqual([]);
});

test("botão Histórico na barra da agenda abre a aba do histórico de ações", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Agenda de Técnicos", exact: true }).click();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Histórico de Ações", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("perfil: trocar foto, remover foto e alterar senha", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/#/profile");
  await page.getByLabel("Escolher foto de perfil").setInputFiles("tests/fixtures/photo.png");
  await expect(page.getByText("Foto atualizada.")).toBeVisible();
  await expect(page.locator(".profile-hero .avatar-img")).toBeVisible();
  const src = await page.locator(".profile-hero .avatar-img").getAttribute("src");
  expect(src).toMatch(/^data:image\/(webp|png);base64,/);
  await expect(page.locator(".avatar-img").first()).toBeVisible();
  await page.getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByText("Foto removida.")).toBeVisible();
  await expect(page.locator(".profile-hero .avatar-img")).toHaveCount(0);
  const senha = page.getByRole("region", { name: "Alterar senha" });
  await senha.getByLabel("Senha atual").fill("errada");
  await senha.getByLabel("Nova senha", { exact: true }).fill("novasenha1");
  await senha.getByLabel("Confirmar nova senha").fill("outra-coisa");
  await senha.getByRole("button", { name: "Alterar senha" }).click();
  await expect(senha.getByRole("alert")).toContainText("não é igual");
  await senha.getByLabel("Confirmar nova senha").fill("novasenha1");
  await senha.getByRole("button", { name: "Alterar senha" }).click();
  await expect(senha.getByRole("alert")).toContainText("Senha atual inválida");
  await senha.getByLabel("Senha atual").fill("teste-local");
  await senha.getByRole("button", { name: "Alterar senha" }).click();
  await expect(senha.getByText("Senha alterada")).toBeVisible();
  const state = await (await request.get(`${servers.chat}/__test/state`)).json();
  expect(state.profileWrites).toEqual([{ avatar: expect.stringMatching(/^data:image\//) }, { avatar: "" }, { senha: "novasenha1" }]);
  expect(errors).toEqual([]);
});

test("perfil: alterar o próprio e-mail exige a senha atual e recusa e-mail já usado", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/#/profile");
  const secao = page.getByRole("region", { name: "Alterar e-mail" });
  await secao.getByLabel("Novo e-mail").fill("novo.email@example.test");
  await secao.getByLabel(/Senha atual/).fill("errada");
  await secao.getByRole("button", { name: "Alterar e-mail" }).click();
  await expect(secao.getByRole("alert")).toContainText("Senha atual inválida");
  await secao.getByLabel("Novo e-mail").fill("usado@example.test");
  await secao.getByLabel(/Senha atual/).fill("teste-local");
  await secao.getByRole("button", { name: "Alterar e-mail" }).click();
  await expect(secao.getByRole("alert")).toContainText("já está em uso");
  await secao.getByLabel("Novo e-mail").fill("novo.email@example.test");
  await secao.getByRole("button", { name: "Alterar e-mail" }).click();
  await expect(secao.getByText("E-mail alterado")).toBeVisible();
  await expect(page.locator(".profile-hero")).toContainText("novo.email@example.test");
  const state = await (await request.get(`${servers.chat}/__test/state`)).json();
  expect(state.profileWrites.at(-1)).toEqual({ email: "novo.email@example.test" });
  expect(errors).toEqual([]);
});

test("barra lateral rola quando a janela é baixa e mantém perfil e status visíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 420 });
  await login(page);
  const lateral = page.getByRole("complementary", { name: "Navegação principal" });
  const rolavel = await lateral.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === "auto");
  expect(rolavel).toBe(true);
  const ultimo = lateral.getByRole("button", { name: "Changelog", exact: true });
  await ultimo.scrollIntoViewIfNeeded();
  await expect(ultimo).toBeInViewport();
  await expect(lateral.getByRole("button", { name: /Perfil de/ })).toBeInViewport();
});

test("Rede (OLT) mostra incidentes ativos, resumo e os clientes afetados", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  const lateral = page.getByRole("complementary", { name: "Navegação principal" });
  await lateral.getByRole("button", { name: "Rede (OLT)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rede · Incidentes" })).toBeVisible();
  // Panorama geral: clientes sem energia / LOSS na rede inteira, por OLT.
  const panorama = page.locator(".rede-panorama");
  await expect(panorama).toContainText("1.159");
  await expect(panorama).toContainText("455");
  await expect(panorama).toContainText("GPON-OLT-MRT-001");
  await expect(panorama).toContainText("Slot 4 · PON 14");
  const resumo = page.locator(".rede-resumo").last();
  await expect(resumo).toContainText("Incidentes ativos");
  await expect(resumo.locator("div", { hasText: "Quedas de PON" }).first()).toContainText("1");
  const pon = page.locator("li.rede-card").filter({ hasText: "Queda de PON" });
  await expect(pon).toContainText("OLT Centro · Slot 1 · PON 3");
  await expect(pon).toContainText("há 12 min");
  await expect(pon).toContainText("20");
  await expect(pon).toContainText("de 40 clientes");
  await expect(page.locator("li.rede-card").filter({ hasText: "Queda de CTO" })).toContainText("CTO 12");
  await pon.getByRole("button", { name: /Clientes afetados/ }).click();
  await expect(pon.getByText("Maria Teste")).toBeVisible();
  await expect(pon.getByText("7001")).toBeVisible();
});

test("barra lateral fica recolhida, abre na borda esquerda e recolhe ao escolher um item", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  const area = page.locator(".workspace");
  await expect(area).toHaveClass(/collapsed/);
  await page.mouse.move(600, 400);
  await page.mouse.move(2, 400);
  await expect(area).not.toHaveClass(/collapsed/);
  const lateral = page.getByRole("complementary", { name: "Navegação principal" });
  await lateral.getByRole("button", { name: "Changelog", exact: true }).click();
  await expect(area).toHaveClass(/collapsed/);
  await expect(page.getByRole("heading", { name: "Changelog" }).first()).toBeVisible();
  // Fixar mantém aberta mesmo sem o mouse; soltar volta ao recolhimento automático.
  await page.mouse.move(2, 400);
  await expect(area).not.toHaveClass(/collapsed/);
  // O conteúdo acompanha a barra (não fica coberto por ela).
  const main = await page.locator(".main").boundingBox();
  const barra = await lateral.boundingBox();
  expect(main!.x).toBeGreaterThanOrEqual(barra!.x + barra!.width - 1);
  await page.getByRole("button", { name: "Fixar barra lateral aberta" }).click();
  await page.mouse.move(700, 400);
  await expect(area).not.toHaveClass(/collapsed/);
});

test("Painel NOC abre na visão resumida (primeiro layout) e guarda a última base de clientes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, { resumido: true });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await expect(resumo).toBeVisible();
  for (const titulo of ["Chamados NOC", "Massivos", "Comercial & Financeiro", "Almoxarifado", "Total de Clientes", "Retirada de Equipamento Suspensos", "Em Andamento", "Backbone Gpon LRJ", "Reclame aqui"])
    await expect(resumo).toContainText(titulo);
  await expect(resumo).toContainText("Servidor conectado");
  await expect(resumo).toContainText("1.234");
  await expect(page.getByLabel("Filtrar indicadores")).toHaveCount(0);
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("workspace:noc-clientes") || "null"));
  expect(guardado.data.total).toBe(1234);
  await page.getByRole("button", { name: "Visão completa", exact: true }).click();
  await expect(page.getByLabel("Filtrar indicadores")).toBeVisible();
  await expect(page.getByLabel("Painel NOC, visão resumida")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Painel NOC cai para long-polling quando o WebSocket é bloqueado e mantém a última atualização", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Simula proxy/antivírus que derruba qualquer WebSocket do Dashboard.
  await page.routeWebSocket(/:14182\//, (ws) => ws.close({ code: 1006 }));
  await login(page, { resumido: true });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await expect(resumo).toContainText("Servidor conectado", { timeout: 20000 });
  await expect(resumo).toContainText("1.234");
  await expect(resumo.getByText("Suporte Técnico")).toBeVisible();
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("workspace:noc-ultimo") || "null"));
  expect(guardado.payload.grupos).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Painel NOC no aplicativo desktop usa a conexão do processo principal", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((config) => {
    const listeners: ((canal: string, payload: unknown) => void)[] = [];
    (window as any).__dash = { starts: 0, stops: 0, refresh: 0, emit: (c: string, p: unknown) => listeners.forEach((l) => l(c, p)) };
    window.desktop = {
      getConfig: async () => config,
      getSession: async () => null,
      saveSession: async () => {},
      clearSession: async () => {},
      notify: async () => {},
      request: async (r: any) => {
        const resposta = await fetch((config as any)[r.service] + r.path, {
          method: r.method,
          headers: { "Content-Type": "application/json", ...(r.token ? { Authorization: "Bearer " + r.token } : {}) },
          body: r.body ? JSON.stringify(r.body) : undefined,
        });
        return { status: resposta.status, data: await resposta.json().catch(() => ({})) };
      },
      setZoom: async () => {},
      unread: async () => {},
      onZoomStep: () => () => {},
      onNavigate: () => () => {},
      updateStatus: async () => ({ phase: "idle", currentVersion: "0.5.9", message: "ok" }),
      onUpdateStatus: () => () => {},
      dashboardStart: async () => { (window as any).__dash.starts++; },
      dashboardStop: async () => { (window as any).__dash.stops++; },
      dashboardRefresh: async () => { (window as any).__dash.refresh++; },
      onDashboardEvent: (cb: any) => { listeners.push(cb); return () => { listeners.splice(listeners.indexOf(cb), 1); }; },
    } as any;
  }, servers);
  // Sessão no navegador de teste: entra pelo formulário, já com o "desktop" simulado.
  await page.goto("/");
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.waitForFunction(() => (window as any).__dash.starts >= 1);
  const resumo = page.getByLabel("Painel NOC, visão resumida");
  await page.evaluate(() => (window as any).__dash.emit("dashboard:status", { connected: false, status: "Não foi possível conectar ao Dashboard", detail: "websocket error" }));
  await expect(resumo).toContainText("websocket error");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  expect(await page.evaluate(() => (window as any).__dash.refresh)).toBe(1);
  await page.evaluate(() => {
    const d = (window as any).__dash;
    d.emit("dashboard:status", { connected: true, status: "Conectado", detail: "" });
    d.emit("dashboard:update", { total: 5, atualizado: 1792590496708, grupos: { "SUPORTE TÉCNICO": 7, OFFLINE: 26 }, emAndamento: { total: 2, atualizado: 1792590496708, chamados: [] }, pedidosAbertos: { vendasEmExecucao: 4, atualizado: 1792590496708, desatualizado: true } });
    d.emit("dashboard:clientes", { total: 500, ativos: 400, reduzido: 20, suspensos: 30, cancelados: 50, atualizado: 1792590496708 });
  });
  await expect(resumo).toContainText("Servidor conectado");
  await expect(resumo.locator(".chamado-card").filter({ hasText: "Suporte Técnico" })).toContainText("7");
  await expect(resumo.locator(".chamado-card").filter({ hasText: "Offline" })).toContainText("26");
  await expect(resumo).toContainText("450");
  await expect(resumo).toContainText("5 ocorrências abertas");
  const hora = new Date(1792590496708).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await expect(resumo).toContainText(`Última atualização: ${hora}`);
  await expect(resumo).toContainText(`última leitura às ${hora}`);
  await expect(page.getByRole("alert")).toContainText("Instalações: a última consulta ao SGP falhou");
  await resumo.getByRole("button", { name: "Abrir chamados em andamento" }).click();
  await expect(page.getByRole("dialog")).toContainText(`Atualização SGP: ${hora}`);
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByRole("button", { name: "Visão completa", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Instalações: a última consulta ao SGP falhou");
  expect(errors).toEqual([]);
});

for (const scope of ["atual", "outro servidor", "outro usuário"] as const) {
  test(`Painel NOC restaura cache apenas da sessão e origem atuais: ${scope}`, async ({ page }) => {
    await page.route("http://127.0.0.1:14182/**", (route) => route.abort());
    await page.routeWebSocket(/:14182\//, (ws) => ws.close({ code: 1006 }));
    await page.addInitScript(({ origin, userId }) => {
      const base = { origin, userId, ts: Date.now() };
      localStorage.setItem("workspace:noc-clientes", JSON.stringify({ ...base, data: { total: 654321, ativos: 600000, atualizado: 1792590496708 } }));
      localStorage.setItem("workspace:noc-ultimo", JSON.stringify({ ...base, payload: { total: 4321, grupos: { OFFLINE: 1 }, atualizado: 1792590496708 } }));
    }, { origin: scope === "outro servidor" ? "http://127.0.0.1:9" : servers.dashboard, userId: scope === "outro usuário" ? 999 : 1 });
    await login(page, { resumido: true });
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    const resumo = page.getByLabel("Painel NOC, visão resumida");
    await expect(resumo).toContainText("Servidor desconectado");
    if (scope === "atual") {
      await expect(resumo).toContainText("654.321");
      await expect(resumo).toContainText("4.321 ocorrências abertas");
      await expect(resumo).toContainText("podem estar desatualizados");
    } else {
      await expect(resumo).not.toContainText("654.321");
      await expect(resumo).not.toContainText("4.321 ocorrências abertas");
      await expect(resumo).toContainText("Aguardando a base de clientes");
    }
  });
}

test("Disparo envia mensagem e arquivo aos destinatários escolhidos", async ({ page }) => {
  const envios: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/chat/enviar-direto") && r.method() === "POST") envios.push(r.postDataJSON());
  });
  await login(page);
  await page.getByRole("button", { name: "Disparo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Disparo de mensagens" })).toBeVisible();
  await page.getByLabel("Mensagem").fill("Aviso para todos");
  await page.locator('input[type="file"]').setInputFiles({ name: "aviso.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByRole("button", { name: /Enviar para 1/ }).click();
  await page.getByRole("button", { name: "Sim, enviar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 enviado(s)." })).toBeVisible();
  expect(envios.map((e) => e.tipo_mensagem)).toEqual(["texto", "arquivo"]);
});

test("Venda nova no Painel NOC lança a comemoração com foguetes", async ({ page, request }) => {
  const venda = (n: number) => request.post("http://127.0.0.1:14179/__test/dashboard", { data: { total: 20 + n, grupos: { OFFLINE: 3, "ATIVAÇÃO DE CONTRATO - COMUM": n }, atualizado: Date.now() } });
  await login(page);
  await expect.poll(async () => (await (await request.get("http://127.0.0.1:14179/__test/state")).json()).dashboardConnections).toBeGreaterThan(0);
  await venda(5);
  await expect(page.getByRole("status").filter({ hasText: "5 novas vendas!" })).toBeVisible({ timeout: 12000 });
  await expect(page.locator(".venda-aviso")).toBeHidden({ timeout: 9000 });
  await venda(7);
  const aviso = page.getByRole("status").filter({ hasText: "2 novas vendas!" });
  await expect(aviso).toBeVisible({ timeout: 12000 });
  await expect(aviso).toContainText("+2");
  await expect(page.locator(".venda-palco canvas")).toHaveCount(1);
  await expect(aviso).toBeHidden({ timeout: 9000 });
  await expect(page.locator(".venda-palco canvas")).toHaveCount(0);
});

test("Administração testa os foguetes só na própria tela", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Testar foguetes na minha tela" }).click();
  const aviso = page.getByRole("status").filter({ hasText: "Teste de venda" });
  await expect(aviso).toContainText("Só na sua tela");
  await expect(page.locator(".venda-palco canvas")).toHaveCount(1);
});

test("Administração mostra quem está usando o aplicativo e a versão", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Administração", exact: true }).click();
  const painel = page.getByRole("region", { name: "Usando o aplicativo agora" });
  await expect(painel).toContainText("2 pessoas com o Workspace aberto");
  await expect(painel).toContainText("1 em versão antiga");
  await expect(painel).toContainText("Colega de Teste");
  await expect(painel).toContainText("v0.5.16 · antiga");
  await expect(painel).toContainText("há 25 min");
  await expect(painel).toContainText("2 conexões");
});
