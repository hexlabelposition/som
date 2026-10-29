import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatColor, parseColor, type SvgColor } from "./color";
import { namedColors, type SvgColorName } from "./named";
import { normalizeColor } from "./normalize";

/** Parses a color, or throws if the text is not one. */
function colorOf(text: string): SvgColor {
  const result = parseColor(text);
  if (result === undefined) throw new Error(`Not a color: ${text}`);
  return result;
}

/** Parses, normalizes and formats a color. */
const normalize = (text: string): string =>
  formatColor(normalizeColor(colorOf(text)));

interface Canvas {
  getContext(id: "2d"): { fillStyle: string } | null;
}

// The browser tests compare with what the browser makes of a color. The
// global is typed here, because the library and its tests have no DOM types.
const { document } = globalThis as {
  document?: { createElement(name: "canvas"): Canvas };
};

/** Normalizes a color the way the browser does, through a canvas. */
function normalizeInBrowser(text: string): SvgColor {
  const context = document?.createElement("canvas").getContext("2d");
  if (context === undefined || context === null) throw new Error("No canvas");
  context.fillStyle = text;
  return normalizeColor(colorOf(context.fillStyle));
}

describe("normalizeColor", () => {
  test("gives every notation of a color the same form", () => {
    for (const text of [
      "#f00",
      "#FF0000",
      "#ff0000ff",
      "red",
      "RED",
      "rgb(255, 0, 0)",
      "rgb(100%, 0%, 0%)",
      "rgb(255 0 0 / 1)",
      "rgba(255, 0, 0, 100%)",
      "hsl(0, 100%, 50%)",
      "hsl(360 100 50)",
      "hsl(-1turn 100% 50%)",
    ]) {
      expect(normalize(text), text).toBe("#f00");
    }
  });

  test("converts named colors to their values", () => {
    expect(normalize("rebeccapurple")).toBe("#639");
    expect(normalize("aliceblue")).toBe("#f0f8ff");
    expect(normalize("transparent")).toBe("#0000");
  });

  test("converts hsl() as CSS Color 4 does", () => {
    expect(normalize("hsl(120, 100%, 25%)")).toBe("#008000");
    expect(normalize("hsl(240, 100%, 50%)")).toBe("#00f");
    expect(normalize("hsl(0, 0%, 50%)")).toBe("#808080");
    expect(normalize("hsl(30, 100%, 50%, 0.5)")).toBe("#ff800080");
  });

  test("clamps values outside the range", () => {
    expect(normalize("rgb(300, -10, 0)")).toBe("#f00");
    expect(normalize("rgb(0 0 0 / 2)")).toBe("#000");
    expect(normalize("rgb(0 0 0 / -1)")).toBe("#0000");
    expect(normalize("hsl(0, 200%, 150%)")).toBe("#fff");
    expect(normalize("hsl(0, -50%, 50%)")).toBe("#808080");
  });

  test("rounds channels and alpha", () => {
    expect(normalize("rgb(127.5, 0.4, 0)")).toBe("#800000");
    expect(normalize("rgb(50%, 0%, 0%)")).toBe("#800000");
    expect(normalize("rgb(0 0 0 / 0.5)")).toBe("#00000080");
  });

  test("keeps currentColor", () => {
    expect(normalizeColor({ type: "currentColor" })).toEqual({
      type: "currentColor",
    });
  });

  test("returns a new object", () => {
    const color: SvgColor = {
      type: "hex",
      red: 1,
      green: 2,
      blue: 3,
      alpha: 1,
    };
    const result = normalizeColor(color);
    expect(result).toEqual(color);
    expect(result).not.toBe(color);
    expect(normalizeColor({ type: "named", name: "red" })).not.toBe(
      normalizeColor({ type: "named", name: "red" }),
    );
  });

  test("throws for values that are not finite and unknown names", () => {
    for (const color of [
      { type: "rgb", red: Number.NaN, green: 0, blue: 0, alpha: 1 },
      { type: "hex", red: 0, green: 0, blue: 0, alpha: Number.NaN },
      {
        type: "hsl",
        hue: Number.POSITIVE_INFINITY,
        saturation: 0,
        lightness: 0,
        alpha: 1,
      },
      { type: "named", name: "constructor" as SvgColorName },
    ] satisfies SvgColor[]) {
      expect(() => normalizeColor(color), JSON.stringify(color)).toThrow(
        TypeError,
      );
    }
  });

  test("is idempotent", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(finite, finite, finite, finite, (a, b, c, alpha) => {
        for (const color of [
          { type: "rgb", red: a, green: b, blue: c, alpha },
          { type: "hsl", hue: a, saturation: b, lightness: c, alpha },
        ] satisfies SvgColor[]) {
          const once = normalizeColor(color);
          expect(normalizeColor(once)).toEqual(once);
          expect(parseColor(formatColor(once))).toEqual(once);
        }
      }),
    );
  });
});

describe.skipIf(document === undefined)("normalizeColor in a browser", () => {
  test("named colors have the browser's values", () => {
    for (const name of Object.keys(namedColors)) {
      expect(normalize(name), name).toBe(formatColor(normalizeInBrowser(name)));
    }
  });

  test("hsl() converts as in the browser", () => {
    for (let hue = -30; hue <= 390; hue += 15) {
      for (const saturation of [0, 25, 50, 100]) {
        for (const lightness of [0, 10, 33, 50, 75, 100]) {
          const text = `hsl(${String(hue)}, ${String(saturation)}%, ${String(lightness)}%)`;
          const expected = normalizeInBrowser(text);
          const actual = normalizeColor(colorOf(text));
          // Engines round half-way channels differently, so allow one step.
          if (expected.type !== "hex" || actual.type !== "hex") {
            throw new Error(`Not converted to hex: ${text}`);
          }
          for (const channel of ["red", "green", "blue"] as const) {
            expect(
              Math.abs(actual[channel] - expected[channel]),
              `${text} ${channel}`,
            ).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
