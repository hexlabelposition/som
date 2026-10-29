import { describe, expect, test } from "vitest";
import { parseAngle, parseLength, parseLengthList } from "./length";

describe("parseLength", () => {
  test("reads user units, percentages and CSS units", () => {
    expect(parseLength("10")).toEqual({ value: 10, unit: "" });
    expect(parseLength("50%")).toEqual({ value: 50, unit: "%" });
    expect(parseLength("2.5mm")).toEqual({ value: 2.5, unit: "mm" });
    expect(parseLength("1.5em")).toEqual({ value: 1.5, unit: "em" });
    expect(parseLength("-1e2px")).toEqual({ value: -100, unit: "px" });
    expect(parseLength("3rem")).toEqual({ value: 3, unit: "rem" });
    expect(parseLength("10vmin")).toEqual({ value: 10, unit: "vmin" });
  });

  test("returns units in their canonical spelling", () => {
    expect(parseLength("2MM")).toEqual({ value: 2, unit: "mm" });
    expect(parseLength("1Px")).toEqual({ value: 1, unit: "px" });
    expect(parseLength("4q")).toEqual({ value: 4, unit: "Q" });
  });

  test("tells an exponent from a unit", () => {
    expect(parseLength("1em")).toEqual({ value: 1, unit: "em" });
    expect(parseLength("1e1em")).toEqual({ value: 10, unit: "em" });
    expect(parseLength("1ex")).toEqual({ value: 1, unit: "ex" });
  });

  test("rejects unknown units, spaces and keywords", () => {
    for (const text of [
      "",
      "10 px",
      "10pxx",
      "10deg",
      "auto",
      "px",
      "1%%",
      "1.px",
    ]) {
      expect(parseLength(text), text).toBeUndefined();
    }
  });
});

describe("parseLengthList", () => {
  test("reads lengths separated by whitespace, a comma or both", () => {
    expect(parseLengthList("10 20%, 3em")).toEqual([
      { value: 10, unit: "" },
      { value: 20, unit: "%" },
      { value: 3, unit: "em" },
    ]);
  });

  test("rejects empty lists and invalid items", () => {
    expect(parseLengthList("")).toBeUndefined();
    expect(parseLengthList("10, auto")).toBeUndefined();
  });
});

describe("parseAngle", () => {
  test("reads plain degrees and CSS angle units", () => {
    expect(parseAngle("45")).toEqual({ value: 45, unit: "" });
    expect(parseAngle("45deg")).toEqual({ value: 45, unit: "deg" });
    expect(parseAngle("100grad")).toEqual({ value: 100, unit: "grad" });
    expect(parseAngle("1.5RAD")).toEqual({ value: 1.5, unit: "rad" });
    expect(parseAngle("0.5turn")).toEqual({ value: 0.5, unit: "turn" });
  });

  test("rejects percentages, length units and keywords", () => {
    for (const text of ["50%", "10px", "auto", "auto-start-reverse", ""]) {
      expect(parseAngle(text), text).toBeUndefined();
    }
  });
});
