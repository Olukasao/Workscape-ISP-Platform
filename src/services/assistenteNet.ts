import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { clients } from "./api";
import { useSession } from "../stores/workspace";
import type { MensagemAssistente } from "./localAi";
import type { BlocoDados } from "../modules/assistente/dados";

export interface Fonte {
  titulo: string;
  url: string;
}
export interface ModeloAssistente {
  id: string;
  nome: string;
  /** Este modelo consegue ler imagens. */
  visao?: boolean;
}
export interface StatusAssistente {
  configurada: boolean;
  busca?: boolean;
  modelos?: ModeloAssistente[];
  /** Há ao menos um modelo que lê imagens (liga o botão de anexar). */
  imagens?: boolean;
  /** Fontes de dados que o setor da pessoa pode usar. */
  fontes?: string[];
}
export interface RespostaAssistente {
  resposta: string;
  fontes: Fonte[];
  /** ok | sem_resultados | falhou | nao_configurada | nao_pedida */
  busca: string;
  modelo?: string;
  /** Títulos dos blocos de dados do Workspace que a IA recebeu. */
  dadosUsados?: string[];
  /** Memórias que o servidor acabou de guardar sobre a pessoa. */
  memorizado?: { id: number; texto: string }[];
}

/** O assistente na internet precisa estar configurado no servidor do Chat (chave do 9Router). `busca`: pesquisa na web disponível. */
export function useAssistenteInternet() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["assistente", "status", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await clients.chat.get<StatusAssistente>("/ia/assistente/status")).data,
  });
}

export async function assistenteConversar(mensagens: MensagemAssistente[], web: boolean, modelo = "auto", dados: BlocoDados[] = [], memoria = true, imagens: { tipo: string; dados: string }[] = []): Promise<RespostaAssistente> {
  try {
    const { data } = await clients.chat.post<RespostaAssistente>("/ia/assistente/conversar", { mensagens, web, modelo, dados, memoria, imagens }, { timeout: 90000 });
    return { resposta: data.resposta, fontes: data.fontes || [], busca: data.busca || "nao_pedida", modelo: data.modelo, dadosUsados: data.dadosUsados || [], memorizado: data.memorizado || [] };
  } catch (e) {
    if (isAxiosError(e) && e.response?.data?.error) throw new Error(String(e.response.data.error));
    throw new Error("Não foi possível falar com o assistente na internet agora.");
  }
}

export interface Memoria {
  id: number;
  texto: string;
  origem: "auto" | "pedido";
  criada_em: string;
}
const erroDe = (e: unknown, padrao: string) =>
  new Error(isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : padrao);

/** Memória do assistente: fatos sobre a pessoa, guardados no servidor do Chat e ligados à conta. */
export function useMemorias() {
  const user = useSession((s) => s.user);
  const client = useQueryClient();
  const chave = ["assistente", "memorias", user?.id];
  const lista = useQuery({
    queryKey: chave,
    enabled: !!user,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => (await clients.chat.get<{ memorias: Memoria[]; maximo: number }>("/ia/assistente/memorias")).data,
  });
  const atualizar = () => client.invalidateQueries({ queryKey: chave });
  const adicionar = useMutation({
    mutationFn: async (texto: string) => { try { await clients.chat.post("/ia/assistente/memorias", { texto }); } catch (e) { throw erroDe(e, "Não foi possível guardar."); } },
    onSuccess: atualizar,
  });
  const editar = useMutation({
    mutationFn: async ({ id, texto }: { id: number; texto: string }) => { try { await clients.chat.put(`/ia/assistente/memorias/${id}`, { texto }); } catch (e) { throw erroDe(e, "Não foi possível editar."); } },
    onSuccess: atualizar,
  });
  const apagar = useMutation({
    mutationFn: async (id: number) => { try { await clients.chat.delete(`/ia/assistente/memorias/${id}`); } catch (e) { throw erroDe(e, "Não foi possível apagar."); } },
    onSuccess: atualizar,
  });
  const apagarTudo = useMutation({
    mutationFn: async () => { try { await clients.chat.delete("/ia/assistente/memorias"); } catch (e) { throw erroDe(e, "Não foi possível apagar."); } },
    onSuccess: atualizar,
  });
  return { lista, adicionar, editar, apagar, apagarTudo, atualizar };
}

/** Desfaz uma memória acabada de guardar (botão "Desfazer" do aviso). */
export async function apagarMemoria(id: number) {
  await clients.chat.delete(`/ia/assistente/memorias/${id}`);
}

/** Resumo do dia da Home, escrito pela IA da internet a partir dos números que o app já tem. */
export async function assistenteResumo(texto: string): Promise<string> {
  try {
    const { data } = await clients.chat.post<{ resumo: string }>("/ia/assistente/resumo", { texto }, { timeout: 90000 });
    return data.resumo;
  } catch (e) {
    if (isAxiosError(e) && e.response?.data?.error) throw new Error(String(e.response.data.error));
    throw new Error("Não foi possível gerar o resumo agora.");
  }
}
