import { describe, expect, it, vi } from "vitest";
import { type CounterStore, handleRequest, normalizeMessage, originAllowed } from "./handler";

class MemoryStore implements CounterStore {
  map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
}

const cfg = { allowedOrigins: ["https://app.example"], sessionCapPerDay: 2, ipCapPerDay: 3, cacheTtlSeconds: 60 };
const carport = { widthFt: 20, depthFt: 20 };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://w.example/patch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example",
      "cf-connecting-ip": "1.2.3.4",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe("handler", () => {
  it("answers CORS preflight", async () => {
    const res = await handleRequest(
      new Request("https://w.example/patch", { method: "OPTIONS", headers: { origin: "https://app.example" } }),
      new MemoryStore(),
      vi.fn(),
      cfg,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example");
  });

  it("rejects bad bodies", async () => {
    const res = await handleRequest(
      post({ sessionId: "short", message: "", carport }),
      new MemoryStore(),
      vi.fn(),
      cfg,
    );
    expect(res.status).toBe(400);
  });

  it("returns the model's validated reply and counts the turn", async () => {
    const ask = vi.fn(async () => ({ patch: { depthFt: 24 }, message: "Deepened to 24 ft." }));
    const store = new MemoryStore();
    const res = await handleRequest(
      post({ sessionId: "session-12345", message: "Make it deeper", carport }),
      store,
      ask,
      cfg,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ patch: { depthFt: 24 }, message: "Deepened to 24 ft." });
    expect(res.headers.get("x-turns-remaining")).toBe("1");
    expect(res.headers.get("x-cache")).toBe("miss");
  });

  it("serves repeats from cache without spending a turn", async () => {
    const ask = vi.fn(async () => ({ patch: { depthFt: 24 }, message: "Deepened." }));
    const store = new MemoryStore();
    await handleRequest(post({ sessionId: "session-12345", message: "Make it deeper!", carport }), store, ask, cfg);
    const res = await handleRequest(
      post({ sessionId: "session-67890", message: "make it   deeper", carport }),
      store,
      ask,
      cfg,
    );
    expect(ask).toHaveBeenCalledTimes(1);
    expect(res.headers.get("x-cache")).toBe("hit");
    expect(res.headers.get("x-turns-remaining")).toBe("2");
  });

  it("enforces the per-session cap with a 429", async () => {
    const ask = vi.fn(async (input: { message: string }) => ({ patch: null, message: input.message }));
    const store = new MemoryStore();
    for (const m of ["one", "two"])
      await handleRequest(post({ sessionId: "session-12345", message: m, carport }), store, ask, cfg);
    const res = await handleRequest(post({ sessionId: "session-12345", message: "three", carport }), store, ask, cfg);
    expect(res.status).toBe(429);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("enforces the per-IP cap across sessions", async () => {
    const ask = vi.fn(async (input: { message: string }) => ({ patch: null, message: input.message }));
    const store = new MemoryStore();
    for (const [s, m] of [
      ["session-aaaaaaa", "a"],
      ["session-bbbbbbb", "b"],
      ["session-ccccccc", "c"],
    ]) {
      await handleRequest(post({ sessionId: s, message: m, carport }), store, ask, cfg);
    }
    const res = await handleRequest(post({ sessionId: "session-ddddddd", message: "d", carport }), store, ask, cfg);
    expect(res.status).toBe(429);
  });

  it("refuses a model reply that fails the schema", async () => {
    const ask = vi.fn(async () => ({ patch: { plateHeightFt: 400 }, message: "Sure" }) as never);
    const res = await handleRequest(
      post({ sessionId: "session-12345", message: "make it 400 ft tall", carport }),
      new MemoryStore(),
      ask,
      cfg,
    );
    expect(res.status).toBe(502);
  });

  it("matches exact and wildcard origins", () => {
    const allowed = ["https://batterboard.pages.dev", "https://*.batterboard.pages.dev"];
    expect(originAllowed("https://batterboard.pages.dev", allowed)).toBe(true);
    expect(originAllowed("https://abc123.batterboard.pages.dev", allowed)).toBe(true);
    expect(originAllowed("https://evil.com", allowed)).toBe(false);
    expect(originAllowed("https://batterboard.pages.dev.evil.com", allowed)).toBe(false);
    expect(originAllowed("http://localhost:5173", allowed)).toBe(true);
  });

  it("normalizes messages for caching", () => {
    expect(normalizeMessage("  Make it DEEPER!! ")).toBe("make it deeper");
  });
});
