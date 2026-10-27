import type {
  SvgComment,
  SvgDocument,
  SvgElement,
  SvgInstruction,
  SvgText,
} from "../ast";
import { isDeclarationStart, readDeclaration } from "./declaration";
import { readDoctype } from "./doctype";
import { Entities, readReference } from "./entities";
import { MAX_DEPTH, MAX_INPUT_LENGTH } from "./limits";
import { readCData, readComment, readInstruction } from "./markup";
import { Namespaces } from "./namespaces";
import { Scanner } from "./scanner";

interface OpenElement {
  element: SvgElement;
  /**
   * Where the start tag begins, for errors about unclosed elements.
   */
  offset: number;
  /**
   * The namespace declarations to restore when the element closes.
   */
  namespaceMark: number;
}

/**
 * Parses SVG markup into a document tree.
 *
 * Parsing is strict: the input must be well-formed XML with declared namespace
 * prefixes. Any root element is accepted, not only `<svg>`. Everything that
 * `stringify()` needs to write the document back is kept, including
 * whitespace between elements, comments, CDATA sections, processing
 * instructions, the XML declaration and the doctype.
 *
 * Character and entity references are decoded. Text entities declared in the
 * doctype are expanded; external entities are never loaded. Line breaks are
 * normalized to `\n`, and whitespace characters in attribute values become
 * spaces, as XML requires. A leading byte order mark is skipped.
 *
 * @example
 * ```ts
 * const document = parse('<svg viewBox="0 0 24 24"><circle r="8"/></svg>');
 * const svg = getRoot(document);
 * svg.attributes.viewBox; // "0 0 24 24"
 * ```
 *
 * @throws {SvgParseError} If the input is not well-formed XML, has no root
 *   element, uses an undeclared prefix, or refers to an entity that is
 *   undefined, external or contains markup.
 */
export function parse(input: string): SvgDocument {
  if (typeof input !== "string") {
    throw new TypeError("parse() expects a string");
  }

  const scanner: Scanner = new Scanner(input);
  if (input.length > MAX_INPUT_LENGTH) {
    scanner.fail(
      "MAX_INPUT_LENGTH_EXCEEDED",
      `Input is longer than ${String(MAX_INPUT_LENGTH)} characters`,
      MAX_INPUT_LENGTH,
    );
  }
  if (input.charCodeAt(0) === 0xfeff) scanner.pos = 1;

  const document: SvgDocument = { type: "document", children: [] };
  if (isDeclarationStart(scanner)) {
    document.declaration = readDeclaration(scanner);
  }

  const namespaces = new Namespaces();
  const open: OpenElement[] = [];
  let entities = new Entities();
  let root: SvgElement | undefined;
  let doctype = false;

  const add = (
    node: SvgElement | SvgText | SvgComment | SvgInstruction,
  ): void => {
    const parent = open.at(-1)?.element;
    if (parent === undefined) document.children.push(node);
    else parent.children.push(node);
  };

  while (scanner.pos < input.length) {
    const parent = open.at(-1)?.element;

    if (scanner.peek() !== 0x3c) {
      if (parent === undefined) {
        add({ type: "text", value: readDocumentWhitespace(scanner) });
      } else {
        const value = readText(scanner, entities);
        // An entity with empty replacement text leaves no text behind.
        if (value !== "") add({ type: "text", value });
      }
      continue;
    }

    const offset = scanner.pos;
    const next = input.charCodeAt(offset + 1);

    if (next === 0x2f) {
      const name = readEndTag(scanner);
      const current = open.pop();
      if (current === undefined) {
        scanner.fail("MALFORMED_XML", `Unexpected end tag </${name}>`, offset);
      }
      if (current.element.name !== name) {
        scanner.fail(
          "MALFORMED_XML",
          `Expected </${current.element.name}>, found </${name}>`,
          offset,
        );
      }
      namespaces.reset(current.namespaceMark);
    } else if (next === 0x3f) {
      add(readInstruction(scanner));
    } else if (next === 0x21) {
      if (scanner.startsWith("<!--")) {
        add(readComment(scanner));
      } else if (scanner.startsWith("<![CDATA[")) {
        if (parent === undefined) {
          scanner.fail(
            "MALFORMED_XML",
            "CDATA is only allowed inside elements",
          );
        }
        parent.children.push(readCData(scanner));
      } else if (scanner.startsWith("<!DOCTYPE")) {
        if (parent !== undefined || root !== undefined || doctype) {
          scanner.fail(
            "MALFORMED_XML",
            "The doctype is only allowed once, before the root element",
          );
        }
        const result = readDoctype(scanner);
        document.children.push(result.doctype);
        entities = result.entities;
        doctype = true;
      } else {
        scanner.fail("MALFORMED_XML", "Malformed markup");
      }
    } else {
      if (parent === undefined && root !== undefined) {
        scanner.fail("MALFORMED_XML", "Only one root element is allowed");
      }
      if (open.length >= MAX_DEPTH) {
        scanner.fail(
          "MAX_DEPTH_EXCEEDED",
          `Elements are nested deeper than ${String(MAX_DEPTH)} levels`,
        );
      }
      const namespaceMark = namespaces.mark;
      const { element, selfClosing } = readStartTag(
        scanner,
        entities,
        namespaces,
      );
      add(element);
      root ??= element;
      if (selfClosing) namespaces.reset(namespaceMark);
      else open.push({ element, offset, namespaceMark });
    }
  }

  const unclosed = open.at(-1);
  if (unclosed !== undefined) {
    scanner.fail(
      "MALFORMED_XML",
      `Element <${unclosed.element.name}> is not closed`,
      unclosed.offset,
    );
  }
  if (root === undefined) {
    scanner.fail("MISSING_ROOT", "The document has no root element");
  }

  return document;
}

/**
 * Reads whitespace outside the root element, where text is not allowed.
 */
function readDocumentWhitespace(scanner: Scanner): string {
  const start = scanner.pos;
  if (!scanner.skipWhitespace()) {
    scanner.fail(
      "MALFORMED_XML",
      "Text is not allowed outside the root element",
    );
  }
  return scanner.slice(start, scanner.pos);
}

/**
 * Reads text inside an element up to the next `<`, decoding references.
 */
function readText(scanner: Scanner, entities: Entities): string {
  const input = scanner.input;
  let value = "";
  let chunkStart = scanner.pos;
  let index = chunkStart;

  for (;;) {
    const char = input.charCodeAt(index);

    if (
      char >= 0x20 &&
      char < 0xd800 &&
      char !== 0x3c &&
      char !== 0x26 &&
      char !== 0x3e
    ) {
      index++;
    } else if (char === 0x3c || Number.isNaN(char)) {
      break;
    } else if (char === 0x26) {
      value += scanner.slice(chunkStart, index);
      scanner.pos = index;
      value += readReference(scanner, entities, false);
      index = chunkStart = scanner.pos;
    } else if (char === 0x3e) {
      if (
        index - chunkStart >= 2 &&
        input.charCodeAt(index - 1) === 0x5d &&
        input.charCodeAt(index - 2) === 0x5d
      ) {
        scanner.fail(
          "MALFORMED_XML",
          "']]>' is not allowed in text",
          index - 2,
        );
      }
      index++;
    } else {
      index = scanner.checkChar(index);
    }
  }

  scanner.pos = index;
  return value + scanner.slice(chunkStart, index);
}

/**
 * Reads a start tag or an empty-element tag and checks its namespaces.
 */
function readStartTag(
  scanner: Scanner,
  entities: Entities,
  namespaces: Namespaces,
): { element: SvgElement; selfClosing: boolean } {
  scanner.pos++;
  const nameOffset = scanner.pos;
  const name = scanner.readName();
  const attributes: Record<string, string> = {};
  // Prefixed attribute names with their offsets, checked once all
  // declarations of the tag are known.
  let prefixed: [string, number][] | undefined;
  let selfClosing: boolean;

  for (;;) {
    const whitespace = scanner.skipWhitespace();
    const char = scanner.peek();

    if (char === 0x3e) {
      scanner.pos++;
      selfClosing = false;
      break;
    }
    if (char === 0x2f) {
      scanner.expect("/>");
      selfClosing = true;
      break;
    }
    if (!whitespace) {
      scanner.fail(
        "MALFORMED_XML",
        `Expected whitespace, '>' or '/>' in <${name}>${scanner.found()}`,
      );
    }

    const offset = scanner.pos;
    const attribute = scanner.readName();
    scanner.skipWhitespace();
    scanner.expect("=");
    scanner.skipWhitespace();
    const value = readAttributeValue(scanner, entities);

    if (Object.hasOwn(attributes, attribute)) {
      scanner.fail(
        "MALFORMED_XML",
        `Duplicate attribute '${attribute}'`,
        offset,
      );
    }
    setAttribute(attributes, attribute, value);

    if (attribute === "xmlns" || attribute.startsWith("xmlns:")) {
      namespaces.declare(scanner, attribute, value, offset);
    } else if (attribute.includes(":")) {
      (prefixed ??= []).push([attribute, offset]);
    }
  }

  namespaces.checkElement(scanner, name, nameOffset);
  if (prefixed !== undefined) namespaces.checkAttributes(scanner, prefixed);

  return {
    element: { type: "element", name, attributes, children: [] },
    selfClosing,
  };
}

/**
 * Sets an attribute as an own property, also when it is named `__proto__`.
 */
function setAttribute(
  attributes: Record<string, string>,
  name: string,
  value: string,
): void {
  if (name === "__proto__") {
    Object.defineProperty(attributes, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    attributes[name] = value;
  }
}

/**
 * Reads a quoted attribute value, decoding references and turning tabs and
 * line breaks into spaces.
 */
function readAttributeValue(scanner: Scanner, entities: Entities): string {
  const quote = scanner.peek();
  if (quote !== 0x22 && quote !== 0x27) {
    scanner.fail(
      "MALFORMED_XML",
      `Expected a quoted attribute value${scanner.found()}`,
    );
  }

  const input = scanner.input;
  let value = "";
  let chunkStart = scanner.pos + 1;
  let index = chunkStart;
  let whitespace = false;

  for (;;) {
    const char = input.charCodeAt(index);

    if (char === quote) break;
    if (char >= 0x20 && char < 0xd800 && char !== 0x3c && char !== 0x26) {
      index++;
    } else if (char === 0x26) {
      value += attributeChunk(input, chunkStart, index, whitespace);
      whitespace = false;
      scanner.pos = index;
      value += readReference(scanner, entities, true);
      index = chunkStart = scanner.pos;
    } else if (char === 0x3c) {
      scanner.fail(
        "MALFORMED_XML",
        "'<' is not allowed in attribute values",
        index,
      );
    } else if (Number.isNaN(char)) {
      scanner.fail(
        "MALFORMED_XML",
        "Unterminated attribute value",
        scanner.pos,
      );
    } else {
      if (char === 0x9 || char === 0xa || char === 0xd) whitespace = true;
      index = scanner.checkChar(index);
    }
  }

  scanner.pos = index + 1;
  return value + attributeChunk(input, chunkStart, index, whitespace);
}

function attributeChunk(
  input: string,
  start: number,
  end: number,
  whitespace: boolean,
): string {
  const chunk = input.slice(start, end);
  return whitespace ? chunk.replace(/\r\n|[\t\n\r]/g, " ") : chunk;
}

/**
 * Reads `</name>` and returns the name.
 */
function readEndTag(scanner: Scanner): string {
  scanner.pos += 2;
  const name = scanner.readName();
  scanner.skipWhitespace();
  scanner.expect(">");
  return name;
}
