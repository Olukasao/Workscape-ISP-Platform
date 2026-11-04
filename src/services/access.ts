import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "../stores/workspace";
export function useAccess() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["access", user?.id],
    queryFn: async () => (await api.get("/me/quick-access")).data,
    enabled: !!user,
    staleTime: 60000,
  });
}
type AccessItem = { id: string; children?: { id: string }[] };
/** Identificadores liberados pelo servidor em /me/quick-access. */
export function allowedIds(data?: { available?: AccessItem[] }) {
  return new Set<string>(
    (data?.available || []).flatMap((i) => [
      i.id,
      ...(i.children || []).map((c) => c.id),
    ]),
  );
}
