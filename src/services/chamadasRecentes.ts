export interface ChamadaRecente {
  id: number;
  direcao: "in" | "out";
  numero: string;
  resultado: "atendida" | "nao_atendida" | "rejeitada" | "falhou" | string;
  duracaoSeg: number;
  inicio: string;
}

/** Recebida e não atendida. Recusar de propósito não conta como perdida. */
export const foiPerdida = (c: ChamadaRecente) => c.direcao === "in" && c.resultado === "nao_atendida";

/** Quantas perdidas aconteceram depois da última vez que a pessoa olhou a lista. */
export function contarPerdidasNovas(chamadas: ChamadaRecente[], vistoEmMs: number): number {
  return chamadas.filter((c) => foiPerdida(c) && new Date(c.inicio).getTime() > vistoEmMs).length;
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "Hoje 14:32", "Ontem 09:05", "ter 13:10" (até 6 dias) ou "21/10 08:00". */
export function rotuloDaChamada(inicio: string, agora = new Date()): string {
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return "";
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias === 0) return `Hoje ${hora}`;
  if (dias === 1) return `Ontem ${hora}`;
  if (dias > 1 && dias < 7) return `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} ${hora}`;
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${hora}`;
}

export function duracaoCurta(seg: number): string {
  if (seg < 1) return "";
  const m = Math.floor(seg / 60);
  return m ? `${m} min ${dois(seg % 60)} s` : `${seg} s`;
}

/** Texto do atalho do Início conforme as perdidas. */
export const textoPerdidas = (n: number) => `${n} ${n === 1 ? "chamada perdida" : "chamadas perdidas"}`;
