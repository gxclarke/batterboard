import { create } from "zustand";

export type Mode = "site" | "model";

interface UiState {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export const useUi = create<UiState>((set) => ({
  mode: "site",
  setMode: (mode) => set({ mode }),
}));
