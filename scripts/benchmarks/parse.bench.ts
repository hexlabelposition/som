import { parse } from "@hexlabelposition/som";
import { parse as svgParserParse } from "svg-parser";
import { parseSync as svgsonParse } from "svgson";
import { test } from "vitest";
import { inputs } from "./inputs";

test.for(inputs)("parse: $name", async ({ documents }, { bench }) => {
  await bench.compare(
    bench("som", () => {
      for (const document of documents) parse(document);
    }),
    bench("svgson", () => {
      for (const document of documents) svgsonParse(document);
    }),
    bench("svg-parser", () => {
      for (const document of documents) svgParserParse(document);
    }),
  );
});
