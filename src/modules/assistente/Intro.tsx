import { CalendarDays, Globe, GraduationCap, Headset, ImageIcon, LayoutDashboard, MessageSquarePlus, RadioTower, ShieldCheck, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { useAssistenteInternet } from "../../services/assistenteNet";
import { useAssistente } from "./store";

// Página de abertura do Assistente: o que ele é, como junta várias IAs em uma e o que consulta.
// A peça central é o diagrama: pulsos de luz (as IAs) entram numa fibra só e saem para os dados da operação.

const ENTRADAS = [
  { y: 90, nome: "Gemini" },
  { y: 170, nome: "Cloudflare" },
  { y: 250, nome: "Outros modelos" },
];
const SAIDAS = [
  { y: 50, nome: "Agenda" },
  { y: 130, nome: "Rede (OLT)" },
  { y: 210, nome: "Chamados" },
  { y: 290, nome: "Painel NOC" },
];
const NUCLEO = { x: 360, y: 170, r: 30 };

const caminhoEntrada = (y: number) => `M124 ${y} C 230 ${y}, 236 ${NUCLEO.y}, ${NUCLEO.x - NUCLEO.r} ${NUCLEO.y}`;
const caminhoSaida = (y: number) => `M${NUCLEO.x + NUCLEO.r} ${NUCLEO.y} C 484 ${NUCLEO.y}, 490 ${y}, 596 ${y}`;

function Diagrama() {
  return (
    <svg className="ia-intro-diagrama" viewBox="0 0 720 340" role="img" aria-label="Várias inteligências artificiais entram em um só Assistente, que consulta agenda, rede, chamados e painel">
      <defs>
        <radialGradient id="ia-intro-brilho">
          <stop offset="0" stopColor="#3ad6ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {ENTRADAS.map((e, i) => (
        <g key={e.nome}>
          <path className="ia-fibra" pathLength={100} d={caminhoEntrada(e.y)} style={{ animationDelay: `${i * 140}ms` }} />
          <path className="ia-pulso entra" pathLength={100} d={caminhoEntrada(e.y)} style={{ animationDelay: `${1200 + i * 700}ms` }} />
        </g>
      ))}
      {SAIDAS.map((s, i) => (
        <g key={s.nome}>
          <path className="ia-fibra" pathLength={100} d={caminhoSaida(s.y)} style={{ animationDelay: `${500 + i * 140}ms` }} />
          <path className="ia-pulso sai" pathLength={100} d={caminhoSaida(s.y)} style={{ animationDelay: `${2300 + i * 450}ms` }} />
        </g>
      ))}

      <circle className="ia-nucleo-brilho" cx={NUCLEO.x} cy={NUCLEO.y} r="86" fill="url(#ia-intro-brilho)" />
      <circle className="ia-onda" cx={NUCLEO.x} cy={NUCLEO.y} r={NUCLEO.r} />
      <circle className="ia-onda segunda" cx={NUCLEO.x} cy={NUCLEO.y} r={NUCLEO.r} />
      <circle className="ia-nucleo" cx={NUCLEO.x} cy={NUCLEO.y} r={NUCLEO.r} />
      <g className="ia-nucleo-icone" transform={`translate(${NUCLEO.x - 13} ${NUCLEO.y - 13})`}>
        <Sparkles width={26} height={26} color="#fff" strokeWidth={1.8} />
      </g>
      <text className="ia-rotulo-nucleo" x={NUCLEO.x} y={NUCLEO.y + 58} textAnchor="middle">Assistente Acessa</text>

      {ENTRADAS.map((e) => (
        <g key={e.nome} className="ia-no">
          <rect x="4" y={e.y - 17} width="120" height="34" rx="17" />
          <text x="64" y={e.y + 4.5} textAnchor="middle">{e.nome}</text>
        </g>
      ))}
      {SAIDAS.map((s) => (
        <g key={s.nome} className="ia-no dado">
          <rect x="596" y={s.y - 17} width="120" height="34" rx="17" />
          <text x="656" y={s.y + 4.5} textAnchor="middle">{s.nome}</text>
        </g>
      ))}
    </svg>
  );
}

const PASSOS = [
  { titulo: "Você pergunta", texto: "Escreva do seu jeito, como numa conversa. Dá para colar um print também." },
  { titulo: "A IA certa responde", texto: "Várias inteligências artificiais trabalham em revezamento: se uma está fora do ar ou lenta, a próxima assume sem você notar." },
  { titulo: "Consulta a nossa operação", texto: "Quando a pergunta pede, ele lê a agenda, a rede, os chamados e o painel NOC, só o que o seu setor pode ver." },
  { titulo: "Mostra de onde tirou", texto: "A resposta indica os dados e as fontes usadas, para você conferir antes de passar adiante." },
];

const FONTES = [
  { id: "agenda", rotulo: "Agenda de técnicos", texto: "OS do dia, quem atende o quê e os recados da coordenação.", icone: CalendarDays },
  { id: "rede", rotulo: "Rede (OLT)", texto: "Quedas de PON e CTO, clientes afetados e há quanto tempo.", icone: RadioTower },
  { id: "chamados", rotulo: "Chamados e painel NOC", texto: "Filas de suporte, volume por fila e o resumo do dia.", icone: Headset },
  { id: "painel", rotulo: "Painel geral", texto: "Clientes online, offline e suspensos num relance.", icone: LayoutDashboard },
  { id: "web", rotulo: "Pesquisa na internet", texto: "Notícias e respostas atuais, com os links das fontes.", icone: Globe },
  { id: "cursos", rotulo: "Cursos", texto: "Resume aulas e tira dúvidas sobre o conteúdo.", icone: GraduationCap },
  { id: "imagens", rotulo: "Imagens", texto: "Entende prints de tela e fotos que você colar na conversa.", icone: ImageIcon },
];

const PERGUNTAS = [
  "Como está a fila de suporte agora?",
  "Quais técnicos ainda têm OS pendentes hoje?",
  "Tem alguma queda de PON ativa na rede?",
  "Faça um resumo do meu dia.",
];

export default function Intro({ onComecar }: { onComecar: () => void }) {
  const status = useAssistenteInternet();
  const { pesquisar, enviar, enviando } = useAssistente();
  const liberadas = status.data?.fontes;
  const modelos = status.data?.modelos?.length ?? 0;

  const perguntar = (texto: string) => {
    onComecar();
    void enviar(texto, pesquisar, true); // onComecar já abriu uma conversa nova
  };

  return (
    <div className="ia-intro">
      <section className="ia-intro-heroi" aria-labelledby="ia-intro-titulo">
        <div className="ia-intro-texto">
          <h1 id="ia-intro-titulo">Uma inteligência artificial feita aqui dentro, que conhece a nossa operação</h1>
          <p className="ia-intro-lide">
            O Assistente foi criado do zero pelo Lucas, na AcessaNet. Em vez de depender de uma só IA, ele junta várias em uma
            e responde com dados reais da agenda, da rede, dos chamados e do painel NOC.
          </p>
          <div className="ia-intro-acoes">
            <button type="button" className="ia-intro-comecar" onClick={onComecar}>
              <MessageSquarePlus size={17} aria-hidden="true" /> Começar uma conversa
            </button>
            {modelos > 1 ? <span className="ia-intro-fato"><b>{modelos}</b> modelos de IA em revezamento</span> : null}
          </div>
        </div>
        <Diagrama />
      </section>

      <section className="ia-intro-secao" aria-labelledby="ia-intro-como">
        <h2 id="ia-intro-como">Como funciona</h2>
        <ol className="ia-intro-passos">
          {PASSOS.map((p, i) => (
            <li key={p.titulo}>
              <span className="ia-intro-marco" aria-hidden="true">{i + 1}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ia-intro-secao" aria-labelledby="ia-intro-fontes">
        <h2 id="ia-intro-fontes">O que ele consulta</h2>
        <ul className="ia-intro-fontes">
          {FONTES.map(({ id, rotulo, texto, icone: Icone }) => {
            const liberada = !liberadas || liberadas.includes(id) || (id === "chamados" && liberadas.includes("chamados"));
            return (
              <li key={id} className={clsx(!liberada && "bloqueada")}>
                <Icone size={18} aria-hidden="true" />
                <div>
                  <b>{rotulo}</b>
                  <span>{liberada ? texto : "Não liberado para o seu setor."}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ia-intro-secao" aria-labelledby="ia-intro-teste">
        <h2 id="ia-intro-teste">Experimente agora</h2>
        <div className="ia-intro-perguntas">
          {PERGUNTAS.map((p) => (
            <button key={p} type="button" disabled={!!enviando} onClick={() => perguntar(p)}>{p}</button>
          ))}
        </div>
      </section>

      <p className="ia-intro-rodape">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Não escreva CPF, telefone, senhas nem dados sigilosos de clientes: as perguntas passam por serviços de IA externos. A IA pode errar, confira o que for importante.</span>
      </p>
    </div>
  );
}
