import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatColor, parseColor, type SvgColor } from "./color";
import { namedColors, type SvgColorName } from "./named";

const rgb = (
  red: number,
  green: number,
  blue: number,
  alpha = 1,
): SvgColor => ({
  type: "rgb",
  red,
  green,
  blue,
  alpha,
});

const hsl = (
  hue: number,
  saturation: number,
  lightness: number,
  alpha = 1,
): SvgColor => ({ type: "hsl", hue, saturation, lightness, alpha });

describe("parseColor", () => {
  test("reads hex colors of 3, 4, 6 and 8 digits", () => {
    const red = { type: "hex", red: 255, green: 0, blue: 0 };
    expect(parseColor("#f00")).toEqual({ ...red, alpha: 1 });
    expect(parseColor("#FF0000")).toEqual({ ...red, alpha: 1 });
    expect(parseColor("#f008")).toEqual({ ...red, alpha: 0x88 / 255 });
    expect(parseColor("#ff000080")).toEqual({ ...red, alpha: 0x80 / 255 });
    expect(parseColor("#12345678")).toEqual({
      type: "hex",
      red: 0x12,
      green: 0x34,
      blue: 0x56,
      alpha: 0x78 / 255,
    });
  });

  test("rejects other hex lengths and digits", () => {
    for (const text of ["#", "#f", "#ff", "#fffff", "#fffffff", "#fffffffff"]) {
      expect(parseColor(text), text).toBeUndefined();
    }
    expect(parseColor("#ggg")).toBeUndefined();
    expect(parseColor("#f 00")).toBeUndefined();
    expect(parseColor("# f00")).toBeUndefined();
  });

  test("reads rgb() in the comma-separated syntax", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual(rgb(255, 0, 0));
    expect(parseColor("rgb(255,0,0)")).toEqual(rgb(255, 0, 0));
    expect(parseColor("rgb( 100% , 50% , 0% )")).toEqual(rgb(255, 127.5, 0));
    expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual(rgb(255, 0, 0, 0.5));
    expect(parseColor("rgb(255, 0, 0, 50%)")).toEqual(rgb(255, 0, 0, 0.5));
    expect(parseColor("rgba(255, 0, 0)")).toEqual(rgb(255, 0, 0));
  });

  test("reads rgb() in the space-separated syntax", () => {
    expect(parseColor("rgb(255 0 0)")).toEqual(rgb(255, 0, 0));
    expect(parseColor("rgb(255 0 0 / 0.5)")).toEqual(rgb(255, 0, 0, 0.5));
    expect(parseColor("rgb(255 0 0/50%)")).toEqual(rgb(255, 0, 0, 0.5));
    expect(parseColor("rgb(100% 0 0)")).toEqual(rgb(255, 0, 0));
    expect(parseColor("rgba( 1.5 2e1 3 )")).toEqual(rgb(1.5, 20, 3));
  });

  test("keeps rgb() values outside the range", () => {
    expect(parseColor("rgb(300, -10, 0, 2)")).toEqual(rgb(300, -10, 0, 2));
  });

  test("reads hsl() with the hue in degrees", () => {
    expect(parseColor("hsl(120, 100%, 25%)")).toEqual(hsl(120, 100, 25));
    expect(parseColor("hsla(120, 100%, 25%, 0.5)")).toEqual(
      hsl(120, 100, 25, 0.5),
    );
    expect(parseColor("hsl(120 100% 25%)")).toEqual(hsl(120, 100, 25));
    expect(parseColor("hsl(120 100 25 / 50%)")).toEqual(hsl(120, 100, 25, 0.5));
    expect(parseColor("hsl(120deg, 100%, 25%)")).toEqual(hsl(120, 100, 25));
    expect(parseColor("hsl(0.5turn 100% 25%)")).toEqual(hsl(180, 100, 25));
    expect(parseColor("hsl(200grad 100% 25%)")).toEqual(hsl(180, 100, 25));
    expect(parseColor("hsl(400 50% 50%)")).toEqual(hsl(400, 50, 50));

    const radians = parseColor("hsl(3.141592653589793rad 100% 25%)");
    expect(radians).toMatchObject({ type: "hsl", saturation: 100 });
    expect(radians?.type === "hsl" && radians.hue).toBeCloseTo(180);
  });

  test("reads function names case-insensitively", () => {
    expect(parseColor("RGB(255, 0, 0)")).toEqual(rgb(255, 0, 0));
    expect(parseColor("HsLa(120DEG, 100%, 25%)")).toEqual(hsl(120, 100, 25));
  });

  test("rejects malformed color functions", () => {
    for (const text of [
      "rgb()",
      "rgb(255)",
      "rgb(255, 0)",
      "rgb(255, 0, 0, 0, 0)",
      "rgb(255 0 0 0)",
      "rgb(255 0)",
      "rgb(255, 0%, 0)",
      "rgb(255 0, 0)",
      "rgb(255, 0, 0 / 0.5)",
      "rgb(255 0 0 /)",
      "rgb(255 0 0 / 0.5 / 1)",
      "rgb(255 0 0 / 0.5 1)",
      "rgb(255,, 0)",
      "rgb(255, 0, 0,)",
      "rgb (255, 0, 0)",
      "rgb(255, 0, 0",
      "rgb(255px, 0, 0)",
      "rgb(none 0 0)",
      "rgb(calc(255) 0 0)",
      "hsl(120, 100, 25)",
      "hsl(120%, 100%, 25%)",
      "hsl(120px 100% 25%)",
      "hsl(120 100% 25)extra",
      "hwb(120 0% 0%)",
      "lab(50% 40 59)",
      "color(srgb 1 0 0)",
    ]) {
      expect(parseColor(text), text).toBeUndefined();
    }
  });

  test("reads every named color case-insensitively", () => {
    for (const name of Object.keys(namedColors)) {
      expect(parseColor(name)).toEqual({ type: "named", name });
      expect(parseColor(name.toUpperCase())).toEqual({ type: "named", name });
    }
    expect(parseColor("transparent")).toEqual({
      type: "named",
      name: "transparent",
    });
  });

  test("reads currentColor case-insensitively", () => {
    expect(parseColor("currentColor")).toEqual({ type: "currentColor" });
    expect(parseColor("currentcolor")).toEqual({ type: "currentColor" });
    expect(parseColor("CURRENTCOLOR")).toEqual({ type: "currentColor" });
  });

  test("compares keywords by ASCII case only", () => {
    // U+212A KELVIN SIGN lowercases to "k" in JavaScript, not in CSS.
    expect(parseColor("blacK")).toBeUndefined();
  });

  test("ignores SVG whitespace around the color", () => {
    expect(parseColor(" \t\n\f\r#f00 \r\n")).toMatchObject({ type: "hex" });
    expect(parseColor(" red ")).toEqual({ type: "named", name: "red" });
  });

  test("rejects paint values and other text", () => {
    for (const text of [
      "",
      " ",
      "none",
      "url(#g)",
      "url(#g) red",
      "red blue",
      "inherit",
      "Canvas",
      "#f00 icc-color(x, 1)",
      "constructor",
      "__proto__",
    ]) {
      expect(parseColor(text), text).toBeUndefined();
    }
  });
});

describe("formatColor", () => {
  test("writes hex colors lowercase and as short as possible", () => {
    const hex = (red: number, green: number, blue: number, alpha = 1) =>
      formatColor({ type: "hex", red, green, blue, alpha });
    expect(hex(255, 0, 0)).toBe("#f00");
    expect(hex(0x12, 0x34, 0x56)).toBe("#123456");
    expect(hex(255, 0, 0, 0x88 / 255)).toBe("#f008");
    expect(hex(255, 0, 0, 0.5)).toBe("#ff000080");
    expect(hex(255, 0, 0, 0)).toBe("#f000");
    expect(hex(0xab, 0xcd, 0xef)).toBe("#abcdef");
  });

  test("writes rgb() and hsl() comma-separated", () => {
    expect(formatColor(rgb(255, 127.5, 0))).toBe("rgb(255, 127.5, 0)");
    expect(formatColor(rgb(255, 0, 0, 0.5))).toBe("rgba(255, 0, 0, 0.5)");
    expect(formatColor(hsl(120, 100, 25))).toBe("hsl(120, 100%, 25%)");
    expect(formatColor(hsl(120, 100, 25, 0.5))).toBe(
      "hsla(120, 100%, 25%, 0.5)",
    );
  });

  test("writes named colors and currentColor", () => {
    expect(formatColor({ type: "named", name: "rebeccapurple" })).toBe(
      "rebeccapurple",
    );
    expect(formatColor({ type: "currentColor" })).toBe("currentColor");
  });

  test("throws for values that would not read back", () => {
    for (const color of [
      { type: "hex", red: 256, green: 0, blue: 0, alpha: 1 },
      { type: "hex", red: -1, green: 0, blue: 0, alpha: 1 },
      { type: "hex", red: 1.5, green: 0, blue: 0, alpha: 1 },
      { type: "hex", red: 0, green: 0, blue: 0, alpha: 2 },
      { type: "hex", red: 0, green: 0, blue: 0, alpha: Number.NaN },
      rgb(Number.NaN, 0, 0),
      rgb(0, Number.POSITIVE_INFINITY, 0),
      rgb(0, 0, 0, Number.NaN),
      hsl(Number.NaN, 0, 0),
      { type: "named", name: "Red" as SvgColorName },
      { type: "named", name: "constructor" as SvgColorName },
    ] satisfies SvgColor[]) {
      expect(() => formatColor(color), JSON.stringify(color)).toThrow(
        TypeError,
      );
    }
  });
});

describe("parseColor and formatColor", () => {
  const byte = fc.integer({ min: 0, max: 255 });
  const finite = fc.double({ noNaN: true, noDefaultInfinity: true });

  test("hex colors read back with their bytes", () => {
    fc.assert(
      fc.property(byte, byte, byte, byte, (red, green, blue, alpha) => {
        const color: SvgColor = {
          type: "hex",
          red,
          green,
          blue,
          alpha: alpha / 255,
        };
        expect(parseColor(formatColor(color))).toEqual(color);
      }),
    );
  });

  test("rgb() and hsl() colors read back exactly", () => {
    fc.assert(
      fc.property(finite, finite, finite, finite, (a, b, c, alpha) => {
        // -0 is written as 0, so it reads back as 0.
        const [x, y, z, w] = [a, b, c, alpha].map((n) => n + 0) as [
          number,
          number,
          number,
          number,
        ];
        expect(parseColor(formatColor(rgb(x, y, z, w)))).toEqual(
          rgb(x, y, z, w),
        );
        expect(parseColor(formatColor(hsl(x, y, z, w)))).toEqual(
          hsl(x, y, z, w),
        );
      }),
    );
  });

  test("formatting is stable", () => {
    const reformat = (text: string): string => {
      const color = parseColor(text);
      if (color === undefined) throw new Error(`Not a color: ${text}`);
      return formatColor(color);
    };
    for (const text of [
      "#FF0000",
      "#ff000080",
      "rgb(100% 50% 0% / 25%)",
      "HSL(0.25turn 50 50)",
      "RebeccaPurple",
      "currentcolor",
    ]) {
      const once = reformat(text);
      expect(reformat(once), text).toBe(once);
    }
  });
});
