import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, errorMessage } from "../../services/api";
import { useServers } from "../../stores/workspace";
import { serviceEndpoint } from "../../services/live";

export { errorMessage };

/** Chamadas ao módulo Cursos do servidor. Toda regra é conferida lá; aqui só se exibe. */
export const cursosApi = {
  get: async <T,>(path: string, params?: Record<string, unknown>) => (await api.get<T>(`/cursos${path}`, { params })).data,
  post: async <T,>(path: string, body?: unknown) => (await api.post<T>(`/cursos${path}`, body ?? {})).data,
  put: async <T,>(path: string, body?: unknown) => (await api.put<T>(`/cursos${path}`, body ?? {})).data,
  del: async <T,>(path: string, params?: Record<string, unknown>) => (await api.delete<T>(`/cursos${path}`, { params })).data,
  upload: async (file: File, cursoId?: number) => {
    const fd = new FormData();
    if (cursoId) fd.append("cursoId", String(cursoId));
    fd.append("arquivo", file);
    return (await api.post<ArquivoInfo>("/cursos/admin/arquivos", fd)).data;
  },
};

/** Endereços de arquivos vêm relativos ao servidor do Chat; aqui viram absolutos. */
export function urlDoServidor(rel?: string | null) {
  if (!rel) return "";
  if (/^https?:/i.test(rel)) return rel;
  const origin = useServers.getState().config.chat;
  return origin ? `${serviceEndpoint("chat", origin)}${rel}` : rel;
}

export function useCursosQuery<T>(key: QueryKey, path: string, params?: Record<string, unknown>, opts: { enabled?: boolean; staleTime?: number } = {}) {
  return useQuery({ queryKey: ["cursos", ...key], queryFn: () => cursosApi.get<T>(path, params), staleTime: opts.staleTime ?? 15000, enabled: opts.enabled });
}

export function useCursosMutation<V, R = unknown>(fn: (v: V) => Promise<R>, invalidar: QueryKey[] = [["cursos"]], onOk?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const k of invalidar) void qc.invalidateQueries({ queryKey: k });
      onOk?.(r);
    },
  });
}

export const formatarDuracao = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);
export const formatarData = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "";
export const NIVEL_ROTULO: Record<string, string> = { basico: "Básico", intermediario: "Intermediário", avancado: "Avançado" };

export interface ArquivoInfo { id: number; nome: string; mime: string; tamanho: number; url: string }
export interface CursoResumo {
  id: number; titulo: string; descricao: string | null; instrutor: string | null; instrutor_url: string | null; nivel: string; categoria_id: number | null; categoria: string | null;
  capa: string | null; carga_horaria_min: number; emite_certificado: number; obrigatorio: boolean; acessos: number; criado_em: string;
  modulos: number; aulas: number; matriculado: boolean; prazoEm: string | null; ultimaAulaId: number | null; ultimoAcesso: string | null;
  concluido: boolean; progresso: number; favorito: boolean; certificado: string | null;
}
export interface Conquista { id: string; titulo: string; descricao: string }
export interface Painel {
  usuario: { nome: string; setor: string | null };
  destaque: CursoResumo | null; continuar: CursoResumo[];
  estatisticas: { progressoGeral: number; horas: number; cursosConcluidos: number; certificados: number; pontos: number; sequencia: number };
  proximas: { tipo: "prazo" | "correcao"; cursoId: number; titulo: string; prazoEm?: string; obrigatorio?: boolean }[];
  recomendados: CursoResumo[]; novos: CursoResumo[]; maisAcessados: CursoResumo[]; conquistas: Conquista[];
}
export interface AulaResumo { id: number; titulo: string; tipo: "conteudo" | "prova"; duracaoMin: number; estado: "nao_iniciada" | "andamento" | "concluida" | "bloqueada" }
export interface CursoDetalhe {
  curso: {
    id: number; titulo: string; descricao: string | null; objetivos: string | null; prerequisitos: string | null; instrutor: string | null; instrutorUrl: string | null; nivel: string; categoria: string | null;
    capa: string | null; cargaHorariaMin: number; status: string; emiteCertificado: boolean; obrigatorio: boolean; notaFinalMinima: number;
    cursoRequisito: { id: number; titulo: string } | null; requisitoCumprido: boolean;
  };
  modulos: { id: number; titulo: string; aulas: AulaResumo[] }[];
  progresso: { total: number; feitas: number; percentual: number; concluido: boolean };
  matriculado: boolean; concluidoEm: string | null; prazoEm: string | null; proximaAulaId: number | null; ultimaAulaId: number | null; ultimaPosicao: number;
  certificado: string | null; favorito: boolean; feedback: { nota: number; comentario: string | null } | null; previa: boolean;
}
export type Bloco = { id: string; tipo: string; [k: string]: any };
export interface AulaConteudo {
  aula: { id: number; cursoId: number; titulo: string; tipo: "conteudo" | "prova"; duracaoMin: number; moduloId: number };
  blocos: Bloco[]; arquivos: Record<string, ArquivoInfo>; progresso: { posicao: number; concluida: boolean }; anotacao: string;
  anterior: number | null; proxima: number | null; previa: boolean;
}
