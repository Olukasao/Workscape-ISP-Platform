const EXTENSAO = /\.[A-Za-z0-9]{1,5}$/;

/** Nome para salvar: garante a extensão (.png, .jpg...) tirada do endereço do arquivo quando o nome não a tem. */
export function nomeComExtensao(nome, url = '') {
  let base = String(nome || '').trim().replace(/[\\/:*?"<>|]+/g, '_');
  let ext = '';
  try { ext = (new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost/').pathname.match(EXTENSAO) || [''])[0].toLowerCase(); } catch { /* sem endereço válido */ }
  const atual = (base.match(EXTENSAO) || [''])[0];
  const semExt = (atual ? base.slice(0, -atual.length) : base).trim();
  if (!semExt) base = `imagem${atual || ext}`;
  else if (!atual && ext) base = `${semExt}${ext}`;
  return base;
}

export default async function baixarArquivo(url, nomeArquivo = 'arquivo') {
  const nome = nomeComExtensao(nomeArquivo || 'arquivo', url);
  if(window.desktop){
    try{return await window.desktop.download({url,name:nome,token:sessionStorage.getItem('token') || undefined});}
    catch(error){window.alert(error.message || 'Não foi possível baixar o arquivo.');return;}
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);

    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

/** Copia a imagem para a área de transferência (como PNG), para colar no chat, no Word ou onde quiser. */
export async function copiarImagem(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Não foi possível carregar a imagem.');
  const bitmap = await createImageBitmap(await resposta.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('Não foi possível preparar a imagem.');
  if (window.desktop?.copyImage) {
    await window.desktop.copyImage(new Uint8Array(await png.arrayBuffer()));
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
