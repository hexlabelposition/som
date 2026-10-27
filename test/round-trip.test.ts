import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  parse,
  stringify,
  type SvgCData,
  type SvgComment,
  type SvgDocument,
  type SvgDocumentChild,
  type SvgElement,
  type SvgInstruction,
  type SvgNode,
  type SvgText,
  type XmlDeclaration,
} from "../src";

// Round-trip guarantee from ARCHITECTURE §5 (A6): for any document from
// parse(), parse(stringify(document)) is deeply equal to it, while quote
// style, entity spelling and whitespace inside tags are normalized.

const NAMESPACE = "http://example.com/x";

const char = (min: number, max: number): fc.Arbitrary<string> =>
  fc.integer({ min, max }).map((code) => String.fromCodePoint(code));

/**
 * Any character allowed in XML, with markup and whitespace characters
 * generated often.
 */
const xmlChar = fc.oneof(
  { weight: 6, arbitrary: char(0x20, 0x7e) },
  {
    weight: 4,
    arbitrary: fc.constantFrom(
      ..."<>&\"'];-?#/= \t\n\r".split(""),
      "]]>",
      "--",
      "?>",
    ),
  },
  { weight: 1, arbitrary: char(0xa0, 0xd7ff) },
  { weight: 1, arbitrary: char(0xe000, 0xfffd) },
  { weight: 1, arbitrary: char(0x10000, 0x10ffff) },
);

const xmlString = (minLength = 0): fc.Arbitrary<string> =>
  fc.string({ unit: xmlChar, minLength, maxLength: 12 });

const name = fc
  .oneof(
    fc.stringMatching(/^[A-Za-z_][\w.-]{0,6}$/),
    fc.constantFrom("linearGradient", "é", "日本", "a·b", "_1"),
  )
  .filter((value) => !/^xml/i.test(value) && value !== "__proto__");

const qualifiedName = fc
  .tuple(fc.boolean(), name)
  .map(([prefixed, local]) => (prefixed ? `x:${local}` : local));

const text: fc.Arbitrary<SvgText> = xmlString(1).map((value) => ({
  type: "text",
  value,
}));

const cdata: fc.Arbitrary<SvgCData> = xmlString()
  .filter((value) => !value.includes("]]>") && !value.includes("\r"))
  .map((value) => ({ type: "cdata", value }));

const comment: fc.Arbitrary<SvgComment> = xmlString()
  .filter(
    (value) =>
      !value.includes("--") && !value.endsWith("-") && !value.includes("\r"),
  )
  .map((value) => ({ type: "comment", value }));

const instruction: fc.Arbitrary<SvgInstruction> = fc
  .tuple(
    name,
    xmlString().filter(
      (value) =>
        !value.includes("?>") && !value.includes("\r") && !/^\s/.test(value),
    ),
  )
  .map(([target, value]) => ({ type: "instruction", target, value }));

const attributes = fc
  .uniqueArray(fc.tuple(qualifiedName, xmlString()), {
    selector: ([key]) => key,
    maxLength: 4,
  })
  .map((entries) => Object.fromEntries(entries));

/**
 * Merges adjacent text nodes, which parse() never produces.
 */
function mergeText<T extends SvgNode | SvgDocumentChild>(nodes: T[]): T[] {
  const merged: T[] = [];
  for (const node of nodes) {
    const previous = merged.at(-1);
    if (node.type === "text" && previous?.type === "text") {
      merged[merged.length - 1] = {
        type: "text",
        value: previous.value + node.value,
      } as T;
    } else {
      merged.push(node);
    }
  }
  return merged;
}

const { element } = fc.letrec<{ element: SvgElement; node: SvgNode }>(
  (tie) => ({
    element: fc.record({
      type: fc.constant("element" as const),
      name: qualifiedName,
      attributes,
      children: fc.array(tie("node"), { maxLength: 5 }).map(mergeText),
    }),
    node: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      text,
      cdata,
      comment,
      instruction,
      tie("element"),
    ),
  }),
);

const root = element.map((node): SvgElement => ({
  ...node,
  attributes: { "xmlns:x": NAMESPACE, ...node.attributes },
}));

const misc: fc.Arbitrary<SvgDocumentChild> = fc.oneof(
  comment,
  instruction,
  fc
    .stringMatching(/^[ \t\n]{1,3}$/)
    .map((value): SvgText => ({ type: "text", value })),
);

const declaration: fc.Arbitrary<XmlDeclaration> = fc.record(
  {
    version: fc.constantFrom("1.0", "1.1"),
    encoding: fc.constantFrom("UTF-8", "utf-8", "ISO-8859-1"),
    standalone: fc.constantFrom("yes" as const, "no" as const),
  },
  { requiredKeys: ["version"] },
);

const document: fc.Arbitrary<SvgDocument> = fc
  .record({
    declaration: fc.option(declaration, { nil: undefined }),
    before: fc.array(misc, { maxLength: 3 }),
    doctype: fc.option(
      fc.constantFrom(
        "svg",
        'svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"',
        "svg [\n  <!ENTITY a 'b'>\n  <!-- c -->\n]",
      ),
      { nil: undefined },
    ),
    between: fc.array(misc, { maxLength: 3 }),
    root,
    after: fc.array(misc, { maxLength: 3 }),
  })
  .map((parts) => {
    const children = mergeText<SvgDocumentChild>([
      ...parts.before,
      ...(parts.doctype === undefined
        ? []
        : [{ type: "doctype" as const, value: parts.doctype }]),
      ...parts.between,
      parts.root,
      ...parts.after,
    ]);
    return parts.declaration === undefined
      ? { type: "document", children }
      : { type: "document", declaration: parts.declaration, children };
  });

/**
 * A small seeded random number generator, so a failing variant can be
 * reproduced from the seed fast-check reports.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Writes a document with randomly chosen lexical details that parse() must
 * normalize away: quote style, entity and character reference spelling,
 * whitespace inside tags, empty elements written with an end tag, line breaks
 * written as `\r\n` or `\r`, and whitespace in attribute values.
 */
function writeVariant(input: SvgDocument, seed: number): string {
  const random = mulberry32(seed);
  const chance = (probability: number): boolean => random() < probability;
  const space = (): string =>
    [" ", "\t", "\n", "  "][Math.floor(random() * 4)] ?? " ";
  const optionalSpace = (): string => (chance(0.5) ? space() : "");
  const quote = (): string => (chance(0.5) ? '"' : "'");

  const reference = (value: string): string => {
    const code = value.codePointAt(0) ?? 0;
    return chance(0.5) ? `&#${String(code)};` : `&#x${code.toString(16)};`;
  };
  const either = (named: string, value: string): string =>
    chance(0.5) ? named : reference(value);

  // A line break written as \r\n or \r, which parse() turns into \n. A lone \r
  // is only used when no \n follows, since "\r\n" reads as one break.
  const lineBreak = (next: string | undefined): string => {
    if (chance(0.6)) return "\n";
    return next === "\n" || chance(0.5) ? "\r\n" : "\r";
  };

  const lineBreaks = (value: string): string => {
    let output = "";
    for (let index = 0; index < value.length; index++) {
      const item = value.charAt(index);
      output += item === "\n" ? lineBreak(value.charAt(index + 1)) : item;
    }
    return output;
  };

  const escape = (value: string, quoteChar?: string): string => {
    // Code points, not graphemes: references are written per code point.
    const chars = Array.from(value);
    let output = "";
    for (const [index, item] of chars.entries()) {
      if (item === "\n" && quoteChar === undefined) {
        output += lineBreak(chars[index + 1]);
      } else if (item === " " && quoteChar !== undefined && chance(0.2)) {
        // Whitespace in attribute values reads as a space.
        output += ["\t", "\n", "\r\n"][Math.floor(random() * 3)] ?? " ";
      } else if (item === "&") output += either("&amp;", item);
      else if (item === "<") output += either("&lt;", item);
      else if (item === ">") {
        // A literal "]]>" is not allowed in text.
        output +=
          output.endsWith("]]") || chance(0.5) ? either("&gt;", item) : item;
      } else if (item === '"' && item === quoteChar) {
        output += either("&quot;", item);
      } else if (item === "'" && item === quoteChar) {
        output += either("&apos;", item);
      } else if (
        item === "\r" ||
        (quoteChar !== undefined && (item === "\t" || item === "\n"))
      ) {
        output += reference(item);
      } else {
        output += chance(0.1) ? reference(item) : item;
      }
    }
    return output;
  };

  const attribute = (key: string, value: string): string => {
    const q = quote();
    return `${space()}${key}${optionalSpace()}=${optionalSpace()}${q}${escape(value, q)}${q}`;
  };

  const write = (node: SvgNode | SvgDocumentChild, inside: boolean): string => {
    switch (node.type) {
      case "element": {
        let output = `<${node.name}`;
        for (const [key, value] of Object.entries(node.attributes)) {
          output += attribute(key, value);
        }
        output += optionalSpace();
        if (node.children.length === 0 && chance(0.5)) return `${output}/>`;
        output += ">";
        for (const child of node.children) output += write(child, true);
        return `${output}</${node.name}${optionalSpace()}>`;
      }
      case "text":
        return inside ? escape(node.value) : lineBreaks(node.value);
      case "cdata":
        return `<![CDATA[${lineBreaks(node.value)}]]>`;
      case "comment":
        return `<!--${lineBreaks(node.value)}-->`;
      case "instruction":
        return node.value === ""
          ? `<?${node.target}${optionalSpace()}?>`
          : `<?${node.target}${space()}${lineBreaks(node.value)}?>`;
      case "doctype":
        return `<!DOCTYPE${space()}${lineBreaks(node.value)}>`;
    }
  };

  let output = "";
  if (input.declaration !== undefined) {
    const { version, encoding, standalone } = input.declaration;
    const pseudo = (key: string, value: string): string => {
      const q = quote();
      return `${space()}${key}${optionalSpace()}=${optionalSpace()}${q}${value}${q}`;
    };
    output += `<?xml${pseudo("version", version)}`;
    if (encoding !== undefined) output += pseudo("encoding", encoding);
    if (standalone !== undefined) output += pseudo("standalone", standalone);
    output += `${optionalSpace()}?>`;
  }
  for (const child of input.children) output += write(child, false);
  return output;
}

describe("property-based", () => {
  test("parse(stringify(document)) equals the document", () => {
    fc.assert(
      fc.property(document, (input) => {
        const output = stringify(input);
        const parsed = parse(output);
        expect(parsed).toEqual(input);
        expect(stringify(parsed)).toBe(output);
      }),
      { numRuns: 300 },
    );
  });

  test("lexical variants parse to the same document", () => {
    fc.assert(
      fc.property(document, fc.integer(), (input, seed) => {
        expect(parse(writeVariant(input, seed))).toEqual(input);
      }),
      { numRuns: 300 },
    );
  });
});

describe("examples", () => {
  const input = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    "<!-- Generator: test -->",
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
    '<?xml-stylesheet href="style.css"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" viewBox="0 0 24 24" width="24">',
    '  <sodipodi:namedview pagecolor="#fff"/>',
    "  <style><![CDATA[circle > rect { fill: red }]]></style>",
    '  <text xml:space="preserve">  a &amp; b &lt; c  </text>',
    '  <use xlink:href="#a" data-unknown="&quot;x&quot;"/>',
    "  <unknown-element><?pi value?></unknown-element>",
    "</svg>",
    "",
  ].join("\n");

  test("keeps everything listed in ARCHITECTURE §5", () => {
    const parsed = parse(input);
    expect(parse(stringify(parsed))).toEqual(parsed);
    // Only the lexical spelling may change: here it does not.
    expect(stringify(parsed)).toBe(input);
  });

  test("normalizes quote style, entity spelling and whitespace inside tags", () => {
    const variant = `<svg  a = 'x &#38; &#x3C; "y"'\nb="1"   ><g ></g ></svg >`;
    const parsed = parse(variant);
    expect(stringify(parsed)).toBe(
      '<svg a="x &amp; &lt; &quot;y&quot;" b="1"><g/></svg>',
    );
    expect(parse(stringify(parsed))).toEqual(parsed);
  });

  test("keeps entities from the doctype expanded and the doctype as written", () => {
    const parsed = parse(
      '<!DOCTYPE svg [<!ENTITY ns_svg "http://www.w3.org/2000/svg"><!ENTITY amp2 "&#38;#38;">]><svg xmlns="&ns_svg;">&amp2;</svg>',
    );
    const output = stringify(parsed);
    expect(output).toBe(
      '<!DOCTYPE svg [<!ENTITY ns_svg "http://www.w3.org/2000/svg"><!ENTITY amp2 "&#38;#38;">]><svg xmlns="http://www.w3.org/2000/svg">&amp;</svg>',
    );
    expect(parse(output)).toEqual(parsed);
  });

  test("keeps whitespace in attribute values written as references", () => {
    const parsed = parse('<svg a="1&#10;2&#9;3&#13;4"/>');
    expect(parse(stringify(parsed))).toEqual(parsed);
  });
});
