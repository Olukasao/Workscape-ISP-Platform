// Respostas que o Assistente dá sozinho, sem consultar nenhuma IA: instantâneas e sempre iguais.

export type ImagemFixa = "harry404" | "ednesio";

export interface RespostaFixa {
  content: string;
  /** Chave de uma imagem do app (a conversa guarda só a chave, não a imagem). */
  imagem: ImagemFixa;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FALA_DA_AGENDA = /\bagenda\b/;
const PROBLEMA = /offline|off-line|fora do ar|fora\b|caiu|caida|cair|derrub|travou|travad|parou|parad|quebr|bug|lent[ao]\b|erro|indisponivel|instavel|sem acesso|nao (esta |ta |tah )?(funcion|abr|carreg|respond|aparec|atualiz|entr|acess|vai|da)|n[aã]o ta|nao funciona|funcionando\?|ta (ok|funcionando|no ar|de pe)|esta (ok|funcionando|no ar)/;

const FALA_DE_TECLADO = /\bteclad/;
const BARULHO = /barulh|ruid|alto\b|escandalos|som\b|faz mais/;

/** Pergunta se a agenda está fora do ar ou com problema? A resposta é sempre a mesma: foi o Harry. */
export function respostaFixa(pergunta: string): RespostaFixa | null {
  const t = semAcento(pergunta);
  if (FALA_DE_TECLADO.test(t) && BARULHO.test(t)) return { content: "É do Ed, o Tecladista. ⌨️", imagem: "ednesio" };
  if (!FALA_DA_AGENDA.test(t) || !PROBLEMA.test(t)) return null;
  return { content: "Foi o Harry que derrubou a agenda. 🫠", imagem: "harry404" };
}
