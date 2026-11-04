import { livePreview } from "../services/live";

export default function LiveEnvironment() {
  if (!livePreview) return null;
  return <aside className="live-environment" aria-label="Ambiente de teste em tempo real">
    <strong>TESTE EM TEMPO REAL</strong>
    <span>Salvar o código atualiza esta tela. Os serviços e dados são reais.</span>
    <a href="/__workspace/status" target="_blank" rel="noreferrer">Estado do servidor</a>
  </aside>;
}
