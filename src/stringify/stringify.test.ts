import { describe, expect, test } from "vitest";
import type {
  SvgChild,
  SvgDocument,
  SvgElement,
  SvgNode,
  XmlDeclaration,
} from "../ast";
import { stringify } from "./stringify";

function element(
  name: string,
  attributes: Record<string, string> = {},
  children: SvgNode[] = [],
): SvgElement {
  return { type: "element", name, attributes, children };
}

function document(...children: SvgDocument["children"]): SvgDocument {
  return { type: "document", children };
}

describe("documents", () => {
  test("writes every kind of node", () => {
    expect(
      stringify({
        type: "document",
        declaration: { version: "1.0", encoding: "UTF-8", standalone: "no" },
        children: [
          { type: "text", value: "\n" },
          { type: "doctype", value: "svg [<!ENTITY a 'b'>]" },
          { type: "comment", value: " logo " },
          {
            type: "instruction",
            target: "xml-stylesheet",
            value: 'href="a.css"',
          },
          element("svg", { viewBox: "0 0 24 24" }, [
            { type: "text", value: "\n  " },
            element("style", {}, [{ type: "cdata", value: "a > b {}" }]),
            element("circle", { r: "8" }),
            { type: "instruction", target: "pi", value: "" },
          ]),
          { type: "text", value: "\n" },
        ],
      }),
    ).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
        "<!DOCTYPE svg [<!ENTITY a 'b'>]>" +
        "<!-- logo -->" +
        '<?xml-stylesheet href="a.css"?>' +
        '<svg viewBox="0 0 24 24">\n  <style><![CDATA[a > b {}]]></style><circle r="8"/><?pi?></svg>\n',
    );
  });

  test("writes only the version of a declaration", () => {
    expect(
      stringify({
        type: "document",
        declaration: { version: "1.1" },
        children: [element("svg")],
      }),
    ).toBe('<?xml version="1.1"?><svg/>');
  });

  test("keeps the order of attributes", () => {
    expect(stringify(element("svg", { z: "1", a: "2", m: "3" }))).toBe(
      '<svg z="1" a="2" m="3"/>',
    );
  });

  test("writes a single node", () => {
    expect(stringify(element("g", {}, [element("path")]))).toBe(
      "<g><path/></g>",
    );
    expect(stringify({ type: "text", value: "a < b" })).toBe("a &lt; b");
  });

  test.each([
    [document(), "no root element"],
    [document(element("a"), element("b")), "two root elements"],
    [
      document(element("svg"), { type: "doctype", value: "svg" }),
      "doctype after the root",
    ],
    [
      document({ type: "text", value: "x" }, element("svg")),
      "text outside the root",
    ],
  ])("rejects a document with %#: %s", (input) => {
    expect(() => stringify(input)).toThrow(TypeError);
  });

  test.each<[Record<string, string>, string]>([
    [{ version: "2.0" }, "version"],
    [{ version: "1.0", encoding: "UTF 8" }, "encoding"],
    [{ version: "1.0", standalone: "maybe" }, "standalone"],
  ])("rejects an invalid declaration %#: %s", (declaration) => {
    expect(() =>
      stringify({
        type: "document",
        declaration: declaration as unknown as XmlDeclaration,
        children: [element("svg")],
      }),
    ).toThrow(TypeError);
  });
});

describe("escaping", () => {
  test("escapes text", () => {
    expect(stringify({ type: "text", value: `a & b < c > d "e" 'f'` })).toBe(
      `a &amp; b &lt; c &gt; d "e" 'f'`,
    );
  });

  test("escapes attribute values", () => {
    expect(stringify(element("svg", { a: `a & b < c > d "e" 'f'` }))).toBe(
      `<svg a="a &amp; b &lt; c > d &quot;e&quot; 'f'"/>`,
    );
  });

  test("keeps line breaks and tabs in text, except \\r", () => {
    expect(stringify({ type: "text", value: "a\n\tb\rc" })).toBe(
      "a\n\tb&#13;c",
    );
  });

  test("escapes whitespace that parse() would turn into spaces", () => {
    expect(stringify(element("svg", { a: "a\n\tb\rc d" }))).toBe(
      '<svg a="a&#10;&#9;b&#13;c d"/>',
    );
  });

  test("returns text without special characters unchanged", () => {
    expect(stringify({ type: "text", value: "😀 abc é" })).toBe("😀 abc é");
  });

  test.each([
    ["\u0000", "NUL"],
    ["\u0001", "control character"],
    ["\uD800", "lone high surrogate"],
    ["\uDC00a", "lone low surrogate"],
    ["￾", "non-character"],
  ])("rejects %j (%s) in text and attributes", (value) => {
    expect(() => stringify({ type: "text", value })).toThrow(TypeError);
    expect(() => stringify(element("svg", { a: value }))).toThrow(TypeError);
  });
});

describe("checks", () => {
  test.each([
    ["1a", "starting with a digit"],
    ["", "empty"],
    ["a b", "with a space"],
  ])("rejects an element name %j (%s)", (name) => {
    expect(() => stringify(element(name))).toThrow(TypeError);
    expect(() => stringify(element("svg", { [name]: "1" }))).toThrow(TypeError);
  });

  test("rejects attribute values that are not strings", () => {
    const svg = element("svg");
    (svg.attributes as Record<string, unknown>).r = 8;
    expect(() => stringify(svg)).toThrow(TypeError);
  });

  test.each<[SvgChild, string]>([
    [{ type: "comment", value: "a--b" }, "'--' in a comment"],
    [{ type: "comment", value: "a-" }, "comment ending with '-'"],
    [{ type: "comment", value: "a\rb" }, "'\\r' in a comment"],
    [{ type: "cdata", value: "a]]>b" }, "']]>' in CDATA"],
    [{ type: "cdata", value: "\u0000" }, "invalid character in CDATA"],
    [{ type: "instruction", target: "xml", value: "" }, "target 'xml'"],
    [{ type: "instruction", target: "XmL", value: "" }, "target 'XmL'"],
    [{ type: "instruction", target: "1", value: "" }, "invalid target"],
    [{ type: "instruction", target: "pi", value: "a?>b" }, "'?>' in a PI"],
    [{ type: "instruction", target: "pi", value: " a" }, "leading whitespace"],
    [{ type: "doctype", value: "svg\r" }, "'\\r' in a doctype"],
    [{ type: "unknown" } as unknown as SvgChild, "unknown node type"],
  ])("rejects %j (%s)", (node) => {
    expect(() => stringify(node)).toThrow(TypeError);
  });
});
