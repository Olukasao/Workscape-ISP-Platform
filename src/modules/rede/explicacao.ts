import type { IncidenteRede, PanoramaRede } from "../../services/redeOlt";

// Texto em linguagem simples sobre uma queda de rede, para o atendimento repassar ao cliente.
// Não usa IA nem dados de cliente: só o que a OLT informa (tipo, local, quantos clientes, desde quando).

export type Porte = "massiva" | "parcial" | "pontual";

/** Massiva: muita gente ou a maior parte da área afetada. Pontual: poucos clientes. */
export function porteDoIncidente(i: Pick<IncidenteRede, "dispositivosAtivos" | "totalDispositivos">): Porte {
  const n = i.dispositivosAtivos;
  if (n === null || n === undefined) return "parcial";
  const total = i.totalDispositivos && i.totalDispositivos > 0 ? i.totalDispositivos : 0;
  if (n >= 30 || (total >= 5 && n / total >= 0.6)) return "massiva";
  return n >= 6 ? "parcial" : "pontual";
}

const milhar = (n: number) => n.toLocaleString("pt-BR");
const energia = (tipo: string) => /no_power/.test(tipo);

const desde = (inicio: string | null, agora: number) => {
  const t = inicio ? Date.parse(inicio) : NaN;
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.floor((agora - t) / 60000));
  const hora = new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} minutos (desde as ${hora})`;
  const h = Math.floor(min / 60);
  return `há ${h} ${h === 1 ? "hora" : "horas"}${min % 60 ? ` e ${min % 60} min` : ""} (desde as ${hora})`;
};

/** Frase curta para o aviso na tela (pop-up e sino). */
export function resumoCurto(i: Pick<IncidenteRede, "tipo" | "dispositivosAtivos" | "totalDispositivos">): string {
  const n = i.dispositivosAtivos;
  const porte = porteDoIncidente(i);
  const pct = n != null && i.totalDispositivos ? Math.round((n / i.totalDispositivos) * 100) : null;
  const causa = energia(i.tipo) ? "sem energia" : "sem conexão";
  const quem = n == null ? "Clientes afetados" : `${milhar(n)} ${n === 1 ? "cliente" : "clientes"}${pct !== null && i.totalDispositivos && i.totalDispositivos > n ? ` de ${milhar(i.totalDispositivos)} (${pct}%)` : ""}`;
  return `${porte === "massiva" ? "Queda massiva · " : ""}${quem} ${causa}`;
}

export function textoParaAtendimento(i: IncidenteRede, opcoes: { panorama?: PanoramaRede | null; agora?: number } = {}): string {
  const agora = opcoes.agora ?? Date.now();
  const porte = porteDoIncidente(i);
  const regiao = i.olt ? `na região atendida por ${i.olt}` : "em parte da nossa rede";
  const caixa = i.cto && /cto/.test(i.tipo) ? ` (caixa ${i.cto})` : "";
  const quando = desde(i.inicio, agora);
  const n = i.dispositivosAtivos;
  const linhas: string[] = [];

  if (energia(i.tipo)) {
    linhas.push(`${porte === "massiva" ? "Queda massiva" : "Falta de energia"} ${regiao}${caixa}: os equipamentos dos clientes ficaram sem energia elétrica, por isso sem internet.`);
  } else if (/pon/.test(i.tipo)) {
    linhas.push(`${porte === "massiva" ? "Queda massiva de internet" : "Queda de internet"} ${regiao}: um trecho da nossa rede de fibra está fora do ar${caixa}.`);
  } else {
    linhas.push(`Instabilidade ${regiao}${caixa}: alguns clientes estão sem conexão.`);
  }

  if (n !== null && n !== undefined) {
    const total = i.totalDispositivos && i.totalDispositivos > n ? ` de ${milhar(i.totalDispositivos)} atendidos nessa área` : "";
    linhas.push(`Hoje há ${milhar(n)} ${n === 1 ? "cliente afetado" : "clientes afetados"}${total}${quando ? `, desde ${quando}` : ""}.`);
  } else if (quando) linhas.push(`Começou ${quando}.`);

  const o = i.olt ? opcoes.panorama?.porOlt?.find((x) => x.olt === i.olt) : undefined;
  if (o && o.semEnergia + o.loss > Math.max(n ?? 0, 0) * 2 && o.semEnergia + o.loss >= 50)
    linhas.push(`Outros pontos dessa mesma região também estão afetados (${milhar(o.semEnergia + o.loss)} clientes no total), o que indica um problema regional.`);

  linhas.push(energia(i.tipo)
    ? "O sinal volta sozinho assim que a energia da região for restabelecida."
    : "Nossa equipe técnica já está acompanhando a ocorrência.");
  linhas.push("Orientação ao cliente: não é preciso trocar o equipamento nem abrir novo chamado por causa dessa queda. Se a internet não voltar depois que o aviso for encerrado, aí sim abrimos uma visita.");
  return linhas.join("\n");
}
