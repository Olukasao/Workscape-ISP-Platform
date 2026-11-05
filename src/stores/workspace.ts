import type { FundoEscolhido } from "../services/fundoUsuario";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeZoom } from "../services/zoom";
import {
  defaultConfig,
  validateConfig,
  type ServerConfig,
} from "../../electron/policy";
export interface User {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  empresa_id: number;
  empresa_nome?: string;
  setor_nome?: string;
  avatar?: string;
  permissions?: string[];
}
interface Session {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clear: () => void;
  /** Login confirmado, mas a tela de acesso ainda termina a animação antes de abrir o Workspace. */
  entrando: boolean;
  setEntrando: (v: boolean) => void;
}
export const useSession = create<Session>((set) => ({
  token: sessionStorage.getItem("token"),
  user: null,
  entrando: false,
  setEntrando: (entrando) => set({ entrando }),
  setSession: (token, user) => {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(user));
    set({ token, user });
  },
  clear: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    set({ token: null, user: null });
    void window.desktop?.clearSession();
  },
}));
export const usePreferences = create(
  persist<{
    theme: "dark" | "light";
    /** Segue o tema do Windows; `theme` passa a ser só o resultado. */
    themeAuto: boolean;
    /** Botão flutuante do Assistente em todas as telas. */
    assistenteFlutuante: boolean;
    setAssistenteFlutuante: (value: boolean) => void;
    /** Cor de destaque em hexadecimal (#rrggbb). */
    accent: string;
    darkBackground: "marinho" | "grafite" | "preto";
    setThemeAuto: (value: boolean) => void;
    setAccent: (hex: string) => void;
    setDarkBackground: (value: "marinho" | "grafite" | "preto") => void;
    /** Aparência do terminal SSH/Telnet (vale para todas as sessões). */
    terminalTema: string;
    terminalFonte: number;
    setTerminalTema: (id: string) => void;
    setTerminalFonte: (px: number) => void;
    /** Imagem de fundo escolhida por usuário (chave = id do Chat Interno). */
    fundoPorUsuario: Record<string, FundoEscolhido>;
    setFundo: (userKey: string, fundo: FundoEscolhido) => void;
    collapsed: boolean;
    /** Barra lateral recolhe sozinha e abre ao passar o mouse; "fixada" mantém aberta. */
    autoHideSidebar: boolean;
    sidebarPinned: boolean;
    setAutoHideSidebar: (value: boolean) => void;
    toggleSidebarPinned: () => void;
    zoomByUser: Record<string, number>;
    setZoom: (userKey: string, percent: number) => void;
    setTheme: (theme: "dark" | "light") => void;
    toggleSidebar: () => void;
  }>(
    (set) => ({
      theme: "light",
      themeAuto: false,
      assistenteFlutuante: true,
      setAssistenteFlutuante: (assistenteFlutuante) => set({ assistenteFlutuante }),
      accent: "#2f6bff",
      darkBackground: "marinho",
      setThemeAuto: (themeAuto) => set({ themeAuto }),
      setAccent: (accent) => set({ accent }),
      setDarkBackground: (darkBackground) => set({ darkBackground }),
      terminalTema: "noite",
      terminalFonte: 14,
      setTerminalTema: (terminalTema) => set({ terminalTema }),
      setTerminalFonte: (px) => set({ terminalFonte: Math.min(24, Math.max(10, Math.round(px))) }),
      fundoPorUsuario: {},
      setFundo: (userKey, fundo) => set((s) => ({ fundoPorUsuario: { ...s.fundoPorUsuario, [userKey]: fundo } })),
      collapsed: false,
      autoHideSidebar: true,
      sidebarPinned: false,
      setAutoHideSidebar: (value) => set({ autoHideSidebar: value, sidebarPinned: false }),
      toggleSidebarPinned: () => set((s) => ({ sidebarPinned: !s.sidebarPinned })),
      zoomByUser: {},
      setZoom: (userKey, percent) => set((s) => ({
        zoomByUser: { ...s.zoomByUser, [userKey]: normalizeZoom(percent) },
      })),
      setTheme: (theme) => set({ theme, themeAuto: false }),
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    {
      name: "workspace-preferences-v1",
      // v2: o tema padrão do app passou a ser o claro; quem já tinha o escuro salvo (mesmo sem nunca ter escolhido) começa no claro e pode trocar em Configurações.
      version: 2,
      migrate: (salvo, versao) => (versao < 2 ? { ...(salvo as object), theme: "light", themeAuto: false } : salvo) as never,
    },
  ),
);
export const useServers = create<{
  config: ServerConfig;
  ready: boolean;
  load: () => Promise<void>;
  save: (config: ServerConfig) => Promise<void>;
}>((set) => ({
  config: defaultConfig,
  ready: false,
  load: async () => {
    const config = window.desktop
      ? await window.desktop.getConfig()
      : validateConfig(
          JSON.parse(
            localStorage.getItem("workspace-servers-v1") ||
              JSON.stringify(defaultConfig),
          ),
        );
    set({ config, ready: true });
  },
  save: async (input) => {
    const config = validateConfig(input);
    if (window.desktop) await window.desktop.saveConfig(config);
    else localStorage.setItem("workspace-servers-v1", JSON.stringify(config));
    set({ config });
  },
}));
export type Notice = {
  id: string;
  title: string;
  body: string;
  target: string;
  time: string;
  read: boolean;
};
export const useNotices = create<{
  items: Notice[];
  add: (notice: Omit<Notice, "read">) => void;
  readAll: () => void;
  clear: () => void;
}>((set) => ({
  items: [],
  add: (n) =>
    set((s) =>
      s.items.some((v) => v.id === n.id)
        ? s
        : { items: [{ ...n, read: false }, ...s.items].slice(0, 100) },
    ),
  readAll: () =>
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
  clear: () => set({ items: [] }),
}));
