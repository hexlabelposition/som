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
 * At-rules whose block holds rules rather than declarations, without a vendor
 * prefix. The block of any other at-rule, such as `@font-face`, is read as
 * declarations.
 */
const groupingRules = new Set([
  "container",
  "document",
  "keyframes",
  "layer",
  "media",
  "scope",
  "starting-style",
  "supports",
]);

/**
 * Splits the text of a `<style>` element into the valid declarations of its
 * rules, in order, with positions in the whole text. Rules inside at-rules
 * such as `@media` are included; selectors and at-rule preludes are never
 * read as declarations.
 */
export function scanStylesheet(text: string): StyleDeclaration[] {
  const declarations: StyleDeclaration[] = [];
  scanRules(text, 0, text.length, declarations);
  return declarations;
}

/**
 * Adds the declarations of the rules between `start` and `end`.
 */
function scanRules(
  text: string,
  start: number,
  end: number,
  declarations: StyleDeclaration[],
): void {
  let index = start;

  while (index < end) {
    index = skipSpaceAndComments(text, index);
    if (index >= end) break;
    // CSS ignores HTML comment markers around rules.
    if (text.startsWith("<!--", index)) {
      index += 4;
      continue;
    }
    if (text.startsWith("-->", index)) {
      index += 3;
      continue;
    }

    const open = findBlockStart(text, index, end);
    if (open >= end) break;
    // A statement at-rule such as `@import url(a.css);` has no block.
    if (text.charCodeAt(open) === 0x3b) {
      index = open + 1;
      continue;
    }

    const close = findBlockEnd(text, open + 1, end);
    if (isGroupingRule(text.slice(index, open))) {
      scanRules(text, open + 1, close, declarations);
    } else {
      const offset = open + 1;
      for (const declaration of scanStyle(text.slice(offset, close))) {
        declarations.push({
          ...declaration,
          start: declaration.start + offset,
          valueStart: declaration.valueStart + offset,
          valueEnd: declaration.valueEnd + offset,
          end: declaration.end + offset,
        });
      }
    }
    index = close + 1;
  }
}

function isGroupingRule(prelude: string): boolean {
  const name = /^@([\w-]+)/.exec(prelude)?.[1];
  if (name === undefined) return false;
  const unprefixed = name.toLowerCase().replace(/^-[a-z\d]+-/, "");
  return groupingRules.has(unprefixed);
}

/**
 * Returns the index of the `{` that opens the block of a rule, or of the `;`
 * that ends an at-rule without a block, outside of strings, parentheses,
 * brackets and comments, or `end` if there is neither.
 */
function findBlockStart(text: string, start: number, end: number): number {
  let depth = 0;
  let index = start;

  while (index < end) {
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

    if (char === 0x28 || char === 0x5b) {
      depth++;
    } else if (char === 0x29 || char === 0x5d) {
      if (depth > 0) depth--;
    } else if (depth === 0 && (char === 0x7b || char === 0x3b)) {
      return index;
    }
    index++;
  }

  return end;
}

/**
 * Returns the index of the `}` that closes a block whose content starts at
 * `start`, or `end` if the block is not closed.
 */
function findBlockEnd(text: string, start: number, end: number): number {
  let depth = 0;
  let index = start;

  while (index < end) {
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
      if (char === 0x7d && depth === 0) return index;
      if (depth > 0) depth--;
    }
    index++;
  }

  return end;
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
export function findStringEnd(text: string, start: number): number {
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
