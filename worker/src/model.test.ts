import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AssistantReplyWireSchema } from "../../src/llm/patch";

/**
 * Structured output compiles the schema to a grammar. The API caps optional properties at 24 and
 * union-typed (including nullable) properties at 16, and rejected 15 flat optionals as "Schema is
 * too complex". The wire schema keeps both at zero.
 */
function grammarCost(node: unknown, cost = { optional: 0, union: 0 }): { optional: number; union: number } {
  if (!node || typeof node !== "object") return cost;
  const n = node as Record<string, unknown>;
  if (Array.isArray(n.type) || Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) cost.union += 1;
  if (n.type === "object" && n.properties && typeof n.properties === "object") {
    const required = new Set((n.required as string[] | undefined) ?? []);
    for (const [key, child] of Object.entries(n.properties as Record<string, unknown>)) {
      if (!required.has(key)) cost.optional += 1;
      grammarCost(child, cost);
    }
  }
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    for (const child of (n[key] as unknown[] | undefined) ?? []) grammarCost(child, cost);
  }
  if (n.items) grammarCost(n.items, cost);
  if (n.$defs && typeof n.$defs === "object") {
    for (const child of Object.values(n.$defs as Record<string, unknown>)) grammarCost(child, cost);
  }
  return cost;
}

describe("structured output format", () => {
  it("builds a strict JSON schema from the reply schema (no tuples, no typeless nodes)", () => {
    expect(() => zodOutputFormat(AssistantReplyWireSchema)).not.toThrow();
  });

  it("has no optional and no union-typed properties", () => {
    expect(grammarCost(z.toJSONSchema(AssistantReplyWireSchema))).toEqual({ optional: 0, union: 0 });
  });
});
