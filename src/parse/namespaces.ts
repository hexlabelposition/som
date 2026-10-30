import { isNameStartChar } from "../shared";
import type { Scanner } from "./scanner";

const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/**
 * The namespace prefixes declared on the open elements.
 *
 * URIs are only used to check the document; they are not stored in the tree.
 */
export class Namespaces {
  private readonly prefixes: string[] = [];
  private readonly uris: string[] = [];

  /**
   * The current depth of declarations, to restore with `reset()` when the
   * element that declared them closes.
   */
  get mark(): number {
    return this.prefixes.length;
  }

  reset(mark: number): void {
    this.prefixes.length = mark;
    this.uris.length = mark;
  }

  lookup(prefix: string): string | undefined {
    if (prefix === "xml") return XML_NAMESPACE;
    for (let index = this.prefixes.length - 1; index >= 0; index--) {
      if (this.prefixes[index] === prefix) return this.uris[index];
    }
    return undefined;
  }

  /**
   * Handles an `xmlns` or `xmlns:prefix` attribute.
   */
  declare(scanner: Scanner, name: string, uri: string, offset: number): void {
    if (name === "xmlns") {
      if (uri === XML_NAMESPACE || uri === XMLNS_NAMESPACE) {
        scanner.fail(
          "MALFORMED_XML",
          `${uri} cannot be the default namespace`,
          offset,
        );
      }
      return;
    }

    checkQualifiedName(scanner, name, offset);
    const prefix = name.slice(6);
    if (prefix === "xmlns") {
      scanner.fail(
        "MALFORMED_XML",
        "The xmlns prefix cannot be declared",
        offset,
      );
    }
    if (uri === "") {
      scanner.fail(
        "MALFORMED_XML",
        `Prefix '${prefix}' cannot be bound to an empty namespace`,
        offset,
      );
    }
    if (
      (prefix === "xml") !== (uri === XML_NAMESPACE) ||
      uri === XMLNS_NAMESPACE
    ) {
      scanner.fail(
        "MALFORMED_XML",
        `Prefix '${prefix}' cannot be bound to ${uri}`,
        offset,
      );
    }
    this.prefixes.push(prefix);
    this.uris.push(uri);
  }

  /**
   * Checks that the prefix of an element name is declared.
   */
  checkElement(scanner: Scanner, name: string, offset: number): void {
    const colon = checkQualifiedName(scanner, name, offset);
    if (colon === -1) return;

    const prefix = name.slice(0, colon);
    if (prefix === "xmlns") {
      scanner.fail(
        "MALFORMED_XML",
        "The xmlns prefix cannot be used for elements",
        offset,
      );
    }
    if (this.lookup(prefix) === undefined) {
      scanner.fail(
        "UNDECLARED_PREFIX",
        `Undeclared prefix '${prefix}'`,
        offset,
      );
    }
  }

  /**
   * Checks that the prefixes of attribute names are declared and that no two
   * attributes have the same local name in the same namespace.
   */
  checkAttributes(scanner: Scanner, attributes: [string, number][]): void {
    const seen = attributes.length > 1 ? new Set<string>() : undefined;

    for (const [name, offset] of attributes) {
      const colon = checkQualifiedName(scanner, name, offset);
      const prefix = name.slice(0, colon);
      const uri = this.lookup(prefix);
      if (uri === undefined) {
        scanner.fail(
          "UNDECLARED_PREFIX",
          `Undeclared prefix '${prefix}'`,
          offset,
        );
      }

      if (seen !== undefined) {
        const key = `${uri} ${name.slice(colon + 1)}`;
        if (seen.has(key)) {
          scanner.fail(
            "MALFORMED_XML",
            `Attribute '${name}' repeats another attribute in the same namespace`,
            offset,
          );
        }
        seen.add(key);
      }
    }
  }
}

/**
 * Checks that a name has at most one colon, with a name on both sides of it,
 * and returns the index of the colon or -1.
 */
export function checkQualifiedName(
  scanner: Scanner,
  name: string,
  offset: number,
): number {
  const colon = name.indexOf(":");
  if (colon === -1) return -1;

  const local = name.codePointAt(colon + 1);
  if (
    colon === 0 ||
    local === undefined ||
    !isNameStartChar(local) ||
    name.includes(":", colon + 1)
  ) {
    scanner.fail("MALFORMED_XML", `Invalid qualified name '${name}'`, offset);
  }
  return colon;
}

/**
 * Checks that a name has no colon, as required for PI targets and entity
 * names.
 */
export function checkNoColon(
  scanner: Scanner,
  name: string,
  offset: number,
): void {
  if (name.includes(":")) {
    scanner.fail("MALFORMED_XML", `Name '${name}' cannot contain ':'`, offset);
  }
}
