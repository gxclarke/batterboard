# 0001. Record architecture decisions

Date: 2026-09-18. Status: accepted.

## Context

The build plan in `docs/plan.md` is the working spec, but decisions made in conversation while building drift away from it unless written down somewhere durable.

## Decision

Keep ADRs in `docs/adr/`, one per decision, indexed in `README.md`. The plan stays as written; where a decision amends it, the plan's amendments section points at the ADR.

## Consequences

Anyone (including a future Claude Code session) can see why the code disagrees with the plan without re-deriving it.
