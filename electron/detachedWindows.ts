import { app, BrowserWindow, screen, shell, type WebContents } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveExternalUrl } from "./moduleNavigation";
import { attachContextMenu } from "./contextMenu";

// Janelas destacáveis (Agenda, Chat e Navegador): a mesma interface do Workspace carregada numa
// segunda janela com rota própria, lendo sessão e servidores do mesmo armazenamento seguro.
// Existe no máximo uma janela de cada tipo; abrir de novo apenas a traz para frente.
export const detachedKinds = ["agenda", "chat", "navegador", "rede", "dashboard", "resumo", "terminal", "telefone"] as const;
export type DetachedKind = (typeof detachedKinds)[number];

const META: Record<DetachedKind, { title: string; width: number; height: number; minWidth: number; minHeight: number }> = {
  agenda: { title: "Agenda Técnica · Acessa Workspace", width: 1280, height: 860, minWidth: 360, minHeight: 240 },
  chat: { title: "Chat Interno · Acessa Workspace", width: 1100, height: 760, minWidth: 340, minHeight: 260 },
  navegador: { title: "Navegador · Acessa Workspace", width: 1280, height: 860, minWidth: 360, minHeight: 240 },
  rede: { title: "Rede (OLT) · Acessa Workspace", width: 980, height: 720, minWidth: 280, minHeight: 160 },
  dashboard: { title: "Painel NOC · Acessa Workspace", width: 1400, height: 860, minWidth: 280, minHeight: 160 },
  resumo: { title: "Resumo · Acessa Workspace", width: 1100, height: 780, minWidth: 280, minHeight: 160 },
  terminal: { title: "Terminal · Acessa Workspace", width: 1100, height: 720, minWidth: 420, minHeight: 260 },
  telefone: { title: "Workscape Phone", width: 380, height: 700, minWidth: 300, minHeight: 440 },
};
type Saved = { x?: number; y?: number; width: number; height: number; maximized?: boolean };

const windows = new Map<DetachedKind, BrowserWindow>();
let notify: (kind: DetachedKind, open: boolean) => void = () => undefined;
let beforeClose: (kind: DetachedKind, win: BrowserWindow) => void = () => undefined;
const boundsFile = (kind: DetachedKind) => path.join(app.getPath("userData"), `janela-${kind}.json`);

async function loadBounds(kind: DetachedKind): Promise<Saved> {
  const work = screen.getPrimaryDisplay().workArea;
  const fallback: Saved = {
    width: Math.min(META[kind].width, work.width),
    height: Math.min(META[kind].height, work.height),
  };
  try {
    const raw = JSON.parse(await readFile(boundsFile(kind), "utf8")) as Saved;
    if (![raw.width, raw.height].every((n) => Number.isFinite(n) && n >= 240)) return fallback;
    if (Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      // Se o monitor onde ela estava foi desligado, volta para a tela principal.
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea;
        const w = Math.min(raw.x! + raw.width, a.x + a.width) - Math.max(raw.x!, a.x);
        const h = Math.min(raw.y! + raw.height, a.y + a.height) - Math.max(raw.y!, a.y);
        return w >= 120 && h >= 80;
      });
      if (!visible) return { width: raw.width, height: raw.height, maximized: raw.maximized };
    }
    return raw;
  } catch {
    return fallback;
  }
}
async function saveBounds(kind: DetachedKind, w: BrowserWindow) {
  const b = w.getNormalBounds();
  const data: Saved = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: w.isMaximized() };
  await writeFile(boundsFile(kind), JSON.stringify(data), { mode: 0o600 }).catch(() => undefined);
}

export const detachedWindow = (kind: DetachedKind) => {
  const w = windows.get(kind);
  return w && !w.isDestroyed() ? w : null;
};
export const detachedContents = (kind: DetachedKind) => detachedWindow(kind)?.webContents ?? null;
export const isDetachedOpen = (kind: DetachedKind) => !!detachedWindow(kind);
/** Qual janela destacada é dona deste conteúdo (null se for a janela principal ou outra coisa). */
export function detachedKindOf(wc: WebContents): DetachedKind | null {
  for (const kind of detachedKinds) if (detachedContents(kind) === wc) return kind;
  return null;
}

export function initDetachedWindows(
  onState: (kind: DetachedKind, open: boolean) => void,
  onBeforeClose: (kind: DetachedKind, win: BrowserWindow) => void,
) {
  notify = onState;
  beforeClose = onBeforeClose;
}

export type DetachedLayout = {
  bounds?: { x: number; y: number; width: number; height: number };
  /** Sempre por cima das outras janelas. */
  pinned?: boolean;
  /** Modo compacto (menos textos e espaços). */
  compact?: boolean;
};
const compactState = new Map<DetachedKind, boolean>();
export const setDetachedCompact = (kind: DetachedKind, compact: boolean) => { compactState.set(kind, compact); };

/** Disposição atual das janelas destacadas abertas (posição, tamanho, "por cima" e modo compacto). */
export function captureDetachedLayout() {
  return detachedKinds.flatMap((kind) => {
    const w = detachedWindow(kind);
    if (!w) return [];
    const b = w.getNormalBounds();
    return [{ kind, x: b.x, y: b.y, width: b.width, height: b.height, pinned: w.isAlwaysOnTop(), compact: compactState.get(kind) === true }];
  });
}

export async function openDetached(
  kind: DetachedKind,
  opts: { base: string; preload: string; icon: Electron.NativeImage | string; search?: string } & DetachedLayout,
) {
  const existing = detachedWindow(kind);
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    if (opts.search) existing.webContents.send("detached:deeplink", opts.search);
    return;
  }
  const meta = META[kind];
  // Uma disposição pedida (workspace salvo ou lado a lado) vale mais que a última posição lembrada.
  const saved: Saved = opts.bounds ? { ...opts.bounds } : await loadBounds(kind);
  compactState.set(kind, opts.compact === true);
  const w = new BrowserWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    minWidth: meta.minWidth,
    minHeight: meta.minHeight,
    title: meta.title,
    icon: opts.icon,
    backgroundColor: "#030716",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: opts.preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  windows.set(kind, w);
  w.setMenu(null);
  attachContextMenu(w.webContents);
  // Links só saem para o navegador do sistema, e somente http(s).
  const abrirFora = (url: string) => {
    const external = resolveExternalUrl(url);
    if (external) void shell.openExternal(external);
  };
  w.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    abrirFora(url);
  });
  w.webContents.on("will-attach-webview", (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(({ url }) => {
    abrirFora(url);
    return { action: "deny" };
  });
  // O título do documento não deve virar "Workspace"; mantém o da janela.
  w.on("page-title-updated", (e) => e.preventDefault());
  if (opts.pinned) w.setAlwaysOnTop(true, "floating");
  w.once("ready-to-show", () => {
    if (w.isDestroyed()) return;
    if (saved.maximized) w.maximize();
    w.show();
  });
  w.on("close", () => {
    void saveBounds(kind, w);
    beforeClose(kind, w);
  });
  w.on("closed", () => {
    if (windows.get(kind) === w) windows.delete(kind);
    notify(kind, false);
  });
  const hash = `#/${kind}?janela=1${opts.compact ? "&compacto=1" : ""}${opts.pinned ? "&porcima=1" : ""}${opts.search ? "&" + opts.search.replace(/^\?/, "") : ""}`;
  await w.loadURL(`${opts.base}/index.html${hash}`);
  notify(kind, true);
}

export function closeDetached(kind: DetachedKind) {
  detachedWindow(kind)?.close();
}
/** Mantém a janela sempre por cima das outras (útil para deixar um painel visível enquanto trabalha). */
export function setDetachedOnTop(kind: DetachedKind, on: boolean) {
  detachedWindow(kind)?.setAlwaysOnTop(on, on ? "floating" : "normal");
}
export function closeAllDetached() {
  for (const kind of detachedKinds) closeDetached(kind);
}
