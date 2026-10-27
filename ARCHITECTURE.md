# Architecture

This document records the decisions behind som (SVG Object Model) and the rules that keep the codebase consistent. Decisions marked **Accepted** are settled; **Proposed** ones are still under discussion. When a decision changes, update it here rather than leaving it implicit in code.

## 1. Decision log

| #   | Decision                                                                                                                                    | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | Single package `@hexlabelposition/som` - SOM (SVG Object Model), MIT, TypeScript, ESM-only                                                  | Accepted |
| A2  | Zero runtime dependencies                                                                                                                   | Accepted |
| A3  | The parser, serializer and AST are part of som itself, not a dependency on another SVG library                                              | Accepted |
| A4  | The AST is made of plain objects, mutated in place and copied explicitly with `clone()`                                                     | Accepted |
| A5  | Pure JavaScript, no DOM: Node.js ≥ 22, Bun, browsers                                                                                        | Accepted |
| A6  | Round trips are lossless at the tree level; lexical details are normalized (§5)                                                             | Accepted |
| A7  | Single entry point `@hexlabelposition/som` for now; subpath exports can be added later without breaking changes (§4)                        | Accepted |
| A8  | Source organized as folders inside one package, not as workspace packages                                                                   | Accepted |
| A9  | v0.1 scope: `parse`, `stringify` + `attributes`                                                                                             | Accepted |
| A10 | Parsing is strict: only well-formed XML is accepted                                                                                         | Accepted |
| A11 | Parsing never loads external entities and enforces fixed resource limits                                                                    | Accepted |
| A12 | Parse errors are `SvgParseError` with stable `code` values and a source position                                                            | Accepted |
| A13 | Dependency pinning policy (§8)                                                                                                              | Accepted |
| A14 | Parsing and serialization are separate modules, `parse` and `stringify`, that do not depend on each other                                   | Accepted |
| A15 | No options for now: functions take only their data (`parse(input)`, `stringify(document)`); options come later as an optional last argument | Accepted |
| A16 | v0.1 `attributes` helpers cover the `style` and `class` attributes; effective values and bulk operations are deferred (§6)                  | Accepted |
| A17 | Mutating helpers return `void`; they return a value only when it tells the caller something new, like `toggleClass` (§2)                    | Accepted |

## 2. Data model

The AST is the public contract of the whole library: every module reads and writes it.

```ts
interface SvgDocument {
  type: "document";
  declaration?: XmlDeclaration; // <?xml version encoding standalone?>
  children: SvgDocumentChild[]; // exactly one SvgElement among them
}

interface SvgElement {
  type: "element";
  name: string; // qualified name as written: "svg", "sodipodi:namedview"
  attributes: Record<string, string>;
  children: SvgNode[];
}

interface SvgText {
  type: "text";
  value: string;
}
interface SvgCData {
  type: "cdata";
  value: string;
}
interface SvgComment {
  type: "comment";
  value: string;
}
interface SvgInstruction {
  type: "instruction";
  target: string;
  value: string;
}
interface SvgDoctype {
  type: "doctype";
  value: string;
}

type SvgNode = SvgElement | SvgText | SvgCData | SvgComment | SvgInstruction;

type SvgDocumentChild =
  SvgElement | SvgText | SvgComment | SvgInstruction | SvgDoctype;

interface XmlDeclaration {
  version: string;
  encoding?: string;
  standalone?: "yes" | "no";
}
```

Rules:

- **Attribute values are strings** with character and entity references decoded, and tabs and line breaks replaced by spaces as XML requires. Typed parsing (numbers, lengths, colors, path data) lives in the modules that need it.
- **Attribute order is the object's insertion order**, kept by `stringify()`. This is reliable because XML names cannot start with a digit.
- **Namespaces are kept as written.** Prefixes stay in names; `xmlns` declarations are ordinary attributes. Namespace URIs are not resolved; undeclared prefixes are rejected by the parser.
- **The document is an ordinary parent.** Its `children` hold the root element and the nodes around it, as in DOM and unist, so traversal treats it like any element. `getRoot()` finds the root element; a dedicated `root` field would make every traversal special-case the document.
- **The XML declaration is a field, not a node.** Set or delete `declaration` to control whether `stringify()` writes it.
- **Doctype appears only at document level; CDATA only inside elements.** The two child unions encode this.
- **No parent pointers.** The tree is plain data: it can be stored as JSON or sent to a worker. Traversal helpers pass the parent to callbacks instead.
- **Mutation is the default.** Editing is plain object editing (`el.attributes.fill = "red"`, `delete el.attributes.style`, splicing `children`). Helper functions mutate too. `clone(node)` makes a deep copy.
- **Mutating helpers return `void` (A17).** Returning the node would suggest a new copy, as in immutable APIs, and invite `const b = addClass(a, "x")` with `b === a` as a surprise; nested calls are no shorter than two statements anyway. A helper returns a value only when it tells the caller something they could not see before the call, as DOM does: `toggleClass` returns whether the class is present afterwards.

New node fields may only be added as optional fields. Changing or removing an existing field is a major release.

## 3. Module structure

One package, organized by domain folders. Each folder is treated as an internal package with an explicit public surface. Unit tests sit next to the code they test.

```text
som/
├── src/
│   ├── index.ts            # root entry: re-exports the public API of each module
│   ├── ast/                # node types, getRoot, clone, walk/find, type guards
│   │   ├── types.ts        #   node types
│   │   └── index.ts
│   ├── parse/              # parser: string → AST
│   │   ├── parse.ts        #   parse
│   │   ├── errors.ts       #   SvgParseError, SvgParseErrorCode
│   │   ├── scanner.ts      #   cursor and low-level reading shared by the files below
│   │   ├── markup.ts, entities.ts, doctype.ts, declaration.ts, namespaces.ts, limits.ts
│   │   ├── *.test.ts
│   │   └── index.ts
│   ├── stringify/          # serializer: AST → string
│   │   ├── stringify.ts    #   stringify
│   │   ├── escape.ts
│   │   ├── *.test.ts
│   │   └── index.ts
│   ├── attributes/         # attribute helpers (§6)
│   │   └── index.ts
│   ├── spec/               # element and attribute data per SVG version
│   │   ├── generated/      # output of scripts/generate-spec, committed
│   │   └── index.ts
│   ├── colors/             # later
│   ├── paths/              # later
│   └── internal/           # shared helpers (XML character rules, …), never exported
├── test/
│   ├── corpus.test.ts      # every fixture parses, round-trips, prints stably
│   ├── round-trip.test.ts  # property-based parse ↔ stringify tests (A6)
│   └── fixtures/           # Figma, Illustrator, Inkscape, SVGO inputs + licenses/
├── scripts/
│   ├── benchmarks/         # vitest bench suites for parse and stringify vs svgson and svg-parser
│   └── generate-spec/      # builds src/spec/generated from spec sources
├── .github/                # CI, docs, release workflows; Dependabot
├── README.md
├── ARCHITECTURE.md
├── BACKLOG.md
└── CONTRIBUTING.md
```

### Boundary rules

1. **A folder's `index.ts` is its public boundary.** Code outside a folder imports only from that folder's `index.ts`, never from its internal files. Enforced with `eslint-plugin-boundaries`, which also rejects any package or Node.js built-in imported from library code (A2).
2. **Dependencies flow one way** and never form cycles:

   ```text
   internal ← ast ← parse
                  ← stringify
                  ← attributes ← colors
                  ← spec
   ```

   `parse` and `stringify` never import each other (A14). They share only `ast` and `internal`, such as the XML character rules, so either one can be used, tested and tree-shaken on its own. Code that needs both, like the round-trip tests, lives outside them in `test/`.

3. **Value-level utilities do not depend on `ast`.** Functions like `parsePath("M0 0 L10 10")` or `parseColor("#fff")` work on strings, so they are usable with framework props, DOM attributes or any other source. AST-level functions (`replaceColor(doc, …)`) are built on top of them.
4. **`internal/` is never exported**, directly or through re-exports.
5. **A future separate package** is extracted from a folder into a workspace only when it needs its own dependencies or release cycle.

## 4. Public API

- `@hexlabelposition/som` is the only entry point for now and exports the whole public API.
- `package.json` `exports` lists exactly `.` and `./package.json`; tsdown builds one entry (`platform: "neutral"`, `target: "es2022"`, ESM, `.d.ts`).
- Core exports: `parse`, `stringify`, `getRoot`, `clone`, `SvgParseError` and all node types.
- No options for now (A15). Each function takes only its data. When options are needed, they are added as an optional last argument, which is not a breaking change.

### Future subpath exports

Subpath exports such as `@hexlabelposition/som/parse` and `@hexlabelposition/som/stringify` may be added later. Adding them is not a breaking change, but removing or renaming one is, so they wait until the module boundaries settle. To keep that step cheap, these rules apply from the start:

1. A folder's `index.ts` is its public API, so every folder can become a subpath as is.
2. Export names are unique across the library, because the root entry point re-exports every module: `parsePath` and `parseColor`, not two functions named `parse`.
3. Modules have no side effects at import time and no shared state.
4. Every class, such as `SvgParseError`, exists once in the build, so `instanceof` works whichever entry point it is imported from.

- Every exported function has an explicit return type and TSDoc comment.
- Every build is validated with publint and arethetypeswrong (`esm-only` profile, `error` level).

## 5. Parsing and serialization

### Parsing (`parse` module)

- Input is a string; streaming is out of scope.
- **Strict (A10).** Only well-formed XML is accepted. SVG embedded in HTML has to be extracted as well-formed XML first.
- **Any root element.** `parse()` checks that the input is well-formed XML, not that it is SVG: the root can be `<svg>`, a prefixed `<svg:svg>`, a fragment such as `<symbol>` or `<g>`, or any other element. Telling whether a document is SVG needs namespace and element data, so it belongs to `spec`.
- **Errors (A12).** `parse()` throws `SvgParseError` with `code`, `line`, `column` and `offset`. `line` and `column` start at 1; columns and offsets count UTF-16 code units, like string indexes. Codes: `MALFORMED_XML`, `MISSING_ROOT`, `UNDECLARED_PREFIX`, `UNDEFINED_ENTITY`, `EXTERNAL_ENTITY`, `UNSUPPORTED_ENTITY` and the limit codes `MAX_INPUT_LENGTH_EXCEEDED`, `MAX_DEPTH_EXCEEDED`, `MAX_ENTITY_EXPANSIONS_EXCEEDED`, `MAX_EXPANDED_LENGTH_EXCEEDED`. Existing codes change only in major releases; new codes may appear in minor ones; message text may change at any time.
- **Resource limits (A11).** External entities are never loaded. Input length (64 Mi chars), nesting depth (1,024), entity expansions (10,000, nested ones included) and expanded text length (1 Mi chars in total) are limited; predefined entities and character references do not count. The limits are fixed for now.
- **Entities.** Text entities declared in the internal DTD subset are expanded (Adobe Illustrator uses them). Entities containing markup throw `UNSUPPORTED_ENTITY`. The DTD is otherwise not interpreted: no parameter entities, no `<!ATTLIST>` defaults.
- **Whitespace** is kept as it is in the source, including whitespace-only text between elements.

### Serialization (`stringify` module)

- Works on any tree that matches the AST types, whether it came from `parse()` or was built by hand. Takes a document or a single node, such as `getRoot(document)`.
- Writes the tree as it is: no indentation is added and no whitespace is removed.
- Attributes are written in double quotes; elements without children are written as `<name/>`.
- Text and attribute values are escaped as needed. Characters that `parse()` would normalize are written as character references: `\r` in text, and tab, `\n` and `\r` in attribute values.
- **Output always reads back.** Every character is checked to be allowed in XML, and anything that cannot be written so that `parse()` returns the same tree throws a `TypeError`: invalid names, `--` in a comment, `]]>` in CDATA, `?>` in a processing instruction, `\r` where it cannot be escaped, non-whitespace text outside the root element, or a document without exactly one root element. Namespace prefixes are not checked.

### Round-trip guarantee (A6)

- For any document from `parse()`, `parse(stringify(doc))` is deeply equal to `doc`.
- Kept: element order, text including whitespace, comments, CDATA, processing instructions, the XML declaration, DOCTYPE, namespaces, attribute order, unknown elements and attributes.
- Normalized: quote style, entity spelling and whitespace inside tags.

### Deferred options

These options are candidates for later and are not part of the API yet (A15):

- `parse`: trimming whitespace-only text, source positions on nodes, configurable limits.
- `stringify`: pretty printing with indentation.

### Performance rules

- No regexes over the whole document, no intermediate token arrays where a single pass works, no repeated parsing within one operation chain.
- `parse` and `stringify` are benchmarked separately. Benchmarks measure the built `dist/`, the same entry point consumers use. Claims about speed in docs must come from the benchmark suite.

## 6. Attributes module

Because attributes are already a plain object, `attributes` must add behavior that plain access does not give, not wrap `el.attributes[name]` in functions. v0.1 contains helpers for the `style` and `class` attributes (A16). Mutating helpers return `void`, except `toggleClass` (A17).

### `style` attribute

- **Value level** (rule 3 in §3, no `ast` import): `parseStyle(text)` returns a property map, `stringifyStyle(properties)` writes one as `name: value; name: value`. Declarations are split with a small CSS tokenizer, so `;` and `:` inside strings, `url(…)` and comments do not break them. Values are trimmed and kept as written, including `!important`.
- **Element level:** `getStyleProperty(el, name)`, `setStyleProperty(el, name, value)`, `removeStyleProperty(el, name)`. Only the affected declaration is rewritten; other declarations, their order, comments and spacing stay as they are.
- **Duplicates** follow CSS: `get` returns the last declaration. `set` writes into the last one and removes the earlier ones, which only served as fallbacks for it. `remove` removes all of them.
- **Names** are compared ASCII case-insensitively, except custom properties (`--name`), which are case-sensitive.
- When the last declaration is removed, the `style` attribute is removed too.

### `class` attribute

- `hasClass(el, name)`, `addClass(el, name)`, `removeClass(el, name)`, `toggleClass(el, name)`.
- Semantics follow DOM `classList`: tokens are separated by ASCII whitespace, `add` appends a missing token at the end, existing tokens keep their order. An unchanged list is not rewritten; a changed one is written with single spaces and without duplicates.
- When the last token is removed, the `class` attribute is removed too.

### Deferred

- **Effective value** (an attribute versus the same property in `style`): it needs to know which attributes are presentation attributes, which is spec data, so it comes with v0.2 (B56). Even then it covers only the element itself: `<style>` sheets and inheritance are decided for colors in B38.
- **Bulk operations across a tree** (rename, remove or set an attribute on every matching element) are not added: with `findAll` (B17) they are a one-line loop over plain objects, so a helper would only wrap plain access.
- **Typed reads** (`getNumber`, `getLength`, …) depend on the spec data and come with v0.2.

## 7. Tooling

| Purpose                           | Tool                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Package manager and script runner | Bun (`bun.lock`, `bun install --frozen-lockfile` in CI)                                         |
| Language                          | TypeScript 6 (three projects: library, tests, scripts)                                          |
| Build                             | tsdown with publint and attw validation                                                         |
| Unit, property and corpus tests   | Vitest 5, `node` project                                                                        |
| Browser tests                     | Vitest browser mode with Playwright: Chromium, Firefox, WebKit                                  |
| Property-based tests              | fast-check                                                                                      |
| Benchmarks                        | `vitest bench` (Tinybench), sequential, one worker, vs svgson and svg-parser                    |
| Lint                              | ESLint 10 + typescript-eslint, eslint-config-prettier, `eslint.config.ts` via jiti              |
| Format                            | Prettier, including a separate Markdown check                                                   |
| Icon corpus                       | Simple Icons, Bootstrap Icons, Tabler Icons                                                     |
| Editor corpus                     | Checked-in Figma, Illustrator, Inkscape exports and SVGO regression inputs, with their licenses |

**CI** (GitHub Actions, actions pinned to commit SHAs):

- Lint, format check, type check, build and `npm pack --dry-run` on Node.js 24.
- Tests on Node.js 22, 24 and 26 (minimum, active LTS, current).
- Tests on Bun 1.2.23 and latest.
- Tests in Chromium, Firefox and WebKit.
- Markdown formatting check. Changes to Markdown and `LICENSE` alone skip CI and run only this check, in the docs workflow.

**Release:** pushing a `vX.Y.Z` tag that matches `package.json` runs CI, builds the package in a job without publishing permissions, stages it on npm with trusted publishing (OIDC, no long-lived token, provenance attached) and creates a GitHub release with generated notes. A staged version becomes installable only after a maintainer approves it with 2FA; the trusted publisher may stage but not publish. Pre-release versions (`X.Y.Z-beta.N`) are staged under the `next` dist-tag. The tag and the approval are the only manual steps; `npm pack --dry-run` runs in regular CI so packaging problems show up before a tag.

**Conventions:** Conventional Commits (`feat`, `fix`, `perf`, `docs`, `test`, `build`, `ci`, `chore`); release commits are `chore: release X.Y.Z`. Workflow changes are checked with actionlint.

**Testing rules:**

- Every change to `parse` or `stringify` keeps the round-trip property: `parse(stringify(parse(x)))` equals `parse(x)`.
- Every corpus file and every icon parses, round-trips and produces stable output.
- Third-party fixtures keep their licenses in `test/fixtures/licenses/` and are never shipped in the package.

## 8. Dependency policy

- **Runtime dependencies:** none.
- **GitHub Actions:** pinned to commit SHAs, updated weekly by Dependabot with a 7-day cooldown.
- **Tooling** (tsdown, vitest, eslint, …): caret ranges (`^`), `bun.lock` committed. Exception: TypeScript uses a tilde range (`~`), because typescript-eslint supports only specific TypeScript minor versions. Updated weekly by Dependabot as one grouped pull request with a 7-day cooldown; TypeScript minor and major updates are ignored and done by hand.
- **Anything that affects test or benchmark results** - benchmark competitors (svgson, svg-parser) and icon sets - is pinned to **exact versions**, so snapshots and benchmark numbers change only when the code changes. Dependabot ignores these packages; they are updated by hand.
- **`@types/node`** follows the minimum supported Node.js version (§9), so its major updates are ignored by Dependabot and done by hand when the minimum changes.
- **Docker images** in workflows (actionlint, Playwright) are pinned to digests and updated by hand.
- **Playwright** is pinned to an exact version that matches the `mcr.microsoft.com/playwright` image the browser tests run in. The package and the image digest in `ci.yml` are updated together by hand.
- The package manager is declared in the `packageManager` field.

## 9. Compatibility

- som works with SVG/XML markup. It does not parse JSX: JSX attributes can contain arbitrary JavaScript expressions.
- No DOM APIs are used in `src/`. Browser support means "runs in a browser", not "integrates with live DOM nodes".
- Node.js ≥ 22 is the minimum. Bun is tested from 1.2.23. Deno is expected to work but is not tested yet.

## 10. Non-goals

- Rendering, canvas or editor UI.
- Parsing JSX/TSX.
- Sanitizing SVG. Parsed documents keep scripts, event handlers and external references and must not be injected into a page as is.
- Interpreting the DTD beyond text entities, or resolving namespace URIs.
- Full SVGO-level optimization in early versions.
- Complete coverage of the SVG specification before v1.0.
