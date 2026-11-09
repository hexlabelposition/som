import { addExact, reflectExact } from "./decimal";
import type { SvgNormalizedPathSegment, SvgPathSegment } from "./types";

/** A relative coordinate made absolute, or an absolute one as it is. */
const resolve = (value: number, origin: number, relative: boolean): number =>
  relative ? addExact(origin, value) : value;

/**
 * Converts path segments to normalized ones: relative commands to absolute
 * and shorthand commands to full ones, so that paths drawn the same way are
 * written the same way.
 *
 * `m`, `l`, `c`, `q`, `a` become `M`, `L`, `C`, `Q`, `A`; `H` and `V` become
 * `L`, `S` becomes `C` and `T` becomes `Q`, with the control point reflected
 * from the previous curve as SVG defines it; `z` becomes `Z`. Arcs keep their
 * radii, rotation and flags as written. The result is a new array, and a
 * normalized path normalizes to itself.
 *
 * Absolute coordinates are summed as decimals, without the binary noise of
 * doubles and without rounding (ARCHITECTURE §13): a result has as many
 * decimal places as its operands, so `M0.1 0 l0.2 0` becomes `M0.1 0 L0.3 0`,
 * not `L0.30000000000000004 0`. Numbers are not checked; `stringifyPath`
 * throws for one that is not finite.
 *
 * @example
 * ```ts
 * normalizePath(parsePath("M10 20 h5 v5 s5 5 10 0 t10 0 z")!);
 * // [
 * //   { type: "M", x: 10, y: 20 },
 * //   { type: "L", x: 15, y: 20 },
 * //   { type: "L", x: 15, y: 25 },
 * //   { type: "C", x1: 15, y1: 25, x2: 20, y2: 30, x: 25, y: 25 },
 * //   { type: "Q", x1: 25, y1: 25, x: 35, y: 25 },
 * //   { type: "Z" },
 * // ]
 * ```
 *
 * @throws {TypeError} If the first segment is not `M` or `m` or a segment
 *   has an unknown type.
 */
export function normalizePath(
  path: readonly SvgPathSegment[],
): SvgNormalizedPathSegment[] {
  const result: SvgNormalizedPathSegment[] = [];
  // The current point and the start of the current subpath, where `Z` goes.
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let previous: SvgNormalizedPathSegment | undefined;

  for (const segment of path) {
    // The type is checked at run time, for segments built by hand.
    const type: unknown = segment.type;
    if (previous === undefined && type !== "M" && type !== "m") {
      throw new TypeError(
        `Path data must start with M or m, got ${String(type)}`,
      );
    }
    // Command letters are ASCII, so lowercase ones are the relative ones.
    const relative = typeof type === "string" && type >= "a";
    let next: SvgNormalizedPathSegment;

    switch (segment.type) {
      case "M":
      case "m":
        next = {
          type: "M",
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        startX = next.x;
        startY = next.y;
        break;
      case "L":
      case "l":
        next = {
          type: "L",
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      case "H":
      case "h":
        next = { type: "L", x: resolve(segment.x, x, relative), y };
        break;
      case "V":
      case "v":
        next = { type: "L", x, y: resolve(segment.y, y, relative) };
        break;
      case "C":
      case "c":
        next = {
          type: "C",
          x1: resolve(segment.x1, x, relative),
          y1: resolve(segment.y1, y, relative),
          x2: resolve(segment.x2, x, relative),
          y2: resolve(segment.y2, y, relative),
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      case "S":
      case "s": {
        // The first control point reflects the previous curve's second one,
        // or is the current point after any other command.
        const curve = previous?.type === "C" ? previous : undefined;
        next = {
          type: "C",
          x1: curve ? reflectExact(x, curve.x2) : x,
          y1: curve ? reflectExact(y, curve.y2) : y,
          x2: resolve(segment.x2, x, relative),
          y2: resolve(segment.y2, y, relative),
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      }
      case "Q":
      case "q":
        next = {
          type: "Q",
          x1: resolve(segment.x1, x, relative),
          y1: resolve(segment.y1, y, relative),
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      case "T":
      case "t": {
        // The control point reflects the previous curve's one, or is the
        // current point after any other command.
        const curve = previous?.type === "Q" ? previous : undefined;
        next = {
          type: "Q",
          x1: curve ? reflectExact(x, curve.x1) : x,
          y1: curve ? reflectExact(y, curve.y1) : y,
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      }
      case "A":
      case "a":
        next = {
          type: "A",
          rx: segment.rx,
          ry: segment.ry,
          rotation: segment.rotation,
          largeArc: segment.largeArc,
          sweep: segment.sweep,
          x: resolve(segment.x, x, relative),
          y: resolve(segment.y, y, relative),
        };
        break;
      case "Z":
      case "z":
        next = { type: "Z" };
        break;
      default:
        throw new TypeError(`Not a path command: ${String(type)}`);
    }

    if (next.type === "Z") {
      x = startX;
      y = startY;
    } else {
      x = next.x;
      y = next.y;
    }
    result.push(next);
    previous = next;
  }

  return result;
}
