import { describe, expect, test } from "vitest";
import { readPaint } from "./paint";

const red = { type: "named", name: "red" };

describe("readPaint", () => {
  test("reads a color and its position", () => {
    expect(readPaint(" red ", false)).toEqual({
      value: "red",
      color: red,
      start: 1,
      end: 4,
    });
    expect(readPaint("#f00", true)).toEqual({
      value: "#f00",
      color: { type: "hex", red: 255, green: 0, blue: 0, alpha: 1 },
      start: 0,
      end: 4,
    });
  });

  test("reads paint keywords only as a paint", () => {
    expect(readPaint("none", true)).toEqual({
      value: "none",
      start: 0,
      end: 0,
    });
    expect(readPaint("Context-Fill", true)?.value).toBe("Context-Fill");
    expect(readPaint("context-stroke", true)?.value).toBe("context-stroke");
    expect(readPaint("none", false)).toBe(undefined);
  });

  test("reads url() with an optional fallback", () => {
    expect(readPaint("url(#g)", true)).toEqual({
      value: "url(#g)",
      url: "#g",
      start: 7,
      end: 7,
    });
    expect(readPaint("URL( '#g' ) none", true)).toEqual({
      value: "URL( '#g' ) none",
      url: "#g",
      start: 12,
      end: 12,
    });
    expect(readPaint(' url("#a b")  red ', true)).toEqual({
      value: 'url("#a b")  red',
      color: red,
      url: "#a b",
      start: 14,
      end: 17,
    });
    expect(readPaint("url(#g)red", true)?.color).toEqual(red);
    expect(readPaint("url(#g) red", false)).toBe(undefined);
  });

  test.each([
    "",
    " ",
    "inherit",
    "freeze",
    "hwb(0 0% 0%)",
    "#f00 icc-color(x, 1)",
    "url(#g",
    "url(#a b)",
    "url('#g)",
    "url('#g' x)",
    "url(#g) inherit",
    "url(#g) url(#h)",
    "none red",
  ])("returns undefined for %j", (text) => {
    expect(readPaint(text, true)).toBe(undefined);
  });
});
