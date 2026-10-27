import { describe, expect, test } from "vitest";
import type { SvgDocument, SvgElement } from "../ast";
import { SvgParseError, type SvgParseErrorCode } from "./errors";
import { parse } from "./parse";

function rootOf(document: SvgDocument): SvgElement {
  const root = document.children.find((node) => node.type === "element");
  if (root === undefined) throw new Error("No root element");
  return root;
}

function expectError(
  input: string,
  code: SvgParseErrorCode,
  offset?: number,
): void {
  let error: unknown;
  try {
    parse(input);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(SvgParseError);
  expect((error as SvgParseError).code).toBe(code);
  if (offset !== undefined)
    expect((error as SvgParseError).offset).toBe(offset);
}

describe("structure", () => {
  test("parses elements, attributes and text", () => {
    expect(parse('<svg a="1"><g><text>Hi</text></g><path/></svg>')).toEqual({
      type: "document",
      children: [
        {
          type: "element",
          name: "svg",
          attributes: { a: "1" },
          children: [
            {
              type: "element",
              name: "g",
              attributes: {},
              children: [
                {
                  type: "element",
                  name: "text",
                  attributes: {},
                  children: [{ type: "text", value: "Hi" }],
                },
              ],
            },
            { type: "element", name: "path", attributes: {}, children: [] },
          ],
        },
      ],
    });
  });

  test("keeps whitespace inside and around the root element", () => {
    const document = parse("\n<svg>\n  <g/>\n</svg>\n");
    expect(document.children.map((node) => node.type)).toEqual([
      "text",
      "element",
      "text",
    ]);
    expect(rootOf(document).children).toEqual([
      { type: "text", value: "\n  " },
      { type: "element", name: "g", attributes: {}, children: [] },
      { type: "text", value: "\n" },
    ]);
  });

  test("accepts any root element", () => {
    expect(rootOf(parse("<symbol/>")).name).toBe("symbol");
  });

  test("keeps comments, CDATA and processing instructions", () => {
    const document = parse(
      '<?xml-stylesheet href="a.css"?><!-- a --><svg><style><![CDATA[a > b]]></style><?pi?></svg>',
    );
    expect(document.children.slice(0, 2)).toEqual([
      { type: "instruction", target: "xml-stylesheet", value: 'href="a.css"' },
      { type: "comment", value: " a " },
    ]);
    const svg = rootOf(document);
    expect((svg.children[0] as SvgElement).children).toEqual([
      { type: "cdata", value: "a > b" },
    ]);
    expect(svg.children[1]).toEqual({
      type: "instruction",
      target: "pi",
      value: "",
    });
  });

  test("keeps the order of attributes", () => {
    const svg = rootOf(parse('<svg z="1" a="2" m="3"/>'));
    expect(Object.keys(svg.attributes)).toEqual(["z", "a", "m"]);
  });

  test("stores an attribute named __proto__ as an own property", () => {
    const svg = rootOf(parse('<svg __proto__="x"/>'));
    expect(Object.keys(svg.attributes)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(svg.attributes)).toBe(Object.prototype);
  });

  test("skips a byte order mark", () => {
    expect(parse("\uFEFF<svg/>").children).toHaveLength(1);
  });
});

describe("XML declaration", () => {
  test("reads all fields", () => {
    expect(
      parse('<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg/>')
        .declaration,
    ).toEqual({ version: "1.0", encoding: "UTF-8", standalone: "no" });
  });

  test("reads only the version", () => {
    expect(parse("<?xml version='1.1' ?><svg/>").declaration).toEqual({
      version: "1.1",
    });
  });

  test("is absent when not written", () => {
    expect(parse("<svg/>")).not.toHaveProperty("declaration");
  });

  test.each([
    ['<?xml encoding="UTF-8"?><svg/>', "missing version"],
    ['<?xml version="2.0"?><svg/>', "unsupported version"],
    ['<?xml version="1.0" standalone="maybe"?><svg/>', "invalid standalone"],
    ['<?xml version="1.0" standalone="no" encoding="UTF-8"?><svg/>', "order"],
    ['<?xml version="1.0"encoding="UTF-8"?><svg/>', "missing whitespace"],
    [' <?xml version="1.0"?><svg/>', "not at the start"],
    ['<svg/><?xml version="1.0"?>', "after the root"],
    ['<?XML version="1.0"?><svg/>', "uppercase target"],
  ])("rejects %j (%s)", (input) => {
    expectError(input, "MALFORMED_XML");
  });
});

describe("doctype", () => {
  test("keeps the doctype as written", () => {
    const doctype =
      'svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"';
    expect(parse(`<!DOCTYPE ${doctype}>\n<svg/>`).children[0]).toEqual({
      type: "doctype",
      value: doctype,
    });
  });

  test("keeps the internal subset", () => {
    const doctype = 'svg [\n  <!ENTITY a "b">\n  <!ATTLIST svg x CDATA "1">\n]';
    expect(parse(`<!DOCTYPE ${doctype}><svg/>`).children[0]).toEqual({
      type: "doctype",
      value: doctype,
    });
  });

  test("does not apply attribute defaults", () => {
    const svg = rootOf(
      parse('<!DOCTYPE svg [<!ATTLIST svg x CDATA "1">]><svg/>'),
    );
    expect(svg.attributes).toEqual({});
  });

  test.each([
    ["<svg/><!DOCTYPE svg>", "after the root"],
    ["<!DOCTYPE svg><!DOCTYPE svg><svg/>", "twice"],
    ["<svg><!DOCTYPE svg></svg>", "inside an element"],
    ['<!DOCTYPE svg [<!ENTITY a "b">><svg/>', "unclosed subset"],
    ["<!DOCTYPE svg [<!FOO>]><svg/>", "unknown declaration"],
    ['<!DOCTYPE svg PUBLIC "a{b" "c"><svg/>', "invalid public ID"],
  ])("rejects %j (%s)", (input) => {
    expectError(input, "MALFORMED_XML");
  });
});

describe("references", () => {
  test("decodes predefined entities and character references", () => {
    const svg = rootOf(
      parse('<svg t="&lt;&#65;&#x42;&quot;">&amp;&gt;&apos;&#x1F600;</svg>'),
    );
    expect(svg.attributes.t).toBe('<AB"');
    expect(svg.children).toEqual([{ type: "text", value: "&>'😀" }]);
  });

  test("expands text entities from the internal subset", () => {
    const document = parse(
      '<!DOCTYPE svg [<!ENTITY ns "http://example.com/&inner;"><!ENTITY inner "x&#38;#38;y">]><svg a="&ns;">&ns;</svg>',
    );
    const svg = rootOf(document);
    expect(svg.attributes.a).toBe("http://example.com/x&y");
    expect(svg.children).toEqual([
      { type: "text", value: "http://example.com/x&y" },
    ]);
  });

  test("keeps the first declaration of an entity", () => {
    const svg = rootOf(
      parse('<!DOCTYPE svg [<!ENTITY a "1"><!ENTITY a "2">]><svg>&a;</svg>'),
    );
    expect(svg.children).toEqual([{ type: "text", value: "1" }]);
  });

  test("leaves no text node for an empty entity", () => {
    const svg = rootOf(parse('<!DOCTYPE svg [<!ENTITY e "">]><svg>&e;</svg>'));
    expect(svg.children).toEqual([]);
  });

  test("ignores parameter entity declarations", () => {
    expect(() =>
      parse('<!DOCTYPE svg [<!ENTITY % p "x">]><svg/>'),
    ).not.toThrow();
  });

  test("reports undefined entities at the reference", () => {
    expectError("<svg>a&nbsp;</svg>", "UNDEFINED_ENTITY", 6);
  });

  test("rejects external entities", () => {
    expectError(
      '<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]><svg>&e;</svg>',
      "EXTERNAL_ENTITY",
    );
  });

  test("accepts declared external entities that are not used", () => {
    expect(() =>
      parse('<!DOCTYPE svg [<!ENTITY e SYSTEM "e.xml">]><svg/>'),
    ).not.toThrow();
  });

  test("rejects entities with markup", () => {
    expectError(
      '<!DOCTYPE svg [<!ENTITY e "<g/>">]><svg>&e;</svg>',
      "UNSUPPORTED_ENTITY",
    );
    expectError(
      '<!DOCTYPE svg [<!ENTITY e "&#60;g/>">]><svg a="&e;"/>',
      "UNSUPPORTED_ENTITY",
    );
  });

  test("rejects parameter entity references", () => {
    expectError(
      '<!DOCTYPE svg [<!ENTITY % p "x"> %p;]><svg/>',
      "UNSUPPORTED_ENTITY",
    );
  });

  test("rejects recursive entities", () => {
    expectError(
      '<!DOCTYPE svg [<!ENTITY a "&b;"><!ENTITY b "&a;">]><svg>&a;</svg>',
      "MALFORMED_XML",
    );
  });

  test.each([
    ["<svg>&#0;</svg>", "reference to U+0000"],
    ["<svg>&#x110000;</svg>", "reference above U+10FFFF"],
    ["<svg>&#xD800;</svg>", "reference to a surrogate"],
    ["<svg>&#x;</svg>", "no digits"],
    ["<svg>&#12a;</svg>", "hex digit in a decimal reference"],
    ["<svg>&amp</svg>", "missing ';'"],
    ["<svg>a & b</svg>", "bare '&'"],
  ])("rejects %j (%s)", (input) => {
    expectError(input, "MALFORMED_XML");
  });
});

describe("normalization", () => {
  test("normalizes line breaks", () => {
    const document = parse("<svg>a\r\nb\rc<!--\r\n--></svg>\r\n");
    expect(rootOf(document).children).toEqual([
      { type: "text", value: "a\nb\nc" },
      { type: "comment", value: "\n" },
    ]);
    expect(document.children[1]).toEqual({ type: "text", value: "\n" });
  });

  test("turns whitespace in attribute values into spaces", () => {
    const svg = rootOf(parse('<svg d="M0\t0\r\nL1\n1" e="&#10;&#9;"/>'));
    expect(svg.attributes.d).toBe("M0 0 L1 1");
    expect(svg.attributes.e).toBe("\n\t");
  });

  test("keeps whitespace in attribute values otherwise", () => {
    expect(rootOf(parse('<svg a="  x  y "/>')).attributes.a).toBe("  x  y ");
  });
});

describe("namespaces", () => {
  test("keeps prefixes and declarations as written", () => {
    const svg = rootOf(
      parse(
        '<svg:svg xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><svg:use xlink:href="#a"/></svg:svg>',
      ),
    );
    expect(svg.name).toBe("svg:svg");
    expect(svg.children[0]).toEqual({
      type: "element",
      name: "svg:use",
      attributes: { "xlink:href": "#a" },
      children: [],
    });
  });

  test("accepts a declaration after the attribute that uses it", () => {
    expect(() =>
      parse('<svg x:a="1" xmlns:x="http://example.com"/>'),
    ).not.toThrow();
  });

  test("accepts the xml prefix without a declaration", () => {
    expect(() => parse('<svg xml:space="preserve"/>')).not.toThrow();
  });

  test("ends a declaration with its element", () => {
    expectError(
      '<svg><g xmlns:x="http://example.com"/><x:a/></svg>',
      "UNDECLARED_PREFIX",
      39,
    );
  });

  test.each([
    ["<x:svg/>", "element"],
    ['<svg x:a="1"/>', "attribute"],
  ])("rejects an undeclared prefix on an %s", (input) => {
    expectError(input, "UNDECLARED_PREFIX");
  });

  test.each([
    ['<svg xmlns:x=""/>', "empty namespace"],
    ['<svg xmlns:xmlns="http://example.com"/>', "declaring xmlns"],
    ['<svg xmlns:xml="http://example.com"/>', "rebinding xml"],
    [
      '<svg xmlns="http://www.w3.org/XML/1998/namespace"/>',
      "xml namespace as default",
    ],
    [
      '<svg xmlns:a="http://example.com" xmlns:b="http://example.com" a:x="1" b:x="2"/>',
      "same attribute in one namespace",
    ],
    ["<a:b:c/>", "two colons"],
    ["<:a/>", "leading colon"],
    ['<svg xmlns:a="http://example.com"><a:/></svg>', "trailing colon"],
    ["<?a:b?><svg/>", "colon in a PI target"],
  ])("rejects %j (%s)", (input) => {
    expectError(input, "MALFORMED_XML");
  });
});

describe("well-formedness", () => {
  test.each([
    ["", "MISSING_ROOT"],
    ["  ", "MISSING_ROOT"],
    ["<!-- only a comment -->", "MISSING_ROOT"],
  ] as const)("rejects %j with %s", (input, code) => {
    expectError(input, code);
  });

  test.each([
    ["<svg>", "unclosed element"],
    ["<svg></g>", "mismatched end tag"],
    ["<svg/></svg>", "extra end tag"],
    ["<svg/><svg/>", "two roots"],
    ["text<svg/>", "text before the root"],
    ["<svg/>text", "text after the root"],
    ['<svg a="1" a="2"/>', "duplicate attribute"],
    ['<svg a="1"b="2"/>', "missing whitespace between attributes"],
    ["<svg a=1/>", "unquoted value"],
    ['<svg a="<"/>', "'<' in a value"],
    ['<svg a="1/>', "unterminated value"],
    ["<svg>]]></svg>", "']]>' in text"],
    ["<svg><!-- a -- b --></svg>", "'--' in a comment"],
    ["<svg><!-- a ---></svg>", "comment ending with '-'"],
    ["<svg><!-- a</svg>", "unterminated comment"],
    ["<svg><![CDATA[a</svg>", "unterminated CDATA"],
    ["<![CDATA[a]]><svg/>", "CDATA outside the root"],
    ["<svg><?pi</svg>", "unterminated processing instruction"],
    ["<svg><1/></svg>", "invalid name"],
    ["<svg>\u0001</svg>", "control character"],
    ["<svg>\uD800</svg>", "lone surrogate"],
    ['<svg a="\uFFFF"/>', "non-character"],
    ["<svg><!foo></svg>", "unknown markup"],
  ])("rejects %j (%s)", (input) => {
    expectError(input, "MALFORMED_XML");
  });

  test("accepts characters outside the BMP", () => {
    const svg = rootOf(parse('<svg a="😀">😀</svg>'));
    expect(svg.attributes.a).toBe("😀");
  });

  test("reports the position of an error", () => {
    expect(() => parse('<svg>\n  <g a="1" a="2"/>\n</svg>')).toThrow(
      expect.objectContaining({ code: "MALFORMED_XML", line: 2, column: 12 }),
    );
  });

  test("reports an unclosed element at its start tag", () => {
    expectError("<svg><g></svg>", "MALFORMED_XML", 8);
    expectError("<svg>\n<g>", "MALFORMED_XML", 6);
  });
});

test("rejects input that is not a string", () => {
  expect(() => parse(42 as unknown as string)).toThrow(TypeError);
});
