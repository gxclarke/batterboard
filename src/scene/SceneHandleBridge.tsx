import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { setSceneHandle } from "./sceneHandle";

/** Mount inside the Canvas. Publishes gl/scene/camera while the viewport is alive. */
export function SceneHandleBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    setSceneHandle({ gl, scene, camera });
    return () => setSceneHandle(null);
  }, [gl, scene, camera]);
  return null;
}
