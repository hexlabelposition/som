import { isXmlChar, scanName } from "../internal";
import type { Scanner } from "./scanner";

/**
 * General entities declared in the internal DTD subset: the replacement text,
 * or `null` for an external entity.
 */
export type Entities = Map<string, string | null>;

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
  return expandEntity(scanner, entities, name, start, inAttribute, new Set());
}

/**
 * Returns the replacement text of the entity `name`, with the references in it
 * expanded. Errors are reported at `offset`, the reference in the input.
 */
function expandEntity(
  scanner: Scanner,
  entities: Entities,
  name: string,
  offset: number,
  inAttribute: boolean,
  active: Set<string>,
): string {
  const builtIn = predefined.get(name);
  if (builtIn !== undefined) return builtIn;

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

  let result = "";
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
      result += value.slice(chunkStart, index);
      if (value.charCodeAt(index + 1) === 0x23) {
        const reference = scanCharReference(value, index);
        if (reference === undefined || !isXmlChar(reference.code)) {
          scanner.fail(
            "MALFORMED_XML",
            `Malformed character reference in entity &${name};`,
            offset,
          );
        }
        result += String.fromCodePoint(reference.code);
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
        result += expandEntity(
          scanner,
          entities,
          value.slice(index + 1, nameEnd),
          offset,
          inAttribute,
          active,
        );
        index = nameEnd + 1;
      }
      chunkStart = index;
      continue;
    }

    if (inAttribute && (char === 0x9 || char === 0xa || char === 0xd)) {
      result += `${value.slice(chunkStart, index)} `;
      chunkStart = index + 1;
    }
    index++;
  }

  active.delete(name);
  return result + value.slice(chunkStart);
}
