import { BrowserWindow, screen } from "electron";

// Aviso de mensagem no canto inferior direito da tela, em janela própria.
// Não depende da central de notificações do Windows (que descarta avisos de
// apps sem AppUserModelID registrado no atalho ou com "Não perturbe").
export type ToastData = {
  title: string;
  body: string;
  sender?: string;
  context?: string;
  kind?: "direct" | "group" | "system";
  avatar?: string;
  /** Destaque do aviso: crítico (vermelho), alerta (âmbar) ou informativo. Usado nos incidentes de rede. */
  tone?: "crit" | "warn" | "info";
  time?: string;
};

const WIDTH = 384;
const HEIGHT = 120;
const GAP = 6;
const MARGIN = 10;
const MAX = 3;
const toasts: BrowserWindow[] = [];

function layout() {
  const area = screen.getPrimaryDisplay().workArea;
  toasts.forEach((t, i) => {
    if (t.isDestroyed()) return;
    t.setBounds({
      x: Math.round(area.x + area.width - WIDTH - MARGIN),
      y: Math.round(area.y + area.height - MARGIN - (HEIGHT + GAP) * (i + 1) + GAP),
      width: WIDTH,
      height: HEIGHT,
    });
  });
}

function close(t: BrowserWindow) {
  const i = toasts.indexOf(t);
  if (i >= 0) toasts.splice(i, 1);
  if (!t.isDestroyed()) t.destroy();
  layout();
}

export function closeAllToasts() {
  [...toasts].forEach(close);
}

/**
 * Mostra um aviso. `base` é a origem da interface local
 * (app://workspace ou o Vite em desenvolvimento).
 */
export function showToast(base: string, data: ToastData, onOpen: () => void) {
  while (toasts.length >= MAX) close(toasts[toasts.length - 1]);
  const t = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  t.setAlwaysOnTop(true, "pop-up-menu");
  t.setMenu(null);
  t.webContents.on("will-navigate", (e) => e.preventDefault());
  t.webContents.on("will-attach-webview", (e) => e.preventDefault());
  t.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // A página responde trocando o hash: #open (clique) ou #close (tempo/fechar).
  t.webContents.on("did-navigate-in-page", (_e, url) => {
    const hash = new URL(url).hash;
    if (hash === "#open") {
      close(t);
      onOpen();
    } else if (hash === "#close") close(t);
  });
  t.webContents.on("render-process-gone", () => close(t));
  t.once("ready-to-show", () => {
    if (!t.isDestroyed()) t.showInactive();
  });
  // Segurança extra caso a página não responda.
  setTimeout(() => close(t), 60000);
  toasts.unshift(t);
  layout();
  const payload = encodeURIComponent(
    JSON.stringify({ ...data, time: data.time || new Date().toISOString() }),
  );
  void t.loadURL(`${base}/toast.html#${payload}`);
}

/** Chamar depois de app.whenReady(): reposiciona ao mudar a resolução ou a barra de tarefas. */
export function initToasts() {
  screen.on("display-metrics-changed", layout);
  screen.on("display-added", layout);
  screen.on("display-removed", layout);
}
