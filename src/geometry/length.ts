import { normalizePath, type SvgPathSegment } from "../paths";
import { toCenterArc } from "./arc";
import { cubicRoots } from "./polynomial";
import { integrate } from "./quadrature";

/**
 * The error allowed in the length of a segment, relative to an upper bound
 * of that length. The quadrature usually ends far below it.
 */
const relativeTolerance = 1e-11;

/**
 * A parameter where the speed of a curve is smallest. Near it the speed is
 * about `√(ε² + k² (t - at)²)`, a dip of width `ε / k`, which is very narrow
 * where the curve nearly stops and turns back.
 */
interface Dip {
  /**
   * The parameter of the smallest speed, in (0, 1).
   */
  at: number;
  /**
   * The width of the dip, `ε / k`: the smallest speed divided by the length
   * of the second derivative there. 0 at a cusp, where the curve stops.
   */
  width: number;
}

/**
 * The ratio between the lengths of neighboring intervals around a dip.
 */
const grading = 4;

/**
 * Splits [0, 1] at each dip and at distances `width × 4^j` on both sides of
 * it, so that every interval is at least a third of its length away from
 * the dip, where the speed is smooth on the scale of the interval.
 */
function gradedPoints(dips: readonly Dip[]): number[] {
  const points = [0, 1];
  for (const { at, width } of dips) {
    points.push(at);
    // A dip as wide as the interval needs no grading; at a cusp, the speed
    // is linear on both sides, which the quadrature integrates exactly.
    if (width === 0) continue;
    for (let step = width; step < 1; step *= grading) {
      if (at - step > 0) points.push(at - step);
      if (at + step < 1) points.push(at + step);
    }
  }
  return points.sort((a, b) => a - b);
}

/**
 * Integrates a speed function over [0, 1] to within the tolerance for a
 * segment whose length is at most `bound`.
 *
 * The quadrature halves an interval until two estimates agree, but over an
 * interval with a narrow dip inside, both can miss the dip in the same way.
 * The interval is therefore split around each dip first (`gradedPoints`).
 */
function lengthOf(
  speed: (t: number) => number,
  bound: number,
  dips: readonly Dip[] = [],
): number {
  if (bound === 0) return 0;
  const points = gradedPoints(dips);
  let sum = 0;
  for (let index = 0; index + 1 < points.length; index++) {
    const a = points[index] ?? 0;
    const b = points[index + 1] ?? 1;
    sum += integrate(speed, a, b, relativeTolerance * bound * (b - a));
  }
  return sum;
}

/**
 * The length of a cubic Bézier curve: the integral of the length of its
 * derivative, `3 ((1-t)² a + 2 (1-t) t b + t² c)`, where `a`, `b` and `c`
 * are the legs of its control polygon. The polygon is longer than the curve.
 */
function cubicLength(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  const ax = x1 - x0;
  const ay = y1 - y0;
  const bx = x2 - x1;
  const by = y2 - y1;
  const cx = x3 - x2;
  const cy = y3 - y2;
  // The derivative divided by 3 is `A t² + B t + C`. Its length is smallest
  // where it is perpendicular to the second derivative, `2 A t + B`: the
  // roots of the cubic `(A t² + B t + C) · (2 A t + B)`.
  const qx = ax - 2 * bx + cx;
  const qy = ay - 2 * by + cy;
  const px = 2 * (bx - ax);
  const py = 2 * (by - ay);
  const dips = cubicRoots(
    2 * (qx * qx + qy * qy),
    3 * (qx * px + qy * py),
    px * px + py * py + 2 * (qx * ax + qy * ay),
    px * ax + py * ay,
  ).map((at) => {
    const s = 1 - at;
    const first = Math.hypot(
      s * s * ax + 2 * s * at * bx + at * at * cx,
      s * s * ay + 2 * s * at * by + at * at * cy,
    );
    const second = Math.hypot(2 * qx * at + px, 2 * qy * at + py);
    return { at, width: second === 0 ? 1 : first / second };
  });
  return lengthOf(
    (t) => {
      const s = 1 - t;
      return (
        3 *
        Math.hypot(
          s * s * ax + 2 * s * t * bx + t * t * cx,
          s * s * ay + 2 * s * t * by + t * t * cy,
        )
      );
    },
    Math.hypot(ax, ay) + Math.hypot(bx, by) + Math.hypot(cx, cy),
    dips,
  );
}

/**
 * The length of a quadratic Bézier curve: the integral of the length of its
 * derivative, `2 ((1-t) a + t b)`, where `a` and `b` are the legs of its
 * control polygon.
 */
function quadraticLength(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const ax = x1 - x0;
  const ay = y1 - y0;
  const bx = x2 - x1;
  const by = y2 - y1;
  // The derivative divided by 2 is `a + t (b - a)`; its length is smallest
  // at the foot of the perpendicular from the origin to that line.
  const dx = bx - ax;
  const dy = by - ay;
  const square = dx * dx + dy * dy;
  const at = square === 0 ? 0 : -(ax * dx + ay * dy) / square;
  const dips =
    at > 0 && at < 1
      ? [
          {
            at,
            width: Math.hypot(ax + at * dx, ay + at * dy) / Math.sqrt(square),
          },
        ]
      : [];
  return lengthOf(
    (t) => 2 * Math.hypot((1 - t) * ax + t * bx, (1 - t) * ay + t * by),
    Math.hypot(ax, ay) + Math.hypot(bx, by),
    dips,
  );
}

/**
 * The length of an elliptical arc. A circular arc is its radius times its
 * angle; an elliptical one has no closed form, so the speed
 * `√((rx sin θ)² + (ry cos θ)²)` is integrated over the angle.
 */
function arcLength(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): number {
  if (x1 === x2 && y1 === y2) return 0;
  const arc = toCenterArc(x1, y1, rx, ry, rotation, largeArc, sweep, x2, y2);
  if (arc === undefined) return Math.hypot(x2 - x1, y2 - y1);
  const span = Math.abs(arc.sweep);
  if (arc.rx === arc.ry) return arc.rx * span;
  return lengthOf(
    (t) => {
      const theta = arc.start + t * arc.sweep;
      return (
        span * Math.hypot(arc.rx * Math.sin(theta), arc.ry * Math.cos(theta))
      );
    },
    Math.max(arc.rx, arc.ry) * span,
  );
}

/**
 * Returns the length of path data, the sum of the lengths of the segments it
 * draws, as `getTotalLength()` measures it in browsers.
 *
 * Lines and circular arcs are measured exactly; curves and elliptical arcs,
 * which have no closed form, are integrated numerically to a relative error
 * below 10⁻¹⁰. Arcs are measured as SVG defines them, with radii scaled up
 * when they are too small and a zero radius drawn as a line. A moveto adds
 * nothing and `Z` adds the line back to the start of the subpath, so an
 * empty path or one of movetos only has length 0.
 *
 * The result is the length of the true curves. Browsers draw arcs as cubic
 * curves and measure them about 0.014% longer, and measure small curves
 * with a fixed tolerance. The `pathLength` attribute, which scales dash
 * offsets, does not change it, as it does not change `getTotalLength()`.
 *
 * @example
 * ```ts
 * getPathLength(parsePath("M0 0 L3 4 Z")!); // 10
 * getPathLength(parsePath("M-1 0 A1 1 0 0 1 1 0 A1 1 0 0 1 -1 0")!); // 2π
 * getPathLength([]); // 0
 * ```
 *
 * @throws {TypeError} If the first segment is not `M` or `m` or a segment
 *   has an unknown type, as `normalizePath` throws.
 */
export function getPathLength(path: readonly SvgPathSegment[]): number {
  let length = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const segment of normalizePath(path)) {
    switch (segment.type) {
      case "M":
        startX = segment.x;
        startY = segment.y;
        break;
      case "L":
        length += Math.hypot(segment.x - x, segment.y - y);
        break;
      case "C":
        length += cubicLength(
          x,
          y,
          segment.x1,
          segment.y1,
          segment.x2,
          segment.y2,
          segment.x,
          segment.y,
        );
        break;
      case "Q":
        length += quadraticLength(
          x,
          y,
          segment.x1,
          segment.y1,
          segment.x,
          segment.y,
        );
        break;
      case "A":
        length += arcLength(
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
        break;
      case "Z":
        length += Math.hypot(startX - x, startY - y);
        x = startX;
        y = startY;
        continue;
    }
    x = segment.x;
    y = segment.y;
  }

  return length;
}
