const CAMINHO_FIGURINHA = /^(?:https?:\/\/[^\s/]+)?\/uploads\/stickers\/\S+\.webp$/i;

// Se o tipo da mensagem se perdeu pelo caminho (chegou como "texto"), mas o conteúdo é o
// endereço de uma figurinha, trata como figurinha para a imagem aparecer.
export const corrigirTipoFigurinha = (item) => {
  if (!item || item.tipo_mensagem === 'sticker') return item;
  if (item.tipo_mensagem && item.tipo_mensagem !== 'texto') return item;
  if (!CAMINHO_FIGURINHA.test(String(item.mensagem || '').trim())) return item;
  return { ...item, mensagem: String(item.mensagem).trim(), tipo_mensagem: 'sticker', anexo_mime: item.anexo_mime || 'image/webp' };
};
