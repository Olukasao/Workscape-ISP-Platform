import { create } from "zustand";

/** Camadas do app que precisam ficar acima das páginas nativas (Navegador, versão web da agenda). */
export const useSobreposicao = create<{ paleta: boolean; setPaleta: (aberta: boolean) => void }>((set) => ({
  paleta: false,
  setPaleta: (paleta) => set({ paleta }),
}));
