import { useRef, useState } from "react";
import { applyPatch, type Change, formatValue } from "@/llm/patch";
import { CapReachedError, requestPatch, type Turn } from "@/llm/worker-client";
import type { Carport } from "@/schema/project";
import { useProject } from "@/store/useProject";

interface Entry {
  id: number;
  role: "user" | "assistant";
  text: string;
  changes?: Change[];
  error?: boolean;
}

/** Natural-language edits. The model proposes a patch; the app validates and applies it as one undo step. */
export function ChatPanel({ carport }: { carport: Carport }) {
  const updateStructure = useProject((s) => s.updateStructure);
  const undo = useProject((s) => s.undo);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const nextId = useRef(1);

  const push = (e: Omit<Entry, "id">) => {
    const id = nextId.current;
    nextId.current += 1;
    setEntries((prev) => [...prev, { id, ...e }]);
  };

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const history: Turn[] = entries.filter((e) => !e.error).map((e) => ({ role: e.role, content: e.text }));
    push({ role: "user", text: message });
    try {
      const reply = await requestPatch(message, carport, history);
      setRemaining(reply.remaining);
      if (!reply.patch) {
        push({ role: "assistant", text: reply.message });
        return;
      }
      const result = applyPatch(carport, reply.patch);
      if (!result.ok) {
        push({ role: "assistant", text: `That would put a value out of range (${result.reason}).`, error: true });
        return;
      }
      if (result.changes.length > 0) {
        updateStructure(carport.id, (s) => (s.kind === "carport" ? result.carport : s));
      }
      push({ role: "assistant", text: reply.message, changes: result.changes });
    } catch (err) {
      const text = err instanceof CapReachedError ? err.message : err instanceof Error ? err.message : String(err);
      push({ role: "assistant", text, error: true });
      if (err instanceof CapReachedError) setRemaining(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="chat">
      <h2>
        Ask for a change
        {remaining !== null && <small className="muted">{remaining} free turns left</small>}
      </h2>
      {entries.length > 0 && (
        <ol className="chat-log">
          {entries.map((e) => (
            <li key={e.id} className={`${e.role}${e.error ? " error" : ""}`}>
              <p>{e.text}</p>
              {e.changes && e.changes.length > 0 && (
                <ul className="chat-changes">
                  {e.changes.map((c) => (
                    <li key={c.path}>
                      {c.label}: {formatValue(c.path, c.from)} → {formatValue(c.path, c.to)}
                    </li>
                  ))}
                  <li>
                    <button type="button" className="link" onClick={undo}>
                      Undo this
                    </button>
                  </li>
                </ul>
              )}
              {e.changes && e.changes.length === 0 && !e.error && <p className="hint">No change was needed.</p>}
            </li>
          ))}
        </ol>
      )}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "make it deep enough for two SUVs"'
          disabled={busy || remaining === 0}
          aria-label="Ask for a change"
        />
        <button type="submit" className="primary" disabled={busy || !input.trim() || remaining === 0}>
          {busy ? "…" : "Send"}
        </button>
      </form>
      <p className="hint">
        The assistant only adjusts the numbers you see in this panel. Every change is one undo step.
      </p>
    </section>
  );
}
