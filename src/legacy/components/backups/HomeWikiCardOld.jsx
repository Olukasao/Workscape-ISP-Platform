import './HomeWikiCardOld.css';

// BACKUP VISUAL ANTIGO - WIKI INTERNA DA HOME OFICIAL
export default function HomeWikiCardOld({ onOpen }) {
  return (
    <button
      type="button"
      className="chat-home-mini-card chat-home-mini-card-wiki stagger-item"
      onClick={onOpen}
      title="Abrir wiki interna"
    >
      <div className="chat-home-mini-icon">📚</div>
      <div>
        <strong>
          Wiki interna
          <span>Treinamento</span>
        </strong>
        <p>
          Tutoriais, dicas de sistema, vendas e informações para novos funcionários.
        </p>
      </div>
      <span className="chat-home-mini-arrow">→</span>
      <div className="chat-home-wiki-bg">?</div>
    </button>
  );
}
