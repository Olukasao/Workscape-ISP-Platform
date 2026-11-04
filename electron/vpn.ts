import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";

// Diagnóstico de conexão e correção da rota da VPN nativa do Windows. O tráfego do app só chega aos servidores
// internos (192.168.1.x) se a VPN levar essa rede; com "túnel dividido" o Windows nem sempre cria essa rota.

export interface LinhaTeste { servico: string; host: string; porta: number; ok: boolean; ms: number; erro?: string }
export interface VpnWindows { nome: string; servidor: string; tipo: string; tunelDividido: boolean; conectada: boolean; temRota: boolean }
export interface ResultadoCorrecao { ok: boolean; mensagem: string; corrigidas: string[]; jaTinham: string[] }

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Faixa /24 de um endereço privado ("192.168.1.133" -> "192.168.1.0/24"); null para nomes, IPs públicos ou inválidos. */
export function redeDe(host: string): string | null {
  const m = IPV4.exec(host);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if ([a, b, c, Number(m[4])].some((n) => n > 255)) return null;
  const privado = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  return privado ? `${a}.${b}.${c}.0/24` : null;
}

/** Conecta na porta e mede o tempo; não envia nada. */
export function testarPorta(host: string, porta: number, limiteMs = 3500): Promise<{ ok: boolean; ms: number; erro?: string }> {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const socket = net.connect({ host, port: porta });
    const fim = (ok: boolean, erro?: string) => { socket.destroy(); resolve({ ok, ms: Date.now() - inicio, erro }); };
    socket.setTimeout(limiteMs, () => fim(false, "sem resposta"));
    socket.once("connect", () => fim(true));
    socket.once("error", (e: NodeJS.ErrnoException) => fim(false, e.code === "ECONNREFUSED" ? "recusou a conexão" : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH" ? "sem rota até o servidor" : e.code || "erro"));
  });
}

/** O computador já está numa rede com a mesma faixa do escritório (ex.: a casa também é 192.168.1.x)? */
export function conflitoDeRede(rede: string, interfaces = os.networkInterfaces()): string | null {
  const prefixo = rede.replace(/\.0\/24$/, ".");
  for (const [nome, enderecos] of Object.entries(interfaces)) {
    if (/vpn|tunnel|ppp|ras|tap|wintun|wireguard/i.test(nome)) continue;
    if ((enderecos || []).some((e) => e.family === "IPv4" && !e.internal && e.address.startsWith(prefixo))) return nome;
  }
  return null;
}

function powershell(script: string, limiteMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true });
    let saida = "", erro = "";
    const timer = setTimeout(() => { proc.kill(); reject(new Error("O Windows demorou demais para responder.")); }, limiteMs);
    proc.stdout.on("data", (d) => { saida += d; });
    proc.stderr.on("data", (d) => { erro += d; });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (codigo) => { clearTimeout(timer); codigo === 0 ? resolve(saida.trim()) : reject(new Error(erro.trim().slice(0, 300) || `PowerShell terminou com código ${codigo}`)); });
  });
}

/** Lista as VPNs do Windows (Configurações > VPN) do usuário e diz se já têm a rota da rede do escritório. */
export async function listarVpns(rede: string | null): Promise<VpnWindows[]> {
  if (process.platform !== "win32") return [];
  const alvo = rede && /^\d{1,3}(\.\d{1,3}){2}\.0\/24$/.test(rede) ? rede : "";
  const saida = await powershell(
    `$ErrorActionPreference='SilentlyContinue'; $r = @(Get-VpnConnection | ForEach-Object { $rotas = @(Get-VpnConnectionRoute -ConnectionName $_.Name | ForEach-Object { $_.DestinationPrefix }); [pscustomobject]@{ nome=$_.Name; servidor=$_.ServerAddress; tipo=[string]$_.TunnelType; tunelDividido=[bool]$_.SplitTunneling; conectada=($_.ConnectionStatus -eq 'Connected'); temRota=(${alvo ? `$rotas -contains '${alvo}'` : "$false"}) } }); ConvertTo-Json -InputObject $r -Compress`,
  );
  if (!saida) return [];
  const dados = JSON.parse(saida);
  return (Array.isArray(dados) ? dados : [dados]).map((v) => ({ nome: String(v.nome), servidor: String(v.servidor), tipo: String(v.tipo), tunelDividido: Boolean(v.tunelDividido), conectada: Boolean(v.conectada), temRota: Boolean(v.temRota) }));
}

/** Adiciona a rota da rede do escritório nas VPNs com túnel dividido. Só vale depois de desconectar e conectar a VPN. */
export async function corrigirRotaVpn(rede: string): Promise<ResultadoCorrecao> {
  if (process.platform !== "win32") return { ok: false, mensagem: "Isso só funciona no Windows.", corrigidas: [], jaTinham: [] };
  if (!/^\d{1,3}(\.\d{1,3}){2}\.0\/24$/.test(rede)) return { ok: false, mensagem: "Endereço de rede inválido.", corrigidas: [], jaTinham: [] };
  const vpns = await listarVpns(rede);
  if (!vpns.length) return { ok: false, mensagem: "Não achei nenhuma VPN do Windows neste usuário. Se a VPN é outro programa (WireGuard, OpenVPN), a rota precisa ser feita nele.", corrigidas: [], jaTinham: [] };
  const corrigidas: string[] = [], jaTinham: string[] = [];
  for (const v of vpns) {
    if (!v.tunelDividido || v.temRota) { jaTinham.push(v.nome); continue; }
    // O nome vai por variável de ambiente, nunca dentro do texto do comando.
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", `Add-VpnConnectionRoute -ConnectionName $env:ACESSA_VPN -DestinationPrefix '${rede}' -ErrorAction Stop | Out-Null`], { windowsHide: true, env: { ...process.env, ACESSA_VPN: v.nome } });
      let erro = "";
      proc.stderr.on("data", (d) => { erro += d; });
      proc.on("error", reject);
      proc.on("close", (c) => (c === 0 ? resolve() : reject(new Error(erro.trim().slice(0, 300) || "Não foi possível adicionar a rota."))));
    });
    corrigidas.push(v.nome);
  }
  const mensagem = corrigidas.length
    ? `Rota adicionada na VPN ${corrigidas.map((n) => `"${n}"`).join(", ")}. Desconecte e conecte a VPN de novo e teste outra vez.`
    : "As VPNs deste computador já estão certas (usam o gateway remoto ou já têm a rota). Se continua sem conexão, o problema é o firewall do servidor ou a rede da casa usar a mesma faixa.";
  return { ok: true, mensagem, corrigidas, jaTinham };
}
