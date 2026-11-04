import { io } from "socket.io-client";
import { api, clients } from "../../services/api";
import { addDays, normalizeAgenda, today, type WorkOrder } from "../../services/agenda";
import { useDashboard } from "../../services/dashboard";
import { socketEndpoint } from "../../services/live";
import { haQuanto, tipoRotulo, type IncidentesResposta } from "../../services/redeOlt";
import { useNotices, useServers, useSession } from "../../stores/workspace";

// Leitura (somente leitura) dos dados do próprio Workspace para o Assistente responder perguntas como
// "qual técnico está com mais OS hoje?". Cada fonte usa o login e as permissões da pessoa e só entra
// quando a pergunta fala dela. Vai para a IA: técnico, horário, status, motivo, bairro, contagens e
// nome e sobrenome do cliente. Nunca vai: CPF, telefone, e-mail, endereço completo, coordenadas.

export type FonteDados = "agenda" | "mudancas" | "chamados" | "painel" | "rede";

export interface BlocoDados {
  /** De onde vem; o servidor usa para respeitar o que o setor da pessoa pode consultar. */
  fonte?: FonteDados;
  titulo: string;
  texto: string;
}

const LIMITE_BLOCO = 6000;
const TEMPO_FONTE_MS = 15000;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function apagar(valor: unknown, no: string): string {
  return String(valor ?? "")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, no)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, no)
    .replace(/(?:\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, no)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, no);
}

/** Apaga CPF, CNPJ, telefone e e-mail de um texto livre (motivo, título, descrição). */
export function limparTexto(valor: unknown, max = 120): string {
  return apagar(valor, "[oculto]").replace(/\s+/g, " ").trim().slice(0, max);
}

/** "Maria da Silva Souza" -> "Maria Souza": nome e sobrenome, sem o resto. Documentos e números somem. */
export function nomeCurto(valor: unknown): string {
  const t = apagar(valor, " ").replace(/[^\p{L}\s'.-]/gu, " ").replace(/\s+/g, " ").trim();
  const partes = t.split(" ").filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

const cortar = (texto: string) => (texto.length > LIMITE_BLOCO ? `${texto.slice(0, LIMITE_BLOCO)}\n[lista cortada por tamanho]` : texto);
const contar = (itens: string[]) => {
  const m = new Map<string, number>();
  for (const i of itens) m.set(i || "(sem informação)", (m.get(i || "(sem informação)") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export interface Intencao {
  agenda: boolean;
  mudancas: boolean;
  chamados: boolean;
  painel: boolean;
  rede: boolean;
  dias: string[];
}

/** Decide quais fontes a pergunta pede, por palavras-chave (sem gastar uma chamada de IA). */
export function detectarFontes(pergunta: string, hoje = today()): Intencao {
  const t = semAcento(pergunta);
  const tem = (re: RegExp) => re.test(t);
  const mudancas = tem(/mudanc|alterac|troca|trocou|reagend|historico|ultimas? acoes|o que mudou|bloque|ausenc/);
  const agenda = mudancas || tem(/tecnic|agenda|\bos\b|ordem(ns)? de servico|visita|instalac|mapa|bairro|regiao|equipe|demanda|roteiro|turno/);
  const chamados = tem(/chamado|ticket|protocolo|\bfila\b|filas|suporte|\bn[123]\b/);
  const painel = tem(/resumo|painel|noc|dashboard|dia de hoje|situacao|clientes (ativos|online|offline|suspensos)|visao geral/);
  const rede = tem(/\brede\b|olt|\bpon\b|\bcto\b|queda|energia|\bloss\b|incidente|massivo|massiva/);
  const dias: string[] = [];
  if (tem(/ontem/)) dias.push(addDays(hoje, -1));
  if (tem(/\bhoje\b/) || (!tem(/ontem|amanha/) && agenda)) dias.push(hoje);
  if (tem(/amanha/)) dias.push(addDays(hoje, 1));
  return { agenda, mudancas, chamados, painel, rede, dias: dias.length ? [...new Set(dias)] : [hoje] };
}

const rotuloDia = (dia: string, hoje = today()) =>
  dia === hoje ? `hoje (${dia})` : dia === addDays(hoje, -1) ? `ontem (${dia})` : dia === addDays(hoje, 1) ? `amanhã (${dia})` : dia;

/** Linhas e totais de um dia da agenda, já sem dados sensíveis. */
export function resumirAgenda(dia: string, ordens: WorkOrder[]): BlocoDados {
  const tecnico = (o: WorkOrder) => limparTexto(o.tecnico, 40);
  const porTecnico = new Map<string, WorkOrder[]>();
  for (const o of ordens) porTecnico.set(tecnico(o) || "(sem técnico)", [...(porTecnico.get(tecnico(o) || "(sem técnico)") ?? []), o]);
  const cabecalho = [
    `Total de OS: ${ordens.length}.`,
    "Por técnico: " + [...porTecnico.entries()].sort((a, b) => b[1].length - a[1].length).map(([nome, lista]) => `${nome} ${lista.length} (${contar(lista.map((o) => limparTexto(o.status, 30))).map(([s, n]) => `${n} ${s}`).join(", ")})`).join("; ") + ".",
    "Por bairro: " + contar(ordens.map((o) => limparTexto(o.bairro, 40))).slice(0, 12).map(([b, n]) => `${b} ${n}`).join(", ") + ".",
  ];
  const linhas = [...ordens]
    .sort((a, b) => String(a.hora ?? "").localeCompare(String(b.hora ?? "")))
    .map((o) => [
      `OS ${o.idOrdemServico ?? o.id ?? "?"}`,
      limparTexto(o.hora, 8) || limparTexto(o.turnoHorario, 20),
      tecnico(o) || "sem técnico",
      nomeCurto(o.cliente) || "cliente não informado",
      limparTexto(o.bairro, 40),
      limparTexto(o.status, 30),
      limparTexto(o.motivo, 70),
    ].filter(Boolean).join(" | "));
  return { fonte: "agenda", titulo: `Agenda de técnicos, ${rotuloDia(dia)}`, texto: cortar([...cabecalho, "Lista (OS | hora | técnico | cliente | bairro | status | motivo):", ...linhas].join("\n")) };
}

/** Pede um dia da agenda ao servidor de agenda, uma vez, e fecha a conexão. */
function carregarAgendaDia(dia: string): Promise<WorkOrder[]> {
  const origin = useServers.getState().config.agenda;
  const token = useSession.getState().token;
  if (!origin || !token) return Promise.reject(new Error("agenda não configurada"));
  return new Promise((resolve, reject) => {
    const endpoint = socketEndpoint("agenda", origin);
    const s = io(endpoint.url, { path: endpoint.path, auth: { token }, transports: ["websocket"], reconnection: false });
    const fim = (fn: () => void) => { clearTimeout(timer); s.disconnect(); fn(); };
    const timer = setTimeout(() => fim(() => reject(new Error("a agenda demorou para responder"))), TEMPO_FONTE_MS);
    const receber = (payload: unknown) => {
      const itens = normalizeAgenda(payload, dia);
      if (itens) fim(() => resolve(itens));
    };
    s.on("connect", () => s.emit("filtrarData", dia));
    s.on("agenda", receber).on("agendaAtualizada", receber);
    s.on("connect_error", () => fim(() => reject(new Error("sem conexão com a agenda"))));
    s.on("agendaErro", () => fim(() => reject(new Error("a agenda não conseguiu atualizar"))));
  });
}

async function blocoAgenda(dias: string[]): Promise<BlocoDados[]> {
  const out: BlocoDados[] = [];
  for (const dia of dias.slice(0, 3)) {
    try {
      out.push(resumirAgenda(dia, await carregarAgendaDia(dia)));
    } catch (e) {
      out.push({ fonte: "agenda", titulo: `Agenda de técnicos, ${rotuloDia(dia)}`, texto: `Indisponível agora: ${e instanceof Error ? e.message : "erro"}.` });
    }
  }
  return out;
}

async function blocoMudancas(): Promise<BlocoDados> {
  const de = addDays(today(), -3);
  const { data } = await clients.agenda.get<{ items: { criadoEm: string; usuario?: { nome?: string } | null; tipo: string; titulo?: string; descricao?: string; tecnico?: string; mudancas?: { campo: string; de: string; para: string }[] }[] }>(
    "/agenda-tecnicos/historico", { params: { limite: "60", de }, timeout: TEMPO_FONTE_MS });
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const linhas = (data.items ?? []).slice(0, 40).map((i) => [
    hora.format(new Date(i.criadoEm)),
    limparTexto(i.tipo, 20),
    limparTexto(i.usuario?.nome, 30) && `por ${limparTexto(i.usuario?.nome, 30)}`,
    limparTexto(i.tecnico, 30),
    limparTexto(i.titulo || i.descricao, 110),
    (i.mudancas ?? []).slice(0, 3).map((m) => `${limparTexto(m.campo, 20)}: ${limparTexto(m.de, 30)} -> ${limparTexto(m.para, 30)}`).join("; "),
  ].filter(Boolean).join(" | "));
  const avisos = useNotices.getState().items.slice(0, 10).map((n) => `${limparTexto(n.title, 60)}: ${limparTexto(n.body, 100)}`);
  return {
    fonte: "mudancas",
    titulo: "Últimas mudanças na agenda (3 dias)",
    texto: cortar([`Ações registradas (${linhas.length}):`, ...linhas, avisos.length ? "Avisos recentes do app:" : "", ...avisos].filter(Boolean).join("\n")),
  };
}

async function blocosChamados(): Promise<BlocoDados[]> {
  const out: BlocoDados[] = [];
  const snap = useDashboard.getState().snapshot;
  if (snap) {
    const filas = Object.entries(snap.groups).filter(([k]) => /SUPORTE|OFFLINE|ROTEADOR|ATENUA|RETIRADA|ATIVA|MUDAN|FINANCEIRO|COMERCIAL/i.test(k));
    out.push({ fonte: "chamados", titulo: "Filas de suporte (painel NOC)", texto: `Total: ${snap.total}.\n` + filas.map(([k, n]) => `${limparTexto(k, 60)}: ${n}`).join("\n") });
  }
  try {
    const { data } = await api.get<{ items: { protocol: string | null; customerName: string | null; title: string; openedAt: string; statusLabel: string }[]; total: number }>(
      "/chamados/site", { params: { period: "30d", page: 1, limit: 40 }, timeout: TEMPO_FONTE_MS });
    const linhas = data.items.map((c) => [
      c.protocol ? `Protocolo ${limparTexto(c.protocol, 20)}` : "",
      new Date(c.openedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      nomeCurto(c.customerName),
      limparTexto(c.title, 80),
      limparTexto(c.statusLabel, 30),
    ].filter(Boolean).join(" | "));
    out.push({ fonte: "chamados", titulo: "Chamados do site (30 dias)", texto: cortar([`Total no período: ${data.total}. Mostrando ${linhas.length} (protocolo | data | cliente | assunto | situação):`, ...linhas].join("\n")) });
  } catch (e) {
    out.push({ fonte: "chamados", titulo: "Chamados do site (30 dias)", texto: `Indisponível agora: ${e instanceof Error ? e.message : "erro"}.` });
  }
  return out;
}

function blocoPainel(): BlocoDados {
  const { snapshot, customers } = useDashboard.getState();
  if (!snapshot) return { fonte: "painel", titulo: "Painel NOC", texto: "Indisponível agora: o painel ainda não recebeu dados." };
  const linhas = [
    `Atualizado em ${new Date(snapshot.updated).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    `Chamados abertos no total: ${snapshot.total}.`,
    ...Object.entries(snapshot.groups).map(([k, n]) => `${limparTexto(k, 60)}: ${n}`),
  ];
  if (customers) linhas.push("Clientes: " + Object.entries(customers).filter(([, n]) => n !== null).map(([k, n]) => `${k} ${n}`).join(", "));
  const andamento = snapshot.running?.orders ?? [];
  if (snapshot.running) {
    linhas.push(`Em andamento agora: ${snapshot.running.total}.`);
    for (const o of andamento.slice(0, 30))
      linhas.push([limparTexto(o.tipo, 40), limparTexto(o.tecnico, 30), nomeCurto(o.cliente), limparTexto(o.bairro, 40), limparTexto(o.status, 30)].filter(Boolean).join(" | "));
  }
  return { fonte: "painel", titulo: "Painel NOC e resumo do dia", texto: cortar(linhas.join("\n")) };
}

async function blocoRede(): Promise<BlocoDados> {
  try {
    const { data } = await clients.chat.get<IncidentesResposta>("/integrations/olt/incidentes", { timeout: TEMPO_FONTE_MS });
    if (!data.configurada) return { fonte: "rede", titulo: "Rede (OLT)", texto: "Indisponível: a OLT Cloud não está configurada." };
    const linhas = data.incidentes.slice(0, 40).map((i) => [
      tipoRotulo(i.tipo),
      [i.olt, i.slotPon && `slot ${i.slotPon}`, i.pon && `PON ${i.pon}`, i.cto].filter(Boolean).join(" "),
      i.dispositivosAtivos !== null ? `${i.dispositivosAtivos}${i.totalDispositivos ? ` de ${i.totalDispositivos}` : ""} clientes afetados` : "",
      haQuanto(i.inicio),
    ].filter(Boolean).join(" | "));
    return { fonte: "rede", titulo: "Rede (OLT): alertas ativos", texto: cortar([`Alertas ativos: ${data.incidentes.length}.`, ...linhas].join("\n")) };
  } catch (e) {
    const negado = (e as { response?: { status?: number } })?.response?.status === 403;
    return { fonte: "rede", titulo: "Rede (OLT)", texto: negado ? "Indisponível: esta conta não tem acesso aos dados de rede." : `Indisponível agora: ${e instanceof Error ? e.message : "erro"}.` };
  }
}

/** Coleta, em paralelo, só as fontes que a pergunta pede. Uma fonte com erro vira um bloco "Indisponível". */
export async function coletarDados(pergunta: string): Promise<BlocoDados[]> {
  const f = detectarFontes(pergunta);
  const tarefas: Promise<BlocoDados[]>[] = [];
  if (f.agenda) tarefas.push(blocoAgenda(f.dias));
  if (f.mudancas) tarefas.push(blocoMudancas().then((b) => [b]).catch((e) => [{ fonte: "mudancas", titulo: "Últimas mudanças na agenda", texto: `Indisponível agora: ${e instanceof Error ? e.message : "erro"}.` }]));
  if (f.chamados) tarefas.push(blocosChamados());
  if (f.painel) tarefas.push(Promise.resolve([blocoPainel()]));
  if (f.rede) tarefas.push(blocoRede().then((b) => [b]));
  return (await Promise.all(tarefas)).flat();
}
