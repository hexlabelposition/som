import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  platform: "neutral",
  target: "es2022",
  format: "esm",
  tsconfig: "tsconfig.lib.json",
  dts: true,
  publint: true,
  attw: { profile: "esm-only", level: "error" },
});
