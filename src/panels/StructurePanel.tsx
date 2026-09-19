import type { ReactNode } from "react";
import {
  BeamSizeSchema,
  type Carport,
  CarportRoofTypeSchema,
  PostSizeSchema,
  RafterSizeSchema,
  RoofingSchema,
} from "@/schema/project";
import { useProject } from "@/store/useProject";

/** Manual parameter UI for the (first) carport. The LLM path patches the same store. */
export function StructurePanel() {
  const carport = useProject((s) => s.project.structures.find((x) => x.kind === "carport"));
  const updateStructure = useProject((s) => s.updateStructure);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);

  if (!carport) return <aside className="panel">No carport in this project.</aside>;

  const set = (fn: (c: Carport) => void) =>
    updateStructure(carport.id, (s) => {
      if (s.kind !== "carport") return s;
      const next = structuredClone(s);
      fn(next);
      return next;
    });

  return (
    <aside className="panel">
      <header>
        <h1>{carport.name}</h1>
        <div className="row">
          <button type="button" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </header>

      <Section title="Roof">
        <Select
          label="Type"
          value={carport.type}
          options={CarportRoofTypeSchema.options}
          onChange={(v) => set((c) => (c.type = v))}
        />
        <Num
          label="Pitch (rise / 12)"
          value={carport.roofPitch}
          min={0}
          max={12}
          step={0.5}
          onChange={(v) => set((c) => (c.roofPitch = v))}
        />
        <Num
          label="Eave overhang (ft)"
          value={carport.overhangFt.eave}
          min={0}
          max={4}
          step={0.25}
          onChange={(v) => set((c) => (c.overhangFt.eave = v))}
        />
        <Num
          label="Rake overhang (ft)"
          value={carport.overhangFt.rake}
          min={0}
          max={4}
          step={0.25}
          onChange={(v) => set((c) => (c.overhangFt.rake = v))}
        />
        <Select
          label="Roofing"
          value={carport.roofing}
          options={RoofingSchema.options}
          onChange={(v) => set((c) => (c.roofing = v))}
        />
      </Section>

      <Section title="Size">
        <Num
          label="Width (ft)"
          value={carport.widthFt}
          min={8}
          max={40}
          step={0.5}
          onChange={(v) => set((c) => (c.widthFt = v))}
        />
        <Num
          label="Depth (ft)"
          value={carport.depthFt}
          min={10}
          max={60}
          step={0.5}
          onChange={(v) => set((c) => (c.depthFt = v))}
        />
        <Num
          label="Plate height (ft)"
          value={carport.plateHeightFt}
          min={7}
          max={14}
          step={0.25}
          onChange={(v) => set((c) => (c.plateHeightFt = v))}
        />
        <Num
          label="Position X (ft)"
          value={carport.position[0]}
          min={-2000}
          max={2000}
          step={0.5}
          onChange={(v) => set((c) => (c.position = [v, c.position[1]]))}
        />
        <Num
          label="Position Y (ft)"
          value={carport.position[1]}
          min={-2000}
          max={2000}
          step={0.5}
          onChange={(v) => set((c) => (c.position = [c.position[0], v]))}
        />
        <Num
          label="Rotation (deg)"
          value={carport.rotationDeg}
          min={0}
          max={360}
          step={5}
          onChange={(v) => set((c) => (c.rotationDeg = v))}
        />
      </Section>

      <Section title="Posts">
        <Select
          label="Size"
          value={carport.posts.size}
          options={PostSizeSchema.options}
          onChange={(v) => set((c) => (c.posts.size = v))}
        />
        <Num
          label="Rows across width"
          value={carport.posts.countAlongWidth}
          min={2}
          max={4}
          step={1}
          onChange={(v) => set((c) => (c.posts.countAlongWidth = v))}
        />
        <Num
          label="Posts per row"
          value={carport.posts.countAlongDepth}
          min={2}
          max={8}
          step={1}
          onChange={(v) => set((c) => (c.posts.countAlongDepth = v))}
        />
      </Section>

      <Section title="Framing">
        <Select
          label="Beam"
          value={carport.framing.beamSize}
          options={BeamSizeSchema.options}
          onChange={(v) => set((c) => (c.framing.beamSize = v))}
        />
        <Num
          label="Beam plies"
          value={carport.framing.beamPly}
          min={1}
          max={3}
          step={1}
          onChange={(v) => set((c) => (c.framing.beamPly = v))}
        />
        <Select
          label="Rafter"
          value={carport.framing.rafterSize}
          options={RafterSizeSchema.options}
          onChange={(v) => set((c) => (c.framing.rafterSize = v))}
        />
        <Select
          label="Rafter spacing"
          value={String(carport.framing.rafterSpacingIn)}
          options={["16", "24"]}
          onChange={(v) => set((c) => (c.framing.rafterSpacingIn = v === "16" ? 16 : 24))}
        />
      </Section>

      <Section title="Colors">
        <Color label="Posts and beams" value={carport.colors.post} onChange={(v) => set((c) => (c.colors.post = v))} />
        <Color label="Rafters and trim" value={carport.colors.trim} onChange={(v) => set((c) => (c.colors.trim = v))} />
        <Color label="Roof" value={carport.colors.roof} onChange={(v) => set((c) => (c.colors.roof = v))} />
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Num(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v)) props.onChange(v);
        }}
      />
    </label>
  );
}

function Select<T extends string>(props: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Color(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}
