import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  normalizePath,
  parsePath,
  stringifyPath,
  type SvgPathSegment,
} from "../paths";
import { arcPoint, toCenterArc } from "./arc";
import { getPathLength } from "./length";

/**
 * The length of path data.
 */
const length = (d: string): number => getPathLength(parsePath(d) ?? []);

/**
 * The length of the parabola `y = x²` from 0 to 1, the quadratic curve
 * `M0 0 Q0.5 0 1 1`.
 */
const parabola = (2 * Math.sqrt(5) + Math.asinh(2)) / 4;

/**
 * The perimeter of an ellipse with radii 2 and 1, `8 E(√3 / 2)`.
 */
const ellipse = 9.688448220547675;

describe("getPathLength", () => {
  test.each<[string, number]>([
    ["M0 0 L3 4", 5],
    ["M0 0 h3 v4", 7],
    ["M0 0 L3 4 Z", 10],
    ["M0 0 L3 4 M10 10 l3 4", 10],
    ["M0 0 L3 4 Z l3 4", 15],
    ["M0 0 Q0.5 0 1 1", parabola],
    ["M0 0 q50 0 100 100", 100 * parabola],
    ["M0 0 T10 0", 10],
    ["M0 0 C0 0 10 0 10 0", 10],
    ["M0 0 C10 0 0 0 10 0", 10],
    ["M0 0 C5 0 5 0 10 0", 10],
    ["M0 0 S10 0 10 0", 10],
  ])("measures %s", (d, expected) => {
    expect(Math.abs(length(d) - expected) / expected).toBeLessThan(1e-12);
  });

  describe("arcs", () => {
    test.each<[string, number]>([
      ["M-1 0 A1 1 0 0 1 1 0 A1 1 0 0 1 -1 0", 2 * Math.PI],
      ["M0 0 a5 5 0 0 1 10 0", 5 * Math.PI],
      ["M0 0 A1 1 0 0 1 10 0", 5 * Math.PI],
      ["M0 0 A-5 -5 0 0 0 10 0", 5 * Math.PI],
      ["M10 0 A10 10 0 0 1 0 10", 5 * Math.PI],
      ["M10 0 A10 10 0 1 0 0 10", 15 * Math.PI],
      ["M-2 0 A2 1 0 0 1 2 0 A2 1 0 0 1 -2 0", ellipse],
      ["M0 -2 A1 2 0 0 1 0 2 A1 2 0 0 1 0 -2", ellipse],
      ["M0 -2 A2 1 90 0 1 0 2 A2 1 90 0 1 0 -2", ellipse],
      ["M0 0 A4 2 0 0 1 8 0 A4 2 0 0 1 0 0", 2 * ellipse],
      ["M0 0 A0 5 0 0 1 10 0", 10],
    ])("measures %s", (d, expected) => {
      expect(Math.abs(length(d) - expected) / expected).toBeLessThan(1e-12);
    });

    test("measures an arc to its start as 0", () => {
      expect(length("M5 5 A5 5 0 0 1 5 5")).toBe(0);
    });
  });

  // Curves that nearly stop and turn back, where the speed has a narrow dip.
  // The values are polylines of 2 × 10⁷ pieces, a little shorter than the
  // curve.
  test.each<[string, number]>([
    ["M305.81 769.36 Q-497.02 1198.77 305.92 769.31", 910.5156506787887],
    ["M0 0 C10 10 -10 10 0.001 0", 20.366862347705066],
    ["M0 0 C30 30 -20 30 10 0.00001", 56.95332040897613],
  ])("measures %s near its cusp", (d, expected) => {
    expect(Math.abs(length(d) - expected) / expected).toBeLessThan(1e-12);
  });

  test.each(["", "M10 20", "M10 20 M30 40", "M10 20 Z", "M1 1 L1 1"])(
    "measures %j as 0",
    (d) => {
      expect(length(d)).toBe(0);
    },
  );

  test("throws for path data without a moveto first", () => {
    expect(() => getPathLength([{ type: "L", x: 0, y: 0 }])).toThrow(TypeError);
  });
});

// Random segments: the length matches a polyline of many points along the
// curve, and browsers measure about the same length.

const coordinate = fc
  .integer({ min: -100_000, max: 100_000 })
  .map((value) => value / 100);
const radius = fc.integer({ min: 1, max: 100_000 }).map((value) => value / 100);
const point = { x: coordinate, y: coordinate };

const arc = fc
  .record({
    type: fc.constantFrom("A" as const, "a" as const),
    rx: radius,
    // Browsers lose precision on very thin ellipses, so the radii differ by
    // a factor of 10 at most.
    ratio: fc.integer({ min: 10, max: 1000 }),
    rotation: fc.integer({ min: -360, max: 360 }),
    largeArc: fc.boolean(),
    sweep: fc.boolean(),
    ...point,
  })
  .map(({ ratio, ...rest }) => ({
    ...rest,
    ry: Math.max(0.01, Math.round(rest.rx * ratio) / 100),
  }));

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
  arc,
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
 * The length of a polyline through `count + 1` points of a curve given as a
 * function of `t` in [0, 1]. It is shorter than the curve by about
 * `1 / count²` of its length.
 */
function polyline(at: (t: number) => [number, number], count: number): number {
  let sum = 0;
  let [x, y] = at(0);
  for (let i = 1; i <= count; i++) {
    const [nextX, nextY] = at(i / count);
    sum += Math.hypot(nextX - x, nextY - y);
    x = nextX;
    y = nextY;
  }
  return sum;
}

/**
 * Measures a path as a polyline of `count` pieces per segment.
 */
function polylineLength(segments: SvgPathSegment[], count: number): number {
  let sum = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const s of normalizePath(segments)) {
    const x0 = x;
    const y0 = y;
    switch (s.type) {
      case "M":
        startX = s.x;
        startY = s.y;
        break;
      case "L":
        sum += Math.hypot(s.x - x0, s.y - y0);
        break;
      case "C":
        sum += polyline((t) => {
          const u = 1 - t;
          const [a, b, c, d] = [
            u * u * u,
            3 * u * u * t,
            3 * u * t * t,
            t * t * t,
          ];
          return [
            a * x0 + b * s.x1 + c * s.x2 + d * s.x,
            a * y0 + b * s.y1 + c * s.y2 + d * s.y,
          ];
        }, count);
        break;
      case "Q":
        sum += polyline((t) => {
          const u = 1 - t;
          const [a, b, c] = [u * u, 2 * u * t, t * t];
          return [a * x0 + b * s.x1 + c * s.x, a * y0 + b * s.y1 + c * s.y];
        }, count);
        break;
      case "A": {
        if (x0 === s.x && y0 === s.y) break;
        const center = toCenterArc(
          x0,
          y0,
          s.rx,
          s.ry,
          s.rotation,
          s.largeArc,
          s.sweep,
          s.x,
          s.y,
        );
        sum +=
          center === undefined
            ? Math.hypot(s.x - x0, s.y - y0)
            : polyline(
                (t) => arcPoint(center, center.start + t * center.sweep),
                count,
              );
        break;
      }
      case "Z":
        sum += Math.hypot(startX - x0, startY - y0);
        x = startX;
        y = startY;
        continue;
    }
    x = s.x;
    y = s.y;
  }
  return sum;
}

describe("against polylines", () => {
  test("gives the length of a fine polyline", () => {
    fc.assert(
      fc.property(path, (segments) => {
        const actual = getPathLength(segments);
        const expected = polylineLength(segments, 20_000);
        // The polyline is a little shorter; the gap shrinks with 1 / count².
        expect(actual).toBeGreaterThanOrEqual(expected * (1 - 1e-12));
        expect(actual - expected).toBeLessThan(1e-6 * Math.max(1, actual));
      }),
      { numRuns: 200 },
    );
  });
});

// The browser tests measure with getTotalLength(). The global is typed here,
// because the library and its tests have no DOM types.
interface PathElement {
  setAttribute(name: string, value: string): void;
  getTotalLength(): number;
  append(node: PathElement): void;
  remove(): void;
}
const { document } = globalThis as {
  document?: {
    createElementNS(namespace: string, name: string): PathElement;
    body: { append(node: PathElement): void };
  };
};

describe.skipIf(document === undefined)("getPathLength in a browser", () => {
  test("gives the length of getTotalLength()", () => {
    if (document === undefined) return;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const element = document.createElementNS(namespace, "path");
    document.body.append(svg);
    svg.append(element);
    try {
      fc.assert(
        fc.property(path, (segments) => {
          const d = stringifyPath(segments);
          element.setAttribute("d", d);
          const expected = element.getTotalLength();
          const actual = getPathLength(segments);
          // Browsers draw arcs as cubic curves, which are 0.014% longer for
          // a circle and up to about 0.04% for a thin ellipse, and keep
          // paths in 32-bit floats.
          expect(Math.abs(actual - expected), d).toBeLessThan(
            1e-3 * Math.max(1, actual),
          );
        }),
        { numRuns: 500 },
      );
    } finally {
      svg.remove();
    }
  });
});
