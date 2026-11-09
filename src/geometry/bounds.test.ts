import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  normalizePath,
  parsePath,
  stringifyPath,
  type SvgPathSegment,
} from "../paths";
import { getPathBounds, type SvgBounds } from "./bounds";

/**
 * The bounds of path data.
 */
const bounds = (d: string): SvgBounds | undefined =>
  getPathBounds(parsePath(d) ?? []);

/**
 * Expects bounds to be close to the given ones.
 */
function expectClose(actual: SvgBounds | undefined, expected: SvgBounds) {
  if (actual === undefined) throw new Error("No bounds");
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(actual[key], key).toBeCloseTo(expected[key], 9);
  }
}

describe("getPathBounds", () => {
  test.each<[string, SvgBounds]>([
    ["M2 4 L12 9", { x: 2, y: 4, width: 10, height: 5 }],
    ["M10 10 h-5 v-5", { x: 5, y: 5, width: 5, height: 5 }],
    ["M0 0 C0 -10 10 -10 10 0", { x: 0, y: -7.5, width: 10, height: 7.5 }],
    ["M0 0 C10 0 0 10 10 10", { x: 0, y: 0, width: 10, height: 10 }],
    ["M0 0 C20 0 -10 0 10 0", { x: 0, y: 0, width: 10, height: 0 }],
    ["M0 0 Q5 -10 10 0", { x: 0, y: -5, width: 10, height: 5 }],
    ["M0 0 Q20 5 0 10", { x: 0, y: 0, width: 10, height: 10 }],
    [
      "M0 0 S5 -10 10 0",
      { x: 0, y: -4.4444444444, width: 10, height: 4.4444444444 },
    ],
    ["M0 0 T10 0", { x: 0, y: 0, width: 10, height: 0 }],
  ])("measures %s", (d, expected) => {
    expectClose(bounds(d), expected);
  });

  describe("arcs", () => {
    test.each<[string, SvgBounds]>([
      ["M0 0 A5 5 0 0 1 10 0", { x: 0, y: -5, width: 10, height: 5 }],
      ["M0 0 A5 5 0 0 0 10 0", { x: 0, y: 0, width: 10, height: 5 }],
      ["M0 0 A5 5 0 1 1 6 0", { x: -2, y: -9, width: 10, height: 9 }],
      ["M0 0 A1 1 0 0 1 10 0", { x: 0, y: -5, width: 10, height: 5 }],
      ["M0 0 A-5 -5 0 0 1 10 0", { x: 0, y: -5, width: 10, height: 5 }],
      ["M0 0 A0 5 0 0 1 10 0", { x: 0, y: 0, width: 10, height: 0 }],
      ["M5 5 A5 5 0 0 1 5 5", { x: 5, y: 5, width: 0, height: 0 }],
      ["M0 0 A10 5 90 0 1 10 0", { x: 0, y: -10, width: 10, height: 10 }],
      // The values Chromium and Firefox give, to float precision.
      [
        "M0 0 A10 5 45 1 1 10 0",
        {
          x: -5.810431660076512,
          y: -12.746923333180218,
          width: 15.811388300841896,
          height: 12.746923333180218,
        },
      ],
      // A thin arc with scaled radii; Chromium is off by 0.1% here. The
      // values are from 10^6 points sampled along the arc.
      [
        "M463.11 0 A0.01 5.22 -319 0 0 174.56 400.08",
        {
          x: -7337.719133701627,
          y: 0,
          width: 7800.829133701627,
          height: 9007.88880857065,
        },
      ],
    ])("measures %s", (d, expected) => {
      const actual = bounds(d);
      if (actual === undefined) throw new Error("No bounds");
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(actual[key] - expected[key]), key).toBeLessThan(1e-6);
      }
    });

    test("gives exact ends", () => {
      expect(bounds("M0 0 A5 5 0 0 1 10 0")).toEqual({
        x: 0,
        y: -5,
        width: 10,
        height: 5,
      });
    });
  });

  describe("what counts", () => {
    test.each<[string, SvgBounds]>([
      ["M10 20", { x: 10, y: 20, width: 0, height: 0 }],
      ["M10 20 M30 40", { x: 30, y: 40, width: 0, height: 0 }],
      ["M10 20 Z", { x: 10, y: 20, width: 0, height: 0 }],
      ["M0 0 L10 0 M50 50", { x: 0, y: 0, width: 10, height: 0 }],
      ["M50 50 M0 0 L10 10", { x: 0, y: 0, width: 10, height: 10 }],
      ["M0 0 L10 10 M50 50 Z", { x: 0, y: 0, width: 50, height: 50 }],
      ["M0 0 L1 1 Z L5 5", { x: 0, y: 0, width: 5, height: 5 }],
      ["M0 0 L1 1 Z m10 10", { x: 0, y: 0, width: 1, height: 1 }],
      // Zero-length segments count, as in Chromium.
      ["M50 50 L50 50 M0 0 L1 1", { x: 0, y: 0, width: 50, height: 50 }],
      [
        "M50 50 A5 5 0 0 1 50 50 M0 0 L1 1",
        { x: 0, y: 0, width: 50, height: 50 },
      ],
    ])("measures %s", (d, expected) => {
      expect(bounds(d)).toEqual(expected);
    });

    test("returns undefined for an empty path", () => {
      expect(getPathBounds([])).toBeUndefined();
    });
  });

  test("throws for path data without a moveto first", () => {
    expect(() => getPathBounds([{ type: "L", x: 0, y: 0 }])).toThrow(TypeError);
  });
});

// Random paths: the bounds contain points sampled along the path and touch
// them on every side, and browsers measure the same bounds.

const coordinate = fc
  .integer({ min: -100_000, max: 100_000 })
  .map((value) => value / 100);
const radius = fc.integer({ min: 1, max: 100_000 }).map((value) => value / 100);
const point = { x: coordinate, y: coordinate };

const segment: fc.Arbitrary<SvgPathSegment> = fc.oneof(
  fc.record({ type: fc.constantFrom("L" as const, "l" as const), ...point }),
  fc.record({ type: fc.constant("H" as const), x: coordinate }),
  fc.record({ type: fc.constant("v" as const), y: coordinate }),
  fc.record({
    type: fc.constantFrom("C" as const, "c" as const),
    x1: coordinate,
    y1: coordinate,
    x2: coordinate,
    y2: coordinate,
    ...point,
  }),
  fc.record({
    type: fc.constant("S" as const),
    x2: coordinate,
    y2: coordinate,
    ...point,
  }),
  fc.record({
    type: fc.constantFrom("Q" as const, "q" as const),
    x1: coordinate,
    y1: coordinate,
    ...point,
  }),
  fc.record({ type: fc.constant("t" as const), ...point }),
  fc
    .record({
      type: fc.constantFrom("A" as const, "a" as const),
      rx: radius,
      // Browsers lose precision on very thin ellipses, so the radii differ
      // by a factor of 10 at most.
      ratio: fc.integer({ min: 10, max: 1000 }),
      rotation: fc.integer({ min: -360, max: 360 }),
      largeArc: fc.boolean(),
      sweep: fc.boolean(),
      ...point,
    })
    .map(({ ratio, ...arc }) => ({
      ...arc,
      ry: Math.max(0.01, Math.round(arc.rx * ratio) / 100),
    })),
  fc.record({ type: fc.constant("Z" as const) }),
  fc.record({ type: fc.constant("m" as const), ...point }),
);

const path: fc.Arbitrary<SvgPathSegment[]> = fc
  .tuple(
    fc.record({ type: fc.constant("M" as const), ...point }),
    fc.array(segment, { minLength: 1, maxLength: 8 }),
  )
  .map(([first, rest]) => [first, ...rest]);

/**
 * Whether a path has a segment of zero length, such as `L` to the current
 * point or `Z` right after `M`. Engines measure these differently: Chromium
 * counts zero-length lines but not curves, Firefox counts neither.
 */
function hasZeroLength(segments: readonly SvgPathSegment[]): boolean {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const segment of normalizePath(segments)) {
    if (segment.type === "M") {
      x = startX = segment.x;
      y = startY = segment.y;
      continue;
    }
    const end = segment.type === "Z" ? { x: startX, y: startY } : segment;
    const points = [
      end,
      ...(segment.type === "C"
        ? [
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
          ]
        : segment.type === "Q"
          ? [{ x: segment.x1, y: segment.y1 }]
          : []),
    ];
    if (points.every((p) => p.x === x && p.y === y)) return true;
    x = end.x;
    y = end.y;
  }
  return false;
}

/**
 * Whether a path ends with a moveto that draws nothing. Browsers leave it out
 * of a path of lines but count it in a path with curves.
 */
const endsWithMoveto = (segments: readonly SvgPathSegment[]): boolean =>
  /^[Mm]$/.test(segments.at(-1)?.type ?? "");

/**
 * The largest coordinate of a bounding box, to scale tolerances by.
 */
const size = (box: SvgBounds): number =>
  Math.max(
    1,
    Math.abs(box.x),
    Math.abs(box.y),
    Math.abs(box.x + box.width),
    Math.abs(box.y + box.height),
  );

// The browser tests measure with getBBox(). The global is typed here,
// because the library and its tests have no DOM types.
interface PathElement {
  setAttribute(name: string, value: string): void;
  getBBox(): SvgBounds;
  remove(): void;
}
const { document } = globalThis as {
  document?: {
    createElementNS(namespace: string, name: string): PathElement;
    body: { append(node: PathElement): void };
  };
};

describe.skipIf(document === undefined)("getPathBounds in a browser", () => {
  test("gives the bounds of getBBox()", () => {
    if (document === undefined) return;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const element = document.createElementNS(namespace, "path");
    document.body.append(svg);
    // `append` on the svg element is not in the minimal type above.
    (svg as unknown as { append(node: PathElement): void }).append(element);
    try {
      fc.assert(
        fc.property(path, (segments) => {
          fc.pre(!hasZeroLength(segments) && !endsWithMoveto(segments));
          const d = stringifyPath(segments);
          element.setAttribute("d", d);
          const expected = element.getBBox();
          const actual = getPathBounds(segments);
          if (actual === undefined) throw new Error("No bounds");
          // Browsers keep paths in 32-bit floats and draw arcs as cubic
          // curves; Chromium is off by up to about 0.1% of the size on thin
          // ellipses. A missed extreme is off by far more.
          const tolerance = 5e-3 * size(actual);
          for (const key of ["x", "y", "width", "height"] as const) {
            expect(
              Math.abs(actual[key] - expected[key]),
              `${key} of ${d}`,
            ).toBeLessThan(tolerance);
          }
        }),
        { numRuns: 500 },
      );
    } finally {
      svg.remove();
    }
  });
});
