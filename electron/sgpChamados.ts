// Lista de chamados por categoria do SGP, dentro do próprio Workspace. O SGP não
// tem API pra isso (só por contrato individual, ver docs do fornecedor), então
// lemos a mesma página de relatório que o app já abre no Navegador > SGP, usando
// a sessão (cookies) de quem já fez login lá -- sem escrever outra vez o que o
// SGP mostra, só lendo a tabela dele por trás, numa janela invisível.
import { BrowserWindow, session } from "electron";

// Mesma sessão persistente do Navegador > SGP (electron/browserTabs.ts): se a
// pessoa já logou lá, esta leitura também já está autenticada.
const PARTITION = "persist:navegador";
const TIMEOUT_MS = 20000;

export interface SgpChamadoLinha {
  colunas: string[];
  link: string | null;
}
export interface SgpChamadosResultado {
  autenticado: boolean;
  colunas: string[];
  linhas: SgpChamadoLinha[];
}

// Roda dentro da página do SGP: acha a tabela de resultados (a com mais linhas)
// e devolve cabeçalho + linhas de forma genérica, sem depender de nomes de
// classe específicos (o HTML exato do SGP não foi conferido ao vivo ainda).
const SCRIPT = `(function () {
  var tabelas = Array.prototype.slice.call(document.querySelectorAll("table"));
  if (!tabelas.length) return { colunas: [], linhas: [] };
  var melhor = tabelas[0], melhorN = -1;
  for (var i = 0; i < tabelas.length; i++) {
    var n = tabelas[i].querySelectorAll("tbody tr, tr").length;
    if (n > melhorN) { melhor = tabelas[i]; melhorN = n; }
  }
  var ths = Array.prototype.slice.call(melhor.querySelectorAll("thead th, thead td"));
  var colunas = ths.map(function (th) { return (th.textContent || "").trim(); }).filter(Boolean);
  var corpo = melhor.querySelectorAll("tbody tr").length
    ? Array.prototype.slice.call(melhor.querySelectorAll("tbody tr"))
    : Array.prototype.slice.call(melhor.querySelectorAll("tr")).slice(colunas.length ? 1 : 0);
  var linhas = corpo.slice(0, 200).map(function (tr) {
    var tds = Array.prototype.slice.call(tr.querySelectorAll("td"));
    var valores = tds.map(function (td) { return (td.textContent || "").trim().replace(/\\s+/g, " "); });
    var a = tr.querySelector("a[href]");
    return { colunas: valores, link: a ? a.href : null };
  }).filter(function (l) { return l.colunas.some(Boolean); });
  return { colunas: colunas, linhas: linhas };
})()`;

export async function listarChamadosSgp(url: string): Promise<SgpChamadosResultado> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: session.fromPartition(PARTITION),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  try {
    await Promise.race([
      win.loadURL(url),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    const atual = win.webContents.getURL();
    if (/\/accounts\/login/i.test(atual)) return { autenticado: false, colunas: [], linhas: [] };
    const dados = (await win.webContents.executeJavaScript(SCRIPT, true)) as { colunas?: string[]; linhas?: SgpChamadoLinha[] };
    return { autenticado: true, colunas: dados.colunas || [], linhas: dados.linhas || [] };
  } catch {
    throw new Error("O SGP não respondeu a tempo.");
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
