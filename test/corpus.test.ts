import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parse, stringify } from "../src";

// Corpus check from ARCHITECTURE §7: every fixture and every icon parses,
// round-trips (A6) and produces stable output, that is, stringify() of the
// re-parsed output gives the same string again.

const fixtures = fileURLToPath(new URL("fixtures/", import.meta.url));
const modules = fileURLToPath(new URL("../node_modules/", import.meta.url));

/**
 * Checked-in fixture directories. Listed explicitly so an empty or missing
 * directory fails instead of passing silently.
 */
const fixtureCorpora = ["figma", "illustrator", "inkscape", "svgo"];

/**
 * Icon directories of the pinned icon set devDependencies.
 */
const iconCorpora = [
  "simple-icons/icons",
  "bootstrap-icons/icons",
  "@tabler/icons/icons/outline",
  "@tabler/icons/icons/filled",
];

/**
 * Lists the SVG files in a directory, sorted so failures are reported in a
 * stable order.
 */
function svgFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".svg"))
    .sort();
}

/**
 * Returns a description of the first failed check, or `undefined` when the
 * input parses, round-trips and produces stable output.
 */
function check(input: string): string | undefined {
  let output: string;
  try {
    const document = parse(input);
    output = stringify(document);
    const reparsed = parse(output);
    expect(reparsed).toEqual(document);
    if (stringify(reparsed) !== output) return "output is not stable";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

describe("fixtures", () => {
  describe.each(fixtureCorpora)("%s", (corpus) => {
    const directory = join(fixtures, corpus);
    const files = svgFiles(directory);

    test("contains SVG files", () => {
      expect(files.length).toBeGreaterThan(0);
    });

    test.each(files)("%s", (file) => {
      expect(check(readFileSync(join(directory, file), "utf8"))).toBe(
        undefined,
      );
    });
  });
});

describe("icon sets", () => {
  // One test per set: thousands of separate tests would mostly add noise.
  test.each(iconCorpora)("%s", (corpus) => {
    const directory = join(modules, corpus);
    const files = svgFiles(directory);
    expect(files.length).toBeGreaterThan(100);

    const failures: string[] = [];
    for (const file of files) {
      const failure = check(readFileSync(join(directory, file), "utf8"));
      if (failure !== undefined) failures.push(`${file}: ${failure}`);
    }
    expect(failures).toEqual([]);
  });
});
