import type { ITheme } from "@xterm/xterm";

export interface TemaTerminal { id: string; nome: string; tema: ITheme }

const ansi = (o: Partial<ITheme>): Partial<ITheme> => o;

/** Temas do terminal (cores da tela e da paleta ANSI). O primeiro é o padrão. */
export const TEMAS_TERMINAL: TemaTerminal[] = [
  { id: "noite", nome: "Azul-noite", tema: { background: "#0b1020", foreground: "#d8e0f0", cursor: "#7fb2ff", selectionBackground: "#2f5fb3aa" } },
  { id: "classico", nome: "Clássico (preto e branco)", tema: { background: "#000000", foreground: "#e5e5e5", cursor: "#ffffff", selectionBackground: "#ffffff44" } },
  { id: "matrix", nome: "Matrix (verde)", tema: { background: "#020a04", foreground: "#33ff66", cursor: "#9dffb5", selectionBackground: "#1f7a3a99", black: "#020a04", green: "#33ff66", brightGreen: "#7dffa0" } },
  { id: "ambar", nome: "Âmbar (terminal antigo)", tema: { background: "#140c00", foreground: "#ffb000", cursor: "#ffd27a", selectionBackground: "#8a5d0099" } },
  { id: "solarized", nome: "Solarized escuro", tema: ansi({ background: "#002b36", foreground: "#93a1a1", cursor: "#93a1a1", selectionBackground: "#073642", black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900", blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5" }) },
  { id: "dracula", nome: "Dracula", tema: ansi({ background: "#282a36", foreground: "#f8f8f2", cursor: "#f8f8f2", selectionBackground: "#44475a", black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c", blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2" }) },
  { id: "monokai", nome: "Monokai", tema: ansi({ background: "#272822", foreground: "#f8f8f2", cursor: "#f8f8f0", selectionBackground: "#49483e", red: "#f92672", green: "#a6e22e", yellow: "#f4bf75", blue: "#66d9ef", magenta: "#ae81ff", cyan: "#a1efe4" }) },
  { id: "claro", nome: "Claro", tema: ansi({ background: "#fbfbfd", foreground: "#1f2430", cursor: "#2f6bff", selectionBackground: "#bcd2ff", black: "#1f2430", red: "#c62828", green: "#2e7d32", yellow: "#a66a00", blue: "#1565c0", magenta: "#8e24aa", cyan: "#00838f", white: "#6b7280", brightBlack: "#6b7280" }) },
];
export const TEMA_PADRAO = TEMAS_TERMINAL[0].id;
export const temaPorId = (id: string | undefined) => TEMAS_TERMINAL.find((t) => t.id === id) ?? TEMAS_TERMINAL[0];
export const FONTE_MIN = 10;
export const FONTE_MAX = 24;
export const FONTE_PADRAO = 14;
