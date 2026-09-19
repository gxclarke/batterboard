import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { Vector3 } from "three";
import { siteToThree } from "@/geometry/frame";
import { useProject } from "@/store/useProject";
import { useUi } from "@/store/useUi";
import { Context } from "./Context";
import { Ground } from "./Ground";
import { Structures } from "./Structures";
import { Sun } from "./Sun";
import { SunBar } from "./SunBar";

/** Center and radius of everything placed on the site, in Three.js coordinates. */
export function sceneExtent(): { center: Vector3; radius: number } {
  const { structures, masses } = useProject.getState().project;
  const pts = [...structures.map((s) => s.position), ...masses.flatMap((m) => m.footprint)];
  if (pts.length === 0) return { center: new Vector3(0, 0, 0), radius: 40 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    center: siteToThree([(minX + maxX) / 2, (minY + maxY) / 2]),
    radius: Math.max(20, Math.hypot(maxX - minX, maxY - minY) / 2 + 15),
  };
}

function frameScene(): { target: Vector3; position: Vector3 } {
  const { structures, masses } = useProject.getState().project;
  const pts = [...structures.map((s) => s.position), ...masses.flatMap((m) => m.footprint)];
  if (pts.length === 0) return { target: new Vector3(0, 6, 0), position: new Vector3(38, 24, 38) };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const center = siteToThree([(minX + maxX) / 2, (minY + maxY) / 2]).add(new Vector3(0, 4, 0));
  const radius = Math.max(20, Math.hypot(maxX - minX, maxY - minY) / 2 + 15);
  // Look from the structure's side of the site so context blocks don't hide it.
  const first = structures[0];
  const focus = first ? siteToThree(first.position).add(new Vector3(0, 4, 0)) : center;
  const target = center.clone().lerp(focus, 0.6);
  const away = focus.clone().sub(center).setY(0);
  if (away.lengthSq() < 1) away.set(1, 0, 1);
  away.normalize();
  const position = target
    .clone()
    .add(away.multiplyScalar(radius * 1.1))
    .add(new Vector3(0, radius * 0.75, 0));
  return { target, position };
}

/** Applies Top / Perspective requests to the camera and orbit controls. */
function CameraRig({ framing }: { framing: { target: Vector3; position: Vector3 } }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const request = useUi((s) => s.viewRequest);
  const requestView = useUi((s) => s.requestView);
  useEffect(() => {
    if (!request || !controls) return;
    const extent = sceneExtent();
    if (request === "top") {
      controls.target.copy(extent.center);
      camera.position.set(extent.center.x, extent.radius * 3.4, extent.center.z + 0.01);
    } else {
      controls.target.copy(framing.target);
      camera.position.copy(framing.position);
    }
    camera.lookAt(controls.target);
    controls.update();
    requestView(null);
  }, [request, controls, camera, framing, requestView]);
  return null;
}

function ViewButtons() {
  const requestView = useUi((s) => s.requestView);
  return (
    <div className="view-buttons">
      <button type="button" onClick={() => requestView("top")}>
        Top
      </button>
      <button type="button" onClick={() => requestView("perspective")}>
        Perspective
      </button>
    </div>
  );
}

export function Viewport() {
  // Frame the structures and any traced blocks once per mount; the user orbits freely after that.
  const [framing] = useState(() => frameScene());
  return (
    <>
      <Canvas
        shadows
        camera={{ position: framing.position, fov: 45, near: 0.5, far: 1500 }}
        gl={{ antialias: true }}
        style={{ background: "#dfe6ee" }}
      >
        <Sun />
        <Structures />
        <Context />
        <Ground />
        <OrbitControls target={framing.target} maxPolarAngle={Math.PI / 2 - 0.02} makeDefault />
        <CameraRig framing={framing} />
      </Canvas>
      <ViewButtons />
      <SunBar />
    </>
  );
}
