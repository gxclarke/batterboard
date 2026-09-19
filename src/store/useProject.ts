/**
 * Project state with an undo/redo stack. Every mutation goes through `commit`,
 * which validates the resulting project against the schema and refuses to
 * apply anything invalid. Autosave to IndexedDB arrives with Phase 0.
 */
import { create } from "zustand";
import { defaultProject } from "@/schema/defaults";
import { type Project, ProjectSchema, type Structure } from "@/schema/project";

const HISTORY_LIMIT = 100;

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  /** Replace the project with the result of `fn`. Returns false if the result failed validation. */
  commit: (label: string, fn: (draft: Project) => Project) => boolean;
  updateStructure: (id: string, fn: (s: Structure) => Structure) => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useProject = create<ProjectState>((set, get) => ({
  project: defaultProject(),
  past: [],
  future: [],

  commit: (label, fn) => {
    const { project, past } = get();
    const next = fn(structuredClone(project));
    next.updatedAt = new Date().toISOString();
    const result = ProjectSchema.safeParse(next);
    if (!result.success) {
      console.warn(`Rejected "${label}":`, result.error.issues);
      return false;
    }
    set({ project: result.data, past: [...past.slice(-HISTORY_LIMIT + 1), project], future: [] });
    return true;
  },

  updateStructure: (id, fn) =>
    get().commit(`update ${id}`, (draft) => {
      draft.structures = draft.structures.map((s) => (s.id === id ? fn(s) : s));
      return draft;
    }),

  undo: () => {
    const { past, project, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future] });
  },

  redo: () => {
    const { past, project, future } = get();
    const [next, ...rest] = future;
    if (!next) return;
    set({ project: next, past: [...past, project], future: rest });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
