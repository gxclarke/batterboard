import { layoutRoof } from "@/geometry/roof";
import { type Mass, MassRoofTypeSchema, type Surface, SurfaceMaterialSchema } from "@/schema/project";
import { useProject } from "@/store/useProject";
import { type Selection, useUi } from "@/store/useUi";
import { area, longestEdgeDeg } from "@/trace/polygon";

/** Properties of whatever is selected in the site view. */
export function SelectedPanel({ selection }: { selection: Selection }) {
  const project = useProject((s) => s.project);
  if (selection.kind === "mass") {
    const m = project.masses.find((x) => x.id === selection.id);
    return m ? <MassPanel mass={m} /> : null;
  }
  if (selection.kind === "surface") {
    const s = project.surfaces.find((x) => x.id === selection.id);
    return s ? <SurfacePanel surface={s} /> : null;
  }
  const st = project.structures.find((x) => x.id === selection.id);
  if (!st) return null;
  return (
    <section className="tool">
      <h2>{st.name}</h2>
      <p>
        {st.widthFt} × {st.depthFt} ft at {st.rotationDeg}°. Use <em>Place</em> to move it here, or the 3D tab to change
        everything else.
      </p>
    </section>
  );
}

function MassPanel({ mass }: { mass: Mass }) {
  const commit = useProject((s) => s.commit);
  const select = useUi((s) => s.select);
  const set = (fn: (m: Mass) => void) =>
    commit("edit block", (d) => {
      const target = d.masses.find((x) => x.id === mass.id);
      if (target) fn(target);
    });
  const remove = () => {
    commit("delete block", (d) => {
      d.masses = d.masses.filter((x) => x.id !== mass.id);
    });
    select(null);
  };
  const note = layoutRoof(mass.footprint, mass.baseElevation, mass.wallHeight, mass.roof).note;

  return (
    <section className="tool">
      <h2>Block</h2>
      <label>
        <span>Name</span>
        <input type="text" value={mass.name} onChange={(e) => set((m) => (m.name = e.target.value || "Block"))} />
      </label>
      <p className="hint">{area(mass.footprint).toFixed(0)} sq ft footprint</p>
      <label>
        <span>Wall height (ft)</span>
        <input
          type="number"
          min={4}
          max={80}
          step={0.5}
          value={mass.wallHeight}
          onChange={(e) => num(e, (v) => set((m) => (m.wallHeight = v)))}
        />
      </label>
      <label>
        <span>Base elevation (ft)</span>
        <input
          type="number"
          min={-20}
          max={100}
          step={0.25}
          value={mass.baseElevation}
          onChange={(e) => num(e, (v) => set((m) => (m.baseElevation = v)))}
        />
      </label>
      <label>
        <span>Roof</span>
        <select
          value={mass.roof.type}
          onChange={(e) => set((m) => (m.roof.type = e.target.value as Mass["roof"]["type"]))}
        >
          {MassRoofTypeSchema.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      {mass.roof.type !== "flat" && (
        <>
          <label>
            <span>Pitch (rise / 12)</span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={mass.roof.pitch}
              onChange={(e) => num(e, (v) => set((m) => (m.roof.pitch = v)))}
            />
          </label>
          <label>
            <span>Overhang (ft)</span>
            <input
              type="number"
              min={0}
              max={4}
              step={0.25}
              value={mass.roof.overhangFt}
              onChange={(e) => num(e, (v) => set((m) => (m.roof.overhangFt = v)))}
            />
          </label>
          <label>
            <span>{mass.roof.type === "shed" ? "Slopes down toward (deg)" : "Ridge direction (deg)"}</span>
            <input
              type="number"
              min={0}
              max={360}
              step={1}
              value={Math.round(mass.roof.ridgeAxisDeg)}
              onChange={(e) => num(e, (v) => set((m) => (m.roof.ridgeAxisDeg = ((v % 360) + 360) % 360)))}
            />
          </label>
          <div className="row">
            <button type="button" onClick={() => set((m) => (m.roof.ridgeAxisDeg = longestEdgeDeg(m.footprint)))}>
              Along long side
            </button>
            <button type="button" onClick={() => set((m) => (m.roof.ridgeAxisDeg = (m.roof.ridgeAxisDeg + 90) % 360))}>
              Turn 90°
            </button>
          </div>
        </>
      )}
      {note && <p className="warn">{note}</p>}
      <label>
        <span>Wall color</span>
        <input type="color" value={mass.color} onChange={(e) => set((m) => (m.color = e.target.value))} />
      </label>
      <div className="row">
        <button type="button" onClick={remove}>
          Delete block
        </button>
      </div>
    </section>
  );
}

function SurfacePanel({ surface }: { surface: Surface }) {
  const commit = useProject((s) => s.commit);
  const select = useUi((s) => s.select);
  const set = (fn: (s: Surface) => void) =>
    commit("edit surface", (d) => {
      const target = d.surfaces.find((x) => x.id === surface.id);
      if (target) fn(target);
    });
  const remove = () => {
    commit("delete surface", (d) => {
      d.surfaces = d.surfaces.filter((x) => x.id !== surface.id);
    });
    select(null);
  };
  return (
    <section className="tool">
      <h2>Surface</h2>
      <label>
        <span>Name</span>
        <input type="text" value={surface.name} onChange={(e) => set((s) => (s.name = e.target.value || "Surface"))} />
      </label>
      <label>
        <span>Material</span>
        <select
          value={surface.material}
          onChange={(e) => set((s) => (s.material = e.target.value as Surface["material"]))}
        >
          {SurfaceMaterialSchema.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{area(surface.polygon).toFixed(0)} sq ft</p>
      <div className="row">
        <button type="button" onClick={remove}>
          Delete surface
        </button>
      </div>
    </section>
  );
}

function num(e: React.ChangeEvent<HTMLInputElement>, fn: (v: number) => void) {
  const v = e.target.valueAsNumber;
  if (Number.isFinite(v)) fn(v);
}
