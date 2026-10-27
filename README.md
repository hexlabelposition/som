# som

**som (SVG Object Model)** is a zero-dependency, tree-shakeable ESM toolkit for working with SVG as plain objects in any JavaScript runtime.

> [!WARNING]
> **Status: pre-alpha.** som is in the design phase, and every API shown below is a draft that may change. See [BACKLOG.md](./BACKLOG.md) for what is planned and [ARCHITECTURE.md](./ARCHITECTURE.md) for how it is built.

## Why

Working with SVG in JavaScript today usually means combining several packages: one to parse, one for paths, one for colors, one for bounds. Each has its own data format, its own types (or none), and often years without updates.

som aims to replace them with one coherent toolkit built around a single document model.

## Principles

- **One library, one model.** Parse once, run any number of operations on the same tree, serialize once.
- **SVG as plain objects.** The tree is ordinary data with no DOM nodes or parent references: edit it with plain property access, store it as JSON or send it to a worker.
- **Lossless round trips.** Element order, text, comments, CDATA, processing instructions, the XML declaration, DOCTYPE, namespaces, attribute order, and unknown elements and attributes all survive `parse` → `stringify`.
- **Type-safe.** Strict public types, including element and attribute types generated from the SVG specifications.
- **Fast.** Single-pass parsing and minimal allocations, benchmarked against svgson and svg-parser. Published numbers come only from the benchmark suite.
- **Zero dependencies.** Pure JavaScript with no runtime dependencies and no DOM requirement.
- **ESM-only and tree-shakeable.** The API is made of independent functions without side effects, so a bundle contains only what you import: using `parse` does not pull in `stringify` or `colors`.

## Guarantees

- **Strict parsing.** Only well-formed XML is accepted, and every error has a stable code and a source position.
- **Bounded parsing.** External entities are never loaded, and input size, nesting depth and entity expansion are limited.
- **No implicit interpretation.** Attribute values stay strings until a module explicitly parses them.
- **Tree-level round trips.** The tree is kept, not the exact source text: quote style, entity spelling and whitespace inside tags are normalized.

## Planned features

| Area                                   | What it covers                                                        | Planned for |
| -------------------------------------- | --------------------------------------------------------------------- | ----------- |
| **parse**                              | Parse SVG into an AST                                                 | v0.1        |
| **stringify**                          | Serialize an AST back to SVG                                          | v0.1        |
| **ast**                                | `clone`, traversal, queries, type guards                              | v0.1        |
| **attributes**                         | Helpers for the `style` and `class` attributes                        | v0.1        |
| **spec types**                         | Element and attribute types per SVG version, generated from the specs | v0.2        |
| **colors**                             | Extract, normalize and replace colors                                 | v0.3        |
| **paths**                              | Parse, serialize and normalize path data (`d`)                        | v0.4        |
| **geometry, transforms, optimization** | Bounds, lengths, matrices, cleanup                                    | later       |

Versions show the intended order, not dates.

## Usage (draft API)

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
