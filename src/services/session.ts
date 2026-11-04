import type { QueryClient } from "@tanstack/react-query";
import { useNotices, useSession } from "../stores/workspace";

/** Encerra a sessão local: mesmos passos usados pelo Perfil. */
export function signOut(query: QueryClient) {
  useSession.getState().clear();
  query.clear();
  useNotices.getState().clear();
  void window.desktop?.unread(0);
}
