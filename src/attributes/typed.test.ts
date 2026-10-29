import { describe, expect, expectTypeOf, test } from "vitest";
import type { SvgElement } from "../ast";
import { parseKeyword } from "./keyword";
import {
  getAngle,
  getInteger,
  getKeyword,
  getLength,
  getLengthList,
  getNumber,
  getNumberList,
  getNumberOrPercentage,
  getNumberPair,
  getPreserveAspectRatio,
  getViewBox,
} from "./typed";

function element(attributes: Record<string, string>): SvgElement {
  return { type: "element", name: "test", attributes, children: [] };
}

describe("typed reads", () => {
  const el = element({
    pathLength: "100",
    numOctaves: "3",
    tableValues: "0 0.5 1",
    stdDeviation: "2",
    offset: "50%",
    width: "2em",
    x: "10 20",
    orient: "45deg",
    viewBox: "0 0 24 24",
    preserveAspectRatio: "xMinYMin slice",
    gradientUnits: "userSpaceOnUse",
    "inkscape:label": "1.5",
    bad: "abc",
  });

  test("parse the attribute with the matching value-level function", () => {
    expect(getNumber(el, "pathLength")).toBe(100);
    expect(getInteger(el, "numOctaves")).toBe(3);
    expect(getNumberList(el, "tableValues")).toEqual([0, 0.5, 1]);
    expect(getNumberPair(el, "stdDeviation")).toEqual([2, 2]);
    expect(getNumberOrPercentage(el, "offset")).toEqual({
      value: 50,
      unit: "%",
    });
    expect(getLength(el, "width")).toEqual({ value: 2, unit: "em" });
    expect(getLengthList(el, "x")).toEqual([
      { value: 10, unit: "" },
      { value: 20, unit: "" },
    ]);
    expect(getAngle(el, "orient")).toEqual({ value: 45, unit: "deg" });
    expect(getViewBox(el)).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(getPreserveAspectRatio(el)).toEqual({
      defer: false,
      align: "xMinYMin",
      meetOrSlice: "slice",
    });
    expect(
      getKeyword(el, "gradientUnits", ["userSpaceOnUse", "objectBoundingBox"]),
    ).toBe("userSpaceOnUse");
  });

  test("read any attribute, without consulting the specs", () => {
    expect(getNumber(el, "inkscape:label")).toBe(1.5);
  });

  test("return undefined for a missing or invalid value", () => {
    expect(getNumber(el, "missing")).toBeUndefined();
    expect(getNumber(el, "bad")).toBeUndefined();
    expect(getLength(el, "bad")).toBeUndefined();
    expect(getViewBox(element({}))).toBeUndefined();
    expect(getKeyword(el, "bad", ["a", "b"])).toBeUndefined();
  });

  test("type keywords as the set passed in", () => {
    expectTypeOf(
      getKeyword(el, "gradientUnits", ["userSpaceOnUse", "objectBoundingBox"]),
    ).toEqualTypeOf<"userSpaceOnUse" | "objectBoundingBox" | undefined>();
    expectTypeOf(parseKeyword("a", ["a", "b"])).toEqualTypeOf<
      "a" | "b" | undefined
    >();
  });
});

describe("parseKeyword", () => {
  test("is case-sensitive and ignores surrounding whitespace", () => {
    expect(parseKeyword(" evenodd ", ["nonzero", "evenodd"])).toBe("evenodd");
    expect(parseKeyword("EvenOdd", ["nonzero", "evenodd"])).toBeUndefined();
    expect(parseKeyword("", ["nonzero", "evenodd"])).toBeUndefined();
  });
});
