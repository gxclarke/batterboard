import { defaultProject } from "@/schema/defaults";
import { migrate, type Project } from "@/schema/project";
import { deleteOrphanBlobs, loadLatestProject, saveProject } from "./persistence";
import { useProject } from "./useProject";

const DEBOUNCE_MS = 400;

/** Every blob key a project points at: aerial tiles and facade photos. */
export function referencedBlobKeys(project: Project): string[] {
  return [
    ...project.site.tiles.map((t) => t.blobKey),
    ...project.masses.flatMap((m) => (m.facade ?? []).map((f) => f.blobKey)),
  ];
}

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
  deleteOrphanBlobs(new Set(referencedBlobKeys(project))).catch(() => undefined);

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
