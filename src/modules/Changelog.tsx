import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { changelog } from "../changelog";
import { Badge, PageHeader } from "../components/ui/primitives";

const dia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));

export default function Changelog() {
  const [instalada, setInstalada] = useState("");
  useEffect(() => {
    void window.desktop?.updateStatus().then((s) => setInstalada(s.currentVersion)).catch(() => undefined);
  }, []);
  return (
    <div className="page changelog-page">
      <PageHeader
        icon={ScrollText}
        title="Changelog"
        description="O que mudou no Acessa Workspace em cada atualização."
        meta={instalada ? <span className="heading-meta">Versão instalada: {instalada}</span> : undefined}
      />
      <ol className="changelog-list">
        {changelog.map((e) => (
          <li key={e.versao} className="panel changelog-entry">
            <header>
              <h2>Versão {e.versao}</h2>
              {instalada === e.versao ? <Badge tone="ok">Instalada</Badge> : null}
              <time dateTime={e.data}>{dia(e.data)}</time>
            </header>
            <ul>
              {e.itens.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="changelog-assinatura">Lucas Soares</p>
          </li>
        ))}
      </ol>
      <p className="data-footnote">
        Procurando as novidades antigas da intranet? <Link to="/changelog-intranet">Abrir o histórico da intranet</Link>.
      </p>
    </div>
  );
}
