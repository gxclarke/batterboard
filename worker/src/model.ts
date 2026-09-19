/** The only file that talks to Anthropic. Structured output validated by the shared zod schema. */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type AssistantReply, AssistantReplyWireSchema, fromWire } from "../../src/llm/patch";
import { SYSTEM_PROMPT, userTurn } from "./prompt";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export type AskModel = (input: { carport: unknown; message: string; history: Turn[] }) => Promise<AssistantReply>;

/** `workspaceId` is required for keys that are not scoped to one workspace. */
export function makeAskModel(apiKey: string, model: string, workspaceId?: string): AskModel {
  const client = new Anthropic({
    apiKey,
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });
  return async ({ carport, message, history }) => {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.content })),
      { role: "user", content: userTurn(carport, message) },
    ];
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { format: zodOutputFormat(AssistantReplyWireSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal") {
      return { patch: null, message: "I can't help with that one. The panel on the right has every setting." };
    }
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("The model did not return a valid reply.");
    return fromWire(AssistantReplyWireSchema.parse(parsed));
  };
}
