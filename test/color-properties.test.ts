import { expect, test } from "vitest";
import { colorProperties } from "../src/colors/scan";
import { svg11Groups } from "../src/spec/generated/svg11";
import { svg2Groups } from "../src/spec/generated/svg2";

// The colors module lists its properties by hand, so it pulls no spec data
// into a bundle (ARCHITECTURE §12). They must be the presentation attributes
// with the `color` or `paint` value type in SVG 1.1 and SVG 2.

test("the color properties match the spec data", () => {
  const expected = new Map<string, boolean>();
  for (const group of [svg11Groups.Presentation, svg2Groups.presentation]) {
    for (const [name, type] of Object.entries(group)) {
      if (type === "color" || type === "paint") {
        expected.set(name, type === "paint");
      }
    }
  }
  expect(expected.size).toBeGreaterThan(0);
  expect([...colorProperties].sort(([a], [b]) => a.localeCompare(b))).toEqual(
    [...expected].sort(([a], [b]) => a.localeCompare(b)),
  );
});
