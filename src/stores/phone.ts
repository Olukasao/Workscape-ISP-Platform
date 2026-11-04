import { create } from "zustand";
import type { PhoneEvent, PhoneSnapshot } from "../../electron/phone";
import { clients } from "../services/api";
import { contarPerdidasNovas, type ChamadaRecente } from "../services/chamadasRecentes";
import { useSession } from "./workspace";

const VAZIO: PhoneSnapshot = {
  motor: "indisponivel", registro: "desconectado", mensagem: "", ramal: "", chamadas: [], naoPerturbe: false, dispositivos: { capture: [], playback: [] },
};

interface PhoneStore {
  snapshot: PhoneSnapshot;
  /** O app tem o motor do telefone (versão para Windows com o motor instalado). */
  motor: boolean;
  /** A pessoa tem ramal cadastrado pelo administrador. */
  temRamal: boolean;
  /** Por que o telefone não conectou (vazio quando está tudo certo). */
  erro: string;
  /** Últimas chamadas (feitas, recebidas e perdidas). */
  recentes: ChamadaRecente[];
  /** Quando a pessoa olhou a lista de recentes pela última vez; perdidas depois disso contam como novas. */
  vistoEm: number;
  set: (s: PhoneSnapshot) => void;
}
export const usePhone = create<PhoneStore>((set) => ({
  snapshot: VAZIO,
  motor: false,
  temRamal: false,
  erro: "",
  recentes: [],
  vistoEm: Number.MAX_SAFE_INTEGER,
  set: (snapshot) => set({ snapshot, motor: snapshot.motor !== "indisponivel" }),
}));

/** Níveis do áudio durante a conversa. Fica fora do estado do telefone: muda 10 vezes por segundo e só o anel do avatar precisa dele. */
export const useNiveis = create<{ mic: number; remoto: number; em: number }>(() => ({ mic: 0, remoto: 0, em: 0 }));

let assinado = false;
let ultimoToken = "";

/** Liga o telefone desta pessoa: assina os eventos do motor, confere se há ramal e conecta. Seguro chamar de novo. */
export async function iniciarTelefone(token: string, aoReceber: (e: PhoneEvent) => void, forcar = false) {
  const d = window.desktop;
  if (!d?.onPhoneEvent || !d.phoneConnect || !d.phoneState) {
    usePhone.setState({ erro: "O telefone só funciona no aplicativo Workspace para Windows." });
    return;
  }
  if (!assinado) {
    assinado = true;
    d.onPhoneEvent((e) => {
      if (e.type === "state") usePhone.getState().set(e.snapshot);
      if (e.type === "levels") useNiveis.setState({ mic: e.mic, remoto: e.remoto, em: Date.now() });
      aoReceber(e);
    });
    usePhone.getState().set(await d.phoneState());
  }
  if (token === ultimoToken && !forcar) return;
  ultimoToken = token;
  // O Não perturbe lembrado vale antes de registrar, para nenhuma chamada tocar no intervalo.
  await d.phoneDnd?.(lerNaoPerturbe());
  usePhone.setState({ erro: "" });
  try {
    const { data } = await clients.chat.get<{ disponivel: boolean; conta: unknown }>("/phone/status");
    usePhone.setState({ temRamal: !!data.conta });
    if (!data.disponivel) { usePhone.setState({ erro: "O telefone ainda não foi habilitado no servidor. Fale com o administrador." }); return; }
    if (!data.conta) { usePhone.setState({ erro: "Você ainda não tem um ramal cadastrado. Peça ao administrador em Admin > Telefone." }); return; }
    void carregarRecentes();
    const r = await d.phoneConnect(token);
    if (!r.ok) usePhone.setState({ erro: r.erro || "Não foi possível conectar o telefone." });
  } catch (e) {
    usePhone.setState({ erro: e instanceof Error && e.message ? `Não foi possível falar com o servidor do telefone (${e.message}).` : "Não foi possível falar com o servidor do telefone." });
  }
}

export async function pararTelefone() {
  ultimoToken = "";
  usePhone.setState({ temRamal: false, erro: "", recentes: [], vistoEm: Number.MAX_SAFE_INTEGER });
  await window.desktop?.phoneDisconnect?.();
}

/** Grava no servidor as chamadas que terminaram (histórico por pessoa). */
export async function registrarHistorico(e: Extract<PhoneEvent, { type: "history" }>) {
  try {
    await clients.chat.post("/phone/chamadas", { direcao: e.direcao, numero: e.numero, resultado: e.resultado, duracaoSeg: e.duracaoSeg, inicioMs: e.inicioMs });
  } catch { /* o histórico é secundário: nunca atrapalha a ligação */ }
  await carregarRecentes();
}

const chaveVisto = () => `workspace:telefone:visto:${useSession.getState().user?.id ?? 0}`;

/** Quantas chamadas perdidas ainda não foram vistas (sobe o contador do atalho). */
export const usePerdidasNovas = () => usePhone((s) => contarPerdidasNovas(s.recentes, s.vistoEm));

export async function carregarRecentes() {
  try {
    const { data } = await clients.chat.get<{ chamadas: ChamadaRecente[] }>("/phone/chamadas");
    let visto = 0;
    try {
      const salvo = localStorage.getItem(chaveVisto());
      // Primeira vez neste computador: o que já existe conta como visto, para não aparecer uma enxurrada de "perdidas" antigas.
      visto = salvo ? Number(salvo) : Date.now();
      if (!salvo) localStorage.setItem(chaveVisto(), String(visto));
    } catch { visto = Date.now(); }
    usePhone.setState((s) => ({ recentes: data.chamadas, vistoEm: s.vistoEm === Number.MAX_SAFE_INTEGER ? visto : s.vistoEm }));
  } catch { /* sem histórico por enquanto: o telefone continua funcionando */ }
}

/** A pessoa viu a lista de recentes: zera o contador de perdidas. */
export function marcarVistas() {
  const agora = Date.now();
  usePhone.setState({ vistoEm: agora });
  try { localStorage.setItem(chaveVisto(), String(agora)); } catch { /* vale só nesta sessão */ }
}

const chaveDnd = () => `workspace:telefone:naoperturbe:${useSession.getState().user?.id ?? 0}`;
function lerNaoPerturbe(): boolean {
  try { return localStorage.getItem(chaveDnd()) === "1"; } catch { return false; }
}

/** Liga ou desliga o Não perturbe e lembra a escolha neste computador. Devolve o erro, se houver. */
export async function definirNaoPerturbe(on: boolean): Promise<string | undefined> {
  const r = await window.desktop?.phoneDnd?.(on);
  if (r && !r.ok) return r.erro || "Não foi possível mudar o Não perturbe.";
  try { localStorage.setItem(chaveDnd(), on ? "1" : "0"); } catch { /* vale só nesta sessão */ }
  return undefined;
}
