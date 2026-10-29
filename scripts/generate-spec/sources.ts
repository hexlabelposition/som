/**
 * Pinned spec sources (ARCHITECTURE §11). Updating a source is a separate
 * commit that changes the pin and regenerates `src/spec/generated/`.
 */

/**
 * A file downloaded at generation time, checked against its SHA-256 so the
 * output changes only when the pin changes.
 */
export interface RemoteSource {
  url: string;
  sha256: string;
}

/**
 * SVG 1.1 Second Edition, the flat DTD with every module inlined.
 */
export const svg11Dtd: RemoteSource = {
  url: "https://www.w3.org/Graphics/SVG/1.1/DTD/svg11-flat-20110816.dtd",
  sha256: "7c22266d65655a7d359e9e79a107d156e64b29a87491313be2092bd66cab3b9b",
};

/**
 * The w3c/svgwg commit the SVG 2 definitions are read from.
 */
export const svgwgCommit = "7d2a72609cbf3cc6d8478ffb25ee5ed87a30ace0";

const svgwg = (path: string, sha256: string): RemoteSource => ({
  url: `https://raw.githubusercontent.com/w3c/svgwg/${svgwgCommit}/${path}`,
  sha256,
});

/**
 * SVG 2 definitions files. The main file comes first: the others are modules
 * that fall back to it for attributes and categories they do not define.
 */
export const svg2Definitions: readonly RemoteSource[] = [
  svgwg(
    "master/definitions.xml",
    "ec5ccd787f33dd54d74349ee5fd67aae582e58e095ff31ad30f8fa442b7dc016",
  ),
  svgwg(
    "master/definitions-filters.xml",
    "f96968584136839df0770a6f09049f780b066f1a4b0821dd6664dc50992c696c",
  ),
  svgwg(
    "master/definitions-masking.xml",
    "50a0769cbc0855fa91b3323876a3a8005cd59ffcb6521d7c13cdf936a4de3ac8",
  ),
  svgwg(
    "specs/animations/master/definitions.xml",
    "bcdd0fc20a13924d423243d6d2fecc28c265d23851c3f7d0ef762ebc917c3385",
  ),
];

/**
 * `@webref/elements` files whose element names must match the SVG 2
 * definitions.
 */
export const webrefSpecs: readonly string[] = [
  "SVG2",
  "filter-effects-1",
  "css-masking-1",
  "svg-animations",
];
