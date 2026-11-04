import { sgpReportKey, type SgpReportKey } from "../../electron/sgpReports";

// Cartões do Painel NOC que abrem o relatório correspondente no SGP (só no aplicativo desktop).
export function relatorioSgp(rotulo: string): SgpReportKey | null {
  return window.desktop ? sgpReportKey(rotulo) : null;
}

export function abrirRelatorioSgp(chave: SgpReportKey) {
  void window.desktop?.openExternal(chave);
}

// Atributos para tornar um cartão clicável e acessível pelo teclado.
export function propsRelatorio(rotulo: string, chaveFixa?: SgpReportKey) {
  const chave = chaveFixa || relatorioSgp(rotulo);
  if (!chave) return {};
  return {
    role: "link" as const,
    tabIndex: 0,
    className: "sgp-link",
    title: "Abrir relatório no SGP",
    "aria-label": `Abrir relatório ${rotulo} no SGP`,
    onClick: () => abrirRelatorioSgp(chave),
    onKeyDown: (e: { key: string; preventDefault(): void }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrirRelatorioSgp(chave);
      }
    },
  };
}
