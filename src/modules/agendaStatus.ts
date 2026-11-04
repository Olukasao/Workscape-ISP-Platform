import type { Tone } from "../components/ui/primitives";

const plain = (s?: string) =>
  (s || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Cor semântica do status de uma OS. Os textos vêm do SGP/agenda original
 * (aberta, pendente, em execução, em andamento, finalizada, encerrada,
 * concluída, cancelada); a interface só traduz o texto em tom visual.
 */
export function orderTone(status?: string): Tone {
  const s = plain(status);
  if (!s) return "neutral";
  if (/cancel|recus|rejeit|improdut/.test(s)) return "crit";
  if (/finaliz|encerr|conclu|resolvid|fechad/.test(s)) return "ok";
  if (/execu|andamento|desloc|iniciad|check/.test(s)) return "live";
  if (/paus|pendenc|aguard|reagend/.test(s)) return "warn";
  if (/abert|pendente|agend|nova/.test(s)) return "info";
  return "neutral";
}

export const toneLegend: [Tone, string][] = [
  ["info", "Aberta"],
  ["live", "Em execução"],
  ["warn", "Pausada ou aguardando"],
  ["ok", "Concluída"],
  ["crit", "Cancelada"],
];
