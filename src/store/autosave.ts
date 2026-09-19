import { defaultProject } from "@/schema/defaults";
import { migrate, type Project } from "@/schema/project";
import { deleteOrphanBlobs, loadLatestProject, saveProject } from "./persistence";
import { useProject } from "./useProject";

const DEBOUNCE_MS = 400;

/** Load the last project (or start fresh) and save on every change thereafter. */
export async function initPersistence(): Promise<void> {
  let project: Project;
  try {
    const raw = await loadLatestProject();
    project = raw ? migrate(raw) : defaultProject();
  } catch (err) {
    console.error("Could not load the saved project; starting fresh.", err);
    project = defaultProject();
  }
  useProject.getState().hydrate(project);
  deleteOrphanBlobs(new Set(project.site.tiles.map((t) => t.blobKey))).catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  useProject.subscribe((state, prev) => {
    if (!state.hydrated || state.project === prev.project) return;
    clearTimeout(timer);
    const snapshot = state.project;
    timer = setTimeout(() => {
      saveProject(snapshot).catch((err) => console.error("Autosave failed", err));
    }, DEBOUNCE_MS);
  });
}
