import { scanXmlChar } from "../internal";

/**
 * Escapes text content: `&`, `<` and `>` become references, and so does `\r`,
 * which `parse()` would otherwise turn into `\n`.
 *
 * @throws {TypeError} If the text contains a character not allowed in XML.
 */
export function escapeText(value: string): string {
  return escape(value, false);
}

/**
 * Escapes an attribute value for double quotes: `&`, `<` and `"` become
 * references, and so do tab, `\n` and `\r`, which `parse()` would otherwise
 * turn into spaces.
 *
 * @throws {TypeError} If the value contains a character not allowed in XML.
 */
export function escapeAttribute(value: string): string {
  return escape(value, true);
}

function escape(value: string, attribute: boolean): string {
  let result = "";
  let chunkStart = 0;
  let index = 0;

  while (index < value.length) {
    const char = value.charCodeAt(index);
    // Nothing from '?' up to the surrogates needs escaping.
    if (char >= 0x3f && char < 0xd800) {
      index++;
      continue;
    }

    const replacement = replacementFor(char, attribute);
    if (replacement === undefined) {
      index = checkChar(value, index, attribute ? "attribute value" : "text");
      continue;
    }
    result += value.slice(chunkStart, index) + replacement;
    chunkStart = ++index;
  }

  return chunkStart === 0 ? value : result + value.slice(chunkStart);
}

function replacementFor(char: number, attribute: boolean): string | undefined {
  switch (char) {
    case 0x26:
      return "&amp;";
    case 0x3c:
      return "&lt;";
    case 0x3e:
      return attribute ? undefined : "&gt;";
    case 0x22:
      return attribute ? "&quot;" : undefined;
    case 0xd:
      return "&#13;";
    case 0xa:
      return attribute ? "&#10;" : undefined;
    case 0x9:
      return attribute ? "&#9;" : undefined;
    default:
      return undefined;
  }
}

/**
 * Checks a value that is written without escaping, such as a comment or CDATA
 * section: every character must be allowed in XML, and `\r` is rejected
 * because `parse()` would turn it into `\n`.
 *
 * @throws {TypeError} If the value contains such a character.
 */
export function checkRaw(value: string, context: string): void {
  let index = 0;
  while (index < value.length) {
    const char = value.charCodeAt(index);
    if (char === 0xd) {
      throw new TypeError(`A ${context} cannot contain '\\r'`);
    }
    index =
      char >= 0x20 && char < 0xd800
        ? index + 1
        : checkChar(value, index, context);
  }
}

/**
 * Checks the character at `index`, which the caller did not accept on its
 * fast path, and returns the index after it.
 */
function checkChar(value: string, index: number, context: string): number {
  const next = scanXmlChar(value, index);
  if (next !== -1) return next;
  const char = value.charCodeAt(index);
  const hex = char.toString(16).toUpperCase().padStart(4, "0");
  throw new TypeError(`Character U+${hex} is not allowed in XML (${context})`);
}
