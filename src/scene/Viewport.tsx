import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useProject } from "@/store/useProject";
import { Ground } from "./Ground";
import { Structures } from "./Structures";
import { Sun } from "./Sun";

export function Viewport() {
  const view = useProject((s) => s.project.view);
  return (
    <Canvas
      shadows
      camera={{ position: view.cameraPosition, fov: 45, near: 0.5, far: 1500 }}
      gl={{ antialias: true }}
      style={{ background: "#dfe6ee" }}
    >
      <Sun />
      <Structures />
      <Ground />
      <OrbitControls target={view.cameraTarget} maxPolarAngle={Math.PI / 2 - 0.02} makeDefault />
    </Canvas>
  );
}
