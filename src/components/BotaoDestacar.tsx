import { ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { MINIAPPS, destacar, podeDestacar, type JanelaKind } from "../services/janelaDestacada";

/** Abre o módulo numa janela própria (redimensionável, pode ir para outro monitor). Some na janela destacada. */
export default function BotaoDestacar({ kind }: { kind: JanelaKind }) {
  if (!podeDestacar()) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => destacar(kind)}
      title={`Abre ${MINIAPPS[kind].titulo} em uma janela separada, que pode ficar em outro monitor`}
    >
      <ExternalLink size={15} /> Destacar
    </Button>
  );
}
