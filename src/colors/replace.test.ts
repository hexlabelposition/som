import { describe, expect, test } from "vitest";
import type { SvgElement, SvgNode } from "../ast";
import { replaceColor } from "./replace";

function element(
  name: string,
  attributes: Record<string, string> = {},
  children: SvgNode[] = [],
): SvgElement {
  return { type: "element", name, attributes, children };
}

describe("replaceColor", () => {
  test("replaces every notation of the color", () => {
    const svg = element("svg", { fill: "#F00" }, [
      element("path", { fill: "red", stroke: "rgb(100% 0% 0%)" }),
      element("circle", { fill: "hsl(0 100% 50%)", stroke: "#ff000080" }),
    ]);
    expect(replaceColor(svg, "red", "blue")).toBe(4);
    expect(svg).toEqual(
      element("svg", { fill: "blue" }, [
        element("path", { fill: "blue", stroke: "blue" }),
        element("circle", { fill: "blue", stroke: "#ff000080" }),
      ]),
    );
  });

  test("rewrites only the color", () => {
    const path = element("path", {
      fill: " red ",
      stroke: "url(#g)  red",
      style: "fill:red /* x */;stroke : RED  !important ;fill: url(#h) none",
    });
    expect(replaceColor(path, "#f00", "#00f")).toBe(3);
    expect(path.attributes).toEqual({
      fill: " #00f ",
      stroke: "url(#g)  #00f",
      style: "fill:red /* x */;stroke : #00f  !important ;fill: url(#h) none",
    });
  });

  test("replaces colors in <style> elements in place", () => {
    const sheet = element("style", {}, [
      { type: "text", value: "#f00, .a { fill: #f00 }\n" },
      { type: "cdata", value: "@media print { .b { stroke: red; } }" },
    ]);
    expect(replaceColor(sheet, "red", "black")).toBe(2);
    expect(sheet.children).toEqual([
      { type: "text", value: "#f00, .a { fill: black }\n" },
      { type: "cdata", value: "@media print { .b { stroke: black; } }" },
    ]);
  });

  test("matches currentColor only to itself", () => {
    const path = element("path", { fill: "currentColor", stroke: "black" });
    expect(replaceColor(path, "black", "red")).toBe(1);
    expect(replaceColor(path, "currentcolor", "#123")).toBe(1);
    expect(path.attributes).toEqual({ fill: "#123", stroke: "red" });
  });

  test("never replaces paints without a color", () => {
    const path = element("path", { fill: "none", stroke: "url(#g)" });
    expect(replaceColor(path, "transparent", "red")).toBe(0);
    expect(path.attributes).toEqual({ fill: "none", stroke: "url(#g)" });
  });

  test("matches transparent to other notations with zero alpha", () => {
    const path = element("path", { fill: "rgba(0, 0, 0, 0)", stroke: "#0000" });
    expect(replaceColor(path, "transparent", "white")).toBe(2);
  });

  test("takes and writes SvgColor values", () => {
    const path = element("path", { fill: "#0f0" });
    replaceColor(
      path,
      { type: "named", name: "lime" },
      { type: "rgb", red: 0, green: 0, blue: 255, alpha: 0.5 },
    );
    expect(path.attributes.fill).toBe("rgba(0, 0, 255, 0.5)");
  });

  test("writes the new color as given, trimmed", () => {
    const path = element("path", { fill: "red" });
    replaceColor(path, "red", "  RebeccaPurple ");
    expect(path.attributes.fill).toBe("RebeccaPurple");
  });

  test("returns 0 and changes nothing when the color is not found", () => {
    const path = element("path", { fill: "red", style: "stroke: blue" });
    expect(replaceColor(path, "green", "black")).toBe(0);
    expect(path.attributes).toEqual({ fill: "red", style: "stroke: blue" });
  });

  test.each([
    ["none", "red"],
    ["red", "none"],
    ["red", "red; stroke: blue"],
    ["url(#g)", "red"],
  ])("throws for %j → %j", (from, to) => {
    expect(() => replaceColor(element("path"), from, to)).toThrow(TypeError);
  });

  test("throws for an SvgColor formatColor cannot write", () => {
    expect(() =>
      replaceColor(element("path"), "red", {
        type: "hex",
        red: 300,
        green: 0,
        blue: 0,
        alpha: 1,
      }),
    ).toThrow(TypeError);
  });
});
