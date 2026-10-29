import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { parseColor } from "../src";
import { namedColors } from "../src/colors/named";

// The named colors in src/colors are written out by hand, so a bundle can drop
// them (ARCHITECTURE §4). They must match CSS Color 4 `<named-color>`.

interface CssType {
  name: string;
  syntax?: string;
}

const css = JSON.parse(
  await readFile(
    new URL("../node_modules/@webref/css/css.json", import.meta.url),
    "utf8",
  ),
) as { types: CssType[] };

test("parseColor reads exactly the CSS named colors", () => {
  const syntax = css.types.find((type) => type.name === "named-color")?.syntax;
  const names = syntax?.split(" | ") ?? [];
  expect(names.length).toBeGreaterThan(140);
  for (const name of names) {
    expect(parseColor(name), name).toEqual({ type: "named", name });
  }

  expect(Object.keys(namedColors).sort()).toEqual([...names].sort());
});
