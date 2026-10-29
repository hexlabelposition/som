import {
  parseAngle,
  parseNumberOrPercentage,
  type SvgAngle,
  type SvgNumberOrPercentage,
} from "../attributes";
import { namedColors, type SvgColorName } from "./named";

/**
 * A color written in hex notation: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
 *
 * @example
 * ```ts
 * // fill="#ff000080"
 * const color: SvgHexColor = {
 *   type: "hex",
 *   red: 255,
 *   green: 0,
 *   blue: 0,
 *   alpha: 128 / 255,
 * };
 * ```
 */
export interface SvgHexColor {
  /** The notation the color is written in. */
  type: "hex";
  /** The red channel, an integer from 0 to 255. */
  red: number;
  /** The green channel, an integer from 0 to 255. */
  green: number;
  /** The blue channel, an integer from 0 to 255. */
  blue: number;
  /** The opacity from 0 to 1; `1` when the hex has no alpha digits. */
  alpha: number;
}

/**
 * A color written as `rgb()` or `rgba()`, in the legacy syntax with commas or
 * the CSS Color 4 syntax with spaces and `/`.
 *
 * Channels written as percentages are converted to the 0-255 scale, so
 * `rgb(50%, 0%, 0%)` has the red channel `127.5`. Values outside the range
 * are kept as written; CSS clamps them when it renders the color.
 *
 * @example
 * ```ts
 * // fill="rgb(255 0 0 / 50%)"
 * const color: SvgRgbColor = { type: "rgb", red: 255, green: 0, blue: 0, alpha: 0.5 };
 * ```
 */
export interface SvgRgbColor {
  /** The notation the color is written in, `"rgb"` for `rgba()` too. */
  type: "rgb";
  /** The red channel, from 0 to 255. */
  red: number;
  /** The green channel, from 0 to 255. */
  green: number;
  /** The blue channel, from 0 to 255. */
  blue: number;
  /** The opacity from 0 to 1; `1` when none is written. */
  alpha: number;
}

/**
 * A color written as `hsl()` or `hsla()`, in the legacy syntax with commas or
 * the CSS Color 4 syntax with spaces and `/`.
 *
 * The hue is converted to degrees, and values outside the usual ranges are
 * kept as written: `hsl(400 50% 50%)` has the hue `400`.
 *
 * @example
 * ```ts
 * // fill="hsl(0.5turn, 100%, 25%)"
 * const color: SvgHslColor = {
 *   type: "hsl",
 *   hue: 180,
 *   saturation: 100,
 *   lightness: 25,
 *   alpha: 1,
 * };
 * ```
 */
export interface SvgHslColor {
  /** The notation the color is written in, `"hsl"` for `hsla()` too. */
  type: "hsl";
  /** The hue in degrees. */
  hue: number;
  /** The saturation in percent, from 0 to 100. */
  saturation: number;
  /** The lightness in percent, from 0 to 100. */
  lightness: number;
  /** The opacity from 0 to 1; `1` when none is written. */
  alpha: number;
}

/**
 * A CSS named color, such as `red` or `transparent`.
 */
export interface SvgNamedColor {
  /** The notation the color is written in. */
  type: "named";
  /** The name, lowercase. */
  name: SvgColorName;
}

/**
 * The `currentColor` keyword: the value of the `color` property, which the
 * element usually inherits.
 */
export interface SvgCurrentColor {
  /** The notation the color is written in. */
  type: "currentColor";
}

/**
 * A color as written in an attribute or a CSS declaration, in one of the
 * notations som reads: hex, `rgb()`, `hsl()`, a named color or
 * `currentColor`.
 *
 * The notation is kept, so a color can be written back the way it was
 * written. Converting between notations is a separate step.
 */
export type SvgColor =
  SvgHexColor | SvgRgbColor | SvgHslColor | SvgNamedColor | SvgCurrentColor;

/** The arguments of a color function, before they are parsed. */
interface ColorArguments {
  /** Whether they are separated by commas, as in CSS Color 3. */
  legacy: boolean;
  /** The three channels. */
  channels: [string, string, string];
  /** The alpha value, if one is written. */
  alpha: string | undefined;
}

const whitespace = /^[ \t\n\f\r]+|[ \t\n\f\r]+$/g;

const trim = (text: string): string => text.replace(whitespace, "");

/**
 * Lowercases ASCII letters only, as CSS compares keywords: `toLowerCase`
 * would also map characters such as the Kelvin sign `K` to `k`.
 */
const asciiLowercase = (text: string): string =>
  text.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32),
  );

/**
 * Splits the text between the parentheses of a color function into three
 * channels and an optional alpha value: `255, 0, 0, 0.5` or `255 0 0 / 50%`.
 */
function splitArguments(text: string): ColorArguments | undefined {
  if (text.includes(",")) {
    const [first, second, third, alpha, ...rest] = text.split(",").map(trim);
    if (third === undefined || rest.length > 0) return undefined;
    return {
      legacy: true,
      channels: [first ?? "", second ?? "", third],
      alpha,
    };
  }

  const [channelText = "", alpha, ...rest] = text.split("/");
  const channels = trim(channelText).split(/[ \t\n\f\r]+/);
  const [first, second, third] = channels;
  if (third === undefined || channels.length > 3 || rest.length > 0) {
    return undefined;
  }
  return {
    legacy: false,
    channels: [first ?? "", second ?? "", third],
    alpha: alpha === undefined ? undefined : trim(alpha),
  };
}

/**
 * Parses an alpha value, a number or a percentage, as a number from 0 to 1.
 * A missing alpha value is `1`.
 */
function parseAlpha(text: string | undefined): number | undefined {
  if (text === undefined) return 1;
  const alpha = parseNumberOrPercentage(text);
  if (alpha === undefined) return undefined;
  return alpha.unit === "%" ? alpha.value / 100 : alpha.value;
}

function parseHex(digits: string): SvgHexColor | undefined {
  if (!/^[0-9a-fA-F]+$/.test(digits)) return undefined;
  let full: string;
  if (digits.length === 3 || digits.length === 4) {
    full = digits.replace(/./g, "$&$&");
  } else if (digits.length === 6 || digits.length === 8) {
    full = digits;
  } else {
    return undefined;
  }
  const byte = (index: number): number =>
    Number.parseInt(full.slice(index, index + 2), 16);
  return {
    type: "hex",
    red: byte(0),
    green: byte(2),
    blue: byte(4),
    alpha: full.length === 8 ? byte(6) / 255 : 1,
  };
}

function parseRgb({
  legacy,
  channels,
  alpha,
}: ColorArguments): SvgRgbColor | undefined {
  const [red, green, blue] = channels.map(parseNumberOrPercentage);
  const opacity = parseAlpha(alpha);
  if (
    red === undefined ||
    green === undefined ||
    blue === undefined ||
    opacity === undefined
  ) {
    return undefined;
  }
  // The legacy syntax takes three numbers or three percentages, not a mix.
  if (legacy && (green.unit !== red.unit || blue.unit !== red.unit)) {
    return undefined;
  }
  const scale = ({ value, unit }: SvgNumberOrPercentage): number =>
    unit === "%" ? (value * 255) / 100 : value;
  return {
    type: "rgb",
    red: scale(red),
    green: scale(green),
    blue: scale(blue),
    alpha: opacity,
  };
}

function toDegrees({ value, unit }: SvgAngle): number {
  switch (unit) {
    case "":
    case "deg":
      return value;
    case "grad":
      return value * 0.9;
    case "rad":
      return (value * 180) / Math.PI;
    case "turn":
      return value * 360;
  }
}

function parseHsl({
  legacy,
  channels,
  alpha,
}: ColorArguments): SvgHslColor | undefined {
  const hue = parseAngle(channels[0]);
  const saturation = parseNumberOrPercentage(channels[1]);
  const lightness = parseNumberOrPercentage(channels[2]);
  const opacity = parseAlpha(alpha);
  if (
    hue === undefined ||
    saturation === undefined ||
    lightness === undefined ||
    opacity === undefined
  ) {
    return undefined;
  }
  // The legacy syntax takes percentages only; in the CSS Color 4 syntax a
  // plain number means the same percentage.
  if (legacy && (saturation.unit !== "%" || lightness.unit !== "%")) {
    return undefined;
  }
  return {
    type: "hsl",
    hue: toDegrees(hue),
    saturation: saturation.value,
    lightness: lightness.value,
    alpha: opacity,
  };
}

/**
 * Parses a color, such as the value of `stop-color` or a `fill` that is a
 * plain color, or returns `undefined` if the text is not one.
 *
 * The notations are the ones CSS Color 4 defines for sRGB:
 *
 * - hex: `#f00`, `#f008`, `#ff0000`, `#ff000080`;
 * - `rgb()` and `rgba()` with numbers or percentages, comma-separated
 *   (`rgb(255, 0, 0)`) or space-separated with an optional `/` alpha
 *   (`rgb(255 0 0 / 50%)`);
 * - `hsl()` and `hsla()`, with the hue as a number or an angle;
 * - the named colors, `transparent` included, and `currentColor`.
 *
 * Keywords and function names are ASCII case-insensitive, and SVG whitespace
 * around the color is ignored. Other color functions such as `hwb()`,
 * `lab()` or `color()`, system colors, `none` channels, `calc()` and paint
 * values such as `url(#g)` or `none` are not colors here.
 *
 * @example
 * ```ts
 * parseColor("#F00"); // { type: "hex", red: 255, green: 0, blue: 0, alpha: 1 }
 * parseColor("rgb(0 128 0 / 50%)"); // { type: "rgb", red: 0, green: 128, blue: 0, alpha: 0.5 }
 * parseColor("Red"); // { type: "named", name: "red" }
 * parseColor("url(#g)"); // undefined
 * ```
 */
export function parseColor(text: string): SvgColor | undefined {
  const value = trim(text);
  if (value.startsWith("#")) return parseHex(value.slice(1));

  const lower = asciiLowercase(value);
  if (lower === "currentcolor") return { type: "currentColor" };
  if (Object.hasOwn(namedColors, lower)) {
    return { type: "named", name: lower as SvgColorName };
  }

  const open = lower.indexOf("(");
  if (open === -1 || !lower.endsWith(")")) return undefined;
  const name = lower.slice(0, open);
  if (name !== "rgb" && name !== "rgba" && name !== "hsl" && name !== "hsla") {
    return undefined;
  }
  const args = splitArguments(value.slice(open + 1, -1));
  if (args === undefined) return undefined;
  return name === "rgb" || name === "rgba" ? parseRgb(args) : parseHsl(args);
}

/**
 * Writes a number as CSS reads it, or throws for `NaN` and infinities, which
 * CSS cannot write.
 */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError(`A color value must be finite, got ${String(value)}`);
  }
  return String(value);
}

function checkByte(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new TypeError(
      `A hex color ${name} channel must be an integer from 0 to 255, got ${String(value)}`,
    );
  }
  return value;
}

function formatHex({ red, green, blue, alpha }: SvgHexColor): string {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new TypeError(
      `A hex color alpha must be from 0 to 1, got ${String(alpha)}`,
    );
  }
  const bytes = [
    checkByte(red, "red"),
    checkByte(green, "green"),
    checkByte(blue, "blue"),
  ];
  const alphaByte = Math.round(alpha * 255);
  if (alphaByte !== 255) bytes.push(alphaByte);
  // A byte with two equal digits, such as 0xff, is a multiple of 0x11 and
  // can be written as one digit.
  const short = bytes.every((byte) => byte % 0x11 === 0);
  const digits = bytes.map((byte) =>
    short ? (byte / 0x11).toString(16) : byte.toString(16).padStart(2, "0"),
  );
  return `#${digits.join("")}`;
}

/**
 * Writes a color as CSS and SVG read it, in the notation it has, or throws a
 * `TypeError` if it would not read back with `parseColor`.
 *
 * Hex colors are written lowercase and as short as possible: `#f00` rather
 * than `#ff0000`, with alpha digits only when the alpha is not `1`. The alpha
 * of a hex color is rounded to the nearest of its 256 steps. `rgb()` and
 * `hsl()` colors are written in the comma-separated syntax, which SVG 1.1
 * renderers read too, as `rgba()` and `hsla()` when the alpha is not `1`.
 * Named colors are written lowercase.
 *
 * @example
 * ```ts
 * formatColor({ type: "hex", red: 255, green: 0, blue: 0, alpha: 1 }); // "#f00"
 * formatColor({ type: "rgb", red: 255, green: 0, blue: 0, alpha: 0.5 }); // "rgba(255, 0, 0, 0.5)"
 * formatColor({ type: "hsl", hue: 120, saturation: 100, lightness: 25, alpha: 1 }); // "hsl(120, 100%, 25%)"
 * formatColor(parseColor("RED")!); // "red"
 * ```
 *
 * @throws {TypeError} If a value is not finite, a hex channel is not an
 *   integer from 0 to 255, a hex alpha is not from 0 to 1, or a name is not a
 *   named color.
 */
export function formatColor(color: SvgColor): string {
  switch (color.type) {
    case "hex":
      return formatHex(color);
    case "rgb": {
      const channels = [color.red, color.green, color.blue].map(formatNumber);
      return color.alpha === 1
        ? `rgb(${channels.join(", ")})`
        : `rgba(${channels.join(", ")}, ${formatNumber(color.alpha)})`;
    }
    case "hsl": {
      const channels = `${formatNumber(color.hue)}, ${formatNumber(color.saturation)}%, ${formatNumber(color.lightness)}%`;
      return color.alpha === 1
        ? `hsl(${channels})`
        : `hsla(${channels}, ${formatNumber(color.alpha)})`;
    }
    case "named":
      if (!Object.hasOwn(namedColors, color.name)) {
        throw new TypeError(`Not a named color: ${color.name}`);
      }
      return color.name;
    case "currentColor":
      return "currentColor";
  }
}
