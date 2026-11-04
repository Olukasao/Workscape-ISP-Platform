import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";

export interface Ponto { label: string; value: number }
export interface ResumoSite {
  generatedAt: string; emCache: boolean; range: { from: string; to: string };
  customers: { accesses: number; uniqueClients: number; newClients: number; returningClients: number; accessesToday: number; uniqueClientsToday: number; uniqueClients7d: number; uniqueClients30d: number; accessesByDay: Ponto[]; uniqueClientsByDay: Ponto[]; accessesByHour: Ponto[]; devices: Ponto[]; pages: Ponto[] };
  sessions: { inRange: number; total: number; averageSeconds: number | null; loginsByDay: Ponto[] };
  accounts: { total: number; createdInRange: number; firstAccessCompleted: number; createdByDay: Ponto[] };
  tickets: { openedInRange: number; openedByDay: Ponto[]; secondCopies: number; invoiceQueries: number; connectionQueries: number; paymentPromises: number };
  contracts: { total: number; marketingOptIn: number; byStatus: Ponto[]; byPlan: Ponto[]; byCity: Ponto[]; byDay: Ponto[] };
  planLeads: { total: number; byPlan: Ponto[]; byDay: Ponto[] };
  wifi: { visitorsTotal: number; visitorsInRange: number; marketingLeads: number; sessionsInRange: number; sessionsByDay: Ponto[] };
  forms: { jobApplications: number; bugReports: number; bugReportsByStatus: Ponto[] };
}
export type Periodo = "today" | "7d" | "30d" | "90d" | "custom";

/** Os dados vêm do chat interno, que guarda o token do site e só entrega a quem tem permissão. */
export function useResumoSite(periodo: Periodo, de: string, ate: string) {
  return useQuery({
    queryKey: ["marketing", "site", periodo, periodo === "custom" ? de : "", periodo === "custom" ? ate : ""],
    queryFn: async () => (await api.get<ResumoSite>("/marketing/site/resumo", { params: { periodo, ...(periodo === "custom" ? { de, ate } : {}) } })).data,
    enabled: periodo !== "custom" || (!!de && !!ate && de <= ate),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}
