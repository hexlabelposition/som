import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  clone,
  extractColors,
  findAll,
  formatColor,
  isElement,
  normalizeColor,
  parse,
  parsePath,
  replaceColor,
  stringify,
  stringifyPath,
  type SvgColor,
  type SvgColorUse,
} from "../src";

// Corpus check from ARCHITECTURE §7: every fixture and every icon parses,
// round-trips (A6) and produces stable output, that is, stringify() of the
// re-parsed output gives the same string again. The colors check (§12) runs
// on the same files: every color extractColors reports, replaceColor changes
// in the place it reports it. So does the paths check (§13): every `d`
// attribute parses, reads back from stringifyPath unchanged, and is written
// the same way again.

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

/** The normalized form of a color, as a string. */
const colorKey = (color: SvgColor): string =>
  formatColor(normalizeColor(color));

/** Where a color is written, without its value. */
const place = (use: SvgColorUse): string =>
  `${use.element.name} ${use.source} ${use.property}`;

/**
 * Returns a description of the first failed colors check, or `undefined` when
 * replacing each color the document has with a color it does not have
 * changes exactly the uses extractColors reports for it, and the result still
 * round-trips.
 */
function checkColors(input: string): string | undefined {
  try {
    const document = parse(input);
    const uses = extractColors(document);
    const keys = uses.flatMap(({ color }) =>
      color === undefined ? [] : [colorKey(color)],
    );
    const unused = ["#010203", "#030201"].find((key) => !keys.includes(key));
    if (unused === undefined) return "no unused color";

    for (const key of new Set(keys)) {
      const copy = clone(document);
      const count = replaceColor(copy, key, unused);
      const expected = keys.filter((other) => other === key).length;
      if (count !== expected) {
        return `${key}: replaced ${String(count)} of ${String(expected)}`;
      }

      const after = extractColors(copy);
      expect(after.map(place)).toEqual(uses.map(place));
      expect(after.map(({ color }) => color && colorKey(color))).toEqual(
        uses.map(
          ({ color }) =>
            color && (colorKey(color) === key ? unused : colorKey(color)),
        ),
      );
      expect(parse(stringify(copy))).toEqual(copy);
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

/**
 * Returns a description of the first failed paths check, or `undefined` when
 * every `d` attribute parses, round-trips through stringifyPath and is
 * written the same way again.
 */
function checkPaths(input: string): string | undefined {
  try {
    const elements = findAll(parse(input), isElement);
    for (const { attributes } of elements) {
      const { d } = attributes;
      if (d === undefined) continue;
      const path = parsePath(d);
      if (path === undefined) return `invalid path data: ${d.slice(0, 40)}`;
      const output = stringifyPath(path);
      expect(parsePath(output)).toEqual(path);
      if (stringifyPath(parsePath(output) ?? []) !== output) {
        return `path output is not stable: ${output.slice(0, 40)}`;
      }
    }
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
      const input = readFileSync(join(directory, file), "utf8");
      expect(check(input) ?? checkColors(input) ?? checkPaths(input)).toBe(
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
      const input = readFileSync(join(directory, file), "utf8");
      const failure = check(input) ?? checkColors(input) ?? checkPaths(input);
      if (failure !== undefined) failures.push(`${file}: ${failure}`);
    }
    expect(failures).toEqual([]);
  });
});

describe("colors in editor exports", () => {
  /** Lists where each color of a fixture is written and its value. */
  const colors = (file: string): string[] =>
    extractColors(parse(readFileSync(join(fixtures, file), "utf8"))).map(
      (use) => `${place(use)}: ${use.value}`,
    );

  test("Illustrator: a class rule in <style>", () => {
    expect(colors("illustrator/styled-paths.svg")).toEqual([
      "style stylesheet fill: #D1DAE5",
    ]);
  });

  test("Inkscape: stop colors in style attributes", () => {
    expect(colors("inkscape/go-next-view.svg")).toContain(
      "stop style stop-color: #cdeeff",
    );
  });

  test("icon sets: currentColor and none", () => {
    const icon = readFileSync(
      join(modules, "@tabler/icons/icons/outline/check.svg"),
      "utf8",
    );
    expect(extractColors(parse(icon)).map((use) => use.value)).toEqual([
      "none",
      "currentColor",
      "none",
      "none",
    ]);
  });
});
