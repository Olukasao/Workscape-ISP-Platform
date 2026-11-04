import { LoaderCircle, Mic, Square } from "lucide-react";
import { clsx } from "clsx";
import { useAssistenteInternet } from "../services/assistenteNet";
import { ditadoDisponivel, useDitado } from "../services/ditado";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Botão de microfone: clique, fale e clique de novo; o texto falado vai para `aoTexto`.
 * Some quando a IA não está configurada ou o computador não tem como gravar.
 */
export default function BotaoDitado({ aoTexto, className, disabled }: { aoTexto: (texto: string) => void; className?: string; disabled?: boolean }) {
  const status = useAssistenteInternet();
  const { estado, segundos, erro, limparErro, alternar, cancelar } = useDitado({ aoTexto });
  if (status.data?.configurada !== true || !ditadoDisponivel()) return null;
  const gravando = estado === "gravando";
  const trabalhando = estado === "transcrevendo";
  return (
    <span className={clsx("ditado", className)}>
      <button
        type="button"
        className={clsx("ditado-botao", gravando && "gravando")}
        onClick={alternar}
        onKeyDown={(e) => { if (e.key === "Escape" && gravando) { e.stopPropagation(); cancelar(); } }}
        disabled={disabled || trabalhando}
        aria-pressed={gravando}
        aria-label={gravando ? "Parar de gravar" : trabalhando ? "Transcrevendo" : "Ditar por voz"}
        title={gravando ? "Clique para parar (Esc cancela)" : "Fale em vez de digitar. Não diga CPF, telefone nem senhas de clientes."}
      >
        {trabalhando ? <LoaderCircle size={16} className="girando" aria-hidden="true" /> : gravando ? <Square size={14} aria-hidden="true" fill="currentColor" /> : <Mic size={16} aria-hidden="true" />}
        {gravando ? <span className="ditado-tempo" aria-live="off">{mmss(segundos)}</span> : null}
        {trabalhando ? <span className="ditado-tempo">Transcrevendo…</span> : null}
      </button>
      {erro ? <span className="ditado-erro" role="alert" onClick={limparErro}>{erro}</span> : null}
    </span>
  );
}
