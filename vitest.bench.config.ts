import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Benchmarks (ARCHITECTURE §5) measure the built dist/, the same entry point
// consumers use, so `bun run bench` builds first. Vitest runs them
// sequentially in one worker. Types come from src/ (tsconfig.scripts.json).
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@hexlabelposition\/som$/,
        replacement: fileURLToPath(new URL("dist/index.js", import.meta.url)),
      },
    ],
  },
  test: {
    include: [],
    benchmark: {
      include: ["scripts/benchmarks/**/*.bench.ts"],
    },
  },
});
