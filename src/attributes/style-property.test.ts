import { describe, expect, test } from "vitest";
import type { SvgElement } from "../ast";
import {
  getStyleProperty,
  removeStyleProperty,
  setStyleProperty,
} from "./style-property";

function path(style?: string): SvgElement {
  return {
    type: "element",
    name: "path",
    attributes: style === undefined ? {} : { style },
    children: [],
  };
}

describe("getStyleProperty", () => {
  test("returns the value of the last declaration", () => {
    const element = path("fill: red; stroke: blue !important; fill: green");
    expect(getStyleProperty(element, "fill")).toBe("green");
    expect(getStyleProperty(element, "stroke")).toBe("blue !important");
  });

  test("compares names ASCII case-insensitively, except custom properties", () => {
    const element = path("Fill: red; --Color: blue");
    expect(getStyleProperty(element, "FILL")).toBe("red");
    expect(getStyleProperty(element, "--Color")).toBe("blue");
    expect(getStyleProperty(element, "--color")).toBeUndefined();
  });

  test("returns undefined without the property or the attribute", () => {
    expect(getStyleProperty(path("fill: red"), "stroke")).toBeUndefined();
    expect(getStyleProperty(path(), "fill")).toBeUndefined();
  });

  test("does not read presentation attributes", () => {
    const element = path();
    element.attributes.fill = "red";
    expect(getStyleProperty(element, "fill")).toBeUndefined();
  });
});

describe("setStyleProperty", () => {
  test.each([
    ["fill:red;stroke:blue", "fill:green;stroke:blue"],
    [
      "stroke: blue; /* c */ fill : red ; /* d */",
      "stroke: blue; /* c */ fill : green ; /* d */",
    ],
    ["FILL: red", "FILL: green"],
  ])("replaces the value in %j", (style, expected) => {
    const element = path(style);
    setStyleProperty(element, "fill", "green");
    expect(element.attributes.style).toBe(expected);
  });

  test("replaces the last declaration and removes earlier ones", () => {
    const element = path("fill: red; stroke: blue; fill: url(#a) red");
    setStyleProperty(element, "fill", "green");
    expect(element.attributes.style).toBe("stroke: blue; fill: green");
  });

  test.each([
    [undefined, "opacity: 0.5"],
    ["", "opacity: 0.5"],
    ["  ", "opacity: 0.5"],
    ["fill:red", "fill:red; opacity: 0.5"],
    ["fill: red;", "fill: red; opacity: 0.5"],
    ["fill: red;  ", "fill: red; opacity: 0.5"],
  ])("appends to %j", (style, expected) => {
    const element = path(style);
    setStyleProperty(element, "opacity", " 0.5 ");
    expect(element.attributes.style).toBe(expected);
  });

  test.each([
    ["", "empty value"],
    ["red; stroke: blue", "';' in the value"],
    ["'red", "unterminated string"],
  ])("rejects %j (%s) without changing the element", (value) => {
    const element = path("fill: red");
    expect(() => {
      setStyleProperty(element, "fill", value);
    }).toThrow(TypeError);
    expect(element.attributes.style).toBe("fill: red");
  });
});

describe("removeStyleProperty", () => {
  test.each([
    ["fill: red; stroke: blue", "stroke: blue"],
    ["stroke: blue; fill: red", "stroke: blue;"],
    ["stroke: blue; fill: red; opacity: 1", "stroke: blue; opacity: 1"],
    ["fill: red; stroke: blue; FILL: green;", "stroke: blue;"],
    ["/* a */ fill: red; stroke: blue", "/* a */ stroke: blue"],
  ])("removes the property from %j", (style, expected) => {
    const element = path(style);
    removeStyleProperty(element, "fill");
    expect(element.attributes.style).toBe(expected);
  });

  test("removes the attribute when no declaration is left", () => {
    const element = path("fill: red; /* note */ ;");
    removeStyleProperty(element, "fill");
    expect(element.attributes).toEqual({});
  });

  test("leaves the attribute as it is without the property", () => {
    const element = path("stroke:blue ;");
    removeStyleProperty(element, "fill");
    expect(element.attributes.style).toBe("stroke:blue ;");

    const empty = path("");
    removeStyleProperty(empty, "fill");
    expect(empty.attributes).toEqual({ style: "" });
  });
});
