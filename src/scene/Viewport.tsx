import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { Vector3 } from "three";
import { siteToThree } from "@/geometry/frame";
import { useProject } from "@/store/useProject";
import { Ground } from "./Ground";
import { Structures } from "./Structures";
import { Sun } from "./Sun";

export function Viewport() {
  // Frame the first structure once per mount; the user orbits freely after that.
  const [framing] = useState(() => {
    const first = useProject.getState().project.structures[0];
    const target = first ? siteToThree(first.position).add(new Vector3(0, 6, 0)) : new Vector3(0, 6, 0);
    const position = target.clone().add(new Vector3(38, 24, 38));
    return { target, position };
  });
  return (
    <Canvas
      shadows
      camera={{ position: framing.position, fov: 45, near: 0.5, far: 1500 }}
      gl={{ antialias: true }}
      style={{ background: "#dfe6ee" }}
    >
      <Sun />
      <Structures />
      <Ground />
      <OrbitControls target={framing.target} maxPolarAngle={Math.PI / 2 - 0.02} makeDefault />
    </Canvas>
  );
}
