import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { normalizePath } from "./normalize";
import { parsePath } from "./parse";
import { stringifyPath } from "./stringify";
import type { SvgPathSegment } from "./types";

/** Normalizes path data and writes it back. */
const normalize = (text: string): string =>
  stringifyPath(normalizePath(parsePath(text) ?? []));

describe("normalizePath", () => {
  test.each<[string, string]>([
    ["M10 20 l5 -5 h10 v5", "M10 20 L15 15 L25 15 L25 20"],
    ["M10 20 H30 V40", "M10 20 L30 20 L30 40"],
    ["m10 20 m5 5", "M10 20 M15 25"],
    ["M1 2 c1 1 2 2 3 3", "M1 2 C2 3 3 4 4 5"],
    ["M1 2 q1 1 2 2", "M1 2 Q2 3 3 4"],
    ["M1 2 a5 6 30 1 0 3 4", "M1 2 A5 6 30 1 0 4 6"],
    ["M1 2 A-5 6 30 1 0 3 4", "M1 2 A-5 6 30 1 0 3 4"],
    ["M1 2 L3 4 z", "M1 2 L3 4 Z"],
  ])("normalizes %s", (input, output) => {
    expect(normalize(input)).toBe(output);
  });

  test("starts a relative moveto at the origin", () => {
    expect(normalize("m1 2 l3 4")).toBe("M1 2 L4 6");
  });

  test("returns to the start of the subpath after Z", () => {
    expect(normalize("M1 2 L5 5 m1 1 l2 2 z l1 1 z m1 1")).toBe(
      "M1 2 L5 5 M6 6 L8 8 Z L7 7 Z M7 7",
    );
  });

  describe("smooth cubic curves", () => {
    test("reflect the second control point of a C", () => {
      expect(normalize("M0 0 C1 2 3 4 5 5 S9 9 10 10")).toBe(
        "M0 0 C1 2 3 4 5 5 C7 6 9 9 10 10",
      );
    });

    test("reflect the second control point of an S", () => {
      expect(normalize("M0 0 s1 1 2 0 s1 1 2 0")).toBe(
        "M0 0 C0 0 1 1 2 0 C3 -1 3 1 4 0",
      );
    });

    test.each(["L5 5", "Q1 1 5 5", "T5 5", "A1 1 0 0 1 5 5", "Z"])(
      "start at the current point after %s",
      (command) => {
        const curve = normalizePath(
          parsePath(`M5 5 C0 0 0 0 5 5 ${command} S9 9 10 10`) ?? [],
        ).at(-1);
        expect(curve).toEqual({
          type: "C",
          x1: 5,
          y1: 5,
          x2: 9,
          y2: 9,
          x: 10,
          y: 10,
        });
      },
    );

    test("start at the current point after a moveto", () => {
      expect(normalize("M5 5 S9 9 10 10")).toBe("M5 5 C5 5 9 9 10 10");
    });
  });

  describe("smooth quadratic curves", () => {
    test("reflect the control point of a Q", () => {
      expect(normalize("M0 0 Q1 2 4 4 T8 8")).toBe("M0 0 Q1 2 4 4 Q7 6 8 8");
    });

    test("reflect the computed control point of a T", () => {
      expect(normalize("M0 0 Q1 1 2 0 t2 0 t2 0")).toBe(
        "M0 0 Q1 1 2 0 Q3 -1 4 0 Q5 1 6 0",
      );
    });

    test("start at the current point after other commands", () => {
      expect(normalize("M0 0 C1 1 2 2 3 3 T5 5")).toBe(
        "M0 0 C1 1 2 2 3 3 Q3 3 5 5",
      );
      expect(normalize("M5 5 t1 1")).toBe("M5 5 Q5 5 6 6");
    });
  });

  test("sums coordinates as decimals", () => {
    expect(normalize("M0.1 0 l0.2 0 h0.4 v0.7 l-0.7 0.1")).toBe(
      "M0.1 0 L0.3 0 L0.7 0 L0.7 0.7 L0 0.8",
    );
    expect(normalize("M0.1 0.2 C0.3 0.3 0.4 0.4 0.3 0.3 S0.1 0.1 0 0")).toBe(
      "M0.1 0.2 C0.3 0.3 0.4 0.4 0.3 0.3 C0.2 0.2 0.1 0.1 0 0",
    );
  });

  test("keeps absolute numbers as they are", () => {
    const path: SvgPathSegment[] = [
      { type: "M", x: 0.30000000000000004, y: 1e-7 },
      { type: "L", x: -0, y: 1e21 },
    ];
    expect(normalizePath(path)).toEqual(path);
  });

  test("returns a new array and new segments", () => {
    const path: SvgPathSegment[] = [{ type: "M", x: 1, y: 2 }];
    const result = normalizePath(path);
    expect(result).not.toBe(path);
    expect(result[0]).not.toBe(path[0]);
  });

  test("normalizes an empty path to an empty one", () => {
    expect(normalizePath([])).toEqual([]);
  });

  test.each<[unknown[], string]>([
    [[{ type: "L", x: 0, y: 0 }], "no moveto first"],
    [[{ type: "Z" }], "no moveto first"],
    [
      [
        { type: "M", x: 0, y: 0 },
        { type: "X", x: 0, y: 0 },
      ],
      "unknown command",
    ],
    [[{ type: 1 }], "type that is not a string"],
  ])("throws for %j (%s)", (path) => {
    expect(() => normalizePath(path as unknown as SvgPathSegment[])).toThrow(
      TypeError,
    );
  });
});

// Properties (ARCHITECTURE §13): the result has only normalized commands,
// normalizing is idempotent and survives a round trip through stringifyPath,
// and decimal coordinates are summed as integer ones are.

/** A path of random commands with the given numbers. */
function pathOf(number: fc.Arbitrary<number>): fc.Arbitrary<SvgPathSegment[]> {
  const point = { x: number, y: number };
  const control = { x1: number, y1: number };
  const control2 = { x2: number, y2: number };
  const letter = <T extends string>(upper: T, lower: string) =>
    fc.constantFrom(upper, lower) as fc.Arbitrary<T>;

  const drawto: fc.Arbitrary<SvgPathSegment> = fc.oneof(
    fc.record({ type: letter("M", "m"), ...point }),
    fc.record({ type: letter("L", "l"), ...point }),
    fc.record({ type: letter("H", "h"), x: number }),
    fc.record({ type: letter("V", "v"), y: number }),
    fc.record({ type: letter("C", "c"), ...control, ...control2, ...point }),
    fc.record({ type: letter("S", "s"), ...control2, ...point }),
    fc.record({ type: letter("Q", "q"), ...control, ...point }),
    fc.record({ type: letter("T", "t"), ...point }),
    fc.record({
      type: letter("A", "a"),
      rx: number,
      ry: number,
      rotation: number,
      largeArc: fc.boolean(),
      sweep: fc.boolean(),
      ...point,
    }),
    fc.record({ type: letter("Z", "z") }),
  );

  return fc
    .tuple(
      fc.record({ type: letter("M", "m"), ...point }),
      fc.array(drawto, { maxLength: 20 }),
    )
    .map(([first, rest]) => [first, ...rest]);
}

/** Multiplies every number of a path by a factor. */
const scale = (path: readonly SvgPathSegment[], factor: number) =>
  path.map((segment) =>
    Object.fromEntries(
      Object.entries(segment).map(([key, value]) => [
        key,
        typeof value === "number" ? value / factor + 0 : value,
      ]),
    ),
  );

const decimal = fc
  .double({ min: -1e6, max: 1e6, noNaN: true })
  .map((value) => Number(value.toFixed(3)) + 0);

describe("properties", () => {
  test("gives only absolute full commands", () => {
    fc.assert(
      fc.property(pathOf(decimal), (path) => {
        for (const { type } of normalizePath(path)) {
          expect(["M", "L", "C", "Q", "A", "Z"]).toContain(type);
        }
      }),
    );
  });

  test("normalizes a normalized path to itself", () => {
    fc.assert(
      fc.property(pathOf(decimal), (path) => {
        const normalized = normalizePath(path);
        expect(normalizePath(normalized)).toEqual(normalized);
      }),
    );
  });

  test("reads back from stringifyPath", () => {
    fc.assert(
      fc.property(pathOf(decimal), (path) => {
        const normalized = normalizePath(path);
        expect(parsePath(stringifyPath(normalized))).toEqual(normalized);
      }),
    );
  });

  test("sums decimals as integers", () => {
    // Integers are summed exactly in doubles, so a path of integers divided
    // by 10^places normalizes to its normalized form divided the same way.
    const integer = fc.integer({ min: -1e8, max: 1e8 });
    fc.assert(
      fc.property(
        pathOf(integer),
        fc.integer({ min: 0, max: 6 }),
        (path, places) => {
          const factor = 10 ** places;
          const decimals = scale(path, factor) as SvgPathSegment[];
          expect(normalizePath(decimals)).toEqual(
            scale(normalizePath(path), factor),
          );
        },
      ),
    );
  });
});
