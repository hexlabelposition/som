import { describe, expect, test } from "vitest";
import type { SvgElement } from "../ast";
import { getPresentationValue } from ".";

function element(name: string, attributes: Record<string, string>): SvgElement {
  return { type: "element", name, attributes, children: [] };
}

describe("getPresentationValue", () => {
  test("prefers a style declaration over the attribute", () => {
    const path = element("path", { fill: "red", style: "fill: blue" });
    expect(getPresentationValue(path, "fill")).toEqual({
      value: "blue",
      source: "style",
      important: false,
    });
  });

  test("falls back to the presentation attribute", () => {
    const path = element("path", { fill: " red ", style: "stroke: blue" });
    expect(getPresentationValue(path, "fill")).toEqual({
      value: "red",
      source: "attribute",
      important: false,
    });
  });

  test("returns undefined when neither sets the property", () => {
    expect(getPresentationValue(element("path", {}), "fill")).toBeUndefined();
  });

  test("splits off !important and lets it win in style", () => {
    const path = element("path", {
      fill: "red",
      style: "fill: blue !important; fill: green",
    });
    expect(getPresentationValue(path, "fill")).toEqual({
      value: "blue",
      source: "style",
      important: true,
    });
  });

  test("compares style names case-insensitively, attribute names exactly", () => {
    expect(
      getPresentationValue(element("path", { style: "FILL: red" }), "fill"),
    ).toMatchObject({ value: "red", source: "style" });
    expect(
      getPresentationValue(element("path", { Fill: "red" }), "Fill"),
    ).toBeUndefined();
  });

  test("counts only presentation attributes of the element", () => {
    // d is a presentation attribute of path in SVG 2, never of rect.
    expect(
      getPresentationValue(element("rect", { d: "M0 0" }), "d"),
    ).toBeUndefined();
    expect(
      getPresentationValue(element("unknown", { fill: "red" }), "fill"),
    ).toBeUndefined();
    expect(
      getPresentationValue(element("svg:rect", { fill: "red" }), "fill"),
    ).toBeUndefined();
    expect(
      getPresentationValue(element("rect", { toString: "x" }), "toString"),
    ).toBeUndefined();
  });

  test("checks the version when given", () => {
    const circle = element("circle", { cx: "5" });
    expect(getPresentationValue(circle, "cx")).toMatchObject({ value: "5" });
    expect(getPresentationValue(circle, "cx", "2")).toMatchObject({
      value: "5",
    });
    expect(getPresentationValue(circle, "cx", "1.1")).toBeUndefined();

    const rect = element("rect", { "enable-background": "new" });
    expect(
      getPresentationValue(rect, "enable-background", "1.1"),
    ).toMatchObject({ value: "new", source: "attribute" });
    expect(
      getPresentationValue(rect, "enable-background", "2"),
    ).toBeUndefined();
  });

  test("reads any property from style, as CSS does", () => {
    const path = element("path", {
      style: "--accent: red; mix-blend-mode: multiply",
    });
    expect(getPresentationValue(path, "--accent")).toMatchObject({
      value: "red",
      source: "style",
    });
    expect(getPresentationValue(path, "mix-blend-mode")).toMatchObject({
      value: "multiply",
    });
  });
});
