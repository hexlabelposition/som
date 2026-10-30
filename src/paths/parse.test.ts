import { describe, expect, test } from "vitest";
import { parsePath } from "./parse";

describe("parsePath", () => {
  test("reads every command", () => {
    expect(
      parsePath(
        "M1 2 L3 4 H5 V6 C7 8 9 10 11 12 S13 14 15 16 Q17 18 19 20 T21 22 A23 24 25 0 1 26 27 Z",
      ),
    ).toEqual([
      { type: "M", x: 1, y: 2 },
      { type: "L", x: 3, y: 4 },
      { type: "H", x: 5 },
      { type: "V", y: 6 },
      { type: "C", x1: 7, y1: 8, x2: 9, y2: 10, x: 11, y: 12 },
      { type: "S", x2: 13, y2: 14, x: 15, y: 16 },
      { type: "Q", x1: 17, y1: 18, x: 19, y: 20 },
      { type: "T", x: 21, y: 22 },
      {
        type: "A",
        rx: 23,
        ry: 24,
        rotation: 25,
        largeArc: false,
        sweep: true,
        x: 26,
        y: 27,
      },
      { type: "Z" },
    ]);
  });

  test("keeps relative commands and the case of z", () => {
    expect(parsePath("m1 2 l3 4 h5 v6 t7 8 z")).toEqual([
      { type: "m", x: 1, y: 2 },
      { type: "l", x: 3, y: 4 },
      { type: "h", x: 5 },
      { type: "v", y: 6 },
      { type: "t", x: 7, y: 8 },
      { type: "z" },
    ]);
  });

  test("gives one segment per set of arguments", () => {
    expect(parsePath("M0 0 1 1 2 2")).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 1, y: 1 },
      { type: "L", x: 2, y: 2 },
    ]);
    expect(parsePath("m0 0 1 1")).toEqual([
      { type: "m", x: 0, y: 0 },
      { type: "l", x: 1, y: 1 },
    ]);
    expect(parsePath("M0 0h1 2,3")).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "h", x: 1 },
      { type: "h", x: 2 },
      { type: "h", x: 3 },
    ]);
  });

  test("reads compact separators", () => {
    expect(parsePath("M10,20l5-5.5.5-1e1Z")).toEqual([
      { type: "M", x: 10, y: 20 },
      { type: "l", x: 5, y: -5.5 },
      { type: "l", x: 0.5, y: -10 },
      { type: "Z" },
    ]);
    expect(parsePath(" \t\n\f\rM 1 , 2 \n")).toEqual([
      { type: "M", x: 1, y: 2 },
    ]);
    expect(parsePath("M0 0zm1 1")).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "z" },
      { type: "m", x: 1, y: 1 },
    ]);
  });

  test("reads arc flags without separators", () => {
    expect(parsePath("M0 0a5 5 0 015 5")).toEqual([
      { type: "M", x: 0, y: 0 },
      {
        type: "a",
        rx: 5,
        ry: 5,
        rotation: 0,
        largeArc: false,
        sweep: true,
        x: 5,
        y: 5,
      },
    ]);
    expect(parsePath("M0 0A1,1,0,1,0,2,2")?.[1]).toMatchObject({
      largeArc: true,
      sweep: false,
    });
  });

  test("reads numbers exactly", () => {
    expect(parsePath("M0.1 1e-7 L+2E+3 -.5")).toEqual([
      { type: "M", x: 0.1, y: 1e-7 },
      { type: "L", x: 2000, y: -0.5 },
    ]);
  });

  test("reads an empty path", () => {
    expect(parsePath("")).toEqual([]);
    expect(parsePath(" \n ")).toEqual([]);
  });

  test.each([
    ["L0 0", "no moveto first"],
    ["z", "no moveto first"],
    ["0 0", "no command"],
    ["M0", "missing argument"],
    ["M0 0 L1", "missing argument"],
    ["M0 0 C1 2 3 4 5", "missing argument"],
    ["M,0 0", "comma before the first argument"],
    ["M0,,0", "two commas"],
    ["M0 0,", "trailing comma"],
    ["M0 0, L1 1", "comma before a command"],
    ["M0 0 z 1 1", "numbers after z"],
    ["M5. 5", "number ending with a dot"],
    ["M1e 5", "exponent without digits"],
    ["M1e999 0", "number too large"],
    ["M0 0 a1 1 0 2 0 1 1", "flag that is not 0 or 1"],
    ["M0 0 a1 1 0 0", "missing flag"],
    ["M0 0 X1 1", "unknown command"],
    ["M0 0 B1", "bearing command"],
    ["M 0x10 0", "hex number"],
    ["M0 0", "non-SVG whitespace"],
    ["none", "keyword"],
  ])("returns undefined for %j (%s)", (text) => {
    expect(parsePath(text)).toBe(undefined);
  });
});
