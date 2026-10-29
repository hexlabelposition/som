# Architecture

This document records the decisions behind som (SVG Object Model) and the rules that keep the codebase consistent. Decisions marked **Accepted** are settled; **Proposed** ones are still under discussion. When a decision changes, update it here rather than leaving it implicit in code.

## 1. Decision log

| #   | Decision                                                                                                                                                      | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | Single package `@hexlabelposition/som` - SOM (SVG Object Model), MIT, TypeScript, ESM-only                                                                    | Accepted |
| A2  | Zero runtime dependencies                                                                                                                                     | Accepted |
| A3  | The parser, serializer and AST are part of som itself, not a dependency on another SVG library                                                                | Accepted |
| A4  | The AST is made of plain objects, mutated in place and copied explicitly with `clone()`                                                                       | Accepted |
| A5  | Pure JavaScript, no DOM: Node.js ≥ 22, Bun, browsers                                                                                                          | Accepted |
| A6  | Round trips are lossless at the tree level; lexical details are normalized (§5)                                                                               | Accepted |
| A7  | Single entry point `@hexlabelposition/som`; modules are not split into subpath exports such as `/spec` or `/paths` (§4)                                       | Accepted |
| A8  | Source organized as folders inside one package, not as workspace packages                                                                                     | Accepted |
| A9  | v0.1 scope: `parse`, `stringify` + `attributes`                                                                                                               | Accepted |
| A10 | Parsing is strict: only well-formed XML is accepted                                                                                                           | Accepted |
| A11 | Parsing never loads external entities and enforces fixed resource limits                                                                                      | Accepted |
| A12 | Parse errors are `SvgParseError` with stable `code` values and a source position                                                                              | Accepted |
| A13 | Dependency pinning policy (§8)                                                                                                                                | Accepted |
| A14 | Parsing and serialization are separate modules, `parse` and `stringify`, that do not depend on each other                                                     | Accepted |
| A15 | No options for now: functions take only their data (`parse(input)`, `stringify(document)`); options come later as an optional last argument                   | Accepted |
| A16 | v0.1 `attributes` helpers cover the `style` and `class` attributes; effective values and bulk operations are deferred (§6)                                    | Accepted |
| A17 | Mutating helpers return `void`; they return a value only when it tells the caller something new, like `toggleClass` (§2)                                      | Accepted |
| A18 | Spec data comes from pinned W3C sources; browser support from MDN BCD is a separate layer that never changes what is valid (§11)                              | Accepted |
| A19 | The API is exported as one namespace object, `import { s } from "@hexlabelposition/som"`, as zod does with `z`, instead of separate named functions (§4, B57) | Proposed |

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
│   ├── attributes/            # attribute helpers (§6)
│   │   ├── style.ts           #   parseStyle, stringifyStyle (value level)
│   │   ├── style-property.ts  # get/set/removeStyleProperty
│   │   ├── class.ts           #   has/add/remove/toggleClass
│   │   └── index.ts
│   ├── spec/               # element and attribute data per SVG version
│   │   ├── generated/      # output of scripts/generate-spec, committed
│   │   └── index.ts
│   ├── colors/             # later
│   ├── paths/              # later
│   └── internal/           # shared helpers (XML character rules, …), never exported
├── test/
│   ├── api-docs.test.ts    # every public export has TSDoc and a return type
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

- `@hexlabelposition/som` is the only entry point and exports the whole public API (A7).
- `package.json` `exports` lists exactly `.` and `./package.json`; tsdown builds one entry (`platform: "neutral"`, `target: "es2022"`, ESM, `.d.ts`).
- Core exports: `parse`, `stringify`, `getRoot`, `clone`, `SvgParseError` and all node types.
- No options for now (A15). Each function takes only its data. When options are needed, they are added as an optional last argument, which is not a breaking change.

### Single entry point

Modules are not published as subpath exports such as `@hexlabelposition/som/spec` or `@hexlabelposition/som/paths` (A7). Bundlers already drop what is not imported, so subpaths would not make bundles smaller; they would only add import paths to choose from and entries to keep stable, since removing or renaming a subpath is a breaking change. These rules keep the single entry point workable:

1. Export names are unique across the library, because the root entry point re-exports every module: `parsePath` and `parseColor`, not two functions named `parse`.
2. Modules have no side effects at import time and no shared state, so unused code is tree-shaken.

The one possible exception is a React integration, which is not planned yet. It would need `react` as a peer dependency, which the main entry point cannot have (A2), so it would be a separate entry point, `@hexlabelposition/som/react`, or a separate package (§3, rule 5). That choice is made if the integration is added.

### Namespace export (proposed)

The API is planned to be exported as one namespace object, the way zod exports `z` (A19, B57):

```ts
import { s } from "@hexlabelposition/som";

const document = s.parse(input);
s.addClass(s.getRoot(document), "icon");
```

One import gives the whole API and editor completion on `s.`, and nothing has to be imported name by name. It is not done yet; B57 decides these points first:

- **Tree-shaking.** `s` is an ES module namespace (`export * as s`), not a plain object, so bundlers can still drop members that are not used. B57 checks this with Rollup, esbuild and webpack before the change.
- **Named exports.** Whether the functions stay available as named exports next to `s`, or only through it. Removing them is a breaking change.
- **Types.** Whether node types are reached as `s.SvgElement` or stay separate type exports.
- **Name.** `s` or another short name.

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

- **Value level** (rule 3 in §3, no `ast` import): `parseStyle(text)` returns a property map, `stringifyStyle(properties)` writes one as `name: value; name: value`. Declarations are split with a small CSS tokenizer, so `;` and `:` inside strings, `url(…)` and comments do not break them. Values are trimmed and kept as written, including `!important` and comments inside them. Invalid declarations (no `:`, an invalid name, an empty value) are skipped, as CSS does.
- **Element level:** `getStyleProperty(el, name)`, `setStyleProperty(el, name, value)`, `removeStyleProperty(el, name)`. Only the affected declaration is rewritten; other declarations, their order, comments and spacing stay as they are.
- **Duplicates** follow CSS: `get` returns the last declaration. `set` writes into the last one and removes the earlier ones, which only served as fallbacks for it. `remove` removes all of them.
- **Names** are compared ASCII case-insensitively, except custom properties (`--name`), which are case-sensitive. `parseStyle` returns them lowercased.
- **Written declarations always read back.** `setStyleProperty` and `stringifyStyle` throw a `TypeError` for an empty value or one that does not close its strings, comments and brackets or contains a top-level `;`, so it cannot swallow the declarations after it.
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

- Lint, format check, type check, spec data check (§11), build and `npm pack --dry-run` on Node.js 24.
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
- **Anything that affects test or benchmark results or generated data** - benchmark competitors (svgson, svg-parser), icon sets and spec sources (§11) - is pinned to **exact versions**, so snapshots and benchmark numbers change only when the code changes. Dependabot ignores these packages; they are updated by hand.
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

## 11. Spec data

`src/spec/generated/` is built by `scripts/generate-spec` from pinned sources and committed (B32). The sources are chosen in A18.

### Versions

- **SVG 1.1** is SVG 1.1 Second Edition (2011). It keeps the elements SVG 2 dropped, such as the SVG fonts, `animateColor`, `tref`, `altGlyph`, `cursor` and `color-profile`.
- **SVG 2** is the editor's draft in [w3c/svgwg](https://github.com/w3c/svgwg) at a pinned commit, not the 2018 Candidate Recommendation: the draft is what the working group maintains and what MDN links to. It includes the modules SVG 2 relies on: Filter Effects, CSS Masking and SVG Animations. The animation elements (`animate`, `set`, `animateMotion`, `animateTransform`, `mpath`) are defined only in SVG Animations, not in the main definitions file.

### Sources

| Data                                    | SVG 1.1                                            | SVG 2                                                                                                                           |
| --------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Elements and their attributes           | Flat DTD `svg11-flat-20110816.dtd`                 | svgwg `master/definitions.xml`, `definitions-filters.xml`, `definitions-masking.xml`, `specs/animations/master/definitions.xml` |
| Attribute groups (core, conditional, …) | DTD parameter entities such as `%SVG.Core.attrib;` | `<attributecategory>` entries                                                                                                   |
| Presentation attributes                 | `%SVG.Presentation.attrib;`                        | `presentationattributes` of the `presentation` category, plus `geometryproperties` per element                                  |
| Value types (B34)                       | DTD datatype entities such as `%Length.datatype;`  | Decided in B34; the definitions files have no value types                                                                       |
| Cross-check of element names            | -                                                  | `@webref/elements` (`SVG2`, `filter-effects-1`, `css-masking-1`, `svg-animations`)                                              |
| Browser support (separate layer)        | -                                                  | `@mdn/browser-compat-data`: `svg.elements` and `svg.global_attributes`                                                          |

### Rules

- **Validity comes from the specs only.** Whether an element or attribute exists in a version is decided by the W3C sources. Browser support never adds or removes anything: the browsers do not implement all of SVG 2, but a document that uses an unsupported feature is still valid SVG 2.
- **Browser support is separate data.** BCD's status (`deprecated`, `standard_track`) and the first supported version per engine are generated next to the spec data, for functions that ask for them explicitly. It does not narrow the v0.2 types.
- **webref is a check, not a source.** The generator fails when the element names it reads from svgwg differ from `@webref/elements`, which catches a moved or renamed definitions file.
- **Pinning (§8).** svgwg is pinned to a commit SHA, the DTD to its dated URL and a SHA-256 checksum, and the npm packages to exact versions ignored by Dependabot. Updating a source is a separate commit that regenerates the data.
- **Licenses.** The svgwg files are under the W3C Document License, the DTD under its W3C copyright notice, BCD under CC0 and webref under MIT. Only facts such as names, categories and types are generated, no spec text, and each generated file names its sources and their licenses in a header.

### Generator

`bun run spec:generate` downloads the DTD and the svgwg files, checks each against the SHA-256 in `scripts/generate-spec/sources.ts`, reads the two npm packages from `node_modules` and writes three modules, formatted with Prettier. `bun run spec:check` builds the same output and fails if it differs from the committed files; CI runs it, so the data always matches its pins.

| File         | Exports                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `svg11.ts`   | `svg11Elements`, `svg11Groups`, `svg11PresentationAttributes`                  |
| `svg2.ts`    | `svg2Elements`, `svg2Groups`, `svg2PresentationAttributes`                     |
| `support.ts` | `svgElementSupport`, `svgGlobalAttributeSupport` (BCD, separate from validity) |

- **Shape.** Each element has `groups` (attribute groups it takes as a whole), `attributes` (its other attributes) and `presentation` (those of its attributes that are presentation attributes on this element only, such as `cx` on `circle` in SVG 2). Groups keep the names their source uses: `Core` and `GraphicalEvents` in the DTD, `core` and `global event` in svgwg. Names are sorted by UTF-16 code units, and every export is `as const`, so B33 can derive types from it. The generated modules are not exported from `spec/index.ts` until B33 and B35 decide the public API.
- **SVG 1.1.** The DTD is read like an external subset: parameter entities are expanded, the first declaration wins, conditional sections are included or ignored, external entities are never loaded. Groups are the collection entities an `<!ATTLIST>` names directly, such as `%SVG.Core.attrib;`.
- **SVG 2.** Elements are resolved as the svgwg build tools do: an element takes its attribute categories, the shared attributes it names, the shared attributes that list it, its own `<attribute>` entries and its geometry properties; module files fall back to the main file. Unlike the build tools, which index one spec at a time, shared attributes apply across files (SVG Animations adds `timelinebegin` to `svg`), and the presentation attributes come only from the main file, because the copy in `definitions-filters.xml` is the SVG 1.1 list. The files refer to a few names they never define, left over from SVG 1.1 (`document element event`, `style`, `externalResourcesRequired`); these are skipped and listed in the generator, and any new unknown name fails it.
- **Support.** BCD entries are limited to elements and attributes that exist in the generated SVG 1.1 or SVG 2 data, so support never adds a name. For each engine (Blink, Gecko, WebKit, read from Chrome, Firefox and Safari) the version is the first one with full, unprefixed support that has not been removed since, or `false`.
