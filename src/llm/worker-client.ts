/**
 * Fetch wrapper for the Batterboard Worker. The endpoint comes from
 * VITE_LLM_ENDPOINT at build time; when it is unset the whole natural-language
 * panel stays hidden and nothing here is called.
 */
import type { Carport } from "@/schema/project";
import { type AssistantReply, AssistantReplySchema, describeCarport } from "./patch";

export const LLM_ENDPOINT: string | undefined = (import.meta.env.VITE_LLM_ENDPOINT as string | undefined) || undefined;

export function llmEnabled(): boolean {
  return Boolean(LLM_ENDPOINT);
}

const SESSION_KEY = "batterboard.session";

/** A random per-browser id the Worker uses for the free-turn cap. Not identity. */
export function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface PatchResponse extends AssistantReply {
  /** free turns left in this session, when the Worker reports it */
  remaining: number | null;
  cached: boolean;
}

export class CapReachedError extends Error {
  constructor() {
    super("You have used all the free assistant turns for this session. The panel on the right still does everything.");
  }
}

export async function requestPatch(message: string, carport: Carport, history: Turn[]): Promise<PatchResponse> {
  if (!LLM_ENDPOINT) throw new Error("Assistant is not configured.");
  const res = await fetch(`${LLM_ENDPOINT.replace(/\/$/, "")}/patch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: sessionId(),
      message,
      carport: describeCarport(carport),
      history: history.slice(-6),
    }),
  });
  const remaining = Number.parseInt(res.headers.get("x-turns-remaining") ?? "", 10);
  if (res.status === 429) throw new CapReachedError();
  if (!res.ok) throw new Error(`Assistant error (${res.status}). Try again in a moment.`);
  const json: unknown = await res.json();
  const parsed = AssistantReplySchema.safeParse(json);
  if (!parsed.success) throw new Error("The assistant sent something the app could not understand.");
  return {
    ...parsed.data,
    remaining: Number.isFinite(remaining) ? remaining : null,
    cached: res.headers.get("x-cache") === "hit",
  };
}
