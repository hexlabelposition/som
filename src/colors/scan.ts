import { walk, type SvgElement, type SvgParent } from "../ast";
import {
  scanStyle,
  scanStylesheet,
  splitImportant,
  type StyleDeclaration,
} from "../internal";
import { asciiLowercase, trim, type SvgColor } from "./color";
import { readPaint } from "./paint";

/**
 * A property whose value is a color or a paint: the presentation attributes
 * with the `color` or `paint` value type in SVG 1.1 and SVG 2.
 */
export type SvgColorProperty =
  "color" | "fill" | "flood-color" | "lighting-color" | "stop-color" | "stroke";

/**
 * The color properties, and whether each takes a `<paint>` rather than only a
 * `<color>`. A test checks the list against the spec data, so the colors
 * module pulls no spec data into a bundle (ARCHITECTURE §12).
 */
export const colorProperties: ReadonlyMap<string, boolean> = new Map([
  ["color", false],
  ["fill", true],
  ["flood-color", false],
  ["lighting-color", false],
  ["stop-color", false],
  ["stroke", true],
]);

/**
 * A color or paint written in a document: where it is written and what it
 * is.
 *
 * @example
 * ```ts
 * // <path fill="url(#g) #f00"/>
 * const use: SvgColorUse = {
 *   element: path,
 *   property: "fill",
 *   source: "attribute",
 *   value: "url(#g) #f00",
 *   color: { type: "hex", red: 255, green: 0, blue: 0, alpha: 1 },
 *   url: "#g",
 * };
 * ```
 */
export interface SvgColorUse {
  /**
   * The element it is written on: the element with the attribute or the
   * `style` attribute, or the `<style>` element whose rule sets it.
   */
  element: SvgElement;
  /** The property it is the value of. */
  property: SvgColorProperty;
  /**
   * `"attribute"` for a presentation attribute such as `fill="red"`,
   * `"style"` for a declaration in the `style` attribute, `"stylesheet"` for
   * a declaration in a `<style>` element.
   */
  source: "attribute" | "style" | "stylesheet";
  /** The value as written, trimmed, without `!important`. */
  value: string;
  /**
   * The color: the value itself, or the fallback color after `url(…)`. Not
   * set for `none`, `context-fill`, `context-stroke`, or `url(…)` without a
   * fallback color.
   */
  color?: SvgColor;
  /** The paint server reference inside `url(…)`, such as `#g`, unquoted. */
  url?: string;
}

/**
 * Returns the text that replaces the color of a use, or `undefined` to leave
 * it as it is. Only called for uses with a color to replace when it returns
 * a text.
 */
type Replace = (use: SvgColorUse) => string | undefined;

/**
 * A change to a text: the range from `start` to `end` is replaced with
 * `text`.
 */
interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Visits every color and paint written in a document or element, the
 * element itself included, in document order, and writes the replacements
 * `replace` returns where each color is written (ARCHITECTURE §12).
 */
export function scanColors(parent: SvgParent, replace: Replace): void {
  if (parent.type === "element") scanElement(parent, replace);
  walk(parent, (node) => {
    if (node.type === "element") scanElement(node, replace);
    return undefined;
  });
}

function scanElement(element: SvgElement, replace: Replace): void {
  const { attributes } = element;
  for (const [name, text] of Object.entries(attributes)) {
    if (name === "style") {
      attributes.style = scanDeclarations(
        text,
        scanStyle(text),
        element,
        "style",
        replace,
      );
      continue;
    }
    const paint = colorProperties.get(name);
    if (paint === undefined) continue;
    const found = readPaint(text, paint);
    if (found === undefined) continue;
    const { value, color, url, start, end } = found;
    const replacement = replace({
      element,
      property: name as SvgColorProperty,
      source: "attribute",
      value,
      ...(color !== undefined && { color }),
      ...(url !== undefined && { url }),
    });
    if (replacement !== undefined && color !== undefined) {
      attributes[name] = applyEdits(text, [{ start, end, text: replacement }]);
    }
  }

  if (element.name === "style" && isCss(element)) {
    for (const child of element.children) {
      if (child.type !== "text" && child.type !== "cdata") continue;
      child.value = scanDeclarations(
        child.value,
        scanStylesheet(child.value),
        element,
        "stylesheet",
        replace,
      );
    }
  }
}

/**
 * Visits the colors in the given declarations of a `style` attribute or a
 * style sheet and returns the text with the replacements written.
 */
function scanDeclarations(
  text: string,
  declarations: readonly StyleDeclaration[],
  element: SvgElement,
  source: "style" | "stylesheet",
  replace: Replace,
): string {
  const edits: Edit[] = [];
  for (const declaration of declarations) {
    const paint = colorProperties.get(declaration.name);
    if (paint === undefined) continue;
    // Without `!important`, the value still starts at `valueStart`.
    const found = readPaint(splitImportant(declaration.value).value, paint);
    if (found === undefined) continue;
    const { value, color, url, start, end } = found;
    const replacement = replace({
      element,
      property: declaration.name as SvgColorProperty,
      source,
      value,
      ...(color !== undefined && { color }),
      ...(url !== undefined && { url }),
    });
    if (replacement !== undefined && color !== undefined) {
      edits.push({
        start: declaration.valueStart + start,
        end: declaration.valueStart + end,
        text: replacement,
      });
    }
  }
  return applyEdits(text, edits);
}

/**
 * Whether a `<style>` element holds CSS: its `type` is missing, empty or
 * `text/css`.
 */
function isCss(element: SvgElement): boolean {
  const type = element.attributes.type;
  if (type === undefined) return true;
  const lower = asciiLowercase(trim(type));
  return lower === "" || lower === "text/css";
}

/**
 * Applies edits that do not overlap and are sorted by position.
 */
function applyEdits(text: string, edits: readonly Edit[]): string {
  let result = text;
  // From the end, so earlier positions stay valid.
  for (const { start, end, text: replacement } of [...edits].reverse()) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}
