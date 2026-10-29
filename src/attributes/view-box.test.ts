import { describe, expect, test } from "vitest";
import { parsePreserveAspectRatio, parseViewBox } from "./view-box";

describe("parseViewBox", () => {
  test("reads four numbers", () => {
    expect(parseViewBox("0 0 24 24")).toEqual({
      x: 0,
      y: 0,
      width: 24,
      height: 24,
    });
    expect(parseViewBox(" -5,-5 , 10.5\n10 ")).toEqual({
      x: -5,
      y: -5,
      width: 10.5,
      height: 10,
    });
  });

  test("accepts a zero size and rejects a negative one", () => {
    expect(parseViewBox("0 0 0 0")).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(parseViewBox("0 0 -1 1")).toBeUndefined();
    expect(parseViewBox("0 0 1 -1")).toBeUndefined();
  });

  test("rejects other counts and units", () => {
    for (const text of ["", "0 0 24", "0 0 24 24 1", "0 0 24px 24", "none"]) {
      expect(parseViewBox(text), text).toBeUndefined();
    }
  });
});

describe("parsePreserveAspectRatio", () => {
  test("reads the alignment and meet or slice", () => {
    expect(parsePreserveAspectRatio("xMidYMid")).toEqual({
      defer: false,
      align: "xMidYMid",
      meetOrSlice: "meet",
    });
    expect(parsePreserveAspectRatio(" xMinYMax \n slice ")).toEqual({
      defer: false,
      align: "xMinYMax",
      meetOrSlice: "slice",
    });
    expect(parsePreserveAspectRatio("none")).toEqual({
      defer: false,
      align: "none",
      meetOrSlice: "meet",
    });
  });

  test("reads defer from SVG 1.1", () => {
    expect(parsePreserveAspectRatio("defer xMaxYMin meet")).toEqual({
      defer: true,
      align: "xMaxYMin",
      meetOrSlice: "meet",
    });
  });

  test("rejects wrong case, order and extra words", () => {
    for (const text of [
      "",
      "defer",
      "xmidymid",
      "slice xMidYMid",
      "xMidYMid meet slice",
      "xMidYMid defer",
      "xMidYMid,meet",
    ]) {
      expect(parsePreserveAspectRatio(text), text).toBeUndefined();
    }
  });
});
