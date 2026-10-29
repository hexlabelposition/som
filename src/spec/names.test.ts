import { describe, expect, expectTypeOf, test } from "vitest";
import {
  isSvgAttributeName,
  isSvgElementName,
  type SvgAttributeName,
  type SvgElementName,
} from ".";

/** Returns a value typed as `string`, as a name read from a document is. */
const runtime = (value: string): string => value;

describe("isSvgElementName", () => {
  test("accepts elements of any version by default", () => {
    expect(isSvgElementName("rect")).toBe(true);
    expect(isSvgElementName("altGlyph")).toBe(true);
    expect(isSvgElementName("feDropShadow")).toBe(true);
  });

  test("checks one version when given", () => {
    expect(isSvgElementName("altGlyph", "1.1")).toBe(true);
    expect(isSvgElementName("altGlyph", "2")).toBe(false);
    expect(isSvgElementName("feDropShadow", "1.1")).toBe(false);
    expect(isSvgElementName("feDropShadow", "2")).toBe(true);
  });

  test("is case-sensitive and takes no prefixes", () => {
    expect(isSvgElementName("lineargradient")).toBe(false);
    expect(isSvgElementName("svg:rect")).toBe(false);
    expect(isSvgElementName("div")).toBe(false);
    expect(isSvgElementName("")).toBe(false);
  });

  test("ignores Object.prototype", () => {
    expect(isSvgElementName("constructor")).toBe(false);
    expect(isSvgElementName("__proto__")).toBe(false);
    expect(isSvgElementName("toString")).toBe(false);
  });

  test("narrows the name", () => {
    const name = runtime("rect");
    if (isSvgElementName(name, "2")) {
      expectTypeOf(name).toEqualTypeOf<SvgElementName<"2">>();
    }
  });
});

describe("isSvgAttributeName", () => {
  test("accepts own attributes and those of the groups", () => {
    expect(isSvgAttributeName("rect", "rx")).toBe(true);
    expect(isSvgAttributeName("rect", "id")).toBe(true);
    expect(isSvgAttributeName("rect", "class")).toBe(true);
    expect(isSvgAttributeName("rect", "fill")).toBe(true);
    expect(isSvgAttributeName("rect", "onclick")).toBe(true);
    expect(isSvgAttributeName("a", "xlink:href")).toBe(true);
  });

  test("checks one version when given", () => {
    expect(isSvgAttributeName("rect", "enable-background", "1.1")).toBe(true);
    expect(isSvgAttributeName("rect", "enable-background", "2")).toBe(false);
    expect(isSvgAttributeName("rect", "enable-background")).toBe(true);
    expect(isSvgAttributeName("rect", "paint-order", "2")).toBe(true);
    expect(isSvgAttributeName("rect", "paint-order", "1.1")).toBe(false);
  });

  test("uses only the versions that define the element", () => {
    expect(isSvgAttributeName("altGlyph", "glyphRef")).toBe(true);
    expect(isSvgAttributeName("altGlyph", "glyphRef", "2")).toBe(false);
  });

  test("rejects attributes of other elements and unknown elements", () => {
    expect(isSvgAttributeName("rect", "cx")).toBe(false);
    expect(isSvgAttributeName("div", "id")).toBe(false);
    expect(isSvgAttributeName("constructor", "id")).toBe(false);
  });

  test("rejects attributes the specs do not list", () => {
    expect(isSvgAttributeName("rect", "data-id")).toBe(false);
    expect(isSvgAttributeName("rect", "inkscape:label")).toBe(false);
    expect(isSvgAttributeName("rect", "RX")).toBe(false);
    expect(isSvgAttributeName("rect", "toString")).toBe(false);
    expect(isSvgAttributeName("rect", "__proto__")).toBe(false);
  });

  test("agrees with SvgAttributeName", () => {
    const attribute = runtime("rx");
    if (isSvgAttributeName("rect", attribute, "2")) {
      expectTypeOf(attribute).toEqualTypeOf<SvgAttributeName<"rect", "2">>();
    }
  });

  test("does not narrow for an element known only at run time", () => {
    const element = runtime("rect");
    const attribute = runtime("rx");
    expectTypeOf(
      isSvgAttributeName(element, attribute),
    ).toEqualTypeOf<boolean>();
    if (isSvgAttributeName(element, attribute)) {
      expectTypeOf(attribute).toEqualTypeOf<string>();
    } else {
      expectTypeOf(attribute).toEqualTypeOf<string>();
    }
  });
});
