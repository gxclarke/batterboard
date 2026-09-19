# 0012. Natural language: structured patches through one Worker

Date: 2026-09-19. Status: accepted.

## Context

The plan's central rule: the model never produces geometry, only validated parameters, and the app must be complete without it. Phase 3 adds the chat panel and the one piece of server code.

## Decision

- **Contract.** `src/llm/patch.ts` defines `CarportPatchSchema`, a strict deep-partial of the carport (no id, no kind), and `AssistantReplySchema` = `{ patch | null, message }`. The Worker validates the model's output with it; the client validates the Worker's reply with it, merges, re-validates the whole carport, and commits one undo step with a change list the user can read.
- **Wire format.** The model does not emit the sparse patch directly. Structured output compiles the schema to a grammar, and the API caps it at 24 optional properties and 16 union-typed (including nullable) properties; a flat partial carport hits one or the other, and tuples are not expressible at all. So `AssistantReplyWireSchema` is `{ changes: [{ field, value }], message }`: `field` is a dotted leaf path (`widthFt`, `framing.rafterSpacingIn`, `position.x`) drawn from the patch shape, `value` is text. It has no optionals and no unions. `fromWire` coerces each value by its leaf type and rebuilds the `CarportPatch`, which then passes through the normal validation. Tests pin the grammar cost at zero.
- **Model call.** `claude-opus-5` through the official SDK, `messages.parse` with `zodOutputFormat(AssistantReplyWireSchema)`, medium effort, a frozen system prompt marked for prompt caching, no images ever. A refusal returns a polite message, never an error. Keys that are not scoped to one workspace need `ANTHROPIC_WORKSPACE_ID`, sent as the `anthropic-workspace-id` header.
- **Cost controls in the Worker.** Per-session and per-IP daily caps in KV, a 7-day reply cache keyed on the normalized message plus current parameters (cache hits are free and do not count), request size limits, CORS pinned to the app's origin. The hard monthly spend cap lives on the API key itself.
- **Flag.** The panel exists only when `VITE_LLM_ENDPOINT` is set at build time. The parameter panel is the product; the assistant is an accelerator.
- **Packaging.** `worker/` is a workspace package with its own wrangler config; the request handler is pure and tested with a fake store and a fake model.

## Consequences

A wrong or unavailable model degrades to a message in the panel. The prompt is the only place that knows what "two SUVs" means; changing it invalidates the reply cache naturally because the cache key does not include it, so bump the cache key prefix when the prompt changes materially.
