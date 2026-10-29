import { describe, expectTypeOf, test } from "vitest";
import type { SvgAttributeName, SvgElementName } from ".";

// Type-level tests: checked by `bun run typecheck`, which fails on a wrong
// assertion or an unused @ts-expect-error.

describe("SvgElementName", () => {
  test("lists the elements of one version", () => {
    expectTypeOf<"feDropShadow">().toExtend<SvgElementName<"2">>();
    expectTypeOf<"altGlyph">().toExtend<SvgElementName<"1.1">>();
    expectTypeOf<"altGlyph">().not.toExtend<SvgElementName<"2">>();
    expectTypeOf<"feDropShadow">().not.toExtend<SvgElementName<"1.1">>();
  });

  test("lists the elements of any version by default", () => {
    expectTypeOf<SvgElementName>().toEqualTypeOf<
      SvgElementName<"1.1"> | SvgElementName<"2">
    >();
  });

  test("is case-sensitive and has no prefixes", () => {
    expectTypeOf<"lineargradient">().not.toExtend<SvgElementName>();
    expectTypeOf<"svg:svg">().not.toExtend<SvgElementName>();
  });
});

describe("SvgAttributeName", () => {
  test("includes own attributes and those of the groups", () => {
    expectTypeOf<"rx" | "id" | "class" | "fill" | "onclick">().toExtend<
      SvgAttributeName<"rect", "2">
    >();
    expectTypeOf<"rx" | "id" | "xml:space" | "fill" | "onclick">().toExtend<
      SvgAttributeName<"rect", "1.1">
    >();
  });

  test("differs between versions", () => {
    expectTypeOf<"enable-background">().toExtend<
      SvgAttributeName<"rect", "1.1">
    >();
    expectTypeOf<"enable-background">().not.toExtend<
      SvgAttributeName<"rect", "2">
    >();
    expectTypeOf<"paint-order">().toExtend<SvgAttributeName<"rect", "2">>();
    expectTypeOf<"paint-order">().not.toExtend<
      SvgAttributeName<"rect", "1.1">
    >();
  });

  test("allows the attributes of any version by default", () => {
    expectTypeOf<SvgAttributeName<"rect">>().toEqualTypeOf<
      SvgAttributeName<"rect", "1.1"> | SvgAttributeName<"rect", "2">
    >();
  });

  test("uses only the versions that define the element", () => {
    expectTypeOf<SvgAttributeName<"altGlyph">>().toEqualTypeOf<
      SvgAttributeName<"altGlyph", "1.1">
    >();
  });

  test("includes geometry properties of SVG 2", () => {
    expectTypeOf<"cx" | "cy" | "r">().toExtend<
      SvgAttributeName<"circle", "2">
    >();
  });

  test("does not include attributes of other elements", () => {
    expectTypeOf<"cx">().not.toExtend<SvgAttributeName<"rect">>();
    expectTypeOf<"data-id">().not.toExtend<SvgAttributeName<"rect">>();
  });

  test("covers every element of a union", () => {
    expectTypeOf<SvgAttributeName<"rect" | "circle", "2">>().toEqualTypeOf<
      SvgAttributeName<"rect", "2"> | SvgAttributeName<"circle", "2">
    >();
  });

  test("rejects elements the version does not define", () => {
    // @ts-expect-error: altGlyph was removed in SVG 2
    expectTypeOf<SvgAttributeName<"altGlyph", "2">>().toBeNever();
    // @ts-expect-error: not an SVG element
    expectTypeOf<SvgAttributeName<"div">>().toBeNever();
  });
});
