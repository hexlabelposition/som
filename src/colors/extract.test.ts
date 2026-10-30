import { describe, expect, test } from "vitest";
import type { SvgDocument, SvgElement, SvgNode } from "../ast";
import { extractColors } from "./extract";

function element(
  name: string,
  attributes: Record<string, string> = {},
  children: SvgNode[] = [],
): SvgElement {
  return { type: "element", name, attributes, children };
}

function document(root: SvgElement): SvgDocument {
  return { type: "document", children: [root] };
}

function style(text: string, attributes: Record<string, string> = {}) {
  return element("style", attributes, [{ type: "text", value: text }]);
}

/** Lists where each color is and its value, without the element. */
const summary = (root: SvgElement) =>
  extractColors(document(root)).map(
    ({ element: { name }, property, source, value }) =>
      `${name} ${source} ${property}: ${value}`,
  );

const red = { type: "named", name: "red" };

describe("extractColors", () => {
  test("reports colors in attributes", () => {
    const path = element("path", { fill: "red", d: "M0 0", stroke: "#00F" });
    expect(extractColors(document(element("svg", {}, [path])))).toEqual([
      {
        element: path,
        property: "fill",
        source: "attribute",
        value: "red",
        color: red,
      },
      {
        element: path,
        property: "stroke",
        source: "attribute",
        value: "#00F",
        color: { type: "hex", red: 0, green: 0, blue: 255, alpha: 1 },
      },
    ]);
  });

  test("reads every color property", () => {
    expect(
      summary(
        element("svg", { color: "red" }, [
          element("stop", { "stop-color": "red" }),
          element("feFlood", { "flood-color": "red" }),
          element("feDiffuseLighting", { "lighting-color": "red" }),
          element("text", { "solid-color": "red", "data-color": "red" }),
        ]),
      ),
    ).toEqual([
      "svg attribute color: red",
      "stop attribute stop-color: red",
      "feFlood attribute flood-color: red",
      "feDiffuseLighting attribute lighting-color: red",
    ]);
  });

  test("includes the element it starts from", () => {
    const svg = element("svg", { fill: "red" }, [
      element("path", { fill: "blue" }),
    ]);
    expect(extractColors(svg).map((use) => use.value)).toEqual(["red", "blue"]);
  });

  test("reports every declaration in style, without !important", () => {
    expect(
      summary(
        element("path", {
          style:
            "fill: red; FILL: blue !important; stroke-width: 2; --fill: red",
        }),
      ),
    ).toEqual(["path style fill: red", "path style fill: blue"]);
  });

  test("reports declarations in <style> at the <style> element", () => {
    const sheet = style(
      "#fff { fill: #D1DAE5 } @media print { .a { stroke: black !important } }",
    );
    const uses = extractColors(document(element("svg", {}, [sheet])));
    expect(uses.map((use) => use.element)).toEqual([sheet, sheet]);
    expect(summary(element("svg", {}, [sheet]))).toEqual([
      "style stylesheet fill: #D1DAE5",
      "style stylesheet stroke: black",
    ]);
  });

  test("reads CDATA and every text child of <style>", () => {
    const sheet = element("style", {}, [
      { type: "text", value: "\n" },
      { type: "cdata", value: ".a { fill: red }" },
      { type: "comment", value: ".b { fill: green }" },
      { type: "text", value: ".c { fill: blue }" },
    ]);
    expect(summary(sheet)).toEqual([
      "style stylesheet fill: red",
      "style stylesheet fill: blue",
    ]);
  });

  test("reads <style> only as CSS", () => {
    expect(summary(style(".a { fill: red }", { type: " Text/CSS " }))).toEqual([
      "style stylesheet fill: red",
    ]);
    expect(summary(style(".a { fill: red }", { type: "" }))).toHaveLength(1);
    expect(summary(style(".a { fill: red }", { type: "text/x-scss" }))).toEqual(
      [],
    );
    expect(
      summary(
        element("svg:style", {}, [{ type: "text", value: ".a { fill: red }" }]),
      ),
    ).toEqual([]);
  });

  test("reports paints without a color", () => {
    const path = element("path", {
      fill: "url(#g)",
      stroke: "none",
      style: "fill: url('#h') currentColor",
    });
    expect(extractColors(path)).toEqual([
      {
        element: path,
        property: "fill",
        source: "attribute",
        value: "url(#g)",
        url: "#g",
      },
      {
        element: path,
        property: "stroke",
        source: "attribute",
        value: "none",
      },
      {
        element: path,
        property: "fill",
        source: "style",
        value: "url('#h') currentColor",
        color: { type: "currentColor" },
        url: "#h",
      },
    ]);
  });

  test("skips values that are not a color or a paint", () => {
    expect(
      summary(
        element("svg", { fill: "inherit", stroke: "hwb(0 0% 0%)" }, [
          element("animate", { fill: "freeze" }),
          element("stop", { "stop-color": "none", style: "color: initial" }),
          element("text", {}, [{ type: "text", value: "#f00" }]),
        ]),
      ),
    ).toEqual([]);
  });

  test("returns an empty list for a document without colors", () => {
    expect(extractColors(document(element("svg")))).toEqual([]);
  });
});
