/**
 * A agenda dentro do Workspace é a página web original, que identifica quem altera pela sessão entregue pelo app.
 * Essa sessão precisa ser renovada enquanto a agenda fica aberta: antes ela era entregue uma vez só e, em computadores
 * que passam o dia com o Workspace aberto, vencia e as alterações passavam a sair como "Usuário não identificado".
 */
export const RENOVAR_A_CADA_MS = 15 * 60 * 1000;

export interface OpcoesRenovador {
  /** Pede ao Chat a sessão da agenda (já guarda em cache e renova sozinha a cada 6 h). */
  obterToken: () => Promise<string>;
  /** Entrega o token à página da agenda. */
  entregar: (token: string) => Promise<unknown>;
  aoSucesso?: () => void;
  aoFalhar?: (erro: unknown) => void;
}

/** Devolve uma função `renovar` segura para chamar de timers e eventos: nunca roda duas vezes ao mesmo tempo. */
export function criarRenovador({ obterToken, entregar, aoSucesso, aoFalhar }: OpcoesRenovador) {
  let emAndamento: Promise<boolean> | null = null;
  return function renovar(): Promise<boolean> {
    emAndamento ??= (async () => {
      try {
        await entregar(await obterToken());
        aoSucesso?.();
        return true;
      } catch (erro) {
        aoFalhar?.(erro);
        return false;
      } finally {
        emAndamento = null;
      }
    })();
    return emAndamento;
  };
}

/** Instante (ms) em que o token da agenda (`agenda.<corpo>.<assinatura>`) vence, ou null se não der para ler. */
export function vencimentoDoToken(token: string): number | null {
  try {
    const corpo = token.split(".")[1];
    if (!corpo) return null;
    const json = atob(corpo.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** O token em cache só serve se ainda faltar margem para vencer; antes o cache de 6 h reentregava token já vencido. */
export function tokenAindaValido(token: string, agora = Date.now(), margemMs = 5 * 60 * 1000): boolean {
  const venc = vencimentoDoToken(token);
  return venc === null || venc - agora > margemMs;
}
