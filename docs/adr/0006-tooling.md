# 0006. Tooling

Date: 2026-09-18. Status: accepted.

## Decision

Mirror the owner's other repos: pnpm, Biome (format and lint, 2-space, 120 columns, double quotes), lefthook pre-commit running Biome and cspell on staged files, Vitest for unit tests. Single package for now; the Cloudflare Worker becomes its own workspace package when Phase 3 starts.

**React 19, not 18.** The plan says React 18, but react-three-fiber 9 (current) requires React 19. Nothing in the plan depends on 18.

## Commands

`pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm spell`, `pnpm build`.
