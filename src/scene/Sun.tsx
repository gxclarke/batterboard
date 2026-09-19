/**
 * The sun as a shadow-casting directional light. With a location, suncalc
 * drives it from the scrubber; without one, a fixed afternoon light stands in.
 * Shadow bounds come from the framed scene so the map is neither acne-ridden
 * nor clipped.
 */
import { useEffect, useMemo, useRef } from "react";
import { Color, type DirectionalLight, Object3D, Vector3 } from "three";
import { useProject } from "@/store/useProject";
import { useUi } from "@/store/useUi";
import { dateFor, sunState } from "./sunModel";
import { sceneExtent } from "./Viewport";

const LIGHT_DISTANCE = 220;
const WARM = new Color("#ffd2a0");
const NOON = new Color("#fff7ec");

export function Sun() {
  const location = useProject((s) => s.project.site.location);
  const northOffsetDeg = useProject((s) => s.project.site.northOffsetDeg);
  const sun = useUi((s) => s.sun);
  const lightRef = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const extent = useMemo(() => sceneExtent(), []);

  const state = useMemo(() => {
    if (!location) return null;
    return sunState({ ...location, northOffsetDeg, date: dateFor(sun.month, sun.day, sun.hour) });
  }, [location, northOffsetDeg, sun]);

  // fixed stand-in: high, from the south-west
  const dir = state ? state.dir : ([-0.45, 0.72, 0.53] as const);
  const altitude = state ? state.altitudeDeg : 46;
  const up = state ? state.up : true;
  const strength = up ? Math.min(1, Math.max(0.15, Math.sin((altitude * Math.PI) / 180) * 1.4)) : 0;
  const color = useMemo(() => WARM.clone().lerp(NOON, Math.min(1, altitude / 50)), [altitude]);

  const position = useMemo(
    () => new Vector3(dir[0], dir[1], dir[2]).multiplyScalar(LIGHT_DISTANCE).add(extent.center),
    [dir, extent.center],
  );

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    target.position.copy(extent.center);
    light.target = target;
    const r = extent.radius + 20;
    const cam = light.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = LIGHT_DISTANCE * 2;
    cam.updateProjectionMatrix();
  }, [extent, target]);

  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={["#dfe9f3", "#7a6a55", up ? 0.35 + 0.35 * strength : 0.25]} />
      <directionalLight
        ref={lightRef}
        position={position}
        color={color}
        intensity={2.4 * strength}
        castShadow={up && altitude > 1}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}
