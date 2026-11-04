import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { clients } from "./api";
import { usePhone } from "../stores/phone";
import { useTelefone } from "../stores/telefone";
import { useSession } from "../stores/workspace";

export interface RamalDaEquipe { usuarioId: number; nome: string; ramal: string }

/** Ramais cadastrados pelo administrador (só nome e ramal; nunca dados da conta SIP). */
export function useDiretorio(): RamalDaEquipe[] {
  const user = useSession((s) => s.user);
  // O aviso do canto da tela nasce no processo principal, que não vê esta lista: ela é enviada para lá.
  const q = useQuery({
    queryKey: ["phone", "diretorio", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await clients.chat.get<{ ramais: RamalDaEquipe[] }>("/phone/diretorio")).data.ramais,
  });
  const lista = q.data;
  useEffect(() => {
    if (lista) void window.desktop?.phoneDiretorio?.(lista.map((r) => ({ ramal: r.ramal, nome: r.nome })));
  }, [lista]);
  return lista ?? [];
}

/** id da pessoa -> ramal. Só quem tem ramal ganha o botão de ligar no chat. */
export function useRamais(): Map<number, string> {
  return new Map(useDiretorio().map((r) => [r.usuarioId, r.ramal]));
}

/** ramal -> nome, para mostrar "Ana Souza" em vez de "1003" nas chamadas recentes. */
export function useNomesPorRamal(): Map<string, string> {
  return new Map(useDiretorio().map((r) => [r.ramal, r.nome]));
}

/** Liga para um ramal pelo Workscape Phone, dentro do Workspace. Devolve o motivo se não for possível. */
export async function ligarPara(ramal: string): Promise<string | undefined> {
  useTelefone.getState().abrir();
  const { snapshot, erro } = usePhone.getState();
  if (snapshot.registro !== "registrado" || !window.desktop?.phoneCall) {
    return erro || snapshot.mensagem || "O telefone ainda não está conectado. Veja o cartão do telefone.";
  }
  const r = await window.desktop.phoneCall(ramal);
  return r.ok ? undefined : r.erro || "Não foi possível ligar.";
}
