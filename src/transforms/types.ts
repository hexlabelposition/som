/**
 * `matrix(a b c d e f)`: the transform given by its six values, which maps a
 * point `(x, y)` to `(a·x + c·y + e, b·x + d·y + f)`.
 *
 * @example
 * ```ts
 * // transform="matrix(1 0 0 -1 6 15)"
 * const fn: SvgMatrixFunction = { type: "matrix", a: 1, b: 0, c: 0, d: -1, e: 6, f: 15 };
 * ```
 */
export interface SvgMatrixFunction {
  /** The function name. */
  type: "matrix";
  /** The x scale, the x coordinate of the transformed x axis. */
  a: number;
  /** The y coordinate of the transformed x axis. */
  b: number;
  /** The x coordinate of the transformed y axis. */
  c: number;
  /** The y scale, the y coordinate of the transformed y axis. */
  d: number;
  /** The x translation. */
  e: number;
  /** The y translation. */
  f: number;
}

/**
 * `translate(x [y])`: moves by `x` and `y` user units.
 *
 * @example
 * ```ts
 * // transform="translate(10)"
 * const fn: SvgTranslateFunction = { type: "translate", x: 10 };
 * ```
 */
export interface SvgTranslateFunction {
  /** The function name. */
  type: "translate";
  /** The distance along the x axis. */
  x: number;
  /** The distance along the y axis; 0 when it is left out. */
  y?: number;
}

/**
 * `scale(x [y])`: scales by `x` along the x axis and `y` along the y axis.
 *
 * @example
 * ```ts
 * // transform="scale(2 -1)"
 * const fn: SvgScaleFunction = { type: "scale", x: 2, y: -1 };
 * ```
 */
export interface SvgScaleFunction {
  /** The function name. */
  type: "scale";
  /** The factor along the x axis. */
  x: number;
  /** The factor along the y axis; the same as `x` when it is left out. */
  y?: number;
}

/**
 * `rotate(angle [cx cy])`: rotates by `angle` degrees around the origin, or
 * around `cx`, `cy` when both are given. A positive angle turns the x axis
 * toward the y axis, clockwise on screen.
 *
 * @example
 * ```ts
 * // transform="rotate(45 5 5)"
 * const fn: SvgRotateFunction = { type: "rotate", angle: 45, cx: 5, cy: 5 };
 * ```
 */
export interface SvgRotateFunction {
  /** The function name. */
  type: "rotate";
  /** The angle in degrees. */
  angle: number;
  /** The x coordinate of the center; given together with `cy` or not at all. */
  cx?: number;
  /** The y coordinate of the center; given together with `cx` or not at all. */
  cy?: number;
}

/**
 * `skewX(angle)`: slants the y axis by `angle` degrees, so a point moves
 * along the x axis by `tan(angle)` times its y coordinate.
 */
export interface SvgSkewXFunction {
  /** The function name. */
  type: "skewX";
  /** The angle in degrees. */
  angle: number;
}

/**
 * `skewY(angle)`: slants the x axis by `angle` degrees, so a point moves
 * along the y axis by `tan(angle)` times its x coordinate.
 */
export interface SvgSkewYFunction {
  /** The function name. */
  type: "skewY";
  /** The angle in degrees. */
  angle: number;
}

/**
 * One function of a transform list, the value of `transform`,
 * `gradientTransform` or `patternTransform`, discriminated by `type`.
 *
 * @example
 * ```ts
 * function describe(fn: SvgTransformFunction): string {
 *   return fn.type === "rotate" ? `turned by ${fn.angle}°` : fn.type;
 * }
 * ```
 */
export type SvgTransformFunction =
  | SvgMatrixFunction
  | SvgTranslateFunction
  | SvgScaleFunction
  | SvgRotateFunction
  | SvgSkewXFunction
  | SvgSkewYFunction;

/**
 * A 2D affine transform as six numbers, named as in `matrix(a b c d e f)`,
 * `DOMMatrix` and `SVGMatrix`. It maps a point `(x, y)` to
 * `(a·x + c·y + e, b·x + d·y + f)`.
 *
 * @example
 * ```ts
 * const identity: SvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
 * ```
 */
export interface SvgMatrix {
  /** The x scale, the x coordinate of the transformed x axis. */
  a: number;
  /** The y coordinate of the transformed x axis. */
  b: number;
  /** The x coordinate of the transformed y axis. */
  c: number;
  /** The y scale, the y coordinate of the transformed y axis. */
  d: number;
  /** The x translation. */
  e: number;
  /** The y translation. */
  f: number;
}

/**
 * A point in user units.
 *
 * @example
 * ```ts
 * const origin: SvgPoint = { x: 0, y: 0 };
 * ```
 */
export interface SvgPoint {
  /** The x coordinate. */
  x: number;
  /** The y coordinate. */
  y: number;
}
