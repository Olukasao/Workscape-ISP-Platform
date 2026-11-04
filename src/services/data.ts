import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "../stores/workspace";
export interface Conversation {
  id: number;
  usuario_outro_id: number;
  usuario_outro_nome: string;
  ultima_mensagem?: string;
  nao_lidas?: number;
  unreadCount?: number;
  favorito?: boolean;
}
export interface Group {
  id: number;
  nome: string;
  nao_lidas?: number;
  unreadCount?: number;
  tem_acesso?: boolean;
}
export interface Contact {
  id: number;
  nome: string;
  email?: string;
  status?: string;
}
export function groupsFrom(data: unknown): Group[] {
  return Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data &&
        "grupos" in data &&
        Array.isArray(data.grupos)
      ? data.grupos
      : [];
}
export const unreadCount = (
  items: Array<{ unreadCount?: number; nao_lidas?: number }>,
) =>
  items.reduce((sum, item) => {
    const n = Number(item.unreadCount ?? item.nao_lidas ?? 0);
    return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  }, 0);
export function useChatData() {
  const user = useSession((s) => s.user);
  const common = {
    enabled: !!user,
    staleTime: 20000,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  };
  const conversations = useQuery({
    queryKey: ["chat", "conversations", user?.id],
    queryFn: async () =>
      (await api.get<Conversation[]>("/chat/conversas-diretas")).data,
    ...common,
  });
  const groups = useQuery({
    queryKey: ["chat", "groups", user?.id],
    queryFn: async () => groupsFrom((await api.get("/chat/grupos")).data),
    ...common,
  });
  const contacts = useQuery({
    queryKey: ["chat", "contacts", user?.id],
    queryFn: async () => (await api.get<Contact[]>("/chat/usuarios")).data,
    ...common,
  });
  return { conversations, groups, contacts };
}
