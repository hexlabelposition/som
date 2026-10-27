import type { SvgDoctype } from "../ast";
import { Entities, readCharReference } from "./entities";
import { readComment, readInstruction } from "./markup";
import { checkNoColon, checkQualifiedName } from "./namespaces";
import type { Scanner } from "./scanner";

/**
 * Reads `<!DOCTYPE …>` and returns the node and the general entities declared
 * in its internal subset.
 *
 * The external subset is never loaded, and the internal subset is not
 * interpreted beyond entity declarations: element, attribute list and notation
 * declarations are only checked for their overall syntax.
 */
export function readDoctype(scanner: Scanner): {
  doctype: SvgDoctype;
  entities: Entities;
} {
  const entities = new Entities();
  scanner.pos += 9;
  scanner.requireWhitespace();

  const valueStart = scanner.pos;
  const name = scanner.readName();
  checkQualifiedName(scanner, name, valueStart);

  if (scanner.skipWhitespace() && isExternalIdStart(scanner)) {
    readExternalId(scanner);
    scanner.skipWhitespace();
  }

  if (scanner.eat("[")) {
    readInternalSubset(scanner, entities);
    scanner.skipWhitespace();
  }

  scanner.expect(">");
  return {
    doctype: {
      type: "doctype",
      value: scanner.slice(valueStart, scanner.pos - 1),
    },
    entities,
  };
}

function isExternalIdStart(scanner: Scanner): boolean {
  return scanner.startsWith("SYSTEM") || scanner.startsWith("PUBLIC");
}

/**
 * Reads `SYSTEM "uri"` or `PUBLIC "id" "uri"`.
 */
function readExternalId(scanner: Scanner): void {
  if (scanner.eat("PUBLIC")) {
    scanner.requireWhitespace();
    const start = scanner.pos;
    const id = scanner.readQuoted();
    if (!/^[\n\r a-zA-Z0-9\-'()+,./:=?;!*#@$_%]*$/.test(id)) {
      scanner.fail("MALFORMED_XML", "Invalid character in public ID", start);
    }
  } else {
    scanner.expect("SYSTEM");
  }
  scanner.requireWhitespace();
  scanner.readQuoted();
}

function readInternalSubset(scanner: Scanner, entities: Entities): void {
  for (;;) {
    scanner.skipWhitespace();

    if (scanner.eat("]")) return;
    if (scanner.startsWith("<!--")) {
      readComment(scanner);
    } else if (scanner.startsWith("<?")) {
      readInstruction(scanner);
    } else if (scanner.startsWith("<!ENTITY")) {
      readEntityDeclaration(scanner, entities);
    } else if (
      scanner.startsWith("<!ELEMENT") ||
      scanner.startsWith("<!ATTLIST") ||
      scanner.startsWith("<!NOTATION")
    ) {
      skipDeclaration(scanner);
    } else if (scanner.peek() === 0x25) {
      scanner.fail(
        "UNSUPPORTED_ENTITY",
        "Parameter entity references are not supported",
      );
    } else {
      scanner.fail(
        "MALFORMED_XML",
        `Expected a declaration or ']' in the doctype${scanner.found()}`,
      );
    }
  }
}

/**
 * Reads `<!ENTITY name "value">` or an external entity declaration and adds
 * the entity unless one with that name is already declared, as XML requires.
 * Parameter entity declarations are read and ignored.
 */
function readEntityDeclaration(scanner: Scanner, entities: Entities): void {
  scanner.pos += 8;
  scanner.requireWhitespace();

  const parameter = scanner.eat("%");
  if (parameter) scanner.requireWhitespace();

  const nameStart = scanner.pos;
  const name = scanner.readName();
  checkNoColon(scanner, name, nameStart);
  scanner.requireWhitespace();

  let value: string | null;
  if (isExternalIdStart(scanner)) {
    readExternalId(scanner);
    if (scanner.skipWhitespace() && !parameter && scanner.eat("NDATA")) {
      scanner.requireWhitespace();
      scanner.readName();
    }
    value = null;
  } else {
    value = readEntityValue(scanner);
  }

  scanner.skipWhitespace();
  scanner.expect(">");
  if (!parameter && !entities.has(name)) entities.set(name, value);
}

/**
 * Reads a quoted entity value. Character references are expanded now and
 * entity references are kept, to be expanded where the entity is used.
 */
function readEntityValue(scanner: Scanner): string {
  const quote = scanner.peek();
  if (quote !== 0x22 && quote !== 0x27) {
    scanner.fail("MALFORMED_XML", `Expected a quoted value${scanner.found()}`);
  }
  const input = scanner.input;
  let value = "";
  let chunkStart = ++scanner.pos;

  for (;;) {
    const char = input.charCodeAt(scanner.pos);

    if (char === quote) {
      value += scanner.slice(chunkStart, scanner.pos);
      scanner.pos++;
      return value;
    }
    if (Number.isNaN(char)) {
      scanner.fail("MALFORMED_XML", "Unterminated entity value");
    }
    if (char === 0x25) {
      scanner.fail(
        "UNSUPPORTED_ENTITY",
        "Parameter entity references are not supported",
      );
    }

    if (char === 0x26) {
      if (input.charCodeAt(scanner.pos + 1) === 0x23) {
        value += scanner.slice(chunkStart, scanner.pos);
        value += readCharReference(scanner);
        chunkStart = scanner.pos;
      } else {
        scanner.pos++;
        scanner.readName();
        scanner.expect(";");
      }
      continue;
    }

    scanner.pos = scanner.checkChar(scanner.pos);
  }
}

/**
 * Skips an element, attribute list or notation declaration up to its `>`,
 * stepping over quoted literals.
 */
function skipDeclaration(scanner: Scanner): void {
  for (;;) {
    const char = scanner.peek();
    if (char === 0x3e) {
      scanner.pos++;
      return;
    }
    if (char === 0x22 || char === 0x27) {
      scanner.readQuoted();
    } else if (Number.isNaN(char)) {
      scanner.fail("MALFORMED_XML", "Unterminated declaration in the doctype");
    } else {
      scanner.pos = scanner.checkChar(scanner.pos);
    }
  }
}
