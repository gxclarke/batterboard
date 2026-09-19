# Batterboard Worker

The only server-side code in Batterboard: a Cloudflare Worker that turns a homeowner's sentence into a validated parameter patch for the carport. The browser never holds the API key.

## What it does

`POST /patch` with `{ sessionId, message, carport, history }` returns `{ patch, message }`.

- Validates the request and the model's reply with the same zod schema the app uses (`src/llm/patch.ts`).
- Caps free turns per session per day and per IP per day (KV counters).
- Caches replies by normalized message plus current parameters, so repeats cost nothing.
- Calls Claude with a frozen, cached system prompt and structured output.
- Answers CORS only for the origins in `ALLOWED_ORIGINS` (exact, or `https://*.example.com`), plus localhost.

## Live

- Worker: `https://batterboard-llm.batterboard-worker.workers.dev`
- Site: `https://batterboard.batterboard-worker.workers.dev` (a Worker serving `dist/` as static assets, configured in the root `wrangler.jsonc`)

## First-time setup (already done for this account)

```
pnpm -C worker exec wrangler login
pnpm -C worker exec wrangler kv namespace create LIMITS   # id goes in worker/wrangler.jsonc
```

## The one manual step: the API key

Create an Anthropic API key with a hard monthly spend cap, then store it as a secret. Never put it in a file.

```
pnpm -C worker exec wrangler secret put ANTHROPIC_API_KEY
```

Until it exists the Worker answers CORS and validation normally and returns a clear 502 for the model call.

If the key is a personal or service-account key that is not scoped to a single workspace, also set `ANTHROPIC_WORKSPACE_ID` in `wrangler.jsonc` to the `wrkspc_...` id (Settings > Workspaces) and redeploy. A key created for one workspace needs nothing extra.

## Deploy

```
pnpm run deploy:worker                                    # the Worker
VITE_LLM_ENDPOINT=https://batterboard-llm.batterboard-worker.workers.dev pnpm build && pnpm run deploy:site
```

Leave `VITE_LLM_ENDPOINT` unset to ship the site without the assistant panel.

## Local

`pnpm -C worker dev` starts the Worker on 8787 (set the secret locally with a `worker/.dev.vars` file containing `ANTHROPIC_API_KEY=...`, which is gitignored). Then `VITE_LLM_ENDPOINT=http://localhost:8787 pnpm dev` at the root.
