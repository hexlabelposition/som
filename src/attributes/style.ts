import { splitImportant } from "../internal";

/**
 * A declaration in a `style` attribute, with its position in the text.
 */
export interface StyleDeclaration {
  /**
   * The property name, lowercased unless it is a custom property.
   */
  name: string;
  /**
   * The value as written, trimmed, including `!important`.
   */
  value: string;
  /**
   * Where the property name starts.
   */
  start: number;
  /**
   * Where the value starts and ends, without surrounding whitespace.
   */
  valueStart: number;
  valueEnd: number;
  /**
   * The index after the `;` that ends the declaration, or the text length.
   */
  end: number;
}

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

/**
 * Lowercases a property name for comparison, except a custom property.
 */
export function normalizeName(name: string): string {
  return name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

const propertyName = /^-?[A-Za-z_\u0080-￿][\w\u0080-￿-]*$/;
const customName = /^--[\w\u0080-￿-]+$/;

/**
 * Splits a `style` attribute into its valid declarations, in order.
 */
export function scanStyle(text: string): StyleDeclaration[] {
  const declarations: StyleDeclaration[] = [];
  let index = 0;

  while (index < text.length) {
    index = skipSpaceAndComments(text, index);
    if (index >= text.length) break;
    if (text.charCodeAt(index) === 0x3b) {
      index++;
      continue;
    }

    const start = index;
    const colon = findTopLevel(text, index, true);
    const end = findTopLevel(text, index, false);
    index = end < text.length ? end + 1 : end;
    if (colon >= end) continue;

    const name = text.slice(start, colon).trimEnd();
    let valueStart = colon + 1;
    while (valueStart < end && isSpace(text.charCodeAt(valueStart))) {
      valueStart++;
    }
    let valueEnd = end;
    while (valueEnd > valueStart && isSpace(text.charCodeAt(valueEnd - 1))) {
      valueEnd--;
    }

    const custom = name.startsWith("--");
    if (!(custom ? customName : propertyName).test(name)) continue;
    if (valueStart === valueEnd && !custom) continue;

    declarations.push({
      name: normalizeName(name),
      value: text.slice(valueStart, valueEnd),
      start,
      valueStart,
      valueEnd,
      end: index,
    });
  }

  return declarations;
}

/**
 * Returns the index of the first `:` (or `;`, if `colon` is false) outside of
 * strings, parentheses, brackets, braces and comments, or the text length.
 * A `;` always ends the search.
 */
function findTopLevel(text: string, start: number, colon: boolean): number {
  let depth = 0;
  let index = start;

  while (index < text.length) {
    const char = text.charCodeAt(index);

    if (char === 0x22 || char === 0x27) {
      index = skipString(text, index);
      continue;
    }
    if (char === 0x2f && text.charCodeAt(index + 1) === 0x2a) {
      index = skipComment(text, index);
      continue;
    }
    if (char === 0x5c) {
      index += 2;
      continue;
    }

    if (char === 0x28 || char === 0x5b || char === 0x7b) {
      depth++;
    } else if (char === 0x29 || char === 0x5d || char === 0x7d) {
      if (depth > 0) depth--;
    } else if (depth === 0 && (char === 0x3b || (colon && char === 0x3a))) {
      return index;
    }
    index++;
  }

  return text.length;
}

/**
 * Returns the index after the string that starts at `start`. An unterminated
 * string runs to the end of the text.
 */
function skipString(text: string, start: number): number {
  const end = findStringEnd(text, start);
  return end === -1 ? text.length : end;
}

/**
 * Returns the index after the string that starts at `start`, or -1 if it is
 * not terminated.
 */
function findStringEnd(text: string, start: number): number {
  const quote = text.charCodeAt(start);
  let index = start + 1;
  while (index < text.length) {
    const char = text.charCodeAt(index);
    if (char === 0x5c) {
      index += 2;
    } else if (char === quote) {
      return index + 1;
    } else {
      index++;
    }
  }
  return -1;
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

/**
 * Returns the index after the comment that starts at `start`.
 */
function skipComment(text: string, start: number): number {
  const end = text.indexOf("*/", start + 2);
  return end === -1 ? text.length : end + 2;
}

function skipSpaceAndComments(text: string, start: number): number {
  let index = start;
  for (;;) {
    while (isSpace(text.charCodeAt(index))) index++;
    if (
      text.charCodeAt(index) !== 0x2f ||
      text.charCodeAt(index + 1) !== 0x2a
    ) {
      return index;
    }
    index = skipComment(text, index);
  }
}

function isSpace(char: number): boolean {
  return (
    char === 0x20 ||
    char === 0x9 ||
    char === 0xa ||
    char === 0xd ||
    char === 0xc
  );
}
