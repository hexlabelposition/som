import type { SvgCData, SvgComment, SvgInstruction } from "../ast";
import { checkNoColon } from "./namespaces";
import type { Scanner } from "./scanner";

/**
 * Reads `<!-- … -->`. The content cannot contain `--`.
 */
export function readComment(scanner: Scanner): SvgComment {
  const start = scanner.pos + 4;
  const end = scanner.input.indexOf("--", start);
  if (end === -1) scanner.fail("MALFORMED_XML", "Unterminated comment");
  if (scanner.input.charCodeAt(end + 2) !== 0x3e) {
    scanner.fail("MALFORMED_XML", "'--' is not allowed in a comment", end);
  }
  scanner.checkChars(start, end);
  scanner.pos = end + 3;
  return { type: "comment", value: scanner.slice(start, end) };
}

/**
 * Reads `<?target value?>`. The target cannot be `xml` in any case, which is
 * reserved for the XML declaration at the very start.
 */
export function readInstruction(scanner: Scanner): SvgInstruction {
  const start = scanner.pos;
  scanner.pos += 2;
  const target = scanner.readName();
  checkNoColon(scanner, target, start + 2);
  if (target.toLowerCase() === "xml") {
    scanner.fail(
      "MALFORMED_XML",
      "The XML declaration is only allowed at the start of the document",
      start,
    );
  }

  if (scanner.eat("?>")) return { type: "instruction", target, value: "" };

  scanner.requireWhitespace();
  const valueStart = scanner.pos;
  const end = scanner.input.indexOf("?>", valueStart);
  if (end === -1) {
    scanner.fail("MALFORMED_XML", "Unterminated processing instruction", start);
  }
  scanner.checkChars(valueStart, end);
  scanner.pos = end + 2;
  return { type: "instruction", target, value: scanner.slice(valueStart, end) };
}

/**
 * Reads `<![CDATA[ … ]]>`.
 */
export function readCData(scanner: Scanner): SvgCData {
  const start = scanner.pos + 9;
  const end = scanner.input.indexOf("]]>", start);
  if (end === -1) {
    scanner.fail("MALFORMED_XML", "Unterminated CDATA section", scanner.pos);
  }
  scanner.checkChars(start, end);
  scanner.pos = end + 3;
  return { type: "cdata", value: scanner.slice(start, end) };
}
