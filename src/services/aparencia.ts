import { useEffect } from "react";
import { usePreferences } from "../stores/workspace";

export interface Destaque {
  id: string;
  nome: string;
  cor: string;
}
/** O primeiro é o azul da marca (padrão); os outros trocam a cor de destaque do app inteiro. */
export const DESTAQUES: Destaque[] = [
  { id: "azul", nome: "Azul", cor: "#2f6bff" },
  { id: "violeta", nome: "Violeta", cor: "#7c5cff" },
  { id: "rosa", nome: "Rosa", cor: "#e0479e" },
  { id: "vermelho", nome: "Vermelho", cor: "#e5484d" },
  { id: "laranja", nome: "Laranja", cor: "#e8801a" },
  { id: "verde", nome: "Verde", cor: "#17b26a" },
  { id: "turquesa", nome: "Turquesa", cor: "#14a8b8" },
];
export const COR_PADRAO = DESTAQUES[0].cor;

export type FundoEscuro = "marinho" | "grafite" | "preto";
export const FUNDOS: { id: FundoEscuro; nome: string; amostra: string }[] = [
  { id: "marinho", nome: "Azul-marinho", amostra: "#0b1430" },
  { id: "grafite", nome: "Grafite", amostra: "#1a1c21" },
  { id: "preto", nome: "Preto", amostra: "#0a0a0c" },
];
const SUPERFICIES: Record<Exclude<FundoEscuro, "marinho">, Record<string, string>> = {
  grafite: {
    "--canvas": "#121316",
    "--surface": "#1a1c21",
    "--surface-2": "#1f2229",
    "--surface-3": "#272b34",
    "--surface-sunken": "#0f1013",
    "--line": "rgba(255, 255, 255, 0.09)",
    "--line-strong": "rgba(255, 255, 255, 0.17)",
    "--rail-bg": "linear-gradient(180deg, #15161a 0%, #0d0e10 100%)",
  },
  preto: {
    "--canvas": "#000000",
    "--surface": "#0a0a0c",
    "--surface-2": "#101114",
    "--surface-3": "#17181c",
    "--surface-sunken": "#000000",
    "--line": "rgba(255, 255, 255, 0.08)",
    "--line-strong": "rgba(255, 255, 255, 0.16)",
    "--rail-bg": "#000000",
  },
};

function hexParaHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s * 100, l * 100];
}
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(Math.min(96, Math.max(6, l)))}%)`;

/** Variáveis de cor derivadas de uma cor de destaque. O brilho é limitado para o texto branco dos botões continuar legível. */
export function variaveisDestaque(hex: string, claro: boolean): Record<string, string> | null {
  const base = hexParaHsl(hex);
  if (!base) return null;
  const [h, s0] = base;
  const s = Math.max(45, s0);
  const l = Math.min(58, Math.max(36, base[2]));
  const forte = hsl(h, s, l);
  return {
    "--blue-300": hsl(h, s, l + 22),
    "--blue-400": hsl(h, s, l + 8),
    "--blue-500": forte,
    "--blue-600": hsl(h, s, l - 10),
    "--primary-soft": `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${claro ? 0.1 : 0.16})`,
    "--info-soft": `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${claro ? 0.1 : 0.15})`,
  };
}

/**
 * Aplica as preferências de aparência ao documento: modo automático (segue o Windows),
 * cor de destaque e fundo do tema escuro. Deve rodar em toda janela do app.
 */
export function useAparencia() {
  const { theme, themeAuto, accent, darkBackground } = usePreferences();
  useEffect(() => {
    if (!themeAuto) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => usePreferences.setState({ theme: mq.matches ? "light" : "dark" });
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [themeAuto]);
  useEffect(() => {
    const el = document.documentElement.style;
    const claro = theme === "light";
    const vars: Record<string, string> = {};
    if (accent && accent.toLowerCase() !== COR_PADRAO) Object.assign(vars, variaveisDestaque(accent, claro));
    if (!claro && darkBackground !== "marinho") Object.assign(vars, SUPERFICIES[darkBackground]);
    const nomes = new Set(["--blue-300", "--blue-400", "--blue-500", "--blue-600", "--primary-soft", "--info-soft", ...Object.values(SUPERFICIES).flatMap((o) => Object.keys(o))]);
    nomes.forEach((n) => (n in vars ? el.setProperty(n, vars[n]) : el.removeProperty(n)));
  }, [theme, accent, darkBackground]);
}
