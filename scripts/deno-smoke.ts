// Smoke test for Deno (B52): imports the built package by name and checks
// that every SVG fixture round-trips. The full test suite runs on Node.js,
// Bun and browsers; here the goal is only that dist/ loads and works on Deno.
// Run after a build: deno run --allow-read scripts/deno-smoke.ts
import { parse, stringify } from "@hexlabelposition/som";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

const files = readdirSync(fixtures, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".svg"))
  .sort();

if (files.length === 0) {
  throw new Error(`No SVG fixtures found in ${fixtures}`);
}

for (const file of files) {
  const source = readFileSync(join(fixtures, file), "utf8");
  const once = stringify(parse(source));
  const twice = stringify(parse(once));
  if (once !== twice) {
    throw new Error(`${file}: output is not stable after a round trip`);
  }
}

console.log(`Deno smoke test passed: ${String(files.length)} fixtures`);
