import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside React Server Components; tests run server code directly.
    alias: { "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts?(x)"],
    environment: "node",
  },
});
