import type { SvgElement } from "../ast";
import { normalizeName, scanStyle, type StyleDeclaration } from "../internal";
import { formatDeclaration, winningDeclarations } from "./style";

/**
 * Returns the value of a property in the `style` attribute of an element, or
 * `undefined` if it is not set there.
 *
 * As in CSS, the last declaration of the property wins, but an `!important`
 * one wins over any that is not, and names are compared ASCII
 * case-insensitively, except custom properties (`--name`). Only the
 * `style` attribute is read: a presentation attribute such as `fill="red"` or
 * a `<style>` sheet is not taken into account.
 *
 * @example
 * ```ts
 * // <path style="fill: red; stroke: blue !important"/>
 * getStyleProperty(path, "fill"); // "red"
 * getStyleProperty(path, "stroke"); // "blue !important"
 * getStyleProperty(path, "opacity"); // undefined
 * ```
 */
export function getStyleProperty(
  element: SvgElement,
  name: string,
): string | undefined {
  const style = element.attributes.style;
  if (style === undefined) return undefined;
  return winningDeclarations(findAll(style, name)).at(0)?.value;
}

/**
 * Sets a property in the `style` attribute of an element, creating the
 * attribute if needed.
 *
 * The value of the last declaration of the property is replaced and earlier
 * ones are removed; if there is none, the declaration is appended. The rest of
 * the text, including other declarations, comments between them and spacing,
 * stays as it is. A comment inside the old value is part of the value and is
 * replaced with it.
 *
 * @example
 * ```ts
 * // <path style="fill:red;stroke:blue"/>
 * setStyleProperty(path, "fill", "green");
 * // <path style="fill:green;stroke:blue"/>
 * setStyleProperty(path, "opacity", "0.5");
 * // <path style="fill:green;stroke:blue; opacity: 0.5"/>
 * ```
 *
 * @throws {TypeError} If the name or value would not read back as the same
 *   declaration, such as an empty value or one with an unbalanced quote or
 *   `;`.
 */
export function setStyleProperty(
  element: SvgElement,
  name: string,
  value: string,
): void {
  const declaration = formatDeclaration(name, value);
  const style = element.attributes.style ?? "";
  const matches = findAll(style, name);
  const last = matches.pop();

  if (last === undefined) {
    const kept = style.trimEnd();
    const separator = kept === "" ? "" : kept.endsWith(";") ? " " : "; ";
    element.attributes.style = kept + separator + declaration;
    return;
  }

  let result =
    style.slice(0, last.valueStart) + value.trim() + style.slice(last.valueEnd);
  result = removeDeclarations(result, matches);
  element.attributes.style = result;
}

/**
 * Removes every declaration of a property from the `style` attribute of an
 * element. The rest of the text stays as it is. If no declaration is left,
 * the `style` attribute is removed.
 *
 * @example
 * ```ts
 * // <path style="fill: red; stroke: blue"/>
 * removeStyleProperty(path, "fill");
 * // <path style="stroke: blue"/>
 * removeStyleProperty(path, "stroke");
 * // <path/>
 * ```
 */
export function removeStyleProperty(element: SvgElement, name: string): void {
  const style = element.attributes.style;
  if (style === undefined) return;

  const matches = findAll(style, name);
  if (matches.length === 0) return;

  const result = removeDeclarations(style, matches);
  if (scanStyle(result).length === 0) delete element.attributes.style;
  else element.attributes.style = result;
}

function findAll(style: string, name: string): StyleDeclaration[] {
  const normalized = normalizeName(name);
  return scanStyle(style).filter(
    (declaration) => declaration.name === normalized,
  );
}

/**
 * Removes the given declarations, which must come before any change made to
 * `style`, with the whitespace after each one.
 */
function removeDeclarations(
  style: string,
  declarations: StyleDeclaration[],
): string {
  let result = style;
  // From the end, so earlier positions stay valid.
  for (const { start, end } of [...declarations].reverse()) {
    let next = end;
    while (next < result.length && /\s/.test(result.charAt(next))) next++;
    // Removing the last declaration leaves the space before it behind.
    result =
      next >= result.length
        ? result.slice(0, start).trimEnd()
        : result.slice(0, start) + result.slice(next);
  }
  return result;
}
