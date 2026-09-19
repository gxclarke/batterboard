import { handleRequest } from "./handler";
import { type AskModel, makeAskModel } from "./model";

interface Env {
  LIMITS: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  /** Needed when the key is not scoped to a single workspace (wrkspc_...). */
  ANTHROPIC_WORKSPACE_ID?: string;
  ALLOWED_ORIGINS: string;
  SESSION_CAP_PER_DAY: string;
  IP_CAP_PER_DAY: string;
  MODEL: string;
}

/** Without a key the Worker still answers CORS and validation; only the model call fails, clearly. */
const notConfigured: AskModel = async () => {
  throw new Error("The assistant is not configured yet (ANTHROPIC_API_KEY is not set).");
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const askModel = env.ANTHROPIC_API_KEY
      ? makeAskModel(env.ANTHROPIC_API_KEY, env.MODEL || "claude-opus-5", env.ANTHROPIC_WORKSPACE_ID || undefined)
      : notConfigured;
    return handleRequest(req, env.LIMITS, askModel, {
      allowedOrigins: env.ALLOWED_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sessionCapPerDay: Number.parseInt(env.SESSION_CAP_PER_DAY || "15", 10),
      ipCapPerDay: Number.parseInt(env.IP_CAP_PER_DAY || "60", 10),
      cacheTtlSeconds: 7 * 24 * 60 * 60,
    });
  },
} satisfies ExportedHandler<Env>;
