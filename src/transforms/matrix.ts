import type { SvgMatrix, SvgPoint, SvgTransformFunction } from "./types";

/**
 * Builds a matrix, writing `-0` as `0`: products such as `-1 × 0` give `-0`,
 * which means the same here but compares unequal with `Object.is`.
 */
const matrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): SvgMatrix => ({
  a: a + 0,
  b: b + 0,
  c: c + 0,
  d: d + 0,
  e: e + 0,
  f: f + 0,
});

/**
 * The cosines and sines of the multiples of 90°, by quarter turn.
 */
const rightAngles: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Returns the cosine and sine of an angle in degrees, exact for multiples of
 * 90°. The angle is reduced to one turn first, in degrees, where `%` is
 * exact; in radians, `Math.cos(Math.PI / 2)` is 6 × 10⁻¹⁷, not 0.
 */
function cosSin(degrees: number): readonly [number, number] {
  const reduced = degrees % 360;
  if (reduced % 90 === 0) {
    return rightAngles[(reduced / 90 + 4) % 4] ?? [1, 0];
  }
  const radians = (reduced * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
}

/**
 * Returns the tangent of an angle in degrees, exact for multiples of 45°
 * other than odd multiples of 90°: `Math.tan(Math.PI / 4)` is
 * 0.9999999999999999. At 90° the tangent is that of the nearest double to
 * π/2, about 1.6 × 10¹⁶, as browsers compute it, not an infinity.
 */
function tan(degrees: number): number {
  const reduced = degrees % 180;
  if (reduced === 0) return 0;
  if (reduced === 45 || reduced === -135) return 1;
  if (reduced === -45 || reduced === 135) return -1;
  return Math.tan((reduced * Math.PI) / 180);
}

/**
 * Returns the matrix of one transform function.
 */
function functionMatrix(fn: SvgTransformFunction): SvgMatrix {
  switch (fn.type) {
    case "matrix":
      return matrix(fn.a, fn.b, fn.c, fn.d, fn.e, fn.f);
    case "translate":
      return matrix(1, 0, 0, 1, fn.x, fn.y ?? 0);
    case "scale":
      return matrix(fn.x, 0, 0, fn.y ?? fn.x, 0, 0);
    case "rotate": {
      const [cos, sin] = cosSin(fn.angle);
      // translate(cx cy) rotate(angle) translate(-cx -cy)
      const cx = fn.cx ?? 0;
      const cy = fn.cy ?? 0;
      return matrix(
        cos,
        sin,
        -sin,
        cos,
        cx - cos * cx + sin * cy,
        cy - sin * cx - cos * cy,
      );
    }
    case "skewX":
      return matrix(1, 0, tan(fn.angle), 1, 0, 0);
    case "skewY":
      return matrix(1, tan(fn.angle), 0, 1, 0, 0);
    default: {
      // The type is checked at run time, for functions built by hand.
      const type: unknown = (fn as { type: unknown }).type;
      throw new TypeError(`Not a transform function: ${String(type)}`);
    }
  }
}

/**
 * Multiplies two matrices: the result applies `n` first, then `m`, as
 * `m.multiply(n)` does with `DOMMatrix`.
 *
 * @example
 * ```ts
 * const translate = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 0 };
 * const scale = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
 * multiplyMatrix(translate, scale);
 * // { a: 2, b: 0, c: 0, d: 2, e: 10, f: 0 }: scales, then moves
 * ```
 */
export function multiplyMatrix(m: SvgMatrix, n: SvgMatrix): SvgMatrix {
  return matrix(
    m.a * n.a + m.c * n.b,
    m.b * n.a + m.d * n.b,
    m.a * n.c + m.c * n.d,
    m.b * n.c + m.d * n.d,
    m.a * n.e + m.c * n.f + m.e,
    m.b * n.e + m.d * n.f + m.f,
  );
}

/**
 * Returns the matrix of a transform list: the product of its functions in
 * the order they are written, so the last one applies to a point first, as
 * SVG defines it. An empty list gives a new identity matrix.
 *
 * Rotations and skews by multiples of 90° and 45° give exact values, such as
 * 0 and 1 for `rotate(90)`; other values are computed in doubles and not
 * rounded (ARCHITECTURE §15).
 *
 * @example
 * ```ts
 * getTransformMatrix(parseTransform("translate(10 20) scale(2)")!);
 * // { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }
 * getTransformMatrix(parseTransform("rotate(90)")!);
 * // { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }
 * ```
 *
 * @throws {TypeError} If a function has an unknown type.
 */
export function getTransformMatrix(
  functions: readonly SvgTransformFunction[],
): SvgMatrix {
  let result = matrix(1, 0, 0, 1, 0, 0);
  for (const [index, fn] of functions.entries()) {
    const next = functionMatrix(fn);
    result = index === 0 ? next : multiplyMatrix(result, next);
  }
  return result;
}

/**
 * Returns the inverse of a matrix, which undoes it, or `undefined` if the
 * matrix has none: when its determinant `a·d − b·c` is 0, as for
 * `scale(0)`, or not finite.
 *
 * @example
 * ```ts
 * invertMatrix({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 0 });
 * // { a: 0.5, b: 0, c: 0, d: 0.5, e: -5, f: 0 }
 * invertMatrix({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }); // undefined
 * ```
 */
export function invertMatrix(m: SvgMatrix): SvgMatrix | undefined {
  const determinant = m.a * m.d - m.b * m.c;
  if (determinant === 0 || !Number.isFinite(determinant)) return undefined;
  return matrix(
    m.d / determinant,
    -m.b / determinant,
    -m.c / determinant,
    m.a / determinant,
    (m.c * m.f - m.d * m.e) / determinant,
    (m.b * m.e - m.a * m.f) / determinant,
  );
}

/**
 * Applies a matrix to a point: `(a·x + c·y + e, b·x + d·y + f)`.
 *
 * @example
 * ```ts
 * transformPoint({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 0 }, { x: 1, y: 1 });
 * // { x: 12, y: 2 }
 * ```
 */
export function transformPoint(m: SvgMatrix, point: SvgPoint): SvgPoint {
  return {
    x: m.a * point.x + m.c * point.y + m.e + 0,
    y: m.b * point.x + m.d * point.y + m.f + 0,
  };
}
