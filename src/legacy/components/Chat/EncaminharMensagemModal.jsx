import { useMemo, useState } from 'react';
import { Check, Search, Send, Users, X } from 'lucide-react';
import api from '../../services/api';
import { useChatData, groupsFrom } from '../../../services/data';

const MAX_DESTINOS = 10;

const resumo = (msg) => {
  if (msg.tipo_mensagem === 'sticker') return 'Figurinha';
  if (msg.tipo_mensagem === 'imagem') return '📷 Imagem';
  if (msg.tipo_mensagem === 'audio') return '🎵 Áudio';
  if (msg.tipo_mensagem === 'arquivo') return `📎 ${msg.anexo_nome || 'Arquivo'}`;
  return String(msg.mensagem || '').slice(0, 160);
};

/**
 * Encaminha uma mensagem (minha ou de outra pessoa) para vários contatos e grupos.
 * Anexos reaproveitam o arquivo já enviado; figurinhas dependem de estarem na biblioteca de quem encaminha.
 */
export default function EncaminharMensagemModal({ mensagem, usuarioAtual, token, socket, onClose }) {
  const { contacts, groups } = useChatData();
  const [busca, setBusca] = useState('');
  const [escolhidos, setEscolhidos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [falhas, setFalhas] = useState([]);

  const destinos = useMemo(() => {
    const pessoas = (contacts.data || [])
      .filter((c) => Number(c.id) !== Number(usuarioAtual?.id))
      .map((c) => ({ chave: `u:${c.id}`, tipo: 'direct', id: c.id, nome: c.nome, detalhe: c.email || '' }));
    const grupos = groupsFrom(groups.data)
      .filter((g) => g.tem_acesso !== false)
      .map((g) => ({ chave: `g:${g.id}`, tipo: 'group', id: g.id, nome: g.nome, detalhe: 'Grupo' }));
    const termo = busca.trim().toLowerCase();
    return [...pessoas, ...grupos]
      .filter((d) => !termo || `${d.nome} ${d.detalhe}`.toLowerCase().includes(termo))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { sensitivity: 'base' }));
  }, [contacts.data, groups.data, busca, usuarioAtual?.id]);

  const alternar = (d) =>
    setEscolhidos((atual) => {
      if (atual.some((x) => x.chave === d.chave)) return atual.filter((x) => x.chave !== d.chave);
      return atual.length >= MAX_DESTINOS ? atual : [...atual, d];
    });

  const corpo = {
    mensagem: mensagem.mensagem,
    tipo_mensagem: mensagem.tipo_mensagem || 'texto',
    anexo_nome: mensagem.anexo_nome || null,
    anexo_mime: mensagem.anexo_mime || null,
    sticker_id: mensagem.tipo_mensagem === 'sticker' ? mensagem.sticker_id || null : null,
  };

  const enviarPara = async (d) => {
    const headers = { Authorization: `Bearer ${token}` };
    if (d.tipo === 'direct') {
      const { data } = await api.post('/chat/enviar-direto', { usuario_id: d.id, ...corpo }, { headers });
      socket?.emit('send_direct_message', {
        id: data.id,
        remetente_id: usuarioAtual.id,
        usuario_id: d.id,
        conversa_id: data.conversa_id,
        mensagem: data.mensagem || corpo.mensagem,
        tipo_mensagem: data.tipo_mensagem || corpo.tipo_mensagem,
        anexo_nome: data.anexo_nome ?? corpo.anexo_nome,
        anexo_mime: data.anexo_mime ?? corpo.anexo_mime,
        sticker_id: data.sticker_id || corpo.sticker_id || null,
        remetente_nome: usuarioAtual.nome,
        remetente_avatar: usuarioAtual.avatar,
        criada_em: data.criada_em,
      });
    } else {
      const { data } = await api.post('/chat/enviar-grupo', { grupo_id: d.id, ...corpo }, { headers });
      socket?.emit('send_group_message', {
        id: data.id,
        remetente_id: usuarioAtual.id,
        grupo_id: d.id,
        grupo_nome: d.nome,
        mensagem: data.mensagem || corpo.mensagem,
        tipo_mensagem: data.tipo_mensagem || corpo.tipo_mensagem,
        anexo_nome: data.anexo_nome ?? corpo.anexo_nome,
        anexo_mime: data.anexo_mime ?? corpo.anexo_mime,
        sticker_id: data.sticker_id || corpo.sticker_id || null,
        mencoes: data.mencoes || [],
        remetente_nome: usuarioAtual.nome,
        remetente_avatar: usuarioAtual.avatar,
        criada_em: data.criada_em,
      });
    }
  };

  const encaminhar = async () => {
    if (!escolhidos.length || enviando) return;
    setEnviando(true);
    const erros = [];
    for (const d of escolhidos) {
      try {
        await enviarPara(d);
      } catch (err) {
        erros.push(`${d.nome}: ${err?.response?.data?.error || 'não foi possível enviar'}`);
      }
    }
    setEnviando(false);
    if (!erros.length) return onClose(true);
    setFalhas(erros);
    // Mantém só quem falhou, para tentar de novo sem duplicar os que já receberam.
    setEscolhidos((atual) => atual.filter((d) => erros.some((e) => e.startsWith(`${d.nome}:`))));
  };

  return (
    <div className="encaminhar-fundo" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="encaminhar" role="dialog" aria-modal="true" aria-label="Encaminhar mensagem">
        <header>
          <h2>Encaminhar mensagem</h2>
          <button type="button" aria-label="Fechar" onClick={() => onClose(false)}><X size={18} /></button>
        </header>
        <p className="encaminhar-previa">{resumo(mensagem)}</p>
        <label className="encaminhar-busca">
          <Search size={15} />
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou grupo" />
        </label>
        <ul className="encaminhar-lista">
          {contacts.isLoading && <li className="encaminhar-vazio">Carregando…</li>}
          {!contacts.isLoading && !destinos.length && <li className="encaminhar-vazio">Ninguém encontrado.</li>}
          {destinos.map((d) => {
            const on = escolhidos.some((x) => x.chave === d.chave);
            return (
              <li key={d.chave}>
                <button type="button" className={on ? 'on' : ''} onClick={() => alternar(d)} aria-pressed={on}>
                  <span className={`encaminhar-avatar ${d.tipo === 'group' ? 'grupo' : ''}`}>
                    {d.tipo === 'group' ? <Users size={15} /> : String(d.nome || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="encaminhar-nome">
                    <strong>{d.nome}</strong>
                    <small>{d.detalhe}</small>
                  </span>
                  {on && <Check size={16} />}
                </button>
              </li>
            );
          })}
        </ul>
        {falhas.length > 0 && (
          <div className="encaminhar-erro" role="alert">
            Não enviado para: {falhas.join(' · ')}
          </div>
        )}
        <footer>
          <span>{escolhidos.length ? `${escolhidos.length} selecionado(s) (máx. ${MAX_DESTINOS})` : 'Escolha para quem enviar'}</span>
          <button type="button" className="encaminhar-enviar" disabled={!escolhidos.length || enviando} onClick={encaminhar}>
            <Send size={15} /> {enviando ? 'Enviando…' : 'Encaminhar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
