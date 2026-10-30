import { describe, expect, test } from "vitest";
import { scanStyle, scanStylesheet } from "./css";

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

/** Returns the name and value of each declaration in a style sheet. */
const declarations = (text: string): string[] =>
  scanStylesheet(text).map(({ name, value }) => `${name}: ${value}`);

describe("scanStylesheet", () => {
  test("reports positions in the whole text", () => {
    const text = ".a { fill : red }";
    expect(scanStylesheet(text)).toEqual([
      {
        name: "fill",
        value: "red",
        start: 5,
        valueStart: 12,
        valueEnd: 15,
        end: 16,
      },
    ]);
    const [declaration] = scanStylesheet(text);
    expect(text.slice(declaration?.valueStart, declaration?.valueEnd)).toBe(
      "red",
    );
  });

  test("reads the declarations of every rule", () => {
    expect(
      declarations(`
        .st0{fill:#D1DAE5;}
        .st1 { stroke: blue; stroke-width: 2 }
        path, #id > rect:hover { fill: red }
      `),
    ).toEqual([
      "fill: #D1DAE5",
      "stroke: blue",
      "stroke-width: 2",
      "fill: red",
    ]);
  });

  test("never reads selectors as declarations", () => {
    expect(
      declarations(
        '#fff, a:hover, [data-x="{fill:red}"], .a\\{ { fill: blue }',
      ),
    ).toEqual(["fill: blue"]);
  });

  test("reads rules inside grouping at-rules", () => {
    expect(
      declarations(`
        @media (prefers-color-scheme: dark) {
          .a { fill: white }
          @supports (fill: red) { .b { fill: red } }
        }
        @-webkit-keyframes pulse { from { fill: red } to { fill: blue } }
        @layer base { .c { color: green } }
      `),
    ).toEqual([
      "fill: white",
      "fill: red",
      "fill: red",
      "fill: blue",
      "color: green",
    ]);
  });

  test("reads the block of other at-rules as declarations", () => {
    expect(
      declarations(
        '@import url("a.css"); @font-face { font-family: X; src: url(x.woff) } .a { fill: red }',
      ),
    ).toEqual(["font-family: X", "src: url(x.woff)", "fill: red"]);
  });

  test("skips comments, strings and HTML comment markers", () => {
    expect(
      declarations(
        '<!-- /* .a { fill: red } */ .b { content: "}"; fill: blue } -->',
      ),
    ).toEqual(['content: "}"', "fill: blue"]);
  });

  test("ignores nested rules in a declaration block", () => {
    expect(
      declarations(".a { fill: red; .b { fill: blue } stroke: green }"),
    ).toEqual(["fill: red"]);
  });

  test("reads an unclosed block to the end", () => {
    expect(declarations(".a { fill: red; stroke: blue")).toEqual([
      "fill: red",
      "stroke: blue",
    ]);
    expect(declarations("@media print { .a { fill: red")).toEqual([
      "fill: red",
    ]);
    expect(declarations(".a")).toEqual([]);
  });
});
