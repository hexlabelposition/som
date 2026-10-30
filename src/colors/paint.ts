import { asciiLowercase, parseColor, type SvgColor } from "./color";

/**
 * A color or paint value read from an attribute or a declaration, with the
 * position of its color in the text.
 */
export interface PaintValue {
  /** The value, without the whitespace around it. */
  value: string;
  /** The color, or the fallback color after `url(…)`. */
  color?: SvgColor;
  /** The reference inside `url(…)`, unquoted. */
  url?: string;
  /** Where the color starts and ends in the text, if there is one. */
  start: number;
  end: number;
}

/**
 * Paint keywords that are not colors. `none` is SVG 1.1 and 2;
 * `context-fill` and `context-stroke` are SVG 2.
 */
const paintKeywords = new Set(["none", "context-fill", "context-stroke"]);

const isSpace = (char: number): boolean =>
  char === 0x20 || char === 0x9 || char === 0xa || char === 0xd || char === 0xc;

/**
 * Reads a `<color>`, or a `<paint>` if `paint` is true: `none`,
 * `context-fill`, `context-stroke`, a color, or `url(…)` with an optional
 * `none` or color fallback. Returns `undefined` for any other text, such as
 * `inherit` or a color function `parseColor` does not read.
 */
export function readPaint(
  text: string,
  paint: boolean,
): PaintValue | undefined {
  let start = 0;
  let end = text.length;
  while (start < end && isSpace(text.charCodeAt(start))) start++;
  while (end > start && isSpace(text.charCodeAt(end - 1))) end--;
  const value = text.slice(start, end);

  if (paint) {
    const lower = asciiLowercase(value);
    if (paintKeywords.has(lower)) return { value, start, end: start };
    if (lower.startsWith("url(")) {
      const reference = readUrl(value);
      if (reference === undefined) return undefined;
      let fallback = start + reference.end;
      while (fallback < end && isSpace(text.charCodeAt(fallback))) fallback++;
      const rest = text.slice(fallback, end);
      if (rest === "" || asciiLowercase(rest) === "none") {
        return { value, url: reference.url, start: fallback, end: fallback };
      }
      const color = parseColor(rest);
      if (color === undefined) return undefined;
      return { value, color, url: reference.url, start: fallback, end };
    }
  }

  const color = parseColor(value);
  if (color === undefined) return undefined;
  return { value, color, start, end };
}

/**
 * Reads the `url(…)` a value starts with: `url(#g)`, `url("#g")` or
 * `url( '#g' )`. Returns the reference and the index after the `)`.
 */
function readUrl(value: string): { url: string; end: number } | undefined {
  let index = 4;
  while (isSpace(value.charCodeAt(index))) index++;

  let url: string;
  const quote = value.charAt(index);
  if (quote === '"' || quote === "'") {
    const close = value.indexOf(quote, index + 1);
    if (close === -1) return undefined;
    url = value.slice(index + 1, close);
    index = close + 1;
    while (isSpace(value.charCodeAt(index))) index++;
    if (value.charAt(index) !== ")") return undefined;
  } else {
    const close = value.indexOf(")", index);
    if (close === -1) return undefined;
    url = value.slice(index, close).replace(/[ \t\n\f\r]+$/, "");
    // An unquoted URL cannot contain whitespace, quotes or parentheses.
    if (/[ \t\n\f\r"'(]/.test(url)) return undefined;
    index = close;
  }

  return { url, end: index + 1 };
}
