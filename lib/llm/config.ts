/** Model choices from CLAUDE.md section 2. Never inline model names elsewhere. */
export const LLM = {
  agent: { model: "claude-sonnet-5-5", maxTokens: 1500 },
  tagging: { model: "claude-haiku-5-5", maxTokens: 2000 },
} as const;

export type LlmTask = keyof typeof LLM;
