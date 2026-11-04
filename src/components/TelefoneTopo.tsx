import { Phone } from "lucide-react";
import { clsx } from "clsx";
import { usePerdidasNovas, usePhone } from "../stores/phone";
import { useTelefone } from "../stores/telefone";

const SITUACAO: Record<string, string> = {
  registrado: "conectado", registrando: "conectando…", recusado: "ramal recusado", falhou: "sem conexão", desconectado: "desconectado",
};

/** Atalho do telefone na barra do topo: abre e fecha o cartão, mostra a situação do ramal e as perdidas, e chama a atenção quando tocam. */
export default function TelefoneTopo() {
  const aberto = useTelefone((s) => s.aberto);
  const abrir = useTelefone((s) => s.abrir);
  const fechar = useTelefone((s) => s.fechar);
  const temRamal = usePhone((s) => s.temRamal);
  const erro = usePhone((s) => s.erro);
  const registro = usePhone((s) => s.snapshot.registro);
  const ramal = usePhone((s) => s.snapshot.ramal);
  const naoPerturbe = usePhone((s) => s.snapshot.naoPerturbe);
  const tocando = usePhone((s) => s.snapshot.chamadas.some((c) => c.direcao === "in" && c.estado === "tocando"));
  const emChamada = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando"));
  const perdidas = usePerdidasNovas();
  // Quem não tem ramal cadastrado não vê o botão; se houve erro de conexão, ele aparece para explicar o motivo.
  if (!temRamal && !erro) return null;

  const tom = registro === "registrado" ? (naoPerturbe ? "dnd" : "ok") : registro === "registrando" ? "aviso" : "erro";
  const texto = tocando ? "Chamada recebida" : emChamada ? "Em chamada" : naoPerturbe && registro === "registrado" ? "Não perturbe ligado" : (SITUACAO[registro] ?? "");
  const titulo = `Workscape Phone${ramal ? ` · Ramal ${ramal}` : ""} · ${texto}${perdidas ? ` · ${perdidas} ${perdidas === 1 ? "perdida" : "perdidas"}` : ""}`;
  return (
    <button
      type="button"
      className={clsx("icon-button telefone-topo", tocando && "tocando", emChamada && "em-chamada", aberto && "ativo")}
      aria-label={titulo}
      aria-pressed={aberto}
      title={titulo}
      onClick={() => (aberto ? fechar() : abrir())}
    >
      <Phone size={17} strokeWidth={1.8} aria-hidden="true" />
      <span className={`telefone-topo-ponto telefone-topo-${tom}`} aria-hidden="true" />
      {perdidas > 0 ? <span className="telefone-topo-contador" aria-hidden="true">{perdidas > 9 ? "9+" : perdidas}</span> : null}
    </button>
  );
}
