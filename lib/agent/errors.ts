/** An agent failure the user can act on; `message` is shown to them as is. */
export class AgentError extends Error {
  constructor(
    readonly code: "NO_LOOKS" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AgentError";
  }
}
