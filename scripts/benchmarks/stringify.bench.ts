import { parse, stringify } from "@hexlabelposition/som";
import { parseSync as svgsonParse, stringify as svgsonStringify } from "svgson";
import { test } from "vitest";
import { inputs } from "./inputs";

// svg-parser has no serializer, so stringify is compared with svgson only.
// Each library writes the tree its own parser produced.

test.for(inputs)("stringify: $name", async ({ documents }, { bench }) => {
  const trees = documents.map((document) => parse(document));
  const svgsonTrees = documents.map((document) => svgsonParse(document));

  await bench.compare(
    bench("som", () => {
      for (const tree of trees) stringify(tree);
    }),
    bench("svgson", () => {
      for (const tree of svgsonTrees) svgsonStringify(tree);
    }),
  );
});
