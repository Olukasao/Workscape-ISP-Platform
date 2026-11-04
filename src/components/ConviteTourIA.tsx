import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSession } from "../stores/workspace";
import { useAssistenteInternet } from "../services/assistenteNet";
import { jaViu, useTour } from "../tour/tour";
import { passosTourIA, TOUR_IA } from "../tour/passosIA";

/** Convite para quem ainda não fez o tour da IA (obrigatório: não tem "agora não"). Fica sob qualquer aviso obrigatório. */
export default function ConviteTourIA() {
  const usuario = useSession((s) => s.user);
  const status = useAssistenteInternet();
  const iniciar = useTour((s) => s.iniciar);
  const ativo = useTour((s) => !!s.ativo);
  const [aberto, setAberto] = useState(false);
  const elegivel = !!usuario && status.data?.configurada === true && !jaViu(TOUR_IA, usuario.id, "convite") && !jaViu(TOUR_IA, usuario.id, "visto");

  useEffect(() => {
    if (!elegivel) return;
    const t = window.setTimeout(() => setAberto(true), 6000);
    return () => window.clearTimeout(t);
  }, [elegivel]);

  if (!aberto || !usuario || ativo) return null;
  const dispensar = () => { setAberto(false); };
  return (
    <aside className="tour-convite" role="complementary" aria-label="Convite para o tour da inteligência artificial">
      <span className="tour-convite-icone" aria-hidden="true"><Sparkles size={20} /></span>
      <div>
        <strong>Novo: Inteligência Artificial no Workspace</strong>
        <p>Faça o tour de 1 minuto para ver como usar.</p>
        <div className="tour-convite-acoes">
          <button type="button" className="tour-proximo" onClick={() => { dispensar(); iniciar(TOUR_IA, passosTourIA); }}>Fazer o tour</button>
        </div>
      </div>
    </aside>
  );
}
