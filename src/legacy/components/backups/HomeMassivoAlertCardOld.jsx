import './HomeMassivoAlertCardOld.css';

// BACKUP VISUAL ANTIGO - ALERTAS/MASSIVOS DA HOME OFICIAL
export default function HomeMassivoAlertCardOld({
  conectado,
  massivos = [],
  onOpen,
}) {
  const total = massivos.reduce(
    (soma, massivo) => soma + Number(massivo.total || 0),
    0
  );
  const temMassivo = total > 0;
  const resumo = massivos
    .map((massivo) => `${massivo.label} (${massivo.total})`)
    .join(', ');

  return (
    <button
      type="button"
      className={`chat-home-mini-card chat-home-mini-card-warning ${
        temMassivo ? 'chat-home-mini-card-warning-active massivo-ativo' : ''
      } stagger-item`}
      onClick={onOpen}
      title={temMassivo ? `Massivos: ${resumo}` : 'Abrir alertas'}
    >
      <div className="chat-home-mini-icon chat-home-alert-icon">⚡</div>
      <div className="chat-home-alert-copy">
        <div className="chat-home-alert-title-row">
          <strong>Alertas</strong>
          {temMassivo && (
            <span className="chat-home-alert-count-badge">
              {total} massivo(s)
            </span>
          )}
        </div>

        {temMassivo ? (
          <div className="chat-home-alert-message">
            <span className="chat-home-alert-caption">
              Massivo ativo no dashboard
            </span>
            <div className="chat-home-alert-tags">
              {massivos.map((massivo) => (
                <span key={massivo.id} className="chat-home-alert-tag">
                  {massivo.label}
                  <strong>{massivo.total}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="chat-home-alert-message">
            {conectado ? (
              'Nenhum alerta crítico no momento.'
            ) : (
              <>
                Nenhum alerta crítico no momento.
                <span className="chat-home-alert-status">
                  Dashboard de alertas desconectado.
                </span>
              </>
            )}
          </p>
        )}
      </div>
      <span className="chat-home-mini-arrow">→</span>
      <div className="chat-home-alert-glow">
        <span />
        <span />
        <span />
      </div>
    </button>
  );
}
