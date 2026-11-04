import { create } from "zustand";
import { api } from "./api";

export type Tipo = "unico" | "diario" | "semanal" | "mensal";
export interface Regra {
  texto: string;
  tipo: Tipo;
  horarios: string[];
  dias_semana: number[];
  dia_mes: number | null;
  data: string | null;
  avisar_chat: number;
}
export interface Lembrete extends Regra {
  id: number;
  ativo: boolean;
  descricao: string;
  proximo: string | null;
}
export interface Alarme { id: number; lembrete_id: number | null; texto: string; disparou_em: string }

export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const regraVazia = (): Regra => ({ texto: "", tipo: "diario", horarios: ["09:00"], dias_semana: [1, 2, 3, 4, 5], dia_mes: 1, data: null, avisar_chat: 1 });

/** Mensagem de erro que o servidor mandou, ou a padrão. */
export const erroDe = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || padrao;

/** "2026-10-27 15:00:00" -> "Amanhã, 15:00" (ou "Hoje, 15:00" / "27/10, 15:00"). */
export function rotuloQuando(quando: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(quando || "");
  if (!m) return "";
  const alvo = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  const dia = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `${m[3]}/${m[2]}`;
  return `${dia}, ${m[4]}:${m[5]}`;
}

export const lembretesApi = {
  listar: async () => (await api.get<{ lembretes: Lembrete[] }>("/lembretes")).data.lembretes,
  interpretar: async (texto: string) => (await api.post<{ lembretes: (Regra & { descricao: string })[] }>("/lembretes/interpretar", { texto }, { timeout: 90000 })).data.lembretes,
  criar: async (lembretes: Regra[]) => (await api.post("/lembretes", { lembretes })).data,
  editar: async (id: number, regra: Regra) => (await api.put(`/lembretes/${id}`, regra)).data,
  ativar: async (id: number, ativo: boolean) => (await api.patch(`/lembretes/${id}/ativo`, { ativo })).data,
  excluir: async (id: number) => (await api.delete(`/lembretes/${id}`)).data,
  hoje: async () => (await api.get<{ lembretes: { id: number; texto: string; hora: string }[] }>("/lembretes/hoje")).data.lembretes,
  alarmes: async () => (await api.get<{ alarmes: Alarme[] }>("/lembretes/alarmes")).data.alarmes,
  concluirAlarme: async (id: number) => (await api.post(`/lembretes/alarmes/${id}/concluir`)).data,
  sonecaAlarme: async (id: number, minutos: number) => (await api.post(`/lembretes/alarmes/${id}/soneca`, { minutos })).data,
};

/** Alarmes que estão tocando agora (fila). `testar` mostra um alarme de mentira para a pessoa conhecer o som e os botões. */
export const useAlarmes = create<{
  fila: Alarme[];
  mudo: boolean;
  definir: (fila: Alarme[]) => void;
  tirar: (id: number) => void;
  alternarMudo: () => void;
  testar: () => void;
}>((set) => ({
  fila: [],
  mudo: false,
  definir: (fila) => set({ fila }),
  tirar: (id) => set((s) => ({ fila: s.fila.filter((a) => a.id !== id) })),
  alternarMudo: () => set((s) => ({ mudo: !s.mudo })),
  testar: () => set((s) => (s.fila.some((a) => a.id < 0) ? s : { fila: [{ id: -1, lembrete_id: null, texto: "Este é um alarme de teste", disparou_em: "" }, ...s.fila] })),
}));
