import {
  parseHex,
  type SvgColor,
  type SvgCurrentColor,
  type SvgHexColor,
} from "./color";
import { namedColors } from "./named";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Rounds a channel on the 0-255 scale to the nearest integer in range, as
 * browsers store sRGB colors.
 */
const toByte = (value: number): number => Math.round(clamp(value, 0, 255));

/**
 * Rounds an alpha value to the nearest of the 256 steps a hex color can
 * write.
 */
const toAlpha = (value: number): number =>
  Math.round(clamp(value, 0, 1) * 255) / 255;

/**
 * Converts HSL to sRGB channels from 0 to 1, with the algorithm in CSS Color
 * 4. The hue wraps around; saturation and lightness are clamped to 0-100.
 */
function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number,
): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

function checkFinite(values: number[]): void {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`A color value must be finite, got ${String(value)}`);
    }
  }
}

/**
 * Converts a color to one form, so that colors which look the same compare
 * equal: a hex color with integer channels from 0 to 255 and an alpha
 * rounded to one of 256 steps, or `currentColor`.
 *
 * Named colors take their CSS value, `hsl()` is converted to sRGB as CSS
 * does, and values outside the range are clamped, as CSS does when it
 * renders them. Channels are rounded to integers, as browsers store them, so
 * `rgb(127.5, 0, 0)` is `#800000`. `currentColor` stays as it is: its value
 * is the inherited `color`, which the color alone does not tell.
 *
 * Write the result with `formatColor` to compare colors as strings or to get
 * the shortest form.
 *
 * @example
 * ```ts
 * normalizeColor(parseColor("red")!); // { type: "hex", red: 255, green: 0, blue: 0, alpha: 1 }
 * formatColor(normalizeColor(parseColor("hsl(120, 100%, 25%)")!)); // "#008000"
 * formatColor(normalizeColor(parseColor("rgba(255, 0, 0, 0)")!)); // "#f000"
 * ```
 *
 * @throws {TypeError} If a value is not finite.
 */
export function normalizeColor(color: SvgColor): SvgHexColor | SvgCurrentColor {
  switch (color.type) {
    case "currentColor":
      return { type: "currentColor" };
    case "named": {
      const hex = Object.hasOwn(namedColors, color.name)
        ? parseHex(namedColors[color.name])
        : undefined;
      if (hex === undefined) {
        throw new TypeError(`Not a named color: ${color.name}`);
      }
      return hex;
    }
    case "hex":
    case "rgb": {
      const { red, green, blue, alpha } = color;
      checkFinite([red, green, blue, alpha]);
      return {
        type: "hex",
        red: toByte(red),
        green: toByte(green),
        blue: toByte(blue),
        alpha: toAlpha(alpha),
      };
    }
    case "hsl": {
      const { hue, saturation, lightness, alpha } = color;
      checkFinite([hue, saturation, lightness, alpha]);
      const [red, green, blue] = hslToRgb(hue, saturation, lightness);
      return {
        type: "hex",
        red: toByte(red * 255),
        green: toByte(green * 255),
        blue: toByte(blue * 255),
        alpha: toAlpha(alpha),
      };
    }
  }
}
