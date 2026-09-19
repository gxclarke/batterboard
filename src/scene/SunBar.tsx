import { useState } from "react";
import { useProject } from "@/store/useProject";
import { useUi } from "@/store/useUi";
import { dateFor, formatHour, sunState } from "./sunModel";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Time-of-day and time-of-year scrubber plus location, overlaid on the 3D view. */
export function SunBar() {
  const location = useProject((s) => s.project.site.location);
  const northOffsetDeg = useProject((s) => s.project.site.northOffsetDeg);
  const commit = useProject((s) => s.commit);
  const sun = useUi((s) => s.sun);
  const setSun = useUi((s) => s.setSun);
  const [editing, setEditing] = useState(false);
  const [lat, setLat] = useState(location ? String(location.lat) : "");
  const [lon, setLon] = useState(location ? String(location.lon) : "");
  const [error, setError] = useState<string | null>(null);

  const state = location
    ? sunState({ ...location, northOffsetDeg, date: dateFor(sun.month, sun.day, sun.hour) })
    : null;

  const saveLocation = (la: number, lo: number) => {
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
    commit("set location", (d) => {
      d.site.location = { lat: Math.round(la * 1e5) / 1e5, lon: Math.round(lo * 1e5) / 1e5 };
    });
    setLat(String(Math.round(la * 1e5) / 1e5));
    setLon(String(Math.round(lo * 1e5) / 1e5));
    setEditing(false);
    setError(null);
  };

  const useDevice = () => {
    if (!navigator.geolocation) {
      setError("This browser has no location service. Enter coordinates instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
      () => setError("Location was refused. Enter coordinates instead."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <div className="sunbar">
      {location ? (
        <>
          <label className="sunbar-time">
            <span>{formatHour(sun.hour)}</span>
            <input
              type="range"
              min={5}
              max={21}
              step={0.25}
              value={sun.hour}
              aria-label="Time of day"
              onChange={(e) => setSun({ hour: e.target.valueAsNumber })}
            />
          </label>
          <select
            aria-label="Month"
            value={sun.month}
            onChange={(e) => setSun({ month: Number(e.target.value), day: Math.min(sun.day, 28) })}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            aria-label="Day"
            min={1}
            max={31}
            value={sun.day}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (v >= 1 && v <= 31) setSun({ day: v });
            }}
          />
          {state && (
            <span className="sunbar-readout">
              {state.up
                ? `sun ${Math.round(state.altitudeDeg)}° high, bearing ${Math.round(state.bearingDeg)}°`
                : "sun is down"}
            </span>
          )}
          <button type="button" className="link" onClick={() => setEditing((v) => !v)}>
            {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
          </button>
        </>
      ) : (
        <>
          <span className="sunbar-readout">Set the location to get real sun angles.</span>
          <button type="button" onClick={useDevice}>
            Use my location
          </button>
          <button type="button" className="link" onClick={() => setEditing((v) => !v)}>
            Enter coordinates
          </button>
        </>
      )}
      {editing && (
        <span className="sunbar-coords">
          <input
            type="number"
            step="any"
            placeholder="lat"
            aria-label="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <input
            type="number"
            step="any"
            placeholder="lon"
            aria-label="Longitude"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
          />
          <button type="button" onClick={() => saveLocation(Number.parseFloat(lat), Number.parseFloat(lon))}>
            Save
          </button>
          {location && (
            <button type="button" onClick={useDevice}>
              Use my location
            </button>
          )}
        </span>
      )}
      {error && <span className="warn">{error}</span>}
    </div>
  );
}
