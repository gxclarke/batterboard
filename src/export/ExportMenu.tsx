import { useEffect, useRef, useState } from "react";
import { getSceneHandle, subscribeSceneHandle } from "@/scene/sceneHandle";
import { deleteProject, getBlob, putBlob, saveProject } from "@/store/persistence";
import { useProject } from "@/store/useProject";
import { downloadBlob, safeFilename, stamp } from "./download";
import { exportGlb } from "./glb";
import { capturePng } from "./png";
import { PROJECT_FILE_EXT, parseProjectFile, serializeProject } from "./projectFile";

/** Topbar controls: screenshot, GLB, save and open project files. */
export function ExportMenu() {
  const project = useProject((s) => s.project);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [has3d, setHas3d] = useState(() => getSceneHandle() !== null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeSceneHandle(() => setHas3d(getSceneHandle() !== null)), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const base = `${safeFilename(project.name)}-${stamp()}`;

  const onOpen = (file: File) =>
    run("open", async () => {
      const parsed = await parseProjectFile(await file.text());
      if (!window.confirm(`Open "${parsed.project.name}"? The current project will be replaced.`)) return;
      for (const [key, blob] of Object.entries(parsed.blobs)) await putBlob(key, blob);
      const old = useProject.getState().project.id;
      useProject.getState().hydrate(parsed.project);
      await saveProject(parsed.project);
      if (old !== parsed.project.id) await deleteProject(old);
      setMessage(`Opened ${parsed.project.name}.`);
    });

  return (
    <div className="export-menu">
      <button
        type="button"
        disabled={!has3d || busy !== null}
        title={has3d ? "Save a PNG of the current view" : "Open the 3D tab first"}
        onClick={() => run("png", async () => downloadBlob(await capturePng(), `${base}.png`))}
      >
        Screenshot
      </button>
      <button
        type="button"
        disabled={!has3d || busy !== null}
        title={has3d ? "Download the model as GLB" : "Open the 3D tab first"}
        onClick={() => run("glb", async () => downloadBlob(await exportGlb(), `${base}.glb`))}
      >
        {busy === "glb" ? "Exporting…" : "GLB"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        title="Save the project and its images as one file"
        onClick={() =>
          run("save", async () => {
            const text = await serializeProject(project, getBlob);
            downloadBlob(
              new Blob([text], { type: "application/json" }),
              `${safeFilename(project.name)}${PROJECT_FILE_EXT}`,
            );
          })
        }
      >
        Save file
      </button>
      <button type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
        Open file
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onOpen(f);
          e.target.value = "";
        }}
      />
      {message && <span className="export-message">{message}</span>}
    </div>
  );
}
