import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  parseInteger,
  parseNumber,
  parseNumberList,
  parseNumberOrPercentage,
  parseNumberPair,
} from "./number";

describe("parseNumber", () => {
  test("reads CSS numbers", () => {
    expect(parseNumber("1")).toBe(1);
    expect(parseNumber("-0.5")).toBe(-0.5);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("+2")).toBe(2);
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("1E-3")).toBe(0.001);
    expect(parseNumber("-.5e+2")).toBe(-50);
  });

  test("ignores SVG whitespace around the number", () => {
    expect(parseNumber(" \t\n\f\r1.5 \r\n")).toBe(1.5);
  });

  test("rejects anything else", () => {
    for (const text of [
      "",
      " ",
      "5.",
      ".",
      "+",
      "1e",
      "1e+",
      "0x10",
      "Infinity",
      "NaN",
      "1 2",
      "1,",
      "10px",
      "1%",
      "--1",
      "1 ",
      "1e999",
      "-1e999",
    ]) {
      expect(parseNumber(text), text).toBeUndefined();
    }
  });

  test("reads back any finite number written by JavaScript", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(parseNumber(String(n))).toBe(n === 0 ? 0 : n);
      }),
    );
  });
});

describe("parseInteger", () => {
  test("reads an optional sign and digits", () => {
    expect(parseInteger("4")).toBe(4);
    expect(parseInteger("-1")).toBe(-1);
    expect(parseInteger("+2")).toBe(2);
    expect(parseInteger(" 007 ")).toBe(7);
  });

  test("rejects fractions, exponents and unsafe integers", () => {
    for (const text of ["1.0", "1.5", "1e2", "", "-", "9007199254740993"]) {
      expect(parseInteger(text), text).toBeUndefined();
    }
  });
});

describe("parseNumberList", () => {
  test("reads numbers separated by whitespace, a comma or both", () => {
    expect(parseNumberList("1 2,3 , 4\n5")).toEqual([1, 2, 3, 4, 5]);
    expect(parseNumberList(" 1 ")).toEqual([1]);
  });

  test("rejects empty lists and stray commas", () => {
    for (const text of ["", " ", ",1", "1,", "1,,2", "1 , , 2", "1-2", "1 x"]) {
      expect(parseNumberList(text), text).toBeUndefined();
    }
  });
});

describe("parseNumberPair", () => {
  test("uses one number for both", () => {
    expect(parseNumberPair("2")).toEqual([2, 2]);
    expect(parseNumberPair("2, 3")).toEqual([2, 3]);
  });

  test("rejects more than two numbers", () => {
    expect(parseNumberPair("1 2 3")).toBeUndefined();
    expect(parseNumberPair("")).toBeUndefined();
  });
});

describe("parseNumberOrPercentage", () => {
  test("tells a percentage from a number", () => {
    expect(parseNumberOrPercentage("0.5")).toEqual({ value: 0.5, unit: "" });
    expect(parseNumberOrPercentage("50%")).toEqual({ value: 50, unit: "%" });
  });

  test("rejects other units and a space before the percent sign", () => {
    expect(parseNumberOrPercentage("50 %")).toBeUndefined();
    expect(parseNumberOrPercentage("5px")).toBeUndefined();
    expect(parseNumberOrPercentage("%")).toBeUndefined();
  });
});
