import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  clone,
  extractColors,
  findAll,
  formatColor,
  getPathBounds,
  getPathLength,
  getTransformMatrix,
  invertMatrix,
  isElement,
  normalizeColor,
  normalizePath,
  parse,
  parsePath,
  parseTransform,
  replaceColor,
  stringify,
  stringifyPath,
  stringifyTransform,
  transformPath,
  type SvgColor,
  type SvgColorUse,
  type SvgMatrix,
  type SvgPathSegment,
} from "../src";

// Corpus check from ARCHITECTURE §7: every fixture and every icon parses,
// round-trips (A6) and produces stable output, that is, stringify() of the
// re-parsed output gives the same string again. The colors check (§12) runs
// on the same files: every color extractColors reports, replaceColor changes
// in the place it reports it. So does the paths check (§13): every `d`
// attribute parses, reads back from stringifyPath unchanged, and is written
// the same way again, and its normalized form reads back unchanged too. Its
// bounds (§14) are finite and contain the end point of every segment, and
// its length lies between the polyline through the end points and the
// control polygons. Drawn through a matrix that rotates, skews and scales
// (§15), it has finite numbers and the mapped end points, the bounds check
// holds for it, and the inverse matrix gives the end points back. Every
// transform list parses, reads back from stringifyTransform unchanged and has
// a finite matrix.

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
 * Returns what is wrong with the bounds of a path, or `undefined` if they are
 * finite and contain the end point of every segment.
 */
function checkBounds(path: SvgPathSegment[]): string | undefined {
  const bounds = getPathBounds(path);
  if (bounds === undefined) return path.length > 0 ? "no bounds" : undefined;
  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every(Number.isFinite)) return "infinite bounds";
  // Normalized segments have absolute end points; Z ends at a known point.
  for (const segment of normalizePath(path)) {
    if (segment.type === "Z" || segment.type === "M") continue;
    if (
      segment.x < x ||
      segment.y < y ||
      segment.x > x + width + 1e-9 * Math.abs(x + width) ||
      segment.y > y + height + 1e-9 * Math.abs(y + height)
    ) {
      return "bounds leave out an end point";
    }
  }
  return undefined;
}

/**
 * Returns what is wrong with the length of a path, or `undefined` if it is at
 * least the polyline through the end points of its segments and, for a path
 * without arcs, at most the polyline through all its control points.
 */
function checkLength(path: SvgPathSegment[]): string | undefined {
  const length = getPathLength(path);
  let chords = 0;
  let polygon = 0;
  let arcs = false;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const segment of normalizePath(path)) {
    if (segment.type === "M") {
      x = startX = segment.x;
      y = startY = segment.y;
      continue;
    }
    const end = segment.type === "Z" ? { x: startX, y: startY } : segment;
    const points =
      segment.type === "C"
        ? [
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
          ]
        : segment.type === "Q"
          ? [{ x: segment.x1, y: segment.y1 }]
          : [];
    if (segment.type === "A") arcs = true;
    chords += Math.hypot(end.x - x, end.y - y);
    let previous = { x, y };
    for (const point of [...points, end]) {
      polygon += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    x = end.x;
    y = end.y;
  }
  const slack = 1e-9 * Math.max(1, length);
  if (!Number.isFinite(length)) return "infinite length";
  if (length < chords - slack) return "length shorter than the chords";
  if (!arcs && length > polygon + slack) {
    return "length longer than the control polygon";
  }
  return undefined;
}

/**
 * A matrix that is not a similarity, so arcs go through the general case.
 */
const skew: SvgMatrix = { a: 1.5, b: 0.5, c: -0.25, d: 1, e: 3, f: -7 };

/**
 * The end points of the segments of normalized path data, `Z` included.
 */
function endPoints(path: SvgPathSegment[]): { x: number; y: number }[] {
  let start = { x: 0, y: 0 };
  return normalizePath(path).map((segment) => {
    if (segment.type === "Z") return start;
    if (segment.type === "M") start = segment;
    return { x: segment.x, y: segment.y };
  });
}

/**
 * Returns what is wrong with a path drawn through a matrix, or `undefined`
 * if its numbers are finite, its end points are the mapped end points, its
 * bounds contain them and the inverse matrix maps them back.
 */
function checkTransformed(path: SvgPathSegment[]): string | undefined {
  const transformed = transformPath(path, skew);
  for (const segment of transformed) {
    if (
      !Object.values(segment).every(
        (value) => typeof value !== "number" || Number.isFinite(value),
      )
    ) {
      return "infinite transformed path";
    }
  }
  const expected = endPoints(path);
  const actual = endPoints(transformed);
  const back = endPoints(
    transformPath(transformed, invertMatrix(skew) ?? skew),
  );
  if (actual.length !== expected.length || back.length !== expected.length) {
    return "transformed path has other segments";
  }
  for (const [index, { x, y }] of expected.entries()) {
    const mapped = {
      x: skew.a * x + skew.c * y + skew.e,
      y: skew.b * x + skew.d * y + skew.f,
    };
    const tolerance = 1e-12 * Math.max(1, Math.abs(x), Math.abs(y));
    const point = actual[index] ?? mapped;
    const again = back[index] ?? { x, y };
    if (Math.hypot(point.x - mapped.x, point.y - mapped.y) > 2 * tolerance) {
      return "transformed end point is not the mapped one";
    }
    if (Math.hypot(again.x - x, again.y - y) > 10 * tolerance) {
      return "inverse does not give the end point back";
    }
  }
  return checkBounds(transformed);
}

/**
 * Returns a description of the first failed paths check, or `undefined` when
 * every `d` attribute parses, round-trips through stringifyPath and is
 * written the same way again, and so does its normalized form, its bounds
 * contain every end point, and it is drawn through a matrix as
 * checkTransformed expects.
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
      // Numbers are written without loss, so comparing the text is
      // comparing the segments, and much faster.
      const failure =
        checkBounds(path) ?? checkLength(path) ?? checkTransformed(path);
      if (failure !== undefined) return `${failure}: ${d.slice(0, 40)}`;
      const normalized = stringifyPath(normalizePath(path));
      const again = normalizePath(parsePath(normalized) ?? []);
      if (stringifyPath(again) !== normalized) {
        return `normalized path is not stable: ${normalized.slice(0, 40)}`;
      }
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

/**
 * The attributes whose value is a transform list.
 */
const transformAttributes = [
  "transform",
  "gradientTransform",
  "patternTransform",
];

/**
 * Returns a description of the first failed transforms check, or `undefined`
 * when every transform list parses, reads back from stringifyTransform
 * unchanged, is written the same way again and has a finite matrix.
 */
function checkTransforms(input: string): string | undefined {
  try {
    const elements = findAll(parse(input), isElement);
    for (const { attributes } of elements) {
      for (const name of transformAttributes) {
        const value = attributes[name];
        if (value === undefined) continue;
        const functions = parseTransform(value);
        if (functions === undefined) return `invalid ${name}: ${value}`;
        const output = stringifyTransform(functions);
        expect(parseTransform(output)).toEqual(functions);
        if (stringifyTransform(parseTransform(output) ?? []) !== output) {
          return `transform output is not stable: ${output}`;
        }
        const matrix = getTransformMatrix(functions);
        if (!Object.values(matrix).every(Number.isFinite)) {
          return `infinite matrix: ${value}`;
        }
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
      expect(
        check(input) ??
          checkColors(input) ??
          checkPaths(input) ??
          checkTransforms(input),
      ).toBe(undefined);
    });
  });
});

describe("icon sets", () => {
  // One test per set: thousands of separate tests would mostly add noise.
  // A set takes a few seconds, more when the browser tests run alongside,
  // so the default timeout of 5 seconds is too short.
  test.each(iconCorpora)("%s", { timeout: 30_000 }, (corpus) => {
    const directory = join(modules, corpus);
    const files = svgFiles(directory);
    expect(files.length).toBeGreaterThan(100);

    const failures: string[] = [];
    for (const file of files) {
      const input = readFileSync(join(directory, file), "utf8");
      const failure =
        check(input) ??
        checkColors(input) ??
        checkPaths(input) ??
        checkTransforms(input);
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
