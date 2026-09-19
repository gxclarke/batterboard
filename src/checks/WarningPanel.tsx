import { useMemo, useState } from "react";
import type { Structure } from "@/schema/project";
import { useProject } from "@/store/useProject";
import { DISCLAIMER, warningsFor } from "./rules";

/** Amber advisories for one structure, with the concept-tool disclaimer. */
export function WarningPanel({ structure }: { structure: Structure }) {
  const project = useProject((s) => s.project);
  const warnings = useMemo(() => warningsFor(project, structure), [project, structure]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <section className={`checks ${warnings.length === 0 ? "checks-ok" : ""}`}>
      <h2>
        Reality check
        <button type="button" className="link" onClick={() => setShowDisclaimer((v) => !v)} title="About these checks">
          ?
        </button>
      </h2>
      {showDisclaimer && <p className="hint">{DISCLAIMER}</p>}
      {warnings.length === 0 ? (
        <p className="ok">Nothing a builder would flag at a glance.</p>
      ) : (
        <ul>
          {warnings.map((w) => (
            <li key={w.id} className={w.severity}>
              <strong>{w.title}</strong>
              <span>{w.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
