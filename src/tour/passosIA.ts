import type { PassoTour } from "./tour";

export const TOUR_IA = "ia-v1";

// O tour da inteligência artificial: do menu até as regras de uso. Passos "opcionais" somem sozinhos se o recurso
// não existir para a pessoa (por exemplo, o botão flutuante desligado nas configurações).
export const passosTourIA: PassoTour[] = [
  {
    id: "menu",
    alvo: "nav-assistente",
    titulo: "O Assistente de IA fica aqui",
    texto: "Um novo item no menu lateral. Clique nele quando quiser conversar com a inteligência artificial: ela responde dúvidas de trabalho, redes, atendimento ou qualquer assunto.",
    lado: "direita",
  },
  {
    id: "resumo",
    rota: "/",
    alvo: "home-resumo",
    opcional: true,
    titulo: "Seu resumo do dia, sozinho",
    texto: "Toda vez que você entra, a tela inicial mostra o resumo do seu dia: filas de suporte, alertas e avisos. Dá para pedir o resumo da semana e fechar quando quiser.",
    lado: "baixo",
  },
  {
    id: "bolha",
    rota: "/",
    alvo: "assistente-bolha",
    opcional: true,
    titulo: "Em qualquer tela, um toque",
    texto: "Este botão abre o Assistente por cima do que você está fazendo. Arraste para o canto que preferir. Para esconder, desligue em Configurações.",
    lado: "direita",
  },
  {
    id: "pergunta",
    rota: "/assistente",
    alvo: "assistente-compositor",
    titulo: "Escreva sua pergunta",
    texto: "Digite aqui e aperte Enter. Shift + Enter quebra a linha. Ele lembra do que você já falou na conversa.",
    lado: "cima",
  },
  {
    id: "modelo",
    rota: "/assistente",
    alvo: "assistente-modelo",
    titulo: "Escolha qual IA responde",
    texto: "O modo Automático tenta em ordem até uma responder. Se quiser, escolha um modelo específico para testar qual agrada mais.",
    lado: "cima",
  },
  {
    id: "pesquisar",
    rota: "/assistente",
    alvo: "assistente-pesquisar",
    opcional: true,
    titulo: "Pesquisa na internet",
    texto: "Ligado, ele pesquisa o que você perguntou e mostra de onde veio cada informação. Ótimo para notícias, cotações e dúvidas atuais.",
    lado: "cima",
  },
  {
    id: "workspace",
    rota: "/assistente",
    alvo: "assistente-workspace",
    titulo: "Pergunte sobre o seu trabalho",
    texto: "Com este botão ligado, a IA lê a agenda, os chamados, o painel e a rede, só o que você já pode ver. Pergunte, por exemplo, qual técnico está com mais OS hoje. CPF, telefone e endereço nunca são enviados.",
    lado: "cima",
  },
  {
    id: "anexo",
    rota: "/assistente",
    alvo: "assistente-anexo",
    opcional: true,
    titulo: "Cole um print",
    texto: "Tire uma captura de tela e cole aqui (Ctrl + V). A IA lê a imagem e explica o erro ou a tela.",
    lado: "cima",
  },
  {
    id: "historico",
    rota: "/assistente",
    alvo: "assistente-lateral",
    opcional: true,
    titulo: "Suas conversas ficam salvas",
    texto: "Volte a qualquer conversa anterior, renomeie ou apague. Elas ficam só neste computador.",
    lado: "direita",
  },
  {
    id: "memoria",
    rota: "/assistente",
    alvo: "assistente-memoria",
    opcional: true,
    titulo: "Ele lembra de você",
    texto: "Conte seu setor ou como prefere as respostas e ele guarda. Você vê, edita e apaga tudo aqui, e pode desligar a memória.",
    lado: "direita",
  },
  {
    id: "regras",
    titulo: "Antes de começar: 3 regras de ouro",
    texto: "1) Não escreva CPF, telefone, senhas nem dados sigilosos de clientes: as perguntas passam por serviços de IA externos.  2) A IA pode errar: confira o que for importante.  3) Dúvida? Fale com o TI. Para rever este tour, use o botão brilhante \"Ver o tour da IA\" no Assistente.",
  },
];
