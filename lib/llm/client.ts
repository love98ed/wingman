import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LLM, type LlmTask } from "./config";

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

type StructuredRequest<T extends z.ZodType> = {
  task: LlmTask;
  /** Short label for dev usage logs, e.g. "face-box". */
  label: string;
  schema: T;
  system?: string;
  content: Anthropic.ContentBlockParam[];
  effort?: "low" | "medium" | "high";
};

/**
 * One Claude call with Zod-validated JSON output. Retries once when the output
 * fails validation (CLAUDE.md section 6).
 */
export async function generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  const config = LLM[req.task];
  const { model, maxTokens } = config;
  const thinking = "thinking" in config ? config.thinking : undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic().messages.parse({
        model,
        max_tokens: maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.content }],
        ...(thinking ? { thinking } : {}),
        output_config: { format: zodOutputFormat(req.schema), effort: req.effort },
      });
      if (process.env.NODE_ENV !== "production") {
        const u = response.usage;
        console.info(`[llm] ${req.label} ${model} in=${u.input_tokens} out=${u.output_tokens}`);
      }
      if (response.stop_reason === "refusal") throw new Error(`Claude declined (${req.label})`);
      if (response.parsed_output == null) throw new Error(`Invalid JSON from Claude (${req.label})`);
      return response.parsed_output as z.infer<T>;
    } catch (err) {
      if (err instanceof Anthropic.APIError) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
