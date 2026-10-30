import type { SvgParent } from "../ast";
import { scanColors, type SvgColorUse } from "./scan";

/**
 * Lists every color and paint written in a document or element, the element
 * itself included, in document order.
 *
 * Colors are read where they are written: in the color presentation
 * attributes (`fill`, `stroke`, `stop-color`, `flood-color`,
 * `lighting-color`, `color`) of any element, in the same properties in
 * `style` attributes, overridden duplicates included, and in the declarations
 * of `<style>` elements, inside at-rules such as `@media` too. Selectors are
 * not matched, so a color in a `<style>` rule is reported once, at the
 * `<style>` element; inheritance is not resolved, and `url(#…)` is reported
 * but not followed. A `<style>` element is read only if its `type` is
 * missing or `text/css`.
 *
 * Values that are not a color or a paint, such as `inherit`, `fill="freeze"`
 * on `<animate>` or a color function `parseColor` does not read, are left
 * out. `none`, `context-fill`, `context-stroke` and `url(…)` without a
 * fallback color are reported without a `color`.
 *
 * To list each distinct color once, normalize the colors and compare them as
 * strings.
 *
 * @example
 * ```ts
 * const document = parse(
 *   '<svg><style>.a { fill: #F00 }</style><path fill="red" stroke="none"/></svg>',
 * );
 * extractColors(document).map((use) => use.value); // ["#F00", "red", "none"]
 *
 * const distinct = new Set(
 *   extractColors(document).flatMap(({ color }) =>
 *     color === undefined ? [] : [formatColor(normalizeColor(color))],
 *   ),
 * ); // Set { "#f00" }
 * ```
 */
export function extractColors(parent: SvgParent): SvgColorUse[] {
  const uses: SvgColorUse[] = [];
  scanColors(parent, (use) => {
    uses.push(use);
    return undefined;
  });
  return uses;
}
