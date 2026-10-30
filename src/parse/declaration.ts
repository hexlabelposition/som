import type { XmlDeclaration } from "../ast";
import { isXmlWhitespace } from "../shared";
import type { Scanner } from "./scanner";

/**
 * Checks whether the input continues with an XML declaration, `<?xml` followed
 * by whitespace.
 */
export function isDeclarationStart(scanner: Scanner): boolean {
  return (
    scanner.startsWith("<?xml") &&
    isXmlWhitespace(scanner.input.charCodeAt(scanner.pos + 5))
  );
}

/**
 * Reads `<?xml version="…" encoding="…" standalone="…"?>`.
 */
export function readDeclaration(scanner: Scanner): XmlDeclaration {
  scanner.pos += 5;
  scanner.requireWhitespace();

  const version = readPseudoAttribute(scanner, "version");
  if (!/^1\.[0-9]+$/.test(version)) {
    scanner.fail("MALFORMED_XML", `Unsupported XML version '${version}'`);
  }
  const declaration: XmlDeclaration = { version };

  let whitespace = scanner.skipWhitespace();
  if (whitespace && scanner.startsWith("encoding")) {
    const encoding = readPseudoAttribute(scanner, "encoding");
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(encoding)) {
      scanner.fail("MALFORMED_XML", `Invalid encoding name '${encoding}'`);
    }
    declaration.encoding = encoding;
    whitespace = scanner.skipWhitespace();
  }

  if (whitespace && scanner.startsWith("standalone")) {
    const standalone = readPseudoAttribute(scanner, "standalone");
    if (standalone !== "yes" && standalone !== "no") {
      scanner.fail("MALFORMED_XML", "standalone must be 'yes' or 'no'");
    }
    declaration.standalone = standalone;
    scanner.skipWhitespace();
  }

  scanner.expect("?>");
  return declaration;
}

function readPseudoAttribute(scanner: Scanner, name: string): string {
  scanner.expect(name);
  scanner.skipWhitespace();
  scanner.expect("=");
  scanner.skipWhitespace();
  return scanner.readQuoted();
}
