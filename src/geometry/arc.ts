/**
 * An elliptical arc in center parameterization: the point at angle `θ` is
 * `center + rotate(φ) · (rx cos θ, ry sin θ)`.
 */
export interface CenterArc {
  /**
   * The x coordinate of the center.
   */
  cx: number;
  /**
   * The y coordinate of the center.
   */
  cy: number;
  /**
   * The x radius, positive and scaled up if it was too small.
   */
  rx: number;
  /**
   * The y radius, positive and scaled up if it was too small.
   */
  ry: number;
  /**
   * The rotation of the ellipse's x axis, in radians.
   */
  phi: number;
  /**
   * The angle of the start point, in radians.
   */
  start: number;
  /**
   * The signed angle the arc spans, in radians: positive for `sweep`.
   */
  sweep: number;
}

/**
 * The angle from vector `(ux, uy)` to vector `(vx, vy)`, in (-π, π].
 */
const angleBetween = (ux: number, uy: number, vx: number, vy: number) =>
  Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

/**
 * Converts an arc from the endpoint parameterization of path data to its
 * center parameterization, as SVG 2 appendix B.2.4 defines it, or returns
 * `undefined` if the arc is drawn as a straight line: when a radius is zero.
 *
 * Negative radii are used as positive, and radii too small to reach the end
 * point are scaled up until they do (B.2.5). The end points must differ;
 * an arc to its own start point is not drawn at all.
 */
export function toCenterArc(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): CenterArc | undefined {
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  if (rxAbs === 0 || ryAbs === 0) return undefined;

  const phi = ((rotation % 360) * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // The start point in a frame centered between the end points and rotated
  // with the ellipse.
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x = cos * dx + sin * dy;
  const y = -sin * dx + cos * dy;

  const lambda = (x * x) / (rxAbs * rxAbs) + (y * y) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rxAbs *= scale;
    ryAbs *= scale;
  }

  const rx2 = rxAbs * rxAbs;
  const ry2 = ryAbs * ryAbs;
  const denominator = rx2 * y * y + ry2 * x * x;
  // The numerator is negative only by rounding when the radii were scaled.
  const factor =
    (largeArc === sweep ? -1 : 1) *
    Math.sqrt(Math.max(0, (rx2 * ry2 - denominator) / denominator));
  const centerX = (factor * rxAbs * y) / ryAbs;
  const centerY = (-factor * ryAbs * x) / rxAbs;

  const ux = (x - centerX) / rxAbs;
  const uy = (y - centerY) / ryAbs;
  const vx = (-x - centerX) / rxAbs;
  const vy = (-y - centerY) / ryAbs;
  let span = angleBetween(ux, uy, vx, vy);
  if (!sweep && span > 0) span -= 2 * Math.PI;
  else if (sweep && span < 0) span += 2 * Math.PI;

  return {
    cx: cos * centerX - sin * centerY + (x1 + x2) / 2,
    cy: sin * centerX + cos * centerY + (y1 + y2) / 2,
    rx: rxAbs,
    ry: ryAbs,
    phi,
    start: angleBetween(1, 0, ux, uy),
    sweep: span,
  };
}

/**
 * The point of an arc at angle `theta`.
 */
export function arcPoint(arc: CenterArc, theta: number): [number, number] {
  const cos = Math.cos(arc.phi);
  const sin = Math.sin(arc.phi);
  const ex = arc.rx * Math.cos(theta);
  const ey = arc.ry * Math.sin(theta);
  return [arc.cx + cos * ex - sin * ey, arc.cy + sin * ex + cos * ey];
}

/**
 * The margin, in radians, by which an angle must be inside an arc. An angle
 * at an end gives an end point, which is known exactly; computing it from
 * the angle would add rounding noise.
 */
const endMargin = 1e-9;

/**
 * Whether angle `theta` lies inside the arc, not at its ends.
 */
export function insideArc(arc: CenterArc, theta: number): boolean {
  const turn = 2 * Math.PI;
  const offset =
    ((((theta - arc.start) * Math.sign(arc.sweep)) % turn) + turn) % turn;
  return offset > endMargin && offset < Math.abs(arc.sweep) - endMargin;
}
