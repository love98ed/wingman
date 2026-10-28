import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
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
