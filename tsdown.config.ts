import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  platform: "neutral",
  target: "es2022",
  format: "esm",
  tsconfig: "tsconfig.lib.json",
  dts: true,
  // Warnings fail the build too; suggestions are only printed.
  publint: { strict: true },
  attw: { profile: "esm-only", level: "error" },
});
