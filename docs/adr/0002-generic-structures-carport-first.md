# 0002. Generic structures model, carport first

Date: 2026-09-18. Status: accepted.

## Context

The plan describes a carport tool with `structure: Carport`, exactly one per project. The owner clarified that the carport is the first example: Batterboard should support rough designs for a variety of buildings and spaces (sheds, pergolas, decks, and so on), possibly several on one site.

## Decision

- `Project.structures` is an array of `Structure`, a zod discriminated union on `kind`. `carport` is the only member in v1.
- Each kind owns its parameter schema in `src/schema/project.ts` and a pure generator in `src/geometry/structures/<kind>.ts`. `src/geometry/structures/index.ts` is the registry that maps a structure to a placed `THREE.Group`.
- Common fields on every kind: `id`, `name`, `position`, `rotationDeg`.
- Panels, checks, and the LLM patch path address structures by id.

## Consequences

Adding a kind is a schema member, a generator, a panel, and checks. Nothing else changes. The one-carport UI in early phases is a convenience over the first structure, not a data-model constraint.
