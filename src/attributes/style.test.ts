import { describe, expect, test } from "vitest";
import { parseStyle, scanStyle, stringifyStyle } from "./style";

describe("parseStyle", () => {
  test("parses declarations", () => {
    expect(parseStyle("fill: red; stroke-width:2;opacity : .5;")).toEqual({
      fill: "red",
      "stroke-width": "2",
      opacity: ".5",
    });
  });

  test("returns an empty map for empty text", () => {
    expect(parseStyle("")).toEqual({});
    expect(parseStyle(" ; ;; ")).toEqual({});
  });

  test("keeps values as written, including !important", () => {
    expect(parseStyle("fill:  rgb(0, 0, 0)  !important ")).toEqual({
      fill: "rgb(0, 0, 0)  !important",
    });
  });

  test("does not split inside strings, parentheses and comments", () => {
    expect(
      parseStyle(
        `font-family: "a;b", 'c:d'; mask: url(#a;b); /* x: y; */ fill: red; content: "\\";"`,
      ),
    ).toEqual({
      "font-family": `"a;b", 'c:d'`,
      mask: "url(#a;b)",
      fill: "red",
      content: `"\\";"`,
    });
  });

  test("lets the last declaration win and keeps its position", () => {
    const style = parseStyle("fill: red; stroke: blue; fill: green");
    expect(style).toEqual({ stroke: "blue", fill: "green" });
    expect(Object.keys(style)).toEqual(["stroke", "fill"]);
  });

  test("lowercases names except custom properties", () => {
    expect(parseStyle("FILL: red; --Main-Color: blue")).toEqual({
      fill: "red",
      "--Main-Color": "blue",
    });
  });

  test("skips invalid declarations", () => {
    expect(
      parseStyle("fill; : red; 1a: b; a b: c; stroke: ; --empty:; opacity: 1"),
    ).toEqual({ "--empty": "", opacity: "1" });
  });

  test("stores a property named __proto__ as an own property", () => {
    const style = parseStyle("__proto__: x");
    expect(Object.keys(style)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(style)).toBe(Object.prototype);
  });
});

describe("stringifyStyle", () => {
  test("writes declarations separated by '; '", () => {
    expect(stringifyStyle({ fill: "red", "stroke-width": " 2 " })).toBe(
      "fill: red; stroke-width: 2",
    );
    expect(stringifyStyle({})).toBe("");
  });

  test("reads back with parseStyle", () => {
    const properties = { fill: "url(#a;b)", "--x": "'a;b'", opacity: "1" };
    expect(parseStyle(stringifyStyle(properties))).toEqual(properties);
  });

  test.each<[Record<string, string>, string]>([
    [{ fill: "" }, "empty value"],
    [{ fill: "red; stroke: blue" }, "';' in the value"],
    [{ fill: '"red' }, "unterminated string"],
    [{ fill: "url(a" }, "unclosed parenthesis"],
    [{ "fi ll": "red" }, "space in the name"],
    [{ "": "red" }, "empty name"],
  ])("rejects %j (%s)", (properties) => {
    expect(() => stringifyStyle(properties)).toThrow(TypeError);
  });
});

test("scanStyle reports positions", () => {
  expect(scanStyle(" fill : red ; x")).toEqual([
    {
      name: "fill",
      value: "red",
      start: 1,
      valueStart: 8,
      valueEnd: 11,
      end: 13,
    },
  ]);
});
