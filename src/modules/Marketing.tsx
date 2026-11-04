import { useState } from "react";
import { clsx } from "clsx";
import { Camera, Globe, LayoutDashboard, Megaphone, MessageCircle, Search, ThumbsUp, Video } from "lucide-react";
import { EmptyState, PageHeader } from "../components/ui/primitives";
import SiteDashboard from "./marketing/SiteDashboard";
import "./marketing/marketing.css";

const ABAS = [
  { id: "resumo", label: "Resumo", icon: LayoutDashboard, texto: "Aqui ficará o resumo geral do marketing: alcance, seguidores, visitas e campanhas em andamento." },
  { id: "site", label: "Site", icon: Globe, texto: "Números do site da AcessaNet." },
  { id: "instagram", label: "Instagram", icon: Camera, texto: "Aqui ficarão as publicações, seguidores e resultados do Instagram." },
  { id: "facebook", label: "Facebook", icon: ThumbsUp, texto: "Aqui ficarão as publicações e os resultados do Facebook." },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, texto: "Aqui ficarão as campanhas e os contatos vindos do WhatsApp." },
  { id: "google", label: "Google", icon: Search, texto: "Aqui ficarão os anúncios e a presença no Google (Meu Negócio e pesquisas)." },
  { id: "youtube", label: "YouTube", icon: Video, texto: "Aqui ficarão os vídeos e os resultados do canal no YouTube." },
] as const;

export default function Marketing() {
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("resumo");
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];
  return (
    <div className="page marketing-page">
      <PageHeader icon={Megaphone} title="Marketing" description="Acompanhe o site e as redes sociais da empresa." />
      <div className="marketing-abas" role="tablist" aria-label="Marketing">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            className={clsx("marketing-aba", aba === a.id && "on")}
            onClick={() => setAba(a.id)}
          >
            <a.icon size={15} />
            {a.label}
          </button>
        ))}
      </div>
      {aba === "site" ? (
        <section role="tabpanel" aria-label="Site"><SiteDashboard /></section>
      ) : (
        <section className="panel marketing-conteudo" role="tabpanel">
          <EmptyState icon={atual.icon} title={atual.label}>
            {atual.texto} Em breve.
          </EmptyState>
        </section>
      )}
    </div>
  );
}
