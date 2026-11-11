import { isWhitespace, scanNumber, toFinite } from "../shared";
import { argumentsOf } from "./functions";
import type { SvgTransformFunction } from "./types";

const skipWhitespace = (text: string, position: number): number => {
  while (isWhitespace(text[position])) position++;
  return position;
};

/** Returns the end of the ASCII letters that start at `position`. */
function skipLetters(text: string, position: number): number {
  while (/[a-zA-Z]/.test(text[position] ?? "")) position++;
  return position;
}

/**
 * Reads the arguments of a function, starting after `(`, up to and including
 * `)`. Returns them with the position after `)`, or `undefined` if they are
 * not a list of numbers.
 */
function readArguments(
  text: string,
  position: number,
): [number[], number] | undefined {
  const values: number[] = [];
  position = skipWhitespace(text, position);
  for (;;) {
    const end = scanNumber(text, position);
    if (end === -1) return undefined;
    const value = toFinite(text.slice(position, end));
    // No function takes more than 6 arguments.
    if (value === undefined || values.length === 6) return undefined;
    values.push(value);
    position = skipWhitespace(text, end);
    if (text[position] === ")") return [values, position + 1];
    // A comma must be followed by another argument; without one, the next
    // number may start right away, as in `translate(-10-20)`.
    if (text[position] === ",") position = skipWhitespace(text, position + 1);
  }
}

/**
 * Parses a transform list, the value of `transform`, `gradientTransform` or
 * `patternTransform`, into its functions, or returns `undefined` if the text
 * is not one.
 *
 * The grammar is the one of SVG 1.1, which is what Chromium, Firefox and
 * WebKit apply in these attributes: `matrix(a b c d e f)`,
 * `translate(x [y])`, `scale(x [y])`, `rotate(angle [cx cy])`, `skewX(angle)`
 * and `skewY(angle)`, with case-sensitive names and plain numbers, lengths in
 * user units and angles in degrees. Numbers follow CSS `<number>` (`.5` but
 * not `5.`); arguments are separated by whitespace, a comma, or both, or by
 * nothing when the next one starts with a sign or a `.`; functions are
 * separated by whitespace, one comma, or nothing; whitespace may stand before
 * and inside the parentheses. Text that is empty or only whitespace is an
 * empty list, the identity.
 *
 * CSS syntax, such as units (`rotate(45deg)`), `translateX()` or `none`, is
 * not valid here: browsers apply it only in the CSS `transform` property and
 * ignore it in the attributes (ARCHITECTURE §15). Optional arguments are kept
 * as written, so `translate(10)` has no `y`. An invalid list returns
 * `undefined` as a whole, as browsers ignore it as a whole.
 *
 * @example
 * ```ts
 * parseTransform("translate(10,20) rotate(45 5 5)");
 * // [
 * //   { type: "translate", x: 10, y: 20 },
 * //   { type: "rotate", angle: 45, cx: 5, cy: 5 },
 * // ]
 * parseTransform("rotate(45deg)"); // undefined: no units in the attribute
 * ```
 */
export function parseTransform(
  text: string,
): SvgTransformFunction[] | undefined {
  const functions: SvgTransformFunction[] = [];
  let position = skipWhitespace(text, 0);
  if (position === text.length) return functions;

  for (;;) {
    const nameEnd = skipLetters(text, position);
    const type = text.slice(position, nameEnd);
    const definition = argumentsOf(type);
    if (definition === undefined) return undefined;

    position = skipWhitespace(text, nameEnd);
    if (text[position] !== "(") return undefined;
    const read = readArguments(text, position + 1);
    if (read === undefined) return undefined;
    const [values, end] = read;
    if (!definition.counts.includes(values.length)) return undefined;

    const fn: Record<string, unknown> = { type };
    for (const [index, value] of values.entries()) {
      fn[definition.names[index] ?? ""] = value;
    }
    functions.push(fn as unknown as SvgTransformFunction);

    position = skipWhitespace(text, end);
    if (position === text.length) return functions;
    // A comma between two functions must be followed by another one.
    if (text[position] === ",") position = skipWhitespace(text, position + 1);
  }
}
