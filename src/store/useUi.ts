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
  /** Sun scrubber. View state, not saved with the project. */
  sun: { month: number; day: number; hour: number };
  setSun: (sun: Partial<UiState["sun"]>) => void;
  /** One-shot camera request consumed by the viewport. */
  viewRequest: "top" | "perspective" | null;
  requestView: (view: UiState["viewRequest"]) => void;
}

export const useUi = create<UiState>((set) => ({
  mode: "site",
  setMode: (mode) => set({ mode }),
  selection: null,
  select: (selection) => set({ selection }),
  sun: { month: new Date().getMonth() + 1, day: new Date().getDate(), hour: 15 },
  setSun: (sun) => set((s) => ({ sun: { ...s.sun, ...sun } })),
  viewRequest: null,
  requestView: (viewRequest) => set({ viewRequest }),
}));
