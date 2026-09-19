import { useEffect } from "react";
import { ExportMenu } from "./export/ExportMenu";
import { StructurePanel } from "./panels/StructurePanel";
import { Viewport } from "./scene/Viewport";
import { defaultProject } from "./schema/defaults";
import { SiteView } from "./site/SiteView";
import { deleteProject } from "./store/persistence";
import { useProject } from "./store/useProject";
import { useUi } from "./store/useUi";

export function App() {
  const hydrated = useProject((s) => s.hydrated);
  const project = useProject((s) => s.project);
  const commit = useProject((s) => s.commit);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "checkbox" && t.type !== "color") return;
      if (t instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (e.shiftKey) useProject.getState().redo();
      else useProject.getState().undo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);

  if (!hydrated) return <div className="loading">Loading…</div>;

  const resetProject = () => {
    if (!window.confirm("Start a new project? The current one will be discarded.")) return;
    const old = useProject.getState().project.id;
    useProject.getState().hydrate(defaultProject());
    deleteProject(old).catch(console.error);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Batterboard</span>
        <nav className="tabs">
          <button type="button" className={mode === "site" ? "active" : ""} onClick={() => setMode("site")}>
            Site
          </button>
          <button type="button" className={mode === "model" ? "active" : ""} onClick={() => setMode("model")}>
            3D
          </button>
        </nav>
        <input
          className="project-name"
          aria-label="Project name"
          value={project.name}
          onChange={(e) =>
            commit("rename project", (d) => {
              d.name = e.target.value || "Untitled project";
            })
          }
        />
        <span className="spacer" />
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Shift+Cmd/Ctrl+Z)">
          Redo
        </button>
        <span className="divider" />
        <ExportMenu />
        <button type="button" onClick={resetProject}>
          New project
        </button>
      </header>
      {mode === "site" ? (
        <SiteView />
      ) : (
        <div className="app">
          <main className="viewport">
            <Viewport />
          </main>
          <StructurePanel />
        </div>
      )}
    </div>
  );
}
