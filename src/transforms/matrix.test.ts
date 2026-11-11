import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  getTransformMatrix,
  invertMatrix,
  multiplyMatrix,
  transformPoint,
} from "./matrix";
import { parseTransform } from "./parse";
import { stringifyTransform } from "./stringify";
import type { SvgMatrix, SvgTransformFunction } from "./types";

/**
 * The matrix of a transform list.
 */
const matrixOf = (text: string): SvgMatrix =>
  getTransformMatrix(parseTransform(text) ?? []);

const m = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): SvgMatrix => ({ a, b, c, d, e, f });

/**
 * Expects a matrix to be close to the given one.
 */
function expectClose(actual: SvgMatrix, expected: SvgMatrix, digits = 12) {
  for (const key of ["a", "b", "c", "d", "e", "f"] as const) {
    expect(actual[key], key).toBeCloseTo(expected[key], digits);
  }
}

describe("getTransformMatrix", () => {
  test.each<[string, SvgMatrix]>([
    ["", m(1, 0, 0, 1, 0, 0)],
    ["matrix(1 2 3 4 5 6)", m(1, 2, 3, 4, 5, 6)],
    ["translate(10)", m(1, 0, 0, 1, 10, 0)],
    ["translate(10 20)", m(1, 0, 0, 1, 10, 20)],
    ["scale(2)", m(2, 0, 0, 2, 0, 0)],
    ["scale(2 -3)", m(2, 0, 0, -3, 0, 0)],
    ["rotate(90)", m(0, 1, -1, 0, 0, 0)],
    ["rotate(180)", m(-1, 0, 0, -1, 0, 0)],
    ["rotate(-90)", m(0, -1, 1, 0, 0, 0)],
    ["rotate(450)", m(0, 1, -1, 0, 0, 0)],
    ["rotate(-270)", m(0, 1, -1, 0, 0, 0)],
    ["rotate(360)", m(1, 0, 0, 1, 0, 0)],
    ["rotate(90 5 5)", m(0, 1, -1, 0, 10, 0)],
    ["skewX(45)", m(1, 0, 1, 1, 0, 0)],
    ["skewX(-135)", m(1, 0, 1, 1, 0, 0)],
    ["skewY(135)", m(1, -1, 0, 1, 0, 0)],
    ["skewX(180)", m(1, 0, 0, 1, 0, 0)],
    ["translate(10 20) scale(2)", m(2, 0, 0, 2, 10, 20)],
    ["scale(2) translate(10 20)", m(2, 0, 0, 2, 20, 40)],
  ])("gives the exact matrix of %j", (text, expected) => {
    expect(matrixOf(text)).toStrictEqual(expected);
  });

  test("computes other angles in doubles", () => {
    const half = Math.SQRT1_2;
    expectClose(matrixOf("rotate(45)"), m(half, half, -half, half, 0, 0));
    expectClose(
      matrixOf("rotate(30)"),
      m(Math.sqrt(3) / 2, 0.5, -0.5, Math.sqrt(3) / 2, 0, 0),
    );
    expectClose(matrixOf("rotate(390)"), matrixOf("rotate(30)"), 15);
    expectClose(matrixOf("skewY(30)"), m(1, Math.sqrt(3) / 3, 0, 1, 0, 0));
  });

  test("keeps a finite skew at 90°, as browsers do", () => {
    const { c } = matrixOf("skewX(90)");
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(1e15);
  });

  test("rotates around the center", () => {
    const point = transformPoint(matrixOf("rotate(37 3 4)"), { x: 3, y: 4 });
    expect(point.x).toBeCloseTo(3, 14);
    expect(point.y).toBeCloseTo(4, 14);
  });

  test("never gives -0", () => {
    const matrix = matrixOf("rotate(180) scale(-1 0) translate(0)");
    for (const value of Object.values(matrix)) {
      expect(Object.is(value, -0)).toBe(false);
    }
  });

  test("returns a new identity for an empty list", () => {
    const first = getTransformMatrix([]);
    first.a = 5;
    expect(getTransformMatrix([]).a).toBe(1);
  });

  test("throws for an unknown function", () => {
    expect(() =>
      getTransformMatrix([
        { type: "skew", angle: 1 } as unknown as SvgTransformFunction,
      ]),
    ).toThrow(TypeError);
  });
});

describe("multiplyMatrix", () => {
  test("applies the second matrix first", () => {
    const translate = m(1, 0, 0, 1, 10, 0);
    const scale = m(2, 0, 0, 2, 0, 0);
    expect(multiplyMatrix(translate, scale)).toEqual(m(2, 0, 0, 2, 10, 0));
    expect(multiplyMatrix(scale, translate)).toEqual(m(2, 0, 0, 2, 20, 0));
  });
});

describe("invertMatrix", () => {
  test("undoes a matrix", () => {
    expect(invertMatrix(m(2, 0, 0, 2, 10, 0))).toEqual(
      m(0.5, 0, 0, 0.5, -5, 0),
    );
    expect(invertMatrix(matrixOf("rotate(90)"))).toEqual(
      matrixOf("rotate(-90)"),
    );
  });

  test.each([
    m(0, 0, 0, 0, 0, 0),
    m(1, 2, 2, 4, 5, 6),
    m(1e200, 0, 0, 1e200, 0, 0),
  ])("returns undefined without an inverse: %j", (matrix) => {
    expect(invertMatrix(matrix)).toBeUndefined();
  });
});

describe("transformPoint", () => {
  test("maps a point", () => {
    expect(transformPoint(m(1, 2, 3, 4, 5, 6), { x: 1, y: 1 })).toEqual({
      x: 9,
      y: 12,
    });
  });
});

// Random lists: the matrix maps points as the functions do one by one, its
// inverse undoes it, and browsers compute the same matrix.

const number = fc
  .integer({ min: -100_000, max: 100_000 })
  .map((value) => value / 100);
const angle = fc.integer({ min: -7200, max: 7200 }).map((value) => value / 10);

const transformFunction: fc.Arbitrary<SvgTransformFunction> = fc.oneof(
  fc.record({
    type: fc.constant("matrix" as const),
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  }),
  fc.record(
    { type: fc.constant("translate" as const), x: number, y: number },
    { requiredKeys: ["type", "x"] },
  ),
  fc.record(
    { type: fc.constant("scale" as const), x: number, y: number },
    { requiredKeys: ["type", "x"] },
  ),
  fc.record({ type: fc.constant("rotate" as const), angle }),
  fc.record({
    type: fc.constant("rotate" as const),
    angle,
    cx: number,
    cy: number,
  }),
  // Skews near 90° are huge and lose all precision in floats.
  fc.record({
    type: fc.constant("skewX" as const),
    angle: fc.integer({ min: -800, max: 800 }).map((value) => value / 10),
  }),
  fc.record({
    type: fc.constant("skewY" as const),
    angle: fc.integer({ min: -800, max: 800 }).map((value) => value / 10),
  }),
);

const list = fc.array(transformFunction, { minLength: 1, maxLength: 4 });

/**
 * The largest absolute value of a matrix, to scale tolerances by.
 */
const size = (matrix: SvgMatrix): number =>
  Math.max(1, ...Object.values(matrix).map(Math.abs));

describe("getTransformMatrix with random lists", () => {
  test("maps a point as the functions do one by one", () => {
    const point = { x: 3.25, y: -7.5 };
    fc.assert(
      fc.property(list, (functions) => {
        let expected = point;
        for (const fn of [...functions].reverse()) {
          expected = transformPoint(getTransformMatrix([fn]), expected);
        }
        const actual = transformPoint(getTransformMatrix(functions), point);
        const tolerance =
          1e-9 * Math.max(1, Math.abs(expected.x), Math.abs(expected.y));
        expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance);
        expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance);
      }),
    );
  });

  test("has an inverse that undoes it", () => {
    fc.assert(
      fc.property(list, (functions) => {
        const matrix = getTransformMatrix(functions);
        const inverse = invertMatrix(matrix);
        const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
        fc.pre(inverse !== undefined && Math.abs(determinant) > 1e-6);
        const product = multiplyMatrix(matrix, inverse);
        const tolerance = 1e-6 * size(matrix) * size(inverse);
        for (const [key, value] of Object.entries(m(1, 0, 0, 1, 0, 0))) {
          expect(
            Math.abs(product[key as keyof SvgMatrix] - value),
          ).toBeLessThan(tolerance);
        }
      }),
    );
  });
});

// The browser test reads the matrix with getCTM(). The global is typed here,
// because the library and its tests have no DOM types.
interface GraphicsElement {
  setAttribute(name: string, value: string): void;
  getCTM(): SvgMatrix;
  remove(): void;
}
const { document } = globalThis as {
  document?: {
    createElementNS(namespace: string, name: string): GraphicsElement;
    body: { append(node: GraphicsElement): void };
  };
};

describe.skipIf(document === undefined)(
  "getTransformMatrix in a browser",
  () => {
    test("gives the matrix of getCTM()", () => {
      if (document === undefined) return;
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      const element = document.createElementNS(namespace, "rect");
      document.body.append(svg);
      (svg as unknown as { append(node: GraphicsElement): void }).append(
        element,
      );
      try {
        fc.assert(
          fc.property(list, (functions) => {
            const actual = getTransformMatrix(functions);
            // Firefox gives the identity for a matrix without an inverse,
            // since an element with one is not rendered.
            // A product with one is singular too, but rounding can leave
            // its determinant a little off 0, so each function is checked.
            fc.pre(
              functions.every(
                (fn) => invertMatrix(getTransformMatrix([fn])) !== undefined,
              ),
            );
            const text = stringifyTransform(functions);
            element.setAttribute("transform", text);
            const expected = element.getCTM();
            // Browsers compute in 32-bit floats in places, so the error
            // grows with the arguments, such as the center of a rotation.
            const largest = Math.max(
              ...functions
                .flatMap((fn) =>
                  Object.values(fn).filter((v) => typeof v === "number"),
                )
                .map(Math.abs),
            );
            const tolerance = 1e-4 * Math.max(size(actual), largest);
            for (const key of ["a", "b", "c", "d", "e", "f"] as const) {
              expect(
                Math.abs(actual[key] - expected[key]),
                `${key} of ${text}`,
              ).toBeLessThan(tolerance);
            }
          }),
          { numRuns: 500 },
        );
      } finally {
        svg.remove();
      }
    });
  },
);
