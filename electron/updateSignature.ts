import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parseDn } from "builder-util-runtime";
import { z } from "zod";
const exec = promisify(execFile);

export function matchesUpdateSigner(input: unknown, filename: string, publishers: string[]) {
  const result = z.object({ Status: z.literal(0), Path: z.string(), Subject: z.string().min(1) }).parse(input);
  if (path.win32.normalize(result.Path).toLowerCase() !== path.win32.normalize(filename).toLowerCase())
    throw new Error("O arquivo verificado difere do instalador baixado.");
  const subject = parseDn(result.Subject);
  if (!publishers.some((publisher) => {
    const expected = parseDn(publisher);
    return expected.size ? [...expected].every(([key, value]) => subject.get(key) === value) : subject.get("CN") === publisher;
  })) throw new Error("O instalador não foi assinado pelo publicador autorizado.");
}

/** Falha fechada: PowerShell indisponível, JSON inválido ou assinatura não válida recusam a atualização. */
export async function verifyUpdateSignature(publishers: string[], filename: string): Promise<string | null> {
  try {
    const root = process.env.SystemRoot || process.env.WINDIR;
    if (!root || !path.win32.isAbsolute(root)) throw new Error("Diretório do Windows indisponível.");
    const script = "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath $env:WORKSPACE_UPDATE_FILE; [pscustomobject]@{Status=[int]$s.Status;Path=$s.Path;Subject=$s.SignerCertificate.Subject}|ConvertTo-Json -Compress";
    const { stdout } = await exec(path.win32.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
      { timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024, env: { ...process.env, WORKSPACE_UPDATE_FILE: filename } });
    matchesUpdateSigner(JSON.parse(stdout.replace(/^\uFEFF/, "")), filename, publishers);
    return null;
  } catch { return "Não foi possível validar a assinatura digital do instalador e seu publicador."; }
}
