export type ProtocoloTerminal = "ssh" | "telnet";
export interface EquipamentoTerminal {
  id: string;
  nome: string;
  grupo: string;
  protocolo: ProtocoloTerminal;
  host: string;
  porta: number;
  usuario: string;
  temSenha: boolean;
}
export interface EquipamentoForm {
  id?: string;
  nome: string;
  grupo: string;
  protocolo: ProtocoloTerminal;
  host: string;
  porta: number;
  usuario: string;
  senha?: string;
  guardarSenha: boolean;
}
export interface PedidoConexao {
  sessao: string;
  equipamentoId?: string;
  rapido?: { protocolo: ProtocoloTerminal; host: string; porta: number; usuario?: string };
  senha?: string;
  cols: number;
  rows: number;
}
export const portaPadrao = (p: ProtocoloTerminal) => (p === "ssh" ? 22 : 23);

/** Aceita "usuario@host", "host:porta" e "ssh://usuario@host:porta" na conexão rápida. */
export function lerEnderecoRapido(texto: string, protocoloPadrao: ProtocoloTerminal = "ssh") {
  let t = texto.trim();
  let protocolo = protocoloPadrao;
  const m = /^(ssh|telnet):\/\//i.exec(t);
  if (m) { protocolo = m[1].toLowerCase() as ProtocoloTerminal; t = t.slice(m[0].length); }
  let usuario = "";
  const arroba = t.lastIndexOf("@");
  if (arroba >= 0) { usuario = t.slice(0, arroba); t = t.slice(arroba + 1); }
  let porta = portaPadrao(protocolo);
  const dp = /^(.+):(\d{1,5})$/.exec(t);
  if (dp && !dp[1].includes(":")) { t = dp[1]; porta = Number(dp[2]); }
  if (!/^[A-Za-z0-9._-]{1,253}$/.test(t) || porta < 1 || porta > 65535) return null;
  return { protocolo, host: t, porta, usuario };
}
