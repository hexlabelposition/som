import {
  findStringEnd,
  normalizeName,
  scanStyle,
  splitImportant,
  type StyleDeclaration,
} from "../shared";

/**
 * Parses a `style` attribute into a property map.
 *
 * Declarations are split with a small CSS tokenizer, so `;` and `:` inside
 * strings, parentheses such as `url(…)`, and comments do not break them.
 * Values are trimmed and kept as written, including `!important`. As in CSS,
 * the last declaration of a property wins, but an `!important` one wins over
 * any that is not; property names are compared ASCII case-insensitively
 * except custom properties (`--name`), and invalid declarations are skipped.
 *
 * @example
 * ```ts
 * parseStyle("fill: red; Stroke: url(#a;b) !important; fill: blue");
 * // { fill: "blue", stroke: "url(#a;b) !important" }
 * parseStyle("fill: red !important; fill: blue");
 * // { fill: "red !important" }
 * ```
 */
export function parseStyle(text: string): Record<string, string> {
  const properties = new Map<string, string>();
  for (const { name, value } of winningDeclarations(scanStyle(text))) {
    properties.set(name, value);
  }
  // fromEntries creates own properties, also for a name like __proto__.
  return Object.fromEntries(properties);
}

/**
 * Returns the declaration that wins for each property, in the order of the
 * winning declarations: the last `!important` one, or the last one if none
 * is.
 */
export function winningDeclarations(
  declarations: readonly StyleDeclaration[],
): StyleDeclaration[] {
  const winners = new Map<string, StyleDeclaration>();
  for (const declaration of declarations) {
    const previous = winners.get(declaration.name);
    if (
      previous !== undefined &&
      splitImportant(previous.value).important &&
      !splitImportant(declaration.value).important
    ) {
      continue;
    }
    // Delete first so a repeated property moves to its last position.
    winners.delete(declaration.name);
    winners.set(declaration.name, declaration);
  }
  return [...winners.values()];
}

/**
 * Writes a property map as a `style` attribute value: `name: value` pairs
 * separated by `; `.
 *
 * @example
 * ```ts
 * stringifyStyle({ fill: "red", "stroke-width": "2" });
 * // "fill: red; stroke-width: 2"
 * ```
 *
 * @throws {TypeError} If a name or value would not read back as the same
 *   declaration, such as an empty value or one with an unbalanced quote or
 *   `;`.
 */
export function stringifyStyle(properties: Record<string, string>): string {
  return Object.keys(properties)
    .map((name) => formatDeclaration(name, properties[name] ?? ""))
    .join("; ");
}

/**
 * Returns `name: value`, after checking that it reads back as one declaration
 * with that name and value.
 *
 * @throws {TypeError} If it does not.
 */
export function formatDeclaration(name: string, value: string): string {
  const declaration = `${name}: ${value.trim()}`;
  const scanned = scanStyle(declaration);
  if (
    scanned.length !== 1 ||
    scanned[0]?.name !== normalizeName(name) ||
    scanned[0].value !== value.trim() ||
    scanned[0].end !== declaration.length ||
    !isComplete(value)
  ) {
    throw new TypeError(
      `Invalid style declaration ${JSON.stringify(declaration)}`,
    );
  }
  return declaration;
}

const closingBracket = new Map([
  [0x28, 0x29],
  [0x5b, 0x5d],
  [0x7b, 0x7d],
]);

/**
 * Checks that a value closes every string, comment and bracket it opens, so
 * text written after it is not swallowed.
 */
function isComplete(value: string): boolean {
  const expected: number[] = [];
  let index = 0;

  while (index < value.length) {
    const char = value.charCodeAt(index);

    if (char === 0x22 || char === 0x27) {
      index = findStringEnd(value, index);
      if (index === -1) return false;
      continue;
    }
    if (char === 0x2f && value.charCodeAt(index + 1) === 0x2a) {
      const end = value.indexOf("*/", index + 2);
      if (end === -1) return false;
      index = end + 2;
      continue;
    }
    if (char === 0x5c) {
      if (index + 1 >= value.length) return false;
      index += 2;
      continue;
    }

    const closing = closingBracket.get(char);
    if (closing !== undefined) {
      expected.push(closing);
    } else if (char === 0x29 || char === 0x5d || char === 0x7d) {
      if (expected.pop() !== char) return false;
    }
    index++;
  }

  return expected.length === 0;
}
