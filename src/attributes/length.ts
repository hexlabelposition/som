import { parseList, parseWhole, scanNumber, toFinite } from "./number";

/**
 * The units a length can have: `""` for user units (a plain number), `"%"`,
 * and the CSS length units, which SVG 2 allows in attributes.
 */
export type SvgLengthUnit =
  | ""
  | "%"
  // Absolute
  | "px"
  | "cm"
  | "mm"
  | "Q"
  | "in"
  | "pt"
  | "pc"
  // Font-relative
  | "em"
  | "rem"
  | "ex"
  | "rex"
  | "cap"
  | "rcap"
  | "ch"
  | "rch"
  | "ic"
  | "ric"
  | "lh"
  | "rlh"
  // Viewport-relative
  | "vw"
  | "vh"
  | "vi"
  | "vb"
  | "vmin"
  | "vmax"
  | "svw"
  | "svh"
  | "svi"
  | "svb"
  | "svmin"
  | "svmax"
  | "lvw"
  | "lvh"
  | "lvi"
  | "lvb"
  | "lvmin"
  | "lvmax"
  | "dvw"
  | "dvh"
  | "dvi"
  | "dvb"
  | "dvmin"
  | "dvmax"
  // Container-relative
  | "cqw"
  | "cqh"
  | "cqi"
  | "cqb"
  | "cqmin"
  | "cqmax";

/**
 * A length as written: a number and its unit.
 *
 * The unit is not converted, because percentages and relative units need
 * context the attribute does not have: `50%` depends on the viewport and `2em`
 * on the font size.
 *
 * @example
 * ```ts
 * // width="2.5mm"
 * const length: SvgLength = { value: 2.5, unit: "mm" };
 * ```
 */
export interface SvgLength {
  /** The number as written, `2.5` for `2.5mm`. */
  value: number;
  /** The unit, in its canonical spelling; `""` for user units. */
  unit: SvgLengthUnit;
}

/**
 * The units an angle can have: `""` for degrees written as a plain number,
 * and the CSS angle units.
 */
export type SvgAngleUnit = "" | "deg" | "grad" | "rad" | "turn";

/**
 * An angle as written: a number and its unit, as in `orient="45deg"`. A
 * plain number is in degrees.
 */
export interface SvgAngle {
  /** The number as written, `45` for `45deg`. */
  value: number;
  /** The unit, lowercase; `""` for a plain number. */
  unit: SvgAngleUnit;
}

/**
 * Length units by their lowercase spelling, mapped to the canonical one: CSS
 * units are ASCII case-insensitive, and `Q` is written in uppercase.
 *
 * The tables are written out as literals, so a bundle that does not use them
 * can drop them. Building one with a call such as `[…].map(…)` at the top
 * level would keep it in every bundle (ARCHITECTURE §4).
 */
const lengthUnits: Readonly<Record<string, SvgLengthUnit>> = {
  "%": "%",
  px: "px",
  cm: "cm",
  mm: "mm",
  q: "Q",
  in: "in",
  pt: "pt",
  pc: "pc",
  em: "em",
  rem: "rem",
  ex: "ex",
  rex: "rex",
  cap: "cap",
  rcap: "rcap",
  ch: "ch",
  rch: "rch",
  ic: "ic",
  ric: "ric",
  lh: "lh",
  rlh: "rlh",
  vw: "vw",
  vh: "vh",
  vi: "vi",
  vb: "vb",
  vmin: "vmin",
  vmax: "vmax",
  svw: "svw",
  svh: "svh",
  svi: "svi",
  svb: "svb",
  svmin: "svmin",
  svmax: "svmax",
  lvw: "lvw",
  lvh: "lvh",
  lvi: "lvi",
  lvb: "lvb",
  lvmin: "lvmin",
  lvmax: "lvmax",
  dvw: "dvw",
  dvh: "dvh",
  dvi: "dvi",
  dvb: "dvb",
  dvmin: "dvmin",
  dvmax: "dvmax",
  cqw: "cqw",
  cqh: "cqh",
  cqi: "cqi",
  cqb: "cqb",
  cqmin: "cqmin",
  cqmax: "cqmax",
};

const angleUnits: Readonly<Record<string, SvgAngleUnit>> = {
  deg: "deg",
  grad: "grad",
  rad: "rad",
  turn: "turn",
};

/**
 * Reads a number followed by a unit at a position: `%` or the letters right
 * after the number, with no space between. A number without one has the unit
 * `""`.
 */
function readDimension<U extends string>(
  text: string,
  position: number,
  units: Readonly<Record<string, U>>,
): [{ value: number; unit: U | "" }, number] | undefined {
  const end = scanNumber(text, position);
  if (end === -1) return undefined;
  const value = toFinite(text.slice(position, end));
  if (value === undefined) return undefined;

  let unitEnd = end;
  if (text[unitEnd] === "%") {
    unitEnd++;
  } else {
    while (/[a-zA-Z]/.test(text[unitEnd] ?? "")) unitEnd++;
  }
  if (unitEnd === end) return [{ value, unit: "" }, end];
  const name = text.slice(end, unitEnd).toLowerCase();
  const unit = Object.hasOwn(units, name) ? units[name] : undefined;
  return unit === undefined ? undefined : [{ value, unit }, unitEnd];
}

const readLength = (
  text: string,
  position: number,
): [SvgLength, number] | undefined =>
  readDimension(text, position, lengthUnits);

/**
 * Parses a length, such as the value of `width`, `r` or `stroke-width`, or
 * returns `undefined` if the text is not one.
 *
 * A length is a number with an optional unit right after it: user units
 * (`10`), a percentage (`50%`) or a CSS length unit (`2mm`, `1.5em`). Units
 * are ASCII case-insensitive and returned in their canonical spelling.
 * Keywords such as `auto` are not lengths.
 *
 * @example
 * ```ts
 * parseLength("10"); // { value: 10, unit: "" }
 * parseLength("50%"); // { value: 50, unit: "%" }
 * parseLength("2MM"); // { value: 2, unit: "mm" }
 * parseLength("10 px"); // undefined
 * ```
 */
export function parseLength(text: string): SvgLength | undefined {
  return parseWhole(text, readLength);
}

/**
 * Parses a list of lengths, such as `x` on `text` or `stroke-dasharray`
 * written as lengths, or returns `undefined` if the text is not one.
 *
 * Lengths are separated by whitespace, a comma, or both. An empty value is
 * not a list.
 *
 * @example
 * ```ts
 * parseLengthList("10 20%, 3em");
 * // [{ value: 10, unit: "" }, { value: 20, unit: "%" }, { value: 3, unit: "em" }]
 * ```
 */
export function parseLengthList(text: string): SvgLength[] | undefined {
  return parseList(text, readLength);
}

/**
 * Parses an angle, such as `orient` on `marker` or the angle of
 * `glyph-orientation-vertical`, or returns `undefined` if the text is not
 * one.
 *
 * An angle is a number with an optional `deg`, `grad`, `rad` or `turn` right
 * after it; a plain number is in degrees. Units are ASCII case-insensitive.
 * Keywords such as `auto` are not angles.
 *
 * @example
 * ```ts
 * parseAngle("45"); // { value: 45, unit: "" }
 * parseAngle("0.5turn"); // { value: 0.5, unit: "turn" }
 * ```
 */
export function parseAngle(text: string): SvgAngle | undefined {
  return parseWhole(text, (value, position) =>
    readDimension(value, position, angleUnits),
  );
}
