# som

**som (SVG Object Model)** is a zero-dependency, tree-shakeable ESM toolkit for working with SVG as plain objects in any JavaScript runtime.

> [!WARNING]
> **Status: early development (0.x).** v0.1 covers parsing, serialization, tree helpers and the `style` and `class` attributes. Until 1.0, any minor release may change the API. See [BACKLOG.md](./BACKLOG.md) for what is planned and [ARCHITECTURE.md](./ARCHITECTURE.md) for how it is built.

## Why

Working with SVG in JavaScript today usually means combining several packages: one to parse, one for paths, one for colors, one for bounds. Each has its own data format, its own types (or none), and often years without updates.

som aims to replace them with one coherent toolkit built around a single document model.

## Principles

- **One library, one model.** Parse once, run any number of operations on the same tree, serialize once.
- **SVG as plain objects.** The tree is ordinary data with no DOM nodes or parent references: edit it with plain property access, store it as JSON or send it to a worker.
- **Lossless round trips.** Element order, text, comments, CDATA, processing instructions, the XML declaration, DOCTYPE, namespaces, attribute order, and unknown elements and attributes all survive `parse` → `stringify`.
- **Type-safe.** Strict public types for the whole tree, and element and attribute name types per SVG version, generated from the specifications (`SvgElementName`, `SvgAttributeName`).
- **Fast parsing.** One pass over the input. In the benchmarks, `parse` is 3-4× faster than svg-parser and 6-13× faster than svgson; see [Performance](#performance).
- **Zero dependencies.** Pure JavaScript with no runtime dependencies and no DOM requirement.
- **ESM-only and tree-shakeable.** The API is made of independent functions without side effects, so a bundle contains only what you import: using `parse` does not pull in `stringify` or the `attributes` helpers.

## Guarantees

- **Strict parsing.** Only well-formed XML is accepted, and every error has a stable code and a source position.
- **Bounded parsing.** External entities are never loaded, and input size, nesting depth and entity expansion are limited.
- **No implicit interpretation.** Attribute values stay strings until a module explicitly parses them.
- **Tree-level round trips.** The tree is kept, not the exact source text: quote style, entity spelling and whitespace inside tags are normalized.

## Features

| Area                                   | What it covers                                                        | Version |
| -------------------------------------- | --------------------------------------------------------------------- | ------- |
| **parse**                              | Parse SVG into an AST                                                 | v0.1    |
| **stringify**                          | Serialize an AST back to SVG                                          | v0.1    |
| **ast**                                | `clone`, traversal, queries, type guards                              | v0.1    |
| **attributes**                         | Helpers for the `style` and `class` attributes                        | v0.1    |
| **spec types**                         | Element and attribute types per SVG version, generated from the specs | v0.2    |
| **colors**                             | Extract, normalize and replace colors                                 | v0.3    |
| **paths**                              | Parse, serialize and normalize path data (`d`)                        | v0.4    |
| **geometry, transforms, optimization** | Bounds, lengths, matrices, cleanup                                    | later   |

v0.1 is released. Later versions show the intended order, not dates.

## Install

```sh
npm install @hexlabelposition/som
```

## Usage

```ts
import { parse, stringify, getRoot } from "@hexlabelposition/som";

const doc = parse(
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
);
const svg = getRoot(doc);

// The tree is plain data: edit it directly.
const circle = svg.children[0];
if (circle.type === "element") {
  circle.attributes.fill = "currentColor";
}

stringify(doc);
// <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>
```

Operations mutate the document. When you need to keep the original, copy it explicitly:

```ts
import { clone } from "@hexlabelposition/som";

const copy = clone(doc);
```

Malformed input throws an `SvgParseError` with a stable `code` and the `line`, `column` and `offset` of the problem.

Element and attribute names can be checked against SVG 1.1 and SVG 2, as types and at run time:

```ts
import {
  isSvgAttributeName,
  type SvgAttributeName,
} from "@hexlabelposition/som";

isSvgAttributeName("rect", "rx"); // true
isSvgAttributeName("rect", "enable-background", "2"); // false: SVG 1.1 only

const name: SvgAttributeName<"rect", "2"> = "paint-order";
```

## Performance

All numbers here come from the benchmark suite in [`scripts/benchmarks/`](./scripts/benchmarks/), run with `bun run bench` against the built package. Compared with svgson 5.3.1 and svg-parser 2.1.0 on Node.js 26.8.1, Linux, Intel Core i5-11400H. Each cell shows how many times more operations per second som runs; below 1× means som is slower.

| Input                          | `parse` vs svg-parser | `parse` vs svgson | `stringify` vs svgson |
| ------------------------------ | --------------------- | ----------------- | --------------------- |
| Bootstrap Icons, 2,078 files   | 4.0×                  | 13.5×             | 0.8×                  |
| Inkscape export, 4 KB          | 3.0×                  | 6.6×              | 1.5×                  |
| Bootstrap Icons sprite, 1.1 MB | 3.7×                  | 13.4×             | 0.75×                 |

svg-parser has no serializer. svgson's tree leaves out the XML declaration, comments, DOCTYPE, processing instructions and whitespace-only text, so it has less to write; som keeps all of them and checks that every character is allowed in XML.

On Bun 1.4.0 (`bun run bench:bun`), som was faster than both libraries in every case, but the results varied more between runs. Numbers depend on the machine and the runtime, so run the benchmarks to compare on yours.

## Runtimes

Node.js ≥ 22, Bun ≥ 1.2.23, Chromium, Firefox and WebKit, all tested in CI.

## Non-goals

som is **not** a JSX parser, a renderer, a visual editor, or a sanitizer. Parsed documents keep scripts, event handlers and external references, so a document from an untrusted source must not be injected into a page as is. som works with SVG/XML markup, not JSX.

## Name

**som** stands for **SVG Object Model**: SVG represented as a tree of plain objects. The project is called som; it is published on npm as `@hexlabelposition/som`, because the unscoped `som` name is taken.

## Contributing

The project is not open for contributions yet. Development setup and conventions are described in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
