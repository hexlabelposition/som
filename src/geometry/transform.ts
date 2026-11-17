import {
  normalizePath,
  type SvgNormalizedPathSegment,
  type SvgPathSegment,
} from "../paths";
import { addExact } from "../shared";
import { getTransformMatrix, type SvgMatrix } from "../transforms";
import { arcPoint, insideArc, toCenterArc } from "./arc";

type ArcSegment = Extract<SvgNormalizedPathSegment, { type: "A" }>;

/**
 * The direction of vector `(x, y)` in degrees, in (-180, 180]. `Math.atan2`
 * gives exact multiples of 90° along the axes.
 */
const direction = (x: number, y: number): number =>
  (Math.atan2(y, x) * 180) / Math.PI;

/**
 * Reduces an axis direction in degrees to [0, 180): an ellipse is the same
 * when turned by half a turn.
 */
const halfTurn = (degrees: number): number =>
  (((degrees % 180) + 180) % 180) + 0;

/**
 * The radii and rotation of an ellipse after a linear map.
 */
interface Ellipse {
  rx: number;
  ry: number;
  rotation: number;
}

/**
 * Maps the ellipse of an arc through the linear part of an invertible matrix:
 * the image of the unit circle under `L · rotate(rotation) · scale(rx, ry)`.
 * Radii are made positive and must not be 0.
 */
function mapEllipse(m: SvgMatrix, arc: ArcSegment): Ellipse {
  const rx = Math.abs(arc.rx);
  const ry = Math.abs(arc.ry);

  // A rotation with a uniform scale, mirrored or not, keeps the shape: the
  // radii scale and the axes turn with the map, or are reflected by it.
  const rotates = m.a === m.d && m.b === -m.c;
  if (rotates || (m.a === -m.d && m.b === m.c)) {
    const scale = Math.hypot(m.a, m.b);
    const angle = direction(m.a, m.b);
    return {
      rx: rx * scale,
      ry: ry * scale,
      rotation:
        ((rotates ? arc.rotation + angle : angle - arc.rotation) % 360) + 0,
    };
  }

  // The images of the ellipse's semi-axes: the columns of
  // K = L · rotate(rotation) · scale(rx, ry). `getTransformMatrix` gives
  // exact sines and cosines for multiples of 90°.
  const r = getTransformMatrix([{ type: "rotate", angle: arc.rotation }]);
  const p = (m.a * r.a + m.c * r.b) * rx;
  const q = (m.b * r.a + m.d * r.b) * rx;
  const s = (m.a * r.c + m.c * r.d) * ry;
  const t = (m.b * r.c + m.d * r.d) * ry;

  // Orthogonal images are the axes of the new ellipse, as for a scale of an
  // ellipse aligned with the axes.
  if (p * s + q * t === 0) {
    return {
      rx: Math.hypot(p, q),
      ry: Math.hypot(s, t),
      rotation: halfTurn(direction(p, q)),
    };
  }

  // A 2×2 singular value decomposition, K = rotate(φ) · diag(σ1, ±σ2) ·
  // rotate(θ): the singular values are the radii and φ the rotation.
  const e = (p + t) / 2;
  const f = (p - t) / 2;
  const g = (q + s) / 2;
  const h = (q - s) / 2;
  const major = Math.hypot(e, h) + Math.hypot(f, g);
  // σ1 · σ2 = |det K|, which loses less to rounding than |Q − R| does for a
  // thin ellipse.
  const minor = Math.abs(p * t - q * s) / major;
  return {
    rx: major,
    ry: minor,
    rotation: halfTurn((direction(f, g) + direction(e, h)) / 2),
  };
}

/**
 * The image of an arc under a singular matrix: `L` segments to the points
 * where the image turns back along its line, in the order the arc reaches
 * them, and to its end point.
 */
function collapseArc(
  m: SvgMatrix,
  x: number,
  y: number,
  arc: ArcSegment,
  map: (x: number, y: number) => [number, number],
): SvgNormalizedPathSegment[] {
  const [endX, endY] = map(arc.x, arc.y);
  const end: SvgNormalizedPathSegment = { type: "L", x: endX, y: endY };
  if (x === arc.x && y === arc.y) return [end];
  const center = toCenterArc(
    x,
    y,
    arc.rx,
    arc.ry,
    arc.rotation,
    arc.largeArc,
    arc.sweep,
    arc.x,
    arc.y,
  );
  if (center === undefined) return [end];

  // The image of the point at angle θ is c + u·cos θ + v·sin θ, with u and v
  // the images of the semi-axes, which lie on one line.
  const cos = Math.cos(center.phi);
  const sin = Math.sin(center.phi);
  const ux = (m.a * cos + m.c * sin) * center.rx;
  const uy = (m.b * cos + m.d * sin) * center.rx;
  const vx = (-m.a * sin + m.c * cos) * center.ry;
  const vy = (-m.b * sin + m.d * cos) * center.ry;
  // Project on the longer of the two, the direction of the line.
  const [lx, ly] =
    Math.hypot(ux, uy) >= Math.hypot(vx, vy) ? [ux, uy] : [vx, vy];
  const along = ux * lx + uy * ly;
  const across = vx * lx + vy * ly;
  if (along === 0 && across === 0) return [end];

  const turn = 2 * Math.PI;
  const offset = (theta: number) =>
    ((((theta - center.start) * Math.sign(center.sweep)) % turn) + turn) % turn;
  const extreme = Math.atan2(across, along);
  return [extreme, extreme + Math.PI]
    .filter((theta) => insideArc(center, theta))
    .sort((first, second) => offset(first) - offset(second))
    .map((theta): SvgNormalizedPathSegment => {
      const [px, py] = map(...arcPoint(center, theta));
      return { type: "L", x: px, y: py };
    })
    .concat(end);
}

/**
 * Returns path data drawn through a matrix: every point of the result is the
 * image of a point of the path, as if the path had the matrix as its
 * `transform`.
 *
 * The path is normalized first (`normalizePath`), since relative commands and
 * `H` and `V` cannot keep their form under a rotation, and the result is a
 * new array of normalized segments. Lines and curves map exactly by their
 * end and control points. Arcs stay arcs, as an affine map turns an ellipse
 * into an ellipse: the radii and rotation are those of the image of the
 * ellipse, `largeArc` is kept, and `sweep` flips when the matrix mirrors.
 * Radii are made positive and not scaled up when too small, since a renderer
 * scales up the image the same way, and an arc with a zero radius becomes
 * `L`. A matrix that only translates keeps arcs as written.
 *
 * Numbers are computed in doubles and not rounded, with exact right angles
 * for rotations by multiples of 90°; a translation alone adds coordinates as
 * exact decimals, so `translate(0.1)` moves `M0.2 0` to `M0.3 0`. A matrix
 * with a determinant of 0 collapses the path onto a line or a point, and an
 * arc becomes `L` segments along that line; browsers do not render an
 * element with such a transform at all (ARCHITECTURE §15).
 *
 * @example
 * ```ts
 * const rotate = getTransformMatrix(parseTransform("rotate(90)")!);
 * stringifyPath(transformPath(parsePath("M0 0 h10 a5 5 0 0 1 0 10")!, rotate));
 * // "M0 0 L0 10 A5 5 0 0 1 -10 10"
 * const move = getTransformMatrix(parseTransform("translate(0.1)")!);
 * transformPath(parsePath("m0.2 0 l0.1 0.7")!, move);
 * // [{ type: "M", x: 0.3, y: 0 }, { type: "L", x: 0.4, y: 0.7 }]
 * ```
 *
 * @throws {TypeError} If the first segment is not `M` or `m` or a segment
 *   has an unknown type, as `normalizePath` throws.
 */
export function transformPath(
  path: readonly SvgPathSegment[],
  matrix: SvgMatrix,
): SvgNormalizedPathSegment[] {
  const m = matrix;
  const translates = m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1;
  const determinant = m.a * m.d - m.b * m.c;
  const map = (x: number, y: number): [number, number] =>
    translates
      ? [addExact(x, m.e), addExact(y, m.f)]
      : [m.a * x + m.c * y + m.e + 0, m.b * x + m.d * y + m.f + 0];

  const result: SvgNormalizedPathSegment[] = [];
  // The current point and the start of the subpath, before the map.
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const segment of normalizePath(path)) {
    switch (segment.type) {
      case "M": {
        const [px, py] = map(segment.x, segment.y);
        result.push({ type: "M", x: px, y: py });
        startX = segment.x;
        startY = segment.y;
        break;
      }
      case "L": {
        const [px, py] = map(segment.x, segment.y);
        result.push({ type: "L", x: px, y: py });
        break;
      }
      case "C": {
        const [x1, y1] = map(segment.x1, segment.y1);
        const [x2, y2] = map(segment.x2, segment.y2);
        const [px, py] = map(segment.x, segment.y);
        result.push({ type: "C", x1, y1, x2, y2, x: px, y: py });
        break;
      }
      case "Q": {
        const [x1, y1] = map(segment.x1, segment.y1);
        const [px, py] = map(segment.x, segment.y);
        result.push({ type: "Q", x1, y1, x: px, y: py });
        break;
      }
      case "A": {
        const [px, py] = map(segment.x, segment.y);
        if (translates) {
          result.push({ ...segment, x: px, y: py });
        } else if (determinant === 0) {
          result.push(...collapseArc(m, x, y, segment, map));
        } else if (segment.rx === 0 || segment.ry === 0) {
          result.push({ type: "L", x: px, y: py });
        } else {
          const ellipse = mapEllipse(m, segment);
          result.push({
            type: "A",
            rx: ellipse.rx,
            ry: ellipse.ry,
            rotation: ellipse.rx === ellipse.ry ? 0 : ellipse.rotation,
            largeArc: segment.largeArc,
            sweep: determinant < 0 ? !segment.sweep : segment.sweep,
            x: px,
            y: py,
          });
        }
        break;
      }
      case "Z":
        result.push({ type: "Z" });
        x = startX;
        y = startY;
        continue;
    }
    x = segment.x;
    y = segment.y;
  }
  return result;
}
