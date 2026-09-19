import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getSceneHandle } from "@/scene/sceneHandle";

/** Export the live scene (structures, blocks, surfaces, ground imagery) as binary glTF. */
export async function exportGlb(): Promise<Blob> {
  const h = getSceneHandle();
  if (!h) throw new Error("Open the 3D view first.");
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(h.scene, { binary: true, onlyVisible: true });
  if (!(result instanceof ArrayBuffer)) throw new Error("Unexpected exporter output");
  return new Blob([result], { type: "model/gltf-binary" });
}
