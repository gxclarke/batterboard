/** Lets code outside the Canvas reach the live renderer, scene and camera for export. */
import type { Camera, Scene, WebGLRenderer } from "three";

export interface SceneHandle {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
}

let current: SceneHandle | null = null;
const listeners = new Set<() => void>();

export function setSceneHandle(handle: SceneHandle | null): void {
  current = handle;
  for (const l of listeners) l();
}

export function getSceneHandle(): SceneHandle | null {
  return current;
}

export function subscribeSceneHandle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
