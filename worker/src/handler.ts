/**
 * Request handling, kept free of Cloudflare specifics so it can run under
 * Vitest with a fake store and a fake model. index.ts wires the real ones.
 */
import { z } from "zod";
import { AssistantReplySchema } from "../../src/llm/patch";
import type { AskModel, Turn } from "./model";

export interface CounterStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface HandlerConfig {
  allowedOrigins: string[];
  sessionCapPerDay: number;
  ipCapPerDay: number;
  cacheTtlSeconds: number;
  now?: () => Date;
}

const RequestSchema = z.object({
  sessionId: z.string().min(8).max(64),
  message: z.string().trim().min(1).max(500),
  carport: z.record(z.string(), z.unknown()),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) }))
    .max(6)
    .default([]),
});

const DAY = 24 * 60 * 60;

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Exact match, or a `https://*.example.com` entry matching one subdomain level. */
export function originAllowed(origin: string, allowed: string[]): boolean {
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  for (const entry of allowed) {
    if (entry === origin) return true;
    const m = /^(https?):\/\/\*\.(.+)$/.exec(entry);
    if (m && new RegExp(`^${m[1]}://[a-z0-9-]+\\.${m[2]?.replace(/\./g, "\\.")}$`, "i").test(origin)) return true;
  }
  return false;
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin !== null && originAllowed(origin, allowed);
  return {
    "access-control-allow-origin": ok && origin ? origin : (allowed[0] ?? ""),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-expose-headers": "x-turns-remaining, x-cache",
    vary: "origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalize a request for the cache: case, whitespace, punctuation at the end. */
export function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?\s]+$/g, "")
    .trim();
}

export async function handleRequest(
  req: Request,
  store: CounterStore,
  askModel: AskModel,
  cfg: HandlerConfig,
): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, cfg.allowedOrigins);
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST" || url.pathname !== "/patch") return json({ error: "not found" }, 404, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "expected JSON" }, 400, cors);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "bad request", issues: parsed.error.issues.slice(0, 3) }, 400, cors);
  const { sessionId, message, carport, history } = parsed.data;

  const now = (cfg.now ?? (() => new Date()))();
  const day = dayKey(now);
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const sessionKey = `s:${sessionId}:${day}`;
  const ipKey = `ip:${ip}:${day}`;
  const sessionUsed = Number.parseInt((await store.get(sessionKey)) ?? "0", 10);
  const ipUsed = Number.parseInt((await store.get(ipKey)) ?? "0", 10);
  if (sessionUsed >= cfg.sessionCapPerDay || ipUsed >= cfg.ipCapPerDay) {
    return json({ error: "cap reached" }, 429, { ...cors, "x-turns-remaining": "0" });
  }

  // Cached answers do not count against the cap: they cost nothing.
  const cacheKey = `c:${await sha256(`${normalizeMessage(message)}|${JSON.stringify(carport)}`)}`;
  const cached = history.length === 0 ? await store.get(cacheKey) : null;
  if (cached) {
    const reply = AssistantReplySchema.safeParse(JSON.parse(cached));
    if (reply.success) {
      return json(reply.data, 200, {
        ...cors,
        "x-cache": "hit",
        "x-turns-remaining": String(cfg.sessionCapPerDay - sessionUsed),
      });
    }
  }

  let reply: z.infer<typeof AssistantReplySchema>;
  try {
    reply = AssistantReplySchema.parse(await askModel({ carport, message, history: history as Turn[] }));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "model error" }, 502, cors);
  }

  await store.put(sessionKey, String(sessionUsed + 1), { expirationTtl: 2 * DAY });
  await store.put(ipKey, String(ipUsed + 1), { expirationTtl: 2 * DAY });
  if (history.length === 0) await store.put(cacheKey, JSON.stringify(reply), { expirationTtl: cfg.cacheTtlSeconds });

  return json(reply, 200, {
    ...cors,
    "x-cache": "miss",
    "x-turns-remaining": String(cfg.sessionCapPerDay - sessionUsed - 1),
  });
}
