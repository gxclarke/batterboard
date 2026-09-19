# 0007. LLM: Claude Opus through a single Worker

Date: 2026-09-18. Status: accepted.

## Decision

Phase 3 uses Claude Opus via the Anthropic API, called only from the Cloudflare Worker. The plan's "small model" guidance is overridden by the owner; the other cost controls stand (tight system prompt, no image input, per-session cap, response cache, monthly spend cap on the key).

Session identity for the cap: a client-generated id stored in localStorage, with a per-IP backstop in the Worker.

The Worker is the only place that sees the API key. The browser never calls the provider directly.
