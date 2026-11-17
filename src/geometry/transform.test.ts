import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  normalizePath,
  parsePath,
  stringifyPath,
  type SvgNormalizedPathSegment,
  type SvgPathSegment,
} from "../paths";
import {
  getTransformMatrix,
  invertMatrix,
  parseTransform,
  type SvgMatrix,
} from "../transforms";
import { arcPoint, toCenterArc } from "./arc";
import { getPathBounds } from "./bounds";
import { getPathLength } from "./length";
import { transformPath } from "./transform";

/**
 * The matrix of a transform list.
 */
const matrixOf = (list: string): SvgMatrix =>
  getTransformMatrix(parseTransform(list) ?? []);

/**
 * Path data drawn through a transform list, written back as text.
 */
const transform = (d: string, list: string): string =>
  stringifyPath(transformPath(parsePath(d) ?? [], matrixOf(list)));

describe("transformPath", () => {
  test.each([
    ["M0 0 h10 a5 5 0 0 1 0 10", "rotate(90)", "M0 0 L0 10 A5 5 0 0 1 -10 10"],
    ["M1 2 L3 4", "", "M1 2 L3 4"],
    [
      "M1 2 l3 4 h1 v1 z m1 1",
      "translate(10 20)",
      "M11 22 L14 26 L15 26 L15 27 Z M12 23",
    ],
    [
      "M1 2 C3 4 5 6 7 8 S9 10 11 12",
      "scale(2)",
      "M2 4 C6 8 10 12 14 16 C18 20 18 20 22 24",
    ],
    ["M1 2 Q3 4 5 6 T7 8", "scale(1 -1)", "M1 -2 Q3 -4 5 -6 Q7 -8 7 -8"],
    ["M1 2 L3 4", "matrix(1 2 3 4 5 6)", "M12 16 L20 28"],
  ])("%s with %s", (d, list, expected) => {
    expect(transform(d, list)).toBe(expected);
  });

  test("returns a new array of normalized segments", () => {
    const path = parsePath("M1 2 L3 4") ?? [];
    const result = transformPath(path, matrixOf(""));
    expect(result).toEqual(path);
    expect(result).not.toBe(path);
    expect(result[0]).not.toBe(path[0]);
  });

  test("adds a translation as exact decimals", () => {
    expect(transform("M0.2 0 l0.1 0.7", "translate(0.1)")).toBe(
      "M0.3 0 L0.4 0.7",
    );
    expect(transform("M0.2 0 A1 1 0 0 1 0.4 0", "translate(0.1 0.2)")).toBe(
      "M0.3 0.2 A1 1 0 0 1 0.5 0.2",
    );
  });

  test("writes -0 as 0", () => {
    const [move] = transformPath(
      parsePath("M0 0") ?? [],
      matrixOf("scale(-1)"),
    );
    expect(Object.is(move?.type === "M" && move.x, 0)).toBe(true);
  });

  describe("arcs", () => {
    test.each([
      // A translation keeps arcs as written, a zero or negative radius too.
      ["M0 0 A-10 0 30 1 0 20 0", "translate(5)", "M5 0 A-10 0 30 1 0 25 0"],
      // A zero radius draws a line.
      ["M0 0 A10 0 0 0 1 20 0", "scale(2)", "M0 0 L40 0"],
      // Negative radii are made positive.
      ["M0 0 A-10 -5 0 0 1 20 0", "scale(2)", "M0 0 A20 10 0 0 1 40 0"],
      // A uniform scale and a rotation scale the radii and turn the axes.
      ["M0 0 A10 5 30 0 1 20 0", "scale(3)", "M0 0 A30 15 30 0 1 60 0"],
      ["M0 0 A10 5 30 1 0 20 0", "rotate(90)", "M0 0 A10 5 120 1 0 0 20"],
      ["M0 0 A10 5 300 0 1 20 0", "rotate(90)", "M0 0 A10 5 30 0 1 0 20"],
      ["M0 0 A10 5 30 0 1 20 0", "rotate(180)", "M0 0 A10 5 210 0 1 -20 0"],
      // Mirrored, the axes are reflected and the sweep flips.
      ["M0 0 A10 5 30 0 1 20 0", "scale(1 -1)", "M0 0 A10 5 -30 0 0 20 0"],
      ["M0 0 A10 5 30 1 1 20 0", "scale(-1 1)", "M0 0 A10 5 150 1 0 -20 0"],
      // Equal radii have no rotation.
      [
        "M0 0 A10 10 30 0 1 20 0",
        "rotate(45)",
        "M0 0 A10 10 0 0 1 14.142135623730951 14.14213562373095",
      ],
      // A scale of an ellipse aligned with the axes keeps it aligned, and each
      // radius stays with its axis.
      ["M0 0 A10 5 0 0 1 20 0", "scale(2 1)", "M0 0 A20 5 0 0 1 40 0"],
      ["M0 0 A10 5 0 0 1 20 0", "scale(1 2)", "M0 0 A10 10 0 0 1 20 0"],
      ["M0 0 A10 5 0 0 1 20 0", "scale(1 3)", "M0 0 A10 15 0 0 1 20 0"],
      ["M0 0 A10 5 90 0 1 20 0", "scale(3 1)", "M0 0 A10 15 90 0 1 60 0"],
      ["M0 0 A10 5 0 0 1 20 0", "scale(-2 1)", "M0 0 A20 5 0 0 0 -40 0"],
    ])("%s with %s", (d, list, expected) => {
      expect(transform(d, list)).toBe(expected);
    });

    test("uses the singular values of other matrices", () => {
      // The singular values of skewX(45) are the golden ratio and its
      // inverse, and the major axis is at atan(1 / φ) from the x axis.
      const [, arc] = transformPath(
        parsePath("M0 0 A10 10 0 0 1 20 0") ?? [],
        matrixOf("skewX(45)"),
      );
      if (arc?.type !== "A") throw new Error("Not an arc");
      const golden = (1 + Math.sqrt(5)) / 2;
      expect(arc.rx).toBeCloseTo(10 * golden, 12);
      expect(arc.ry).toBeCloseTo(10 / golden, 12);
      expect(arc.rotation).toBeCloseTo(
        (Math.atan(1 / golden) * 180) / Math.PI,
        12,
      );
      expect(arc.rotation).toBeGreaterThanOrEqual(0);
      expect(arc.rotation).toBeLessThan(180);
    });

    test("keeps radii too small to reach the end point", () => {
      expect(transform("M0 0 A1 2 0 0 1 20 0", "scale(2)")).toBe(
        "M0 0 A2 4 0 0 1 40 0",
      );
    });

    test.each([
      // The image of a half ellipse on a line through its end points.
      ["M0 0 A10 5 0 1 1 20 0", "scale(1 0)", "M0 0 L20 0"],
      // Across the line, it goes out and back.
      ["M0 0 A10 5 0 1 1 20 0", "scale(0 1)", "M0 0 L0 -5 L0 0"],
      ["M0 0 A10 5 0 1 0 20 0", "scale(0 1)", "M0 0 L0 5 L0 0"],
      // A large arc of a circle turns where it is farthest along the line.
      ["M0 0 A10 10 0 1 1 10 10", "scale(1 0)", "M0 0 L20 0 L10 0"],
      ["M0 0 A10 10 0 1 0 10 10", "scale(1 0)", "M0 0 L-10 0 L10 0"],
      // To a point, or with a zero radius, it is a line to the end point.
      ["M0 0 A10 5 0 0 1 20 0", "scale(0)", "M0 0 L0 0"],
      ["M0 0 A10 0 0 0 1 20 0", "scale(1 0)", "M0 0 L20 0"],
      ["M0 0 A10 5 0 0 1 0 0", "scale(1 0)", "M0 0 L0 0"],
    ])("%s with %s collapses to lines", (d, list, expected) => {
      expect(transform(d, list)).toBe(expected);
    });
  });

  test("throws for a path that does not start with a moveto", () => {
    expect(() =>
      transformPath([{ type: "L", x: 0, y: 0 }], matrixOf("")),
    ).toThrow(TypeError);
  });
});

// Random paths and matrices: points sampled along the path, mapped through
// the matrix, lie on the transformed path, which has the bounds of these
// points, and browsers draw the transformed path through them.

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
    type: fc.constantFrom("Q" as const, "q" as const),
    x1: coordinate,
    y1: coordinate,
    ...point,
  }),
  fc
    .record({
      type: fc.constantFrom("A" as const, "a" as const),
      rx: radius,
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

const entry = fc.integer({ min: -30, max: 30 }).map((value) => value / 10);

/**
 * Invertible matrices that do not squeeze a shape by more than a factor of
 * 10, so that browsers, which compute in 32-bit floats, draw them precisely.
 */
const matrix: fc.Arbitrary<SvgMatrix> = fc
  .record({
    a: entry,
    b: entry,
    c: entry,
    d: entry,
    e: coordinate,
    f: coordinate,
  })
  .filter(({ a, b, c, d }) => {
    const determinant = Math.abs(a * d - b * c);
    const norm = a * a + b * b + c * c + d * d;
    // The squared ratio of the singular values is at most about norm² / det².
    return determinant > 0 && norm / determinant < 10;
  });

/**
 * The center form of an arc segment from a point, or `undefined` if it is
 * drawn as a line or not at all.
 */
function centerOf(x: number, y: number, segment: SvgNormalizedPathSegment) {
  if (segment.type !== "A" || (x === segment.x && y === segment.y)) {
    return undefined;
  }
  return toCenterArc(
    x,
    y,
    segment.rx,
    segment.ry,
    segment.rotation,
    segment.largeArc,
    segment.sweep,
    segment.x,
    segment.y,
  );
}

/**
 * Samples points along each drawn segment of normalized path data, from its
 * exact parametric form; arcs are sampled by angle in center form. Returns
 * the points of each segment, with the current point before it.
 */
function sampleSegments(
  segments: readonly SvgNormalizedPathSegment[],
  count: number,
): { from: [number, number]; points: [number, number][] }[] {
  const result: { from: [number, number]; points: [number, number][] }[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const segment of segments) {
    const from: [number, number] = [x, y];
    const points: [number, number][] = [];
    result.push({ from, points });
    if (segment.type === "M") {
      x = startX = segment.x;
      y = startY = segment.y;
      points.push([x, y]);
      continue;
    }
    const end = segment.type === "Z" ? { x: startX, y: startY } : segment;
    const arc = centerOf(x, y, segment);
    // An arc to its start is not drawn.
    const drawn = segment.type !== "A" || x !== end.x || y !== end.y;
    for (let i = 1; drawn && i <= count; i++) {
      const t = i / count;
      const s = 1 - t;
      if (arc !== undefined) {
        points.push(arcPoint(arc, arc.start + t * arc.sweep));
      } else if (segment.type === "C") {
        points.push([
          s * s * s * x +
            3 * s * s * t * segment.x1 +
            3 * s * t * t * segment.x2 +
            t * t * t * end.x,
          s * s * s * y +
            3 * s * s * t * segment.y1 +
            3 * s * t * t * segment.y2 +
            t * t * t * end.y,
        ]);
      } else if (segment.type === "Q") {
        points.push([
          s * s * x + 2 * s * t * segment.x1 + t * t * end.x,
          s * s * y + 2 * s * t * segment.y1 + t * t * end.y,
        ]);
      } else {
        points.push([s * x + t * end.x, s * y + t * end.y]);
      }
    }
    x = end.x;
    y = end.y;
  }
  return result;
}

/**
 * Samples points along the segments of normalized path data.
 */
const samplePath = (
  segments: readonly SvgNormalizedPathSegment[],
  count: number,
): [number, number][] =>
  sampleSegments(segments, count).flatMap(({ points }) => points);

/**
 * Samples the points that segments of normalized path data draw, with their
 * start points. A moveto that no command follows draws nothing, and segments
 * of zero length are left out, since browsers draw them differently.
 */
const drawnPoints = (
  segments: readonly SvgNormalizedPathSegment[],
  count: number,
): [number, number][] =>
  sampleSegments(segments, count).flatMap(({ from, points }, index) =>
    segments[index]?.type === "M" ||
    points.every(([x, y]) => x === from[0] && y === from[1])
      ? []
      : [from, ...points],
  );

/**
 * Applies a matrix to a point given as a pair.
 */
const apply = (m: SvgMatrix, [x, y]: [number, number]): [number, number] => [
  m.a * x + m.c * y + m.e,
  m.b * x + m.d * y + m.f,
];

/**
 * The largest absolute coordinate of a list of points, at least 1.
 */
const extent = (points: readonly [number, number][]): number =>
  Math.max(1, ...points.flat().map(Math.abs));

describe("transformPath on random paths", () => {
  test("draws the image of each point", () => {
    fc.assert(
      fc.property(path, matrix, (segments, m) => {
        const before = sampleSegments(normalizePath(segments), 32);
        const transformed = transformPath(segments, m);
        const after = sampleSegments(transformed, 32);
        expect(after).toHaveLength(before.length);
        const size = extent(
          before.flatMap(({ points }) => points).map((p) => apply(m, p)),
        );
        const tolerance = 1e-9 * size;
        for (const [index, { points }] of before.entries()) {
          const expected = points.map((p) => apply(m, p));
          const { from, points: actual } = after[index] ?? {
            from: [0, 0],
            points: [],
          };
          const target = transformed[index];
          const arc = target && centerOf(...from, target);
          if (arc === undefined) {
            // Lines and curves keep their parameter under an affine map.
            expect(actual).toHaveLength(expected.length);
            for (const [i, [x, y]] of expected.entries()) {
              const [px, py] = actual[i] ?? [Number.NaN, Number.NaN];
              expect(Math.hypot(px - x, py - y)).toBeLessThan(tolerance);
            }
            continue;
          }
          // Arcs do not keep their angle, so each point is checked on the
          // ellipse and between the ends of the arc.
          const cos = Math.cos(arc.phi);
          const sin = Math.sin(arc.phi);
          let previous = 0;
          for (const [x, y] of expected) {
            const u = (cos * (x - arc.cx) + sin * (y - arc.cy)) / arc.rx;
            const v = (-sin * (x - arc.cx) + cos * (y - arc.cy)) / arc.ry;
            expect(Math.abs(Math.hypot(u, v) - 1)).toBeLessThan(
              1e-7 * (size / Math.min(arc.rx, arc.ry)),
            );
            const turn = 2 * Math.PI;
            const offset =
              ((((Math.atan2(v, u) - arc.start) * Math.sign(arc.sweep)) %
                turn) +
                turn) %
              turn;
            // The last point is the end, at an offset of the whole span or,
            // by rounding, near 0.
            const along = offset < 1e-6 && previous > 0 ? turn : offset;
            expect(along).toBeGreaterThanOrEqual(previous - 1e-6);
            expect(along).toBeLessThanOrEqual(Math.abs(arc.sweep) + 1e-6);
            previous = along;
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  test("has the bounds of the mapped points", () => {
    fc.assert(
      fc.property(path, matrix, (segments, m) => {
        const points = drawnPoints(normalizePath(segments), 2000).map((p) =>
          apply(m, p),
        );
        fc.pre(points.length > 0);
        const bounds = getPathBounds(transformPath(segments, m));
        if (bounds === undefined) throw new Error("No bounds");
        const xs = points.map(([x]) => x);
        const ys = points.map(([, y]) => y);
        // Samples miss an extreme by up to about (π / 2000)² / 2 of a radius.
        const tolerance = 2e-5 * extent(points);
        expect(Math.abs(Math.min(...xs) - bounds.x)).toBeLessThan(tolerance);
        expect(Math.abs(Math.min(...ys) - bounds.y)).toBeLessThan(tolerance);
        expect(
          Math.abs(Math.max(...xs) - bounds.x - bounds.width),
        ).toBeLessThan(tolerance);
        expect(
          Math.abs(Math.max(...ys) - bounds.y - bounds.height),
        ).toBeLessThan(tolerance);
      }),
      { numRuns: 200 },
    );
  });

  test("scales the length by the scale of a similarity", () => {
    const similarity = fc
      .record({
        angle: fc.integer({ min: -360, max: 360 }),
        scale: fc.integer({ min: 1, max: 50 }).map((value) => value / 10),
        mirror: fc.boolean(),
        e: coordinate,
        f: coordinate,
      })
      .map(({ angle, scale, mirror, e, f }) => ({
        scale,
        matrix: matrixOf(
          `translate(${String(e)} ${String(f)}) rotate(${String(angle)}) scale(${String(scale)} ${String(mirror ? -scale : scale)})`,
        ),
      }));
    fc.assert(
      fc.property(path, similarity, (segments, { scale, matrix: m }) => {
        const length = getPathLength(segments);
        expect(getPathLength(transformPath(segments, m))).toBeCloseTo(
          scale * length,
          Math.max(0, 6 - Math.ceil(Math.log10(Math.max(1, length)))),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("is undone by the inverse matrix", () => {
    fc.assert(
      fc.property(path, matrix, (segments, m) => {
        const inverse = invertMatrix(m);
        if (inverse === undefined) throw new Error("Not invertible");
        const expected = samplePath(normalizePath(segments), 16);
        const actual = samplePath(
          transformPath(transformPath(segments, m), inverse),
          16,
        );
        // The center form of a half arc whose radii were scaled up loses
        // about half the digits, in a square root of rounding noise.
        const tolerance = 1e-7 * extent(expected);
        for (const [index, [x, y]] of expected.entries()) {
          const [px, py] = actual[index] ?? [Number.NaN, Number.NaN];
          expect(Math.hypot(px - x, py - y)).toBeLessThan(tolerance);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// The browser tests check with isPointInStroke() that browsers draw the
// transformed path through the mapped points. The globals are typed here,
// because the library and its tests have no DOM types.
interface PathElement {
  setAttribute(name: string, value: string): void;
  isPointInStroke(point: { x: number; y: number }): boolean;
  append(node: PathElement): void;
  remove(): void;
}
const { document } = globalThis as {
  document?: {
    createElementNS(namespace: string, name: string): PathElement;
    body: { append(node: PathElement): void };
  };
};

describe.skipIf(document === undefined)("transformPath in a browser", () => {
  test("draws the transformed path through the mapped points", () => {
    if (document === undefined) return;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const element = document.createElementNS(namespace, "path");
    document.body.append(svg);
    svg.append(element);
    element.setAttribute("fill", "none");
    element.setAttribute("stroke", "black");
    // Round caps cover the end points, which lie on the edge of a butt cap.
    element.setAttribute("stroke-linecap", "round");
    element.setAttribute("stroke-linejoin", "round");
    try {
      fc.assert(
        fc.property(path, matrix, (segments, m) => {
          const points = drawnPoints(normalizePath(segments), 16).map((p) =>
            apply(m, p),
          );
          fc.pre(points.length > 0);
          const d = stringifyPath(transformPath(segments, m));
          element.setAttribute("d", d);
          // Browsers keep paths in 32-bit floats and draw arcs as cubic
          // curves, off by less than 0.1% of the size.
          element.setAttribute("stroke-width", String(4e-3 * extent(points)));
          for (const [x, y] of points) {
            expect(
              element.isPointInStroke({ x, y }),
              `${String(x)},${String(y)} on ${d}`,
            ).toBe(true);
          }
        }),
        { numRuns: 300 },
      );
    } finally {
      svg.remove();
    }
  });
});
