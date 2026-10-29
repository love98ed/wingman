import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const serverEnvSchema = z.object({
  YOUCAM_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.url(),
  // Unused while all database access is server-side with the service role key.
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MOCK_YOUCAM: bool,
  /** Mock mode only: comma-separated APIs (clothes, hair, beard) whose first call per image fails, to see the retry. */
  MOCK_YOUCAM_FAIL: z.string().default(""),
  YOUCAM_UNIT_LIMIT: z.coerce.number().int().positive().default(700),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Parsed server env. Import only from server code (see lib/env.server.ts). */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server env: ${missing}`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv();
  return cached;
}
