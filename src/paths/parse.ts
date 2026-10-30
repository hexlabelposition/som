import { isWhitespace, scanNumber, toFinite } from "../shared";
import { argumentsOf, isFlag } from "./commands";
import type { SvgPathSegment } from "./types";

const skipWhitespace = (text: string, position: number): number => {
  while (isWhitespace(text[position])) position++;
  return position;
};

/**
 * Skips the separator between two arguments: whitespace, a comma, or both.
 * The separator is optional, as in `M0-1` or `a1 1 0 01 5 5`.
 */
function skipSeparator(text: string, position: number): number {
  const next = skipWhitespace(text, position);
  return text[next] === "," ? skipWhitespace(text, next + 1) : next;
}

/** Whether a number can start at `position`. */
function startsNumber(text: string, position: number): boolean {
  const char = text[position];
  return (
    char === "+" ||
    char === "-" ||
    char === "." ||
    (char !== undefined && char >= "0" && char <= "9")
  );
}

/**
 * Parses path data, the value of `d`, into its commands, or returns
 * `undefined` if the text is not valid path data.
 *
 * Each command with its arguments is one segment, and commands are kept as
 * written: absolute and relative letters, shorthand commands and the case of
 * `Z` stay as they are. A letter followed by several sets of arguments is the
 * same command repeated, so it gives one segment per set, and the sets after
 * `M` or `m` are `L` or `l`, as the SVG grammar defines them. Numbers are read
 * exactly, without rounding (ARCHITECTURE §13).
 *
 * The grammar is the one of SVG 1.1 and SVG 2: numbers follow CSS `<number>`
 * (`.5` but not `5.`) and need no separator when the next one starts with a
 * sign or a `.`, arguments are separated by whitespace, a comma, or both, arc
 * flags are a single `0` or `1`, and the first command is `M` or `m`. Text
 * that is empty or only whitespace is an empty path.
 *
 * Invalid path data returns `undefined` as a whole, although browsers draw
 * the commands before the error: a path cut at the error would lose the rest
 * when it is written back.
 *
 * @example
 * ```ts
 * parsePath("M10,20l5-5 10 0Z");
 * // [
 * //   { type: "M", x: 10, y: 20 },
 * //   { type: "l", x: 5, y: -5 },
 * //   { type: "l", x: 10, y: 0 },
 * //   { type: "Z" },
 * // ]
 * parsePath("L10 20"); // undefined: no M first
 * ```
 */
export function parsePath(text: string): SvgPathSegment[] | undefined {
  const segments: SvgPathSegment[] = [];
  let position = skipWhitespace(text, 0);

  while (position < text.length) {
    const letter = text.charAt(position);
    const names = argumentsOf(letter);
    if (names === undefined) return undefined;
    if (segments.length === 0 && letter !== "M" && letter !== "m") {
      return undefined;
    }
    position = skipWhitespace(text, position + 1);
    if (names.length === 0) {
      segments.push({ type: letter } as SvgPathSegment);
      continue;
    }

    let type = letter;
    for (;;) {
      const segment: Record<string, unknown> = { type };
      for (const [index, name] of names.entries()) {
        if (index > 0) position = skipSeparator(text, position);
        if (isFlag(name)) {
          const flag = text[position];
          if (flag !== "0" && flag !== "1") return undefined;
          segment[name] = flag === "1";
          position++;
          continue;
        }
        const end = scanNumber(text, position);
        if (end === -1) return undefined;
        const value = toFinite(text.slice(position, end));
        if (value === undefined) return undefined;
        segment[name] = value;
        position = end;
      }
      segments.push(segment as unknown as SvgPathSegment);

      // The sets after a moveto are lineto commands.
      if (type === "M") type = "L";
      else if (type === "m") type = "l";

      position = skipWhitespace(text, position);
      if (text[position] === ",") {
        // A comma between two sets must be followed by another set.
        position = skipWhitespace(text, position + 1);
        if (!startsNumber(text, position)) return undefined;
      } else if (!startsNumber(text, position)) {
        break;
      }
    }
  }

  return segments;
}
