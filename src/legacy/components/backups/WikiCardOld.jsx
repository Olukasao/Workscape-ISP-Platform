import { ArrowRight, Goal } from 'lucide-react';
import './WikiCardOld.css';

// BACKUP VISUAL ANTIGO - WIKI INTERNA
function TacticalBoardOld() {
  return (
    <div className="cupTacticalBoard" aria-hidden="true">
      <span className="cupTacticLine cupTacticLine--one" />
      <span className="cupTacticLine cupTacticLine--two" />
      <b className="cupTacticX cupTacticX--one">×</b>
      <b className="cupTacticX cupTacticX--two">×</b>
      <i className="cupTacticO cupTacticO--one" />
      <i className="cupTacticO cupTacticO--two" />
      <Goal size={52} />
    </div>
  );
}

export default function WikiCardOld({ onOpen }) {
  return (
    <button type="button" className="cupWikiCard" onClick={onOpen}>
      <span className="cupWikiIcon">
        <Goal size={28} />
      </span>
      <span className="cupWikiCopy">
        <span className="cupInfoTitleRow">
          <strong>Wiki interna</strong>
          <em>Playbook</em>
        </span>
        <small>
          Tutoriais, dicas de sistema, vendas e
          informações para novos funcionários.
        </small>
        <b>
          Acessar agora
          <ArrowRight size={15} />
        </b>
      </span>
      <TacticalBoardOld />
    </button>
  );
}
