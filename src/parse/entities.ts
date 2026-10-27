import { isXmlChar, scanName } from "../internal";
import { MAX_ENTITY_EXPANSIONS, MAX_EXPANDED_LENGTH } from "./limits";
import type { Scanner } from "./scanner";

/**
 * General entities declared in the internal DTD subset: the replacement text,
 * or `null` for an external entity.
 *
 * Also counts how much expansion the document has used so far, to enforce
 * the limits across all references.
 */
export class Entities extends Map<string, string | null> {
  /**
   * Expansions of declared entities, nested ones included.
   */
  expansions = 0;
  /**
   * Characters produced by expanding declared entities.
   */
  expandedLength = 0;
}

const predefined = new Map([
  ["lt", "<"],
  ["gt", ">"],
  ["amp", "&"],
  ["apos", "'"],
  ["quot", '"'],
]);

/**
 * Reads the character reference at `index` (`&#…;` or `&#x…;`) and returns
 * its code point and the index after it, or `undefined` if the syntax is
 * wrong. The code point is not checked.
 */
export function scanCharReference(
  text: string,
  index: number,
): { code: number; end: number } | undefined {
  let position = index + 2;
  const hex = text.charCodeAt(position) === 0x78;
  if (hex) position++;

  const digitsStart = position;
  let code = 0;
  for (;;) {
    const digit = hexDigit(text.charCodeAt(position));
    if (digit === -1 || (!hex && digit > 9)) break;
    // Clamp so long references cannot overflow; anything above U+10FFFF is invalid.
    code = Math.min(code * (hex ? 16 : 10) + digit, 0x110000);
    position++;
  }

  if (position === digitsStart || text.charCodeAt(position) !== 0x3b) {
    return undefined;
  }
  return { code, end: position + 1 };
}

function hexDigit(char: number): number {
  if (char >= 0x30 && char <= 0x39) return char - 0x30;
  if (char >= 0x61 && char <= 0x66) return char - 0x57;
  if (char >= 0x41 && char <= 0x46) return char - 0x37;
  return -1;
}

/**
 * Reads the character reference at the current position and returns the
 * character.
 */
export function readCharReference(scanner: Scanner): string {
  const start = scanner.pos;
  const reference = scanCharReference(scanner.input, start);
  if (reference === undefined) {
    scanner.fail("MALFORMED_XML", "Malformed character reference", start);
  }
  if (!isXmlChar(reference.code)) {
    scanner.fail(
      "MALFORMED_XML",
      "Character reference to a character not allowed in XML",
      start,
    );
  }
  scanner.pos = reference.end;
  return String.fromCodePoint(reference.code);
}

/**
 * Reads the reference at the current position (`&name;` or a character
 * reference) in text or an attribute value and returns its replacement text.
 *
 * In attribute values, whitespace characters in entity replacement text become
 * spaces, as XML requires.
 */
export function readReference(
  scanner: Scanner,
  entities: Entities,
  inAttribute: boolean,
): string {
  if (scanner.input.charCodeAt(scanner.pos + 1) === 0x23) {
    return readCharReference(scanner);
  }

  const start = scanner.pos;
  scanner.pos++;
  const name = scanner.readName();
  scanner.expect(";");
  return (
    predefined.get(name) ??
    expandEntity(scanner, entities, name, start, inAttribute, new Set())
  );
}

/**
 * Returns the replacement text of the declared entity `name`, with the
 * references in it expanded. Errors are reported at `offset`, the reference in
 * the input.
 */
function expandEntity(
  scanner: Scanner,
  entities: Entities,
  name: string,
  offset: number,
  inAttribute: boolean,
  active: Set<string>,
): string {
  const value = entities.get(name);
  if (value === undefined) {
    scanner.fail("UNDEFINED_ENTITY", `Undefined entity &${name};`, offset);
  }
  if (value === null) {
    scanner.fail(
      "EXTERNAL_ENTITY",
      `External entity &${name}; is not loaded`,
      offset,
    );
  }
  if (active.has(name)) {
    scanner.fail("MALFORMED_XML", `Entity &${name}; refers to itself`, offset);
  }
  active.add(name);

  if (++entities.expansions > MAX_ENTITY_EXPANSIONS) {
    scanner.fail(
      "MAX_ENTITY_EXPANSIONS_EXCEEDED",
      `More than ${String(MAX_ENTITY_EXPANSIONS)} entity expansions`,
      offset,
    );
  }

  let result = "";
  // Counts only the characters this entity adds itself, so text from nested
  // entities is counted once, before the result grows past the limit.
  const append = (text: string): void => {
    entities.expandedLength += text.length;
    if (entities.expandedLength > MAX_EXPANDED_LENGTH) {
      scanner.fail(
        "MAX_EXPANDED_LENGTH_EXCEEDED",
        `Entities expand to more than ${String(MAX_EXPANDED_LENGTH)} characters`,
        offset,
      );
    }
    result += text;
  };
  let chunkStart = 0;
  let index = 0;
  while (index < value.length) {
    const char = value.charCodeAt(index);

    if (char === 0x3c) {
      scanner.fail(
        "UNSUPPORTED_ENTITY",
        `Entity &${name}; contains markup`,
        offset,
      );
    }

    if (char === 0x26) {
      append(value.slice(chunkStart, index));
      if (value.charCodeAt(index + 1) === 0x23) {
        const reference = scanCharReference(value, index);
        if (reference === undefined || !isXmlChar(reference.code)) {
          scanner.fail(
            "MALFORMED_XML",
            `Malformed character reference in entity &${name};`,
            offset,
          );
        }
        append(String.fromCodePoint(reference.code));
        index = reference.end;
      } else {
        const nameEnd = scanName(value, index + 1);
        if (nameEnd === index + 1 || value.charCodeAt(nameEnd) !== 0x3b) {
          scanner.fail(
            "MALFORMED_XML",
            `Malformed reference in entity &${name};`,
            offset,
          );
        }
        const nested = value.slice(index + 1, nameEnd);
        const builtIn = predefined.get(nested);
        if (builtIn === undefined) {
          result += expandEntity(
            scanner,
            entities,
            nested,
            offset,
            inAttribute,
            active,
          );
        } else {
          append(builtIn);
        }
        index = nameEnd + 1;
      }
      chunkStart = index;
      continue;
    }

    if (inAttribute && (char === 0x9 || char === 0xa || char === 0xd)) {
      append(`${value.slice(chunkStart, index)} `);
      chunkStart = index + 1;
    }
    index++;
  }

  append(value.slice(chunkStart));
  active.delete(name);
  return result;
}
