import { isWhitespace, parseNumberList, trimWhitespace } from "./number";

/**
 * The value of a `viewBox` attribute: the rectangle of user space that is
 * mapped to the viewport.
 *
 * @example
 * ```ts
 * // viewBox="0 0 24 24"
 * const viewBox: SvgViewBox = { x: 0, y: 0, width: 24, height: 24 };
 * ```
 */
export interface SvgViewBox {
  /** The left edge in user units. */
  x: number;
  /** The top edge in user units. */
  y: number;
  /** The width in user units, never negative. */
  width: number;
  /** The height in user units, never negative. */
  height: number;
}

/**
 * How `preserveAspectRatio` aligns the view box in the viewport: `none`, or
 * the alignment on each axis, such as `xMidYMid`.
 */
export type SvgAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax";

/**
 * The value of a `preserveAspectRatio` attribute.
 *
 * @example
 * ```ts
 * // preserveAspectRatio="xMinYMid slice"
 * const ratio: SvgPreserveAspectRatio = {
 *   defer: false,
 *   align: "xMinYMid",
 *   meetOrSlice: "slice",
 * };
 * ```
 */
export interface SvgPreserveAspectRatio {
  /**
   * Whether the value starts with `defer`, which SVG 1.1 allowed on `image`
   * and SVG 2 removed.
   */
  defer: boolean;
  /** The alignment; `xMidYMid` is the default when the attribute is absent. */
  align: SvgAlign;
  /** `meet` unless the value says `slice`; ignored when `align` is `none`. */
  meetOrSlice: "meet" | "slice";
}

// An array literal, not a Set, so a bundle that does not use it can drop it.
const aligns: readonly string[] = [
  "none",
  "xMinYMin",
  "xMidYMin",
  "xMaxYMin",
  "xMinYMid",
  "xMidYMid",
  "xMaxYMid",
  "xMinYMax",
  "xMidYMax",
  "xMaxYMax",
] satisfies SvgAlign[];

/**
 * Parses the value of a `viewBox` attribute, or returns `undefined` if the
 * text is not four numbers.
 *
 * The numbers are separated by whitespace, a comma, or both. A negative width
 * or height is an error in the specs, so it returns `undefined` too; zero is
 * valid and disables rendering of the element.
 *
 * @example
 * ```ts
 * parseViewBox("0 0 24 24"); // { x: 0, y: 0, width: 24, height: 24 }
 * parseViewBox("0,0,100,50"); // { x: 0, y: 0, width: 100, height: 50 }
 * parseViewBox("0 0 -1 1"); // undefined
 * ```
 */
export function parseViewBox(text: string): SvgViewBox | undefined {
  const numbers = parseNumberList(text);
  if (numbers?.length !== 4) return undefined;
  const [x = 0, y = 0, width = 0, height = 0] = numbers;
  return width < 0 || height < 0 ? undefined : { x, y, width, height };
}

/**
 * Parses the value of a `preserveAspectRatio` attribute, or returns
 * `undefined` if the text is not one.
 *
 * The value is an optional `defer`, an alignment such as `xMidYMid` or
 * `none`, and an optional `meet` or `slice`, separated by whitespace.
 * Keywords are case-sensitive, as the specs define them.
 *
 * @example
 * ```ts
 * parsePreserveAspectRatio("xMidYMid");
 * // { defer: false, align: "xMidYMid", meetOrSlice: "meet" }
 * parsePreserveAspectRatio("none slice");
 * // { defer: false, align: "none", meetOrSlice: "slice" }
 * parsePreserveAspectRatio("xmidymid"); // undefined
 * ```
 */
export function parsePreserveAspectRatio(
  text: string,
): SvgPreserveAspectRatio | undefined {
  const words = splitWhitespace(text);
  const defer = words[0] === "defer";
  if (defer) words.shift();
  const [align, meetOrSlice = "meet", ...rest] = words;
  if (align === undefined || !aligns.includes(align) || rest.length > 0) {
    return undefined;
  }
  if (meetOrSlice !== "meet" && meetOrSlice !== "slice") return undefined;
  return { defer, align: align as SvgAlign, meetOrSlice };
}

const splitWhitespace = (text: string): string[] => {
  const words: string[] = [];
  let word = "";
  for (const char of trimWhitespace(text)) {
    if (!isWhitespace(char)) {
      word += char;
    } else if (word !== "") {
      words.push(word);
      word = "";
    }
  }
  if (word !== "") words.push(word);
  return words;
};
