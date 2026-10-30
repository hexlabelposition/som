import type { SvgParent } from "../ast";
import { formatColor, parseColor, type SvgColor } from "./color";
import { normalizeColor } from "./normalize";
import { scanColors } from "./scan";

/**
 * Returns the normalized form of a color as a string, so that colors which
 * look the same compare equal.
 */
const colorKey = (color: SvgColor): string =>
  formatColor(normalizeColor(color));

/**
 * Parses a color given as a string, or throws if it is not one.
 */
function toColor(color: SvgColor | string): SvgColor {
  if (typeof color !== "string") return color;
  const parsed = parseColor(color);
  if (parsed === undefined) {
    throw new TypeError(`Not a color: ${JSON.stringify(color)}`);
  }
  return parsed;
}

/**
 * Returns a color given as a string as it is written, trimmed, after checking
 * that it is one.
 */
function formatGiven(color: string): string {
  toColor(color);
  return color.trim();
}

/**
 * Replaces a color everywhere `extractColors` finds it in a document or
 * element, the element itself included, and returns how many colors were
 * replaced.
 *
 * Colors are compared in their normalized form, so `#f00`, `red`,
 * `rgb(100% 0% 0%)` and `hsl(0 100% 50%)` all match each other, but not
 * `#f008`, which has a different alpha. `currentColor` matches only
 * `currentColor`. Only the color is rewritten: `!important`, a `url(…)` it
 * is the fallback of, other declarations, comments and spacing stay as they
 * are. `none` and `url(…)` without a fallback color are never replaced.
 *
 * The new color is written as given, trimmed, or with `formatColor` if it is
 * an `SvgColor`. A rule in a `<style>` element is changed in place, so every
 * element it applies to is recolored, and so is every shape that uses a
 * gradient whose stop colors are replaced.
 *
 * @example
 * ```ts
 * // <svg><path fill="#F00" style="stroke: red !important"/></svg>
 * replaceColor(document, "red", "currentColor"); // 2
 * // <svg><path fill="currentColor" style="stroke: currentColor !important"/></svg>
 * ```
 *
 * @throws {TypeError} If `from` or `to` is a string that is not a color, or
 *   an `SvgColor` with a value `formatColor` cannot write.
 */
export function replaceColor(
  parent: SvgParent,
  from: SvgColor | string,
  to: SvgColor | string,
): number {
  const key = colorKey(toColor(from));
  const replacement =
    typeof to === "string" ? formatGiven(to) : formatColor(to);

  let count = 0;
  scanColors(parent, (use) => {
    if (use.color === undefined || colorKey(use.color) !== key) {
      return undefined;
    }
    count++;
    return replacement;
  });
  return count;
}
