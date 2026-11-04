import { useDashboard, reconectarDashboard } from "../services/dashboard";
import { useServers } from "../stores/workspace";
import { livePreview } from "../services/live";
import { Button } from "./ui/button";

export default function DashboardConnection() {
  const { diagnostics, connected, status, detail, snapshot, customersUpdated } = useDashboard();
  const origin = useServers((s) => s.config.dashboard);
  return (
    <details className="panel dashboard-connection">
      <summary>Diagnóstico da conexão · {connected ? "conectado" : status}</summary>
      <dl>
        <div><dt>Servidor do dashboard</dt><dd>{diagnostics?.origin || origin}</dd></div>
        {diagnostics?.sourceOrigin ? <div><dt>Fonte no servidor</dt><dd>{diagnostics.sourceOrigin}</dd></div> : null}
        <div><dt>Ambiente</dt><dd>{window.desktop ? "Aplicativo desktop" : livePreview ? "Teste em tempo real" : "Navegador"}</dd></div>
        <div><dt>Transporte</dt><dd>{diagnostics?.transport || "Socket.IO"}</dd></div>
        <div><dt>Indicadores recebidos</dt><dd>{snapshot ? new Date(snapshot.updated).toLocaleString("pt-BR") : "Nenhuma resposta recebida"}</dd></div>
        <div><dt>Base de clientes</dt><dd>{customersUpdated ? new Date(customersUpdated).toLocaleString("pt-BR") : "Aguardando o ciclo de até 3 minutos"}</dd></div>
        <div><dt>Último erro</dt><dd>{diagnostics?.lastError || detail || "Nenhum erro informado"}</dd></div>
      </dl>
      <Button size="sm" variant="outline" onClick={reconectarDashboard}>Reconectar dashboard</Button>
      <p className="muted">No desktop corporativo, os dados passam pelo serviço do Chat Interno. A conexão com a porta 5000 é feita dentro do servidor.</p>
    </details>
  );
}
