import { create } from "zustand";
import { assistenteConversar, apagarMemoria, type Fonte } from "../../services/assistenteNet";
import { coletarDados, type BlocoDados } from "./dados";
import type { ImagemAnexa } from "./imagens";
import { respostaFixa, type ImagemFixa } from "./respostasFixas";

export interface Msg {
  role: "user" | "assistant";
  content: string;
  fontes?: Fonte[];
  /** Imagem do app mostrada na resposta (só a chave). */
  imagem?: ImagemFixa;
  /** Modelo que respondeu (id). */
  modelo?: string;
  /** Miniaturas das imagens anexadas a esta pergunta. */
  miniaturas?: string[];
  /** Dados do Workspace que a IA recebeu nesta resposta. */
  dados?: string[];
  /** Memórias guardadas sobre a pessoa a partir desta pergunta (com a opção de desfazer). */
  memorizado?: { id: number; texto: string }[];
  hora: number;
}
export interface Conversa {
  id: string;
  titulo: string;
  criada: number;
  atualizada: number;
  mensagens: Msg[];
}

// As conversas ficam só neste computador, separadas por usuário (localStorage). O servidor não guarda nada.
const CHAVE = "workspace-assistente-v1:";
const MAX_CONVERSAS = 60;
const MAX_BYTES = 2_500_000;

interface Salvo {
  conversas: Conversa[];
  ativaId: string | null;
  modelo: string;
  pesquisar: boolean;
  usarDados: boolean;
  usarMemoria: boolean;
}
const novoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const tituloDe = (texto: string) => {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 47)}…` : t || "Nova conversa";
};

function ler(usuario: string): Salvo {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE + usuario) || "null") as Partial<Salvo> | null;
    if (v && Array.isArray(v.conversas)) {
      return { conversas: v.conversas, ativaId: v.ativaId ?? null, modelo: v.modelo || "auto", pesquisar: v.pesquisar !== false, usarDados: v.usarDados !== false, usarMemoria: v.usarMemoria !== false };
    }
  } catch {
    /* sem histórico legível: começa vazio */
  }
  return { conversas: [], ativaId: null, modelo: "auto", pesquisar: true, usarDados: true, usarMemoria: true };
}
function gravar(usuario: string, dados: Salvo) {
  if (!usuario) return;
  let conversas = [...dados.conversas].sort((a, b) => b.atualizada - a.atualizada).slice(0, MAX_CONVERSAS);
  let texto = JSON.stringify({ ...dados, conversas });
  // Passou do limite do armazenamento: descarta as conversas mais antigas até caber.
  while (texto.length > MAX_BYTES && conversas.length > 1) {
    conversas = conversas.slice(0, -1);
    texto = JSON.stringify({ ...dados, conversas });
  }
  try {
    localStorage.setItem(CHAVE + usuario, texto);
  } catch {
    /* sem armazenamento: o histórico vale só nesta sessão */
  }
}

interface Estado extends Salvo {
  usuario: string;
  enviando: string | null; // id da conversa que está esperando resposta
  coletando: boolean; // lendo dados do Workspace antes de perguntar à IA
  erro: { conversaId: string; texto: string } | null;
  aviso: { conversaId: string; texto: string } | null;
  aberto: boolean; // painel flutuante
  carregar: (usuario: string) => void;
  nova: () => void;
  abrir: (id: string) => void;
  apagar: (id: string) => void;
  renomear: (id: string, titulo: string) => void;
  apagarTudo: () => void;
  setModelo: (id: string) => void;
  setPesquisar: (v: boolean) => void;
  setUsarDados: (v: boolean) => void;
  setUsarMemoria: (v: boolean) => void;
  desfazerMemoria: (conversaId: string, memoriaId: number) => Promise<void>;
  setAberto: (v: boolean) => void;
  enviar: (texto: string, busca: boolean, usarDados?: boolean, imagens?: ImagemAnexa[]) => Promise<void>;
}

export const useAssistente = create<Estado>((set, get) => {
  const salvar = () => {
    const s = get();
    gravar(s.usuario, { conversas: s.conversas, ativaId: s.ativaId, modelo: s.modelo, pesquisar: s.pesquisar, usarDados: s.usarDados, usarMemoria: s.usarMemoria });
  };
  const atualizarConversa = (id: string, fn: (c: Conversa) => Conversa) => {
    set((s) => ({ conversas: s.conversas.map((c) => (c.id === id ? fn(c) : c)) }));
    salvar();
  };
  return {
    usuario: "",
    conversas: [],
    ativaId: null,
    modelo: "auto",
    pesquisar: true,
    usarDados: true,
    usarMemoria: true,
    enviando: null,
    coletando: false,
    erro: null,
    aviso: null,
    aberto: false,
    carregar: (usuario) => {
      if (get().usuario === usuario) return;
      set({ usuario, ...ler(usuario), enviando: null, erro: null, aviso: null });
    },
    // "Nova conversa" só desmarca a ativa; a conversa nasce quando a primeira pergunta é enviada.
    nova: () => { set({ ativaId: null, erro: null, aviso: null }); salvar(); },
    abrir: (id) => { set({ ativaId: id, erro: null, aviso: null }); salvar(); },
    apagar: (id) => {
      set((s) => ({ conversas: s.conversas.filter((c) => c.id !== id), ativaId: s.ativaId === id ? null : s.ativaId }));
      salvar();
    },
    renomear: (id, titulo) => atualizarConversa(id, (c) => ({ ...c, titulo: tituloDe(titulo) })),
    apagarTudo: () => { set({ conversas: [], ativaId: null, erro: null, aviso: null }); salvar(); },
    setModelo: (modelo) => { set({ modelo }); salvar(); },
    setPesquisar: (pesquisar) => { set({ pesquisar }); salvar(); },
    setUsarDados: (usarDados) => { set({ usarDados }); salvar(); },
    setUsarMemoria: (usarMemoria) => { set({ usarMemoria }); salvar(); },
    desfazerMemoria: async (conversaId, memoriaId) => {
      await apagarMemoria(memoriaId).catch(() => {});
      atualizarConversa(conversaId, (c) => ({
        ...c,
        mensagens: c.mensagens.map((m) => (m.memorizado ? { ...m, memorizado: m.memorizado.filter((x) => x.id !== memoriaId) } : m)),
      }));
    },
    setAberto: (aberto) => set({ aberto }),
    enviar: async (texto, busca, usarDados = false, imagens = []) => {
      // Só imagem, sem texto: pede para explicar a imagem.
      const limpo = texto.trim() || (imagens.length ? "Explique esta imagem." : "");
      if (!limpo || get().enviando) return;
      let id = get().ativaId;
      const agora = Date.now();
      const usuarioMsg: Msg = { role: "user", content: limpo, hora: agora, ...(imagens.length ? { miniaturas: imagens.map((i) => i.miniatura) } : {}) };
      if (!id || !get().conversas.some((c) => c.id === id)) {
        id = novoId();
        const conversa: Conversa = { id, titulo: tituloDe(limpo), criada: agora, atualizada: agora, mensagens: [usuarioMsg] };
        set((s) => ({ conversas: [conversa, ...s.conversas], ativaId: id }));
      } else {
        const alvo = id;
        set((s) => ({ conversas: s.conversas.map((c) => (c.id === alvo ? { ...c, atualizada: agora, mensagens: [...c.mensagens, usuarioMsg] } : c)) }));
      }
      set({ enviando: id, erro: null, aviso: null });
      salvar();
      const conversaId = id;
      // Perguntas com resposta pronta (ex.: agenda fora do ar) não vão à IA.
      const fixa = imagens.length ? null : respostaFixa(limpo);
      if (fixa) {
        await new Promise((r) => setTimeout(r, 700));
        atualizarConversa(conversaId, (c) => ({ ...c, atualizada: Date.now(), mensagens: [...c.mensagens, { role: "assistant", content: fixa.content, imagem: fixa.imagem, hora: Date.now() }] }));
        set({ enviando: null, coletando: false });
        return;
      }
      const historico = get().conversas.find((c) => c.id === conversaId)!.mensagens.map(({ role, content }) => ({ role, content }));
      try {
        let dados: BlocoDados[] = [];
        if (usarDados) {
          set({ coletando: true });
          // Falha ao ler uma fonte nunca impede a pergunta: a fonte vira "indisponível" para a IA.
          dados = await coletarDados(limpo).catch(() => []);
          set({ coletando: false });
        }
        const r = await assistenteConversar(historico, busca, get().modelo, dados, get().usarMemoria, imagens.map(({ tipo, dados: b64 }) => ({ tipo, dados: b64 })));
        atualizarConversa(conversaId, (c) => ({
          ...c,
          atualizada: Date.now(),
          mensagens: [...c.mensagens, { role: "assistant", content: r.resposta, fontes: r.fontes, modelo: r.modelo, dados: r.dadosUsados, memorizado: r.memorizado, hora: Date.now() }],
        }));
        if (busca && (r.busca === "falhou" || r.busca === "sem_resultados"))
          set({ aviso: { conversaId, texto: r.busca === "falhou" ? "A pesquisa na internet falhou desta vez; a resposta veio sem ela." : "A pesquisa não achou resultados; a resposta veio sem ela." } });
      } catch (e) {
        set({ erro: { conversaId, texto: e instanceof Error ? e.message : "Não foi possível responder agora." } });
      } finally {
        set({ enviando: null, coletando: false });
      }
    },
  };
});

/** Agrupa por data como o ChatGPT/Claude: Hoje, Ontem, Últimos 7 dias, Anteriores. */
export function agruparPorData(conversas: Conversa[], agora = new Date()) {
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const dia = 86_400_000;
  const grupos: { rotulo: string; itens: Conversa[] }[] = [
    { rotulo: "Hoje", itens: [] },
    { rotulo: "Ontem", itens: [] },
    { rotulo: "Últimos 7 dias", itens: [] },
    { rotulo: "Anteriores", itens: [] },
  ];
  for (const c of [...conversas].sort((a, b) => b.atualizada - a.atualizada)) {
    const i = c.atualizada >= inicioDia ? 0 : c.atualizada >= inicioDia - dia ? 1 : c.atualizada >= inicioDia - 7 * dia ? 2 : 3;
    grupos[i].itens.push(c);
  }
  return grupos.filter((g) => g.itens.length);
}
