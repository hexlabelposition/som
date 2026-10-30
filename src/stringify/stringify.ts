import type { SvgChild, SvgDocument, SvgElement, XmlDeclaration } from "../ast";
import { isXmlWhitespace, scanName } from "../shared";
import { checkRaw, escapeAttribute, escapeText } from "./escape";

/**
 * Writes a document or a single node as SVG markup.
 *
 * The tree is written as it is: no indentation is added and no whitespace is
 * removed. Text and attribute values are escaped where needed, attributes are
 * written in double quotes, and elements without children are written as
 * `<name/>`. For any document from `parse()`, `parse(stringify(document))` is
 * deeply equal to `document`.
 *
 * Trees built or edited by hand are checked, so the output is always
 * well-formed XML that `parse()` reads back to the same tree.
 *
 * @example
 * ```ts
 * const document = parse('<svg viewBox="0 0 24 24"><circle r="8"/></svg>');
 * getRoot(document).attributes.fill = "currentColor";
 * stringify(document);
 * // '<svg viewBox="0 0 24 24" fill="currentColor"><circle r="8"/></svg>'
 *
 * // A single element, without anything around the root.
 * stringify(getRoot(document));
 * ```
 *
 * @throws {TypeError} If the tree cannot be written so that it reads back the
 *   same: a name that is not a valid XML name, a character not allowed in
 *   XML, `--` in a comment, `]]>` in CDATA, `?>` in a processing instruction,
 *   text other than spaces, tabs and line feeds outside the root element, or a document without
 *   exactly one root element.
 */
export function stringify(node: SvgDocument | SvgChild): string {
  return node.type === "document" ? writeDocument(node) : writeChild(node, "");
}

function writeDocument(document: SvgDocument): string {
  let output =
    document.declaration === undefined
      ? ""
      : writeDeclaration(document.declaration);
  let root = false;

  for (const child of document.children) {
    if (child.type === "element") {
      if (root) throw new TypeError("Document has more than one root element");
      root = true;
    } else if (child.type === "doctype" && root) {
      throw new TypeError("The doctype must come before the root element");
    } else if (child.type === "text" && !isDocumentWhitespace(child.value)) {
      throw new TypeError(
        "Text outside the root element must be spaces, tabs or line feeds",
      );
    }
    output = writeChild(child, output);
  }

  if (!root) throw new TypeError("Document has no root element");
  return output;
}

function writeDeclaration(declaration: XmlDeclaration): string {
  const { version, encoding } = declaration;
  // Typed as a string, since hand-built trees can hold any value.
  const standalone: string | undefined = declaration.standalone;
  if (!/^1\.[0-9]+$/.test(version)) {
    throw new TypeError(`Invalid XML version ${JSON.stringify(version)}`);
  }
  let output = `<?xml version="${version}"`;

  if (encoding !== undefined) {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(encoding)) {
      throw new TypeError(`Invalid encoding name ${JSON.stringify(encoding)}`);
    }
    output += ` encoding="${encoding}"`;
  }
  if (standalone !== undefined) {
    if (standalone !== "yes" && standalone !== "no") {
      throw new TypeError("standalone must be 'yes' or 'no'");
    }
    output += ` standalone="${standalone}"`;
  }

  return `${output}?>`;
}

/**
 * Appends a node to `output` and returns the result.
 */
function writeChild(node: SvgChild, output: string): string {
  switch (node.type) {
    case "element":
      return writeElement(node, output);
    case "text":
      return output + escapeText(node.value);
    case "cdata":
      checkRaw(node.value, "CDATA section");
      if (node.value.includes("]]>")) {
        throw new TypeError("A CDATA section cannot contain ']]>'");
      }
      return `${output}<![CDATA[${node.value}]]>`;
    case "comment":
      checkRaw(node.value, "comment");
      if (node.value.includes("--") || node.value.endsWith("-")) {
        throw new TypeError("A comment cannot contain '--' or end with '-'");
      }
      return `${output}<!--${node.value}-->`;
    case "instruction":
      return output + writeInstruction(node.target, node.value);
    case "doctype":
      checkRaw(node.value, "doctype");
      return `${output}<!DOCTYPE ${node.value}>`;
    default:
      throw new TypeError(
        `Unknown node type ${JSON.stringify((node as { type: unknown }).type)}`,
      );
  }
}

function writeElement(element: SvgElement, output: string): string {
  checkName(element.name, "element");
  let result = `${output}<${element.name}`;

  for (const name of Object.keys(element.attributes)) {
    const value = element.attributes[name];
    checkName(name, "attribute");
    if (typeof value !== "string") {
      throw new TypeError(`Value of attribute '${name}' must be a string`);
    }
    result += ` ${name}="${escapeAttribute(value)}"`;
  }

  if (element.children.length === 0) return `${result}/>`;

  result += ">";
  for (const child of element.children) result = writeChild(child, result);
  return `${result}</${element.name}>`;
}

function writeInstruction(target: string, value: string): string {
  checkName(target, "processing instruction target");
  if (target.toLowerCase() === "xml") {
    throw new TypeError("A processing instruction target cannot be 'xml'");
  }
  if (value === "") return `<?${target}?>`;

  checkRaw(value, "processing instruction");
  if (value.includes("?>")) {
    throw new TypeError("A processing instruction cannot contain '?>'");
  }
  if (isXmlWhitespace(value.charCodeAt(0))) {
    throw new TypeError(
      "A processing instruction value cannot start with whitespace",
    );
  }
  return `<?${target} ${value}?>`;
}

function checkName(name: string, kind: string): void {
  if (name === "" || scanName(name, 0) !== name.length) {
    throw new TypeError(`Invalid ${kind} name ${JSON.stringify(name)}`);
  }
}

/**
 * Checks that text can stand outside the root element. `\r` is not allowed:
 * `parse()` would turn it into `\n`, and the reference `&#13;` is not allowed
 * there.
 */
function isDocumentWhitespace(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const char = text.charCodeAt(index);
    if (char !== 0x20 && char !== 0x9 && char !== 0xa) return false;
  }
  return true;
}
