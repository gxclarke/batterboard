import { getSceneHandle } from "@/scene/sceneHandle";

/** Render the current view and hand back a PNG. Renders explicitly so no preserveDrawingBuffer is needed. */
export function capturePng(): Promise<Blob> {
  const h = getSceneHandle();
  if (!h) return Promise.reject(new Error("Open the 3D view first."));
  h.gl.render(h.scene, h.camera);
  return new Promise((resolve, reject) => {
    h.gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the canvas."))), "image/png");
  });
}
