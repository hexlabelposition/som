import { describe, expect, test } from "vitest";
import { parseTransform } from "./parse";
import { stringifyTransform } from "./stringify";
import type { SvgTransformFunction } from "./types";

describe("stringifyTransform", () => {
  test("writes one form", () => {
    expect(
      stringifyTransform(
        parseTransform(
          "matrix(1,0,0,-1,6,15)translate(10) , scale(2,3)rotate(45 5,5) skewX(1)skewY(-1)",
        ) ?? [],
      ),
    ).toBe(
      "matrix(1 0 0 -1 6 15) translate(10) scale(2 3) rotate(45 5 5) skewX(1) skewY(-1)",
    );
  });

  test("writes numbers in their shortest form", () => {
    expect(
      stringifyTransform([
        { type: "translate", x: 0.1 + 0.2, y: -0 },
        { type: "scale", x: 1e-7, y: 1e21 },
      ]),
    ).toBe("translate(0.30000000000000004 0) scale(1e-7 1e+21)");
  });

  test("writes an empty list as an empty string", () => {
    expect(stringifyTransform([])).toBe("");
  });

  test.each<[unknown, string]>([
    [{ type: "translate", x: Number.NaN }, "NaN"],
    [{ type: "scale", x: 1, y: Number.POSITIVE_INFINITY }, "infinity"],
    [{ type: "translate", x: "1" }, "string"],
    [{ type: "translate" }, "missing argument"],
    [{ type: "translate", y: 1 }, "missing argument"],
    [{ type: "matrix", a: 1, b: 0, c: 0, d: 1, e: 0 }, "missing argument"],
    [{ type: "rotate", angle: 45, cx: 5 }, "cx without cy"],
    [{ type: "rotate", angle: 45, cy: 5 }, "cy without cx"],
    [{ type: "skew", angle: 45 }, "unknown function"],
    [{ type: "Rotate", angle: 45 }, "unknown function"],
  ])("throws for %j (%s)", (fn) => {
    expect(() => stringifyTransform([fn as SvgTransformFunction])).toThrow(
      TypeError,
    );
  });
});
