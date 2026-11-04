import { create } from "zustand";

/** O card flutuante do Telefone: aberto pelo Início, por Ferramentas ou pelo Meu acesso rápido. */
export const useTelefone = create<{ aberto: boolean; abrir: () => void; fechar: () => void }>((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
}));
