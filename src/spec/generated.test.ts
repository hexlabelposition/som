import { describe, expect, test } from "vitest";
import { svg11Elements, svg11Groups } from "./generated/svg11";
import { svg2Elements, svg2Groups } from "./generated/svg2";

// Spot checks of the generated value types (ARCHITECTURE §11). `bun run
// spec:check` proves the data matches its sources; these prove the generator
// reads them as intended.

describe("SVG 1.1 value types", () => {
  test("come from DTD datatypes", () => {
    expect(svg11Elements.rect.attributes.rx).toBe("length");
    expect(svg11Elements.path.attributes.d).toBe("path-data");
    expect(svg11Elements.svg.attributes.viewBox).toBe("view-box");
    expect(svg11Groups.Presentation.fill).toBe("paint");
    expect(svg11Groups.Core["xml:base"]).toBe("url");
  });

  test("list the keywords of enumerations", () => {
    expect(svg11Elements.linearGradient.attributes.gradientUnits).toEqual([
      "userSpaceOnUse",
      "objectBoundingBox",
    ]);
    expect(svg11Groups.Presentation["fill-rule"]).toEqual([
      "nonzero",
      "evenodd",
      "inherit",
    ]);
  });

  test("may differ between groups", () => {
    expect(svg11Groups.XLinkEmbed["xlink:show"]).toEqual(["embed"]);
    expect(svg11Groups.XLinkReplace["xlink:show"]).toEqual(["new", "replace"]);
  });
});

describe("SVG 2 value types", () => {
  test("come from CSS for presentation attributes", () => {
    expect(svg2Groups.presentation.fill).toBe("paint");
    expect(svg2Groups.presentation.opacity).toBe("number-or-percentage");
    expect(svg2Groups.presentation["paint-order"]).toBe("css");
    expect(svg2Groups.presentation["mask-type"]).toEqual([
      "luminance",
      "alpha",
    ]);
  });

  test("come from IDL for element attributes", () => {
    expect(svg2Elements.rect.attributes.rx).toBe("length");
    expect(svg2Elements.radialGradient.attributes.fr).toBe("length");
    expect(svg2Elements.feGaussianBlur.attributes.stdDeviation).toBe(
      "number-optional-number",
    );
    expect(svg2Elements.image.attributes.crossorigin).toEqual([
      "anonymous",
      "use-credentials",
    ]);
  });

  test("keep the more specific SVG 1.1 type", () => {
    expect(svg2Elements.stop.attributes.offset).toBe("number-or-percentage");
    expect(svg2Elements.linearGradient.attributes.gradientUnits).toEqual([
      "userSpaceOnUse",
      "objectBoundingBox",
    ]);
    expect(svg2Elements.path.attributes.d).toBe("path-data");
  });

  test("use overrides where SVG 2 changed an enumeration", () => {
    expect(svg2Elements.feBlend.attributes.mode).toContain("luminosity");
    expect(svg2Elements.feComposite.attributes.operator).toContain("lighter");
    expect(svg2Groups["animation timing"].fill).toEqual(["freeze", "remove"]);
  });

  test("follow the conventions for events and ARIA", () => {
    expect(svg2Groups["global event"].onclick).toBe("script");
    expect(svg2Groups.aria["aria-label"]).toBe("string");
  });
});
