import { create } from "zustand";

export type Mode = "site" | "model";

export interface Selection {
  kind: "mass" | "surface" | "structure";
  id: string;
}

interface UiState {
  mode: Mode;
  setMode: (mode: Mode) => void;
  selection: Selection | null;
  select: (selection: Selection | null) => void;
}

export const useUi = create<UiState>((set) => ({
  mode: "site",
  setMode: (mode) => set({ mode }),
  selection: null,
  select: (selection) => set({ selection }),
}));
