import { argumentsOf } from "./functions";
import type { SvgTransformFunction } from "./types";

/**
 * Writes a number in the shortest form that reads back as the same number,
 * or throws for a value that is not a finite number.
 */
function formatNumber(value: unknown, type: string, name: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `A transform argument must be a finite number, got ${type} ${name} = ${String(value)}`,
    );
  }
  return String(value);
}

function formatFunction(fn: SvgTransformFunction): string {
  // The type is checked at run time, for functions built by hand.
  const type: unknown = fn.type;
  const definition = typeof type === "string" ? argumentsOf(type) : undefined;
  if (typeof type !== "string" || definition === undefined) {
    throw new TypeError(`Not a transform function: ${String(type)}`);
  }
  const values = fn as unknown as Record<string, unknown>;
  // The arguments given must be the first ones, in a number the function
  // can be written with.
  const { names, counts } = definition;
  const missing = names.findIndex((name) => values[name] === undefined);
  const count = missing === -1 ? names.length : missing;
  const extra = names.slice(count).some((name) => values[name] !== undefined);
  if (!counts.includes(count) || extra) {
    throw new TypeError(
      `Arguments of ${type} must be ${counts
        .map((length) => names.slice(0, length).join(", "))
        .join(" or ")}`,
    );
  }
  const parts = names
    .slice(0, count)
    .map((name) => formatNumber(values[name], type, name));
  return `${type}(${parts.join(" ")})`;
}

/**
 * Writes transform functions as a transform list, the value of `transform`,
 * `gradientTransform` or `patternTransform`, or throws a `TypeError` if they
 * would not read back with `parseTransform`.
 *
 * Functions are separated by one space and their arguments by one space, as
 * in `translate(10 20) rotate(45 5 5)`. Optional arguments are written when
 * they are given. Numbers are written in the shortest form that reads back
 * as the same number, without rounding (ARCHITECTURE §15). An empty list is
 * an empty string.
 *
 * @example
 * ```ts
 * stringifyTransform(parseTransform("translate(10,20)rotate(45)")!);
 * // "translate(10 20) rotate(45)"
 * const m = { a: 1, b: 0, c: 0, d: -1, e: 6, f: 15 };
 * stringifyTransform([{ type: "matrix", ...m }]); // "matrix(1 0 0 -1 6 15)"
 * ```
 *
 * @throws {TypeError} If a function has an unknown type, a number is not
 *   finite, a required argument is missing, or only one of `cx` and `cy` of
 *   `rotate` is given.
 */
export function stringifyTransform(
  functions: readonly SvgTransformFunction[],
): string {
  return functions.map(formatFunction).join(" ");
}
