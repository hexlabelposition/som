// Builds `src/spec/generated/` from the pinned sources (ARCHITECTURE §11).
// With `--check`, compares the result with the committed files instead and
// fails if they differ.

import bcd from "@mdn/browser-compat-data";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { readSupport, type KnownNames } from "./bcd";
import { readSvg11 } from "./dtd";
import { emitSpec, emitSupport, header } from "./emit";
import type { SpecData } from "./model";
import {
  svg11Dtd,
  svg2Definitions,
  webrefSpecs,
  type RemoteSource,
} from "./sources";
import { readSvg2 } from "./svgwg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(root, "src/spec/generated");
const check = process.argv.includes("--check");

const download = async ({ url, sha256 }: RemoteSource): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${String(response.status)}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) {
    throw new Error(`${url}: SHA-256 is ${actual}, expected ${sha256}`);
  }
  return new TextDecoder().decode(bytes);
};

const packageVersion = async (name: string): Promise<string> => {
  const text = await readFile(
    join(root, "node_modules", name, "package.json"),
    "utf8",
  );
  return (JSON.parse(text) as { version: string }).version;
};

/**
 * Fails when the SVG 2 element names differ from `@webref/elements`, which
 * catches a moved or renamed definitions file.
 */
const checkWebref = async (svg2: SpecData): Promise<void> => {
  const names = new Set<string>();
  for (const spec of webrefSpecs) {
    const text = await readFile(
      join(root, "node_modules/@webref/elements", `${spec}.json`),
      "utf8",
    );
    const data = JSON.parse(text) as { elements: { name: string }[] };
    for (const element of data.elements) {
      names.add(element.name);
    }
  }
  const missing = [...names].filter((name) => !svg2.elements.has(name));
  const extra = [...svg2.elements.keys()].filter((name) => !names.has(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `SVG 2 elements differ from @webref/elements: missing ${missing.join(", ") || "none"}, extra ${extra.join(", ") || "none"}`,
    );
  }
};

const knownNames = (versions: SpecData[]): KnownNames => {
  const known: KnownNames = {
    elements: new Map(),
    globalAttributes: new Set(),
  };
  for (const version of versions) {
    for (const [name, element] of version.elements) {
      const attributes = known.elements.get(name) ?? new Set();
      for (const attribute of element.attributes) {
        attributes.add(attribute);
      }
      known.elements.set(name, attributes);
    }
    for (const attributes of version.groups.values()) {
      for (const attribute of attributes) {
        known.globalAttributes.add(attribute);
      }
    }
  }
  return known;
};

const [dtd, ...definitions] = await Promise.all(
  [svg11Dtd, ...svg2Definitions].map(download),
);
const svg11 = readSvg11(dtd ?? "");
const svg2 = readSvg2(definitions);
await checkWebref(svg2);
const support = readSupport(bcd.svg, knownNames([svg11, svg2]));

const webrefVersion = await packageVersion("@webref/elements");
const bcdVersion = await packageVersion("@mdn/browser-compat-data");

const files: Record<string, string> = {
  "svg11.ts": emitSpec(
    "svg11",
    svg11,
    header([
      `SVG 1.1 Second Edition DTD, ${svg11Dtd.url} (W3C copyright notice)`,
    ]),
  ),
  "svg2.ts": emitSpec(
    "svg2",
    svg2,
    header([
      ...svg2Definitions.map(({ url }) => `${url} (W3C Document License)`),
      `@webref/elements ${webrefVersion}, element names checked only (MIT)`,
    ]),
  ),
  "support.ts": emitSupport(
    support.elements,
    support.globalAttributes,
    header([
      `@mdn/browser-compat-data ${bcdVersion}, svg.elements and svg.global_attributes (CC0),`,
      "  limited to the elements and attributes in svg11.ts and svg2.ts",
    ]),
  ),
};

const changed: string[] = [];
for (const [name, source] of Object.entries(files)) {
  const path = join(output, name);
  const options = await resolveConfig(path);
  const text = await format(source, { ...options, filepath: path });
  const committed = await readFile(path, "utf8").catch(() => undefined);
  if (text === committed) {
    continue;
  }
  changed.push(name);
  if (!check) {
    await mkdir(output, { recursive: true });
    await writeFile(path, text);
  }
}

if (check && changed.length > 0) {
  console.error(
    `src/spec/generated is out of date: ${changed.join(", ")}. Run \`bun run spec:generate\`.`,
  );
  process.exit(1);
}
console.log(
  changed.length === 0
    ? "src/spec/generated is up to date."
    : `Wrote ${changed.join(", ")}.`,
);
