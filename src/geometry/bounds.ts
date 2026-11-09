import { normalizePath, type SvgPathSegment } from "../paths";
import { arcPoint, insideArc, toCenterArc } from "./arc";

/**
 * A rectangle aligned with the axes, such as the bounds of a path.
 *
 * @example
 * ```ts
 * // The bounds of d="M2 4 L12 9"
 * const bounds: SvgBounds = { x: 2, y: 4, width: 10, height: 5 };
 * ```
 */
export interface SvgBounds {
  /**
   * The left edge.
   */
  x: number;
  /**
   * The top edge.
   */
  y: number;
  /**
   * The width, never negative; 0 for a vertical line or a point.
   */
  width: number;
  /**
   * The height, never negative; 0 for a horizontal line or a point.
   */
  height: number;
}

/**
 * The smallest and largest coordinates seen so far.
 */
class Extent {
  minX = Number.POSITIVE_INFINITY;
  minY = Number.POSITIVE_INFINITY;
  maxX = Number.NEGATIVE_INFINITY;
  maxY = Number.NEGATIVE_INFINITY;

  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  get empty(): boolean {
    return this.minX > this.maxX;
  }
}

/**
 * Returns the parameters in (0, 1) where `a t² + b t + c` is zero, in a form
 * that stays accurate when `a` is close to zero.
 */
function roots(a: number, b: number, c: number): number[] {
  let found: number[];
  if (a === 0) {
    found = b === 0 ? [] : [-c / b];
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];
    const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)) / 2;
    found = q === 0 ? [0] : [q / a, c / q];
  }
  return found.filter((t) => t > 0 && t < 1);
}

/**
 * The value of a cubic Bézier curve at `t` on one axis.
 */
function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number) {
  const s = 1 - t;
  return (
    s * s * s * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t * p3
  );
}

/**
 * The parameters in (0, 1) where a cubic Bézier curve turns on one axis:
 * the roots of its derivative divided by 3.
 */
const cubicExtremes = (p0: number, p1: number, p2: number, p3: number) =>
  roots(-p0 + 3 * p1 - 3 * p2 + p3, 2 * (p0 - 2 * p1 + p2), p1 - p0);

/**
 * The value of a quadratic Bézier curve at `t` on one axis.
 */
function quadraticAt(p0: number, p1: number, p2: number, t: number) {
  const s = 1 - t;
  return s * s * p0 + 2 * s * t * p1 + t * t * p2;
}

/**
 * The parameter in (0, 1) where a quadratic Bézier curve turns on one axis,
 * if it turns there.
 */
function quadraticExtreme(p0: number, p1: number, p2: number): number[] {
  const denominator = p0 - 2 * p1 + p2;
  if (denominator === 0) return [];
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [t] : [];
}

/**
 * Returns the bounds of path data: the smallest rectangle aligned with the
 * axes that contains every point the path draws, as `getBBox()` measures it
 * in browsers, or `undefined` for an empty path.
 *
 * The bounds are exact, not those of the control points: a curve counts up to
 * the points where it turns, and an arc up to its extremes, with radii scaled
 * up when they are too small and an arc with a zero radius drawn as a line,
 * as SVG defines it. The stroke, markers and transforms are not included.
 *
 * Only what is drawn counts: a moveto that no command follows draws nothing
 * and is left out, although browsers count it at the end of a path with
 * curves. A path that draws nothing, such as `M10 20`, has zero-size bounds
 * at its last point, as in browsers. Segments of zero length count, as in
 * Chromium for lines, although Firefox leaves them out.
 *
 * The center of a path is the middle of its bounds:
 * `{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }`.
 *
 * @example
 * ```ts
 * getPathBounds(parsePath("M0 0 C0 -10 10 -10 10 0")!);
 * // { x: 0, y: -7.5, width: 10, height: 7.5 }
 * getPathBounds(parsePath("M0 0 Q5 -10 10 0 Z m20 0")!);
 * // { x: 0, y: -5, width: 10, height: 5 }: the last moveto draws nothing
 * getPathBounds([]); // undefined
 * ```
 *
 * @throws {TypeError} If the first segment is not `M` or `m` or a segment
 *   has an unknown type, as `normalizePath` throws.
 */
export function getPathBounds(
  path: readonly SvgPathSegment[],
): SvgBounds | undefined {
  const extent = new Extent();
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Whether the current subpath has drawn anything, so its start counts.
  let drawn = false;

  for (const segment of normalizePath(path)) {
    if (segment.type === "M") {
      x = startX = segment.x;
      y = startY = segment.y;
      drawn = false;
      continue;
    }
    if (!drawn) {
      extent.add(startX, startY);
      drawn = true;
    }

    switch (segment.type) {
      case "L":
        break;
      case "C":
        for (const t of [
          ...cubicExtremes(x, segment.x1, segment.x2, segment.x),
          ...cubicExtremes(y, segment.y1, segment.y2, segment.y),
        ]) {
          extent.add(
            cubicAt(x, segment.x1, segment.x2, segment.x, t),
            cubicAt(y, segment.y1, segment.y2, segment.y, t),
          );
        }
        break;
      case "Q":
        for (const t of [
          ...quadraticExtreme(x, segment.x1, segment.x),
          ...quadraticExtreme(y, segment.y1, segment.y),
        ]) {
          extent.add(
            quadraticAt(x, segment.x1, segment.x, t),
            quadraticAt(y, segment.y1, segment.y, t),
          );
        }
        break;
      case "A": {
        if (x === segment.x && y === segment.y) break;
        const arc = toCenterArc(
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
        if (arc === undefined) break;
        // The angles where the ellipse turns on the x and on the y axis.
        const cos = Math.cos(arc.phi);
        const sin = Math.sin(arc.phi);
        const thetaX = Math.atan2(-arc.ry * sin, arc.rx * cos);
        const thetaY = Math.atan2(arc.ry * cos, arc.rx * sin);
        for (const theta of [
          thetaX,
          thetaX + Math.PI,
          thetaY,
          thetaY + Math.PI,
        ]) {
          if (insideArc(arc, theta)) extent.add(...arcPoint(arc, theta));
        }
        break;
      }
      case "Z":
        x = startX;
        y = startY;
        continue;
    }

    extent.add(segment.x, segment.y);
    x = segment.x;
    y = segment.y;
  }

  // A path that draws nothing is at its last point.
  if (extent.empty) {
    if (path.length === 0) return undefined;
    extent.add(x, y);
  }
  return {
    x: extent.minX,
    y: extent.minY,
    width: extent.maxX - extent.minX,
    height: extent.maxY - extent.minY,
  };
}
