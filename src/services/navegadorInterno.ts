import type { BrowserSite } from "../../electron/browserTabs";

/** Pede ao Navegador do Workspace que mude para um site (a tela escuta este evento e troca a aba). */
export const EVENTO_SITE_NAVEGADOR = "workspace:navegador-site";

/**
 * Abre uma página do SGP dentro do próprio Workspace (Navegador > SGP). Fora do app Windows, ou se algo falhar,
 * cai no comportamento antigo: abre no navegador do computador.
 */
export async function abrirSgpNoWorkspace(url: string, navigate: (caminho: string) => void) {
  const desktop = window.desktop;
  if (!desktop) return;
  try {
    await desktop.browserOpenSgp(url);
    window.dispatchEvent(new CustomEvent<BrowserSite>(EVENTO_SITE_NAVEGADOR, { detail: "sgp" }));
    navigate("/navegador");
  } catch {
    await desktop.openSgpLink(url);
  }
}
