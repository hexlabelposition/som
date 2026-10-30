import { argumentsOf, isFlag } from "./commands";
import type { SvgPathSegment } from "./types";

/**
 * Writes a number in the shortest form that reads back as the same number,
 * or throws for a value that is not a finite number.
 */
function formatNumber(value: unknown, name: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `A path argument must be a finite number, got ${name} = ${String(value)}`,
    );
  }
  return String(value);
}

function formatFlag(value: unknown, name: string): string {
  if (typeof value !== "boolean") {
    throw new TypeError(
      `A path arc flag must be a boolean, got ${name} = ${String(value)}`,
    );
  }
  return value ? "1" : "0";
}

function formatSegment(segment: SvgPathSegment, index: number): string {
  // The type is checked at run time, for segments built by hand.
  const type: unknown = segment.type;
  const names = typeof type === "string" ? argumentsOf(type) : undefined;
  if (typeof type !== "string" || names === undefined) {
    throw new TypeError(`Not a path command: ${String(type)}`);
  }
  if (index === 0 && type !== "M" && type !== "m") {
    throw new TypeError(`Path data must start with M or m, got ${type}`);
  }
  const values = segment as unknown as Record<string, unknown>;
  const parts = names.map((name) =>
    isFlag(name)
      ? formatFlag(values[name], name)
      : formatNumber(values[name], name),
  );
  return type + parts.join(" ");
}

/**
 * Writes path segments as path data, the value of `d`, or throws a
 * `TypeError` if they would not read back with `parsePath`.
 *
 * The output has one form, whichever way the path was written: each segment
 * with its own command letter, the letter followed directly by its first
 * number, and one space between numbers and between segments, as in
 * `M10 20 L30 40 A5 5 0 0 1 50 60 Z`. Numbers are written in the shortest
 * form that reads back as the same number, without rounding, and arc flags
 * as `0` or `1` (ARCHITECTURE §13). An empty path is an empty string.
 *
 * @example
 * ```ts
 * stringifyPath(parsePath("M10,20l5-5 10 0Z")!); // "M10 20 l5 -5 l10 0 Z"
 * stringifyPath([
 *   { type: "M", x: 0, y: 0.1 },
 *   { type: "h", x: -0.5 },
 * ]); // "M0 0.1 h-0.5"
 * ```
 *
 * @throws {TypeError} If the first segment is not `M` or `m`, a segment has
 *   an unknown type, a number is not finite or a flag is not a boolean.
 */
export function stringifyPath(path: readonly SvgPathSegment[]): string {
  return path.map(formatSegment).join(" ");
}
