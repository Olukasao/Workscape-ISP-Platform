import { useEffect, useRef, useState } from 'react';
import { Sparkles, LoaderCircle } from 'lucide-react';
import styles from '../../styles/Chat.module.css';
import { localAiCompletar, localAiDisponivel, descreverStatusLocalAi, onLocalAiStatus } from '../../../services/localAi';

// Ajuda da IA local no chat interno: resumir a conversa, reescrever o
// rascunho ou sugerir uma resposta. Roda no próprio PC; nada sai dele.
// Some sozinho se o recurso não existir (web, ou app sem RAM suficiente).
export default function AssistenteIaButton({ getRascunho, setRascunho, getConversaTexto, disabled = false }) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null); // { texto, usar }
  const [statusTexto, setStatusTexto] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fecharAoClicarFora = (event) => {
      if (wrapperRef.current?.contains(event.target)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', fecharAoClicarFora);
    return () => document.removeEventListener('mousedown', fecharAoClicarFora);
  }, [aberto]);

  // Enquanto processa, mostra o andamento real (ex.: baixando o modelo na
  // primeira vez) em vez de deixar parecer que travou.
  useEffect(() => {
    if (!carregando) { setStatusTexto(''); return undefined; }
    return onLocalAiStatus((status) => setStatusTexto(descreverStatusLocalAi(status)));
  }, [carregando]);

  if (!localAiDisponivel()) return null;

  const executar = async (task, usarComoRascunho) => {
    setErro('');
    setResultado(null);
    const texto = task === 'chat-reescrever' ? getRascunho() : getConversaTexto();
    if (!texto || !texto.trim()) {
      setErro('Nada para processar ainda.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await localAiCompletar(task, texto);
      if (usarComoRascunho) {
        setRascunho(resposta);
        setAberto(false);
      } else {
        setResultado({ texto: resposta, usar: task === 'chat-sugerir' });
      }
    } catch (erroChamada) {
      setErro(erroChamada?.message || 'Não foi possível concluir. Pode ser a primeira vez (baixando o modelo) — tente de novo em instantes.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={styles.emojiPickerWrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.attachButton}
        title="Ajuda da IA (local, sem sair do computador)"
        onClick={() => setAberto((atual) => !atual)}
        disabled={disabled}
      >
        {carregando ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
      </button>
      {aberto && (
        <div className={styles.iaAssistantPopover}>
          <button type="button" className={styles.iaAssistantOption} disabled={carregando} onClick={() => executar('chat-reescrever', true)}>
            Reescrever meu rascunho
          </button>
          <button type="button" className={styles.iaAssistantOption} disabled={carregando} onClick={() => executar('chat-sugerir', false)}>
            Sugerir uma resposta
          </button>
          <button type="button" className={styles.iaAssistantOption} disabled={carregando} onClick={() => executar('chat-resumir', false)}>
            Resumir esta conversa
          </button>
          <div className={styles.iaAssistantNote}>
            {carregando && statusTexto ? statusTexto : 'IA local: processa só neste computador. Na primeira vez pode levar alguns minutos para baixar o modelo.'}
          </div>
          {erro && <div className={styles.iaAssistantNote}>{erro}</div>}
          {resultado && (
            <>
              <div className={styles.iaAssistantResult}>{resultado.texto}</div>
              <div className={styles.iaAssistantResultActions}>
                {resultado.usar && (
                  <button type="button" className={styles.iaAssistantOption} onClick={() => { setRascunho(resultado.texto); setAberto(false); }}>
                    Usar como resposta
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
