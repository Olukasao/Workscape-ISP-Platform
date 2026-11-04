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
