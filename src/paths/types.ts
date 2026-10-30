/**
 * `M` or `m`: starts a new subpath at `x`, `y`.
 *
 * @example
 * ```ts
 * // d="M10 20"
 * const segment: SvgMoveTo = { type: "M", x: 10, y: 20 };
 * ```
 */
export interface SvgMoveTo {
  /** `"M"` for absolute coordinates, `"m"` for relative ones. */
  type: "M" | "m";
  /** The x coordinate of the new current point. */
  x: number;
  /** The y coordinate of the new current point. */
  y: number;
}

/**
 * `L` or `l`: a straight line to `x`, `y`.
 */
export interface SvgLineTo {
  /** `"L"` for absolute coordinates, `"l"` for relative ones. */
  type: "L" | "l";
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `H` or `h`: a horizontal line to `x`.
 */
export interface SvgHorizontalLineTo {
  /** `"H"` for an absolute coordinate, `"h"` for a relative one. */
  type: "H" | "h";
  /** The x coordinate of the end point. */
  x: number;
}

/**
 * `V` or `v`: a vertical line to `y`.
 */
export interface SvgVerticalLineTo {
  /** `"V"` for an absolute coordinate, `"v"` for a relative one. */
  type: "V" | "v";
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `C` or `c`: a cubic Bézier curve to `x`, `y` with two control points.
 */
export interface SvgCubicCurveTo {
  /** `"C"` for absolute coordinates, `"c"` for relative ones. */
  type: "C" | "c";
  /** The x coordinate of the first control point. */
  x1: number;
  /** The y coordinate of the first control point. */
  y1: number;
  /** The x coordinate of the second control point. */
  x2: number;
  /** The y coordinate of the second control point. */
  y2: number;
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `S` or `s`: a cubic Bézier curve whose first control point is the
 * reflection of the previous curve's second one.
 */
export interface SvgSmoothCubicCurveTo {
  /** `"S"` for absolute coordinates, `"s"` for relative ones. */
  type: "S" | "s";
  /** The x coordinate of the second control point. */
  x2: number;
  /** The y coordinate of the second control point. */
  y2: number;
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `Q` or `q`: a quadratic Bézier curve to `x`, `y` with one control point.
 */
export interface SvgQuadraticCurveTo {
  /** `"Q"` for absolute coordinates, `"q"` for relative ones. */
  type: "Q" | "q";
  /** The x coordinate of the control point. */
  x1: number;
  /** The y coordinate of the control point. */
  y1: number;
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `T` or `t`: a quadratic Bézier curve whose control point is the reflection
 * of the previous curve's one.
 */
export interface SvgSmoothQuadraticCurveTo {
  /** `"T"` for absolute coordinates, `"t"` for relative ones. */
  type: "T" | "t";
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `A` or `a`: an elliptical arc to `x`, `y`.
 *
 * @example
 * ```ts
 * // d="… a5 5 0 0 1 10 0"
 * const segment: SvgArcTo = {
 *   type: "a",
 *   rx: 5,
 *   ry: 5,
 *   rotation: 0,
 *   largeArc: false,
 *   sweep: true,
 *   x: 10,
 *   y: 0,
 * };
 * ```
 */
export interface SvgArcTo {
  /** `"A"` for absolute coordinates, `"a"` for relative ones. */
  type: "A" | "a";
  /** The x radius of the ellipse, as written; renderers use its absolute value. */
  rx: number;
  /** The y radius of the ellipse, as written; renderers use its absolute value. */
  ry: number;
  /** The rotation of the ellipse's x axis, in degrees. */
  rotation: number;
  /** The large arc flag: whether the arc spans more than 180°. */
  largeArc: boolean;
  /** The sweep flag: whether the arc is drawn in the positive-angle direction. */
  sweep: boolean;
  /** The x coordinate of the end point. */
  x: number;
  /** The y coordinate of the end point. */
  y: number;
}

/**
 * `Z` or `z`: closes the current subpath with a line to its start. Both
 * letters mean the same; the case is kept as written.
 */
export interface SvgClosePath {
  /** The letter as written. */
  type: "Z" | "z";
}

/**
 * One command of path data with its arguments. Commands are kept as written:
 * absolute and relative, shorthand and full.
 */
export type SvgPathSegment =
  | SvgMoveTo
  | SvgLineTo
  | SvgHorizontalLineTo
  | SvgVerticalLineTo
  | SvgCubicCurveTo
  | SvgSmoothCubicCurveTo
  | SvgQuadraticCurveTo
  | SvgSmoothQuadraticCurveTo
  | SvgArcTo
  | SvgClosePath;
