/**
 * Directional light standing in for the sun. Phase 1 replaces the fixed
 * direction with suncalc. Shadow settings are tuned for a site on the order of
 * 150 ft across; revisit bounds when the site model lands.
 */
export function Sun() {
  return (
    <>
      <hemisphereLight args={["#dfe9f3", "#7a6a55", 0.55]} />
      <directionalLight
        position={[45, 70, 25]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}
