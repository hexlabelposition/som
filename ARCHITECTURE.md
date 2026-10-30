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
| A20 | Spec types take the SVG version as an optional last parameter; without it, a name is valid if any version defines it (§11)                                    | Accepted |
| A21 | Typed reads parse by syntax, without the spec data; a missing or invalid value is `undefined`, and units are kept as written (§6)                             | Accepted |
| A22 | Colors are read and replaced where they are written, in attributes, `style` and `<style>`; selectors, inheritance and `url(#…)` are not resolved (§12)        | Accepted |

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
│   ├── colors/             # color values (§12)
│   │   ├── color.ts        #   parseColor, formatColor, color types
│   │   ├── named.ts        #   named color table
│   │   ├── normalize.ts    #   normalizeColor
│   │   ├── extract.ts      #   extractColors
│   │   ├── replace.ts      #   replaceColor
│   │   ├── scan.ts         #   finds colors in a tree, SvgColorUse
│   │   └── index.ts
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

   `spec` uses `attributes` for the `style` attribute (B56); `attributes` never uses `spec`, so its helpers pull no spec data into a bundle (A21). `colors` also uses `ast` and `internal` directly: the CSS tokenizer that `attributes` uses for `style` lives in `internal`, so `colors` reads `style` attributes and `<style>` sheets with it (§12).

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
2. Modules have no side effects at import time and no shared state, so unused code is tree-shaken. Top-level values are built from literals only: `new Map([…])` and `new Set([…])` of literals are fine, but no other calls, such as `[…].map(…)`. Bundlers know the first kind has no side effects and drop it when unused; they cannot tell that of an arbitrary call, so they keep it, and everything it uses, in every bundle, even one that imports only `parse` (checked with Bun 1.4 and rolldown).

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
- **Duplicates** follow CSS: `get` and `parseStyle` return the last declaration, or the last `!important` one if there is one, since it wins over any later declaration that is not. `set` writes into the last one and removes the earlier ones, so the new value is the only one left. `remove` removes all of them.
- **Names** are compared ASCII case-insensitively, except custom properties (`--name`), which are case-sensitive. `parseStyle` returns them lowercased.
- **Written declarations always read back.** `setStyleProperty` and `stringifyStyle` throw a `TypeError` for an empty value or one that does not close its strings, comments and brackets or contains a top-level `;`, so it cannot swallow the declarations after it.
- When the last declaration is removed, the `style` attribute is removed too.

### `class` attribute

- `hasClass(el, name)`, `addClass(el, name)`, `removeClass(el, name)`, `toggleClass(el, name)`.
- Semantics follow DOM `classList`: tokens are separated by ASCII whitespace, `add` appends a missing token at the end, existing tokens keep their order. An unchanged list is not rewritten; a changed one is written with single spaces and without duplicates.
- When the last token is removed, the `class` attribute is removed too.

### Typed reads

Typed reads parse attribute values that are numbers, lengths and similar simple kinds (B36, A21). Each kind has a value-level parser and an element-level reader that parses one attribute with it (§3, rule 3):

| Kind (B34)               | Value level                 | Element level                     | Result                   |
| ------------------------ | --------------------------- | --------------------------------- | ------------------------ |
| `number`                 | `parseNumber`               | `getNumber(el, name)`             | `number`                 |
| `integer`                | `parseInteger`              | `getInteger(el, name)`            | `number`                 |
| `number-list`            | `parseNumberList`           | `getNumberList(el, name)`         | `number[]`               |
| `number-optional-number` | `parseNumberPair`           | `getNumberPair(el, name)`         | `[number, number]`       |
| `number-or-percentage`   | `parseNumberOrPercentage`   | `getNumberOrPercentage(el, name)` | `SvgNumberOrPercentage`  |
| `length`                 | `parseLength`               | `getLength(el, name)`             | `SvgLength`              |
| `length-list`            | `parseLengthList`           | `getLengthList(el, name)`         | `SvgLength[]`            |
| `angle`                  | `parseAngle`                | `getAngle(el, name)`              | `SvgAngle`               |
| `view-box`               | `parseViewBox`              | `getViewBox(el)`                  | `SvgViewBox`             |
| `preserve-aspect-ratio`  | `parsePreserveAspectRatio`  | `getPreserveAspectRatio(el)`      | `SvgPreserveAspectRatio` |
| enumerations             | `parseKeyword(text, words)` | `getKeyword(el, name, words)`     | one of `words`           |

Colors, paint, path data and transforms have their own milestones (v0.3, v0.4, B48).

- **`undefined` for missing and invalid values.** A missing attribute and a value that does not parse both return `undefined`, like `getStyleProperty`, so reading a document from any source never throws, as browsers ignore an invalid attribute. Plain access (`el.attributes[name]`) tells the two apart.
- **By syntax, not by spec (A21).** The readers parse any attribute, including unknown ones and editor attributes such as `inkscape:*`, and do not check that the spec gives the attribute that kind: `getLength(el, "fill")` parses `fill` as a length. So `attributes` does not depend on `spec` and pulls no spec data into a bundle; the spec types (§11) tell which reader fits an attribute.
- **Grammar.** Numbers follow CSS `<number>`: `1`, `-.5`, `+2`, `1e3`, but not `5.`, `0x10` or `Infinity`, and a number too large to be finite is invalid. An `e` that no digits follow ends the number, so `1em` is a length. SVG whitespace (space, tab, line feed, form feed, carriage return) around a value is ignored. Lists are separated by whitespace, a comma, or both; an empty list, a leading or trailing comma and two commas in a row are invalid.
- **Units are kept, not converted.** `SvgLength` is `{ value, unit }` with `""` for user units, `"%"`, and the CSS length units, which SVG 2 allows; percentages and relative units need a viewport or font size the attribute does not have. Units are ASCII case-insensitive and returned in their canonical spelling (`mm`, `Q`). Angles work the same way with `deg`, `grad`, `rad` and `turn`; a plain number is in degrees.
- **Bundle size.** The readers use no spec data: `getLength` alone is about 1.6 kB minified, 0.8 kB gzipped (Bun 1.4 `bun build --minify`), and a bundle of `parse` alone does not change.
- **Spec rules that are part of the syntax** are applied: `number-optional-number` with one number is that number twice, a `viewBox` with a negative width or height is invalid, and `preserveAspectRatio` keywords are case-sensitive and may start with SVG 1.1's `defer`. Keywords in `parseKeyword` are compared case-sensitively, as SVG attributes define them.

### Presentation values

`getPresentationValue(el, name, version?)` returns the value a property has on the element itself (B56): `{ value, source, important }`, where `source` is `"style"` or `"attribute"`, or `undefined` if neither sets it. It lives in `spec`, because telling a presentation attribute from any other is spec data.

- **The cascade on the element.** A declaration in `style` wins over the presentation attribute, and among declarations the last one wins unless an earlier one is `!important`, as in `getStyleProperty`. `!important` is split off the value into `important`.
- **Only real presentation attributes count.** The attribute is used only if it is a presentation attribute on this element in the version, or in any version when it is left out (A20): in the presentation group, or one of the element's own, such as `cx` on `circle` in SVG 2. An attribute on an unknown or prefixed element does not count; a declaration in `style` always does, for any property.
- **Only the element.** `<style>` sheets, inheritance and initial values are not taken into account, and the colors module does not compute them either (§12). Values are not checked against the property's syntax, and `inherit` and other CSS-wide keywords are returned as written. `source` says where a value is written, so a caller can change it in the same place.

### Deferred

- **Bulk operations across a tree** (rename, remove or set an attribute on every matching element) are not added: with `findAll` (B17) they are a one-line loop over plain objects, so a helper would only wrap plain access.

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
- **Playwright** is pinned to an exact version that matches the `mcr.microsoft.com/playwright` image the browser tests run in. The package, the image digest in `ci.yml` and the one in `scripts/test-webkit.sh` are updated together by hand.
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

| Data                                    | SVG 1.1                                                                            | SVG 2                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Elements and their attributes           | Flat DTD `svg11-flat-20110816.dtd`                                                 | svgwg `master/definitions.xml`, `definitions-filters.xml`, `definitions-masking.xml`, `specs/animations/master/definitions.xml`             |
| Attribute groups (core, conditional, …) | DTD parameter entities such as `%SVG.Core.attrib;`                                 | `<attributecategory>` entries                                                                                                               |
| Presentation attributes                 | `%SVG.Presentation.attrib;`                                                        | `presentationattributes` of the `presentation` category, plus `geometryproperties` per element                                              |
| Value types (B34)                       | DTD datatype entities such as `%Length.datatype;` and enumerations in `<!ATTLIST>` | `@webref/css` value syntax for presentation attributes, `@webref/idl` reflected types for other attributes, then SVG 1.1 (§11, Value types) |
| Cross-check of element names            | -                                                                                  | `@webref/elements` (`SVG2`, `filter-effects-1`, `css-masking-1`, `svg-animations`)                                                          |
| Browser support (separate layer)        | -                                                                                  | `@mdn/browser-compat-data`: `svg.elements` and `svg.global_attributes`                                                                      |

### Rules

- **Validity comes from the specs only.** Whether an element or attribute exists in a version is decided by the W3C sources. Browser support never adds or removes anything: the browsers do not implement all of SVG 2, but a document that uses an unsupported feature is still valid SVG 2.
- **Browser support is separate data.** BCD's status (`deprecated`, `standard_track`) and the first supported version per engine are generated next to the spec data, for functions that ask for them explicitly. It does not narrow the v0.2 types.
- **webref is a check, not a source.** The generator fails when the element names it reads from svgwg differ from `@webref/elements`, which catches a moved or renamed definitions file.
- **Pinning (§8).** svgwg is pinned to a commit SHA, the DTD to its dated URL and a SHA-256 checksum, and the npm packages to exact versions ignored by Dependabot. Updating a source is a separate commit that regenerates the data.
- **Licenses.** The svgwg files are under the W3C Document License, the DTD under its W3C copyright notice, BCD under CC0, and webref and webidl2 under MIT. Only facts such as names, categories and types are generated, no spec text, and each generated file names its sources and their licenses in a header.

### Generator

`bun run spec:generate` downloads the DTD and the svgwg files, checks each against the SHA-256 in `scripts/generate-spec/sources.ts`, reads the npm packages (`@webref/elements`, `@webref/css`, `@webref/idl` with `webidl2`, BCD) from `node_modules` and writes three modules, formatted with Prettier. `bun run spec:check` builds the same output and fails if it differs from the committed files; CI runs it, so the data always matches its pins.

| File         | Exports                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `svg11.ts`   | `svg11Elements`, `svg11Groups`, `svg11PresentationAttributes`                  |
| `svg2.ts`    | `svg2Elements`, `svg2Groups`, `svg2PresentationAttributes`                     |
| `support.ts` | `svgElementSupport`, `svgGlobalAttributeSupport` (BCD, separate from validity) |

- **Shape.** Each element has `groups` (attribute groups it takes as a whole), `attributes` (its other attributes, each with its value type) and `presentation` (those of its attributes that are presentation attributes on this element only, such as `cx` on `circle` in SVG 2). Each group maps its attributes to their value types; an attribute's type may differ between groups (`xlink:show` is fixed to `embed` or `other` in SVG 1.1). Groups keep the names their source uses: `Core` and `GraphicalEvents` in the DTD, `core` and `global event` in svgwg. Names are sorted by UTF-16 code units, and every export is `as const`, so B33 can derive types from it. The generated modules themselves are not exported: `spec/index.ts` exports the types and functions built on them (below), so the shape of the data can change without a breaking change.
- **SVG 1.1.** The DTD is read like an external subset: parameter entities are expanded, the first declaration wins, conditional sections are included or ignored, external entities are never loaded. Groups are the collection entities an `<!ATTLIST>` names directly, such as `%SVG.Core.attrib;`.
- **SVG 2.** Elements are resolved as the svgwg build tools do: an element takes its attribute categories, the shared attributes it names, the shared attributes that list it, its own `<attribute>` entries and its geometry properties; module files fall back to the main file. Unlike the build tools, which index one spec at a time, shared attributes apply across files (SVG Animations adds `timelinebegin` to `svg`), and the presentation attributes come only from the main file, because the copy in `definitions-filters.xml` is the SVG 1.1 list. The files refer to a few names they never define, left over from SVG 1.1 (`document element event`, `style`, `externalResourcesRequired`); these are skipped and listed in the generator, and any new unknown name fails it.
- **Support.** BCD entries are limited to elements and attributes that exist in the generated SVG 1.1 or SVG 2 data, so support never adds a name. For each engine (Blink, Gecko, WebKit, read from Chrome, Firefox and Safari) the version is the first one with full, unprefixed support that has not been removed since, or `false`.

### Value types

Every attribute has a value type (B34): a kind from a fixed list, or the keywords of an enumeration such as `["userSpaceOnUse", "objectBoundingBox"]`. The kinds are som's own vocabulary, defined in `scripts/generate-spec/model.ts`, so B36 can map each to a typed read:

`string`, `number`, `integer`, `number-optional-number`, `number-or-percentage`, `number-list`, `length`, `length-list`, `angle`, `color`, `paint`, `url`, `path-data`, `points`, `transform-list`, `view-box`, `preserve-aspect-ratio`, `script`, `style`, `css`.

- **`length` includes percentages** and plain numbers (user units), as SVG lengths do. **`css`** is a CSS property value no other kind describes, such as `font-family` or `stroke-dasharray`; **`string`** is any other text, such as IDs, names, language tags and animation timing.
- **SVG 1.1** takes the kind from the datatype entity of each attribute (a table in `dtd.ts`; an unknown datatype fails the generator) and the keywords from enumerations, including `inherit` where the DTD lists it. Plain `CDATA` is `string`.
- **SVG 2** tries, in order: an override in `values.ts`; for presentation attributes, the CSS value syntax from `@webref/css` (a few syntaxes such as `<paint>` map to a kind, keyword-only syntaxes to an enumeration, anything else to `css`); for other attributes, the IDL attribute that reflects it in `@webref/idl` (`SVGAnimatedLength` is `length`); the same attribute in SVG 1.1; and finally the conventions `on*` (`script`) and `aria-*` (`string`). An attribute none of these covers fails the generator, and so does an override that is no longer used.
- **IDL and SVG 1.1 together.** IDL does not list enumeration keywords, so those come from SVG 1.1; an IDL string or number takes the more specific SVG 1.1 type when there is one (`url`, an enumeration, `number-or-percentage`). Pairs such as `stdDeviationX` and `stdDeviationY` reflect one `number-optional-number` attribute, and HTML-style camel case is matched case-insensitively (`crossOrigin` is `crossorigin`).
- **Overrides** cover what the data cannot give: attributes new in SVG 2 that no IDL attribute reflects (`side` on `textPath`, `playbackorder`), and enumerations whose keywords changed since SVG 1.1 (`mode` on `feBlend` takes every `<blend-mode>`, `operator` on `feComposite` gained `lighter`). Each override names the definition it comes from.

### Types

`spec` exports types derived from the generated data with `typeof`, so they add nothing to a bundle (B33):

| Type                     | Meaning                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `SvgVersion`             | `"1.1" \| "2"`                                                |
| `SvgElementName<V>`      | Element names defined in version `V`                          |
| `SvgAttributeName<E, V>` | Attributes element `E` allows in version `V`, groups included |

```ts
type A = SvgAttributeName<"rect">; // SVG 1.1 or SVG 2: "rx" | "enable-background" | "paint-order" | …
type B = SvgAttributeName<"rect", "2">; // SVG 2 only: no "enable-background"
type C = SvgAttributeName<"altGlyph", "2">; // error: altGlyph is not in SVG 2
```

- **Version last and optional (A20).** Without a version, a name is valid if SVG 1.1 or SVG 2 defines it, which fits real files: editors still write SVG 1.1 attributes such as `enable-background`. Passing `"1.1"` or `"2"` narrows the type to one version. The types distribute over unions, so `SvgAttributeName<"rect" | "circle">` allows the attributes of either element.
- **Only what the specs list.** Names are case-sensitive and written as the specs write them: elements without a prefix (`linearGradient`, not `svg:linearGradient`), attributes with the prefixes the specs use (`xml:space`, `xlink:href`). `data-*` attributes and attributes in editor namespaces such as `inkscape:label` are not included. The AST is not narrowed by these types: attribute values and names in `SvgElement.attributes` stay `Record<string, string>` (A4), because a parsed document may contain anything.
- **Presentation attributes** are included through the presentation group; telling them apart is B56.

### Runtime checks

`isSvgElementName(name, version?)` and `isSvgAttributeName(element, attribute, version?)` answer the same questions as the types at run time (B35), with the same rules: the version is optional and means any version (A20), names are compared as the specs write them, and `data-*` or foreign-namespace attributes are not valid. They work on strings, not nodes (§3, rule 3): pass `element.name`, or the local name of a prefixed element.

- **Type guards.** `isSvgElementName` narrows its argument to `SvgElementName<V>`. `isSvgAttributeName` narrows `attribute` to `SvgAttributeName<E, V>` only when the element name is a literal known at compile time; an overload for an element name known only at run time returns a plain `boolean`, since a guard there would narrow to `never` or leave nothing for the `false` branch.
- **Lookups** use `Object.hasOwn` on the generated objects, so names such as `constructor` or `__proto__` never match `Object.prototype`. Nothing is computed or cached at import time (§4).
- **Bundle size.** The data is only in a bundle that imports one of these functions: a bundle of `parse` alone does not change. `isSvgAttributeName` alone is about 38 kB minified, 6 kB gzipped (Bun 1.4 `bun build --minify`), because the generated objects also carry the value types (B34) that B36 needs. Splitting names from value types is possible later without an API change.

## 12. Colors

The colors module finds, normalizes and replaces colors (v0.3). It works with colors where they are written in the document, not with the color an element is rendered in (A22): computing that needs the whole CSS cascade, which som does not implement (§10).

### Color values

`parseColor(text)` reads one color and `formatColor(color)` writes it (B39). Both work on strings (§3, rule 3).

| Notation       | Examples                                                         | `SvgColor`                                           |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Hex            | `#f00`, `#f008`, `#ff0000`, `#ff000080`                          | `{ type: "hex", red, green, blue, alpha }`           |
| `rgb()`        | `rgb(255, 0, 0)`, `rgba(100%, 0%, 0%, .5)`, `rgb(255 0 0 / 50%)` | `{ type: "rgb", red, green, blue, alpha }`           |
| `hsl()`        | `hsl(120, 100%, 25%)`, `hsl(0.5turn 100 25 / .5)`                | `{ type: "hsl", hue, saturation, lightness, alpha }` |
| Named          | `red`, `RebeccaPurple`, `transparent`                            | `{ type: "named", name }`                            |
| `currentColor` | `currentColor`, `currentcolor`                                   | `{ type: "currentColor" }`                           |

- **The notation is kept.** A color is parsed into the notation it is written in, so `formatColor` writes `#f00` back as hex and `red` as `red`. Converting between notations and comparing colors, so that `#f00` matches `red`, is a separate step, `normalizeColor`.
- **Values are converted only to one scale per field, not clamped.** `rgb()` channels are on the 0-255 scale (`50%` is `127.5`), hues in degrees (`0.5turn` is `180`), saturation and lightness in percent, alpha from 0 to 1 (`50%` is `0.5`, the hex `80` is `128 / 255`). Values outside the range, such as `rgb(300, 0, 0)`, are kept: CSS clamps them only when it renders the color.
- **Grammar.** The sRGB notations of CSS Color 4: the comma-separated syntax, where `rgb()` takes three numbers or three percentages, not a mix, and `hsl()` takes percentages; and the space-separated syntax with an optional `/` alpha, where numbers and percentages mix. `rgba()` and `hsla()` are the same functions. Numbers follow CSS `<number>` (§6). Keywords and function names are ASCII case-insensitive; SVG whitespace around the color is ignored.
- **Not read:** other color functions (`hwb()`, `lab()`, `oklch()`, `color()`, `color-mix()`), system colors such as `Canvas`, `none` channels, `calc()` and SVG 1.1 `icc-color(…)`. They return `undefined`, so B41 leaves them as they are. They can be added later without an API change.
- **Writing.** Hex is lowercase and as short as possible (`#f00`, alpha digits only when the alpha is not `1`), with the alpha rounded to one of its 256 steps. `rgb()` and `hsl()` use the comma-separated syntax, which SVG 1.1 renderers read too, as `rgba()` and `hsla()` when the alpha is not `1`. `formatColor` throws a `TypeError` for a value that would not read back: a non-finite number, a hex channel that is not an integer from 0 to 255, a hex alpha outside 0-1, or an unknown name.
- **Named colors** are a literal table in `named.ts` from name to hex digits (`transparent` is `00000000`). A test checks the names against `@webref/css` `<named-color>`, and a browser test checks the values against what a canvas makes of each name in Chromium, Firefox and WebKit.

### Normalization

`normalizeColor(color)` converts a color to one form, so that colors which look the same compare equal (B40): a hex color with integer channels from 0 to 255 and an alpha rounded to one of 256 steps, or `currentColor`. `formatColor` then writes it as a string, so `formatColor(normalizeColor(parseColor(text)))` is `#f00` for `red`, `#FF0000`, `rgb(100% 0% 0%)` and `hsl(0 100% 50%)` alike.

- **sRGB only.** Every notation `parseColor` reads is sRGB, so the result loses nothing a browser keeps: browsers store these colors with 8-bit channels too, and serialize `rgb(127.5, 0, 0)` as `rgb(128, 0, 0)`.
- **As CSS renders it.** Named colors take their CSS value, `hsl()` is converted with the algorithm in CSS Color 4, the hue wraps around, and values outside the range are clamped: `rgb(300, 0, 0)` is `#f00`, `hsl(0, 200%, 150%)` is `#fff`. A browser test compares the `hsl()` conversion with the browsers, allowing one step where engines round half-way channels differently.
- **`currentColor` stays.** Its value is the inherited `color` property, which the color alone does not tell (see "What is not resolved"). It equals only itself.
- **Idempotent.** A normalized color normalizes to itself and reads back from `formatColor` unchanged. `normalizeColor` returns a new object and throws a `TypeError` for a value that is not finite or an unknown name, as `formatColor` does.
- **Bundle size** (Bun 1.4 `bun build --minify`): `parseColor` alone is about 6.0 kB minified, 2.7 kB gzipped, `normalizeColor` about 4.1 kB and 2.0 kB; most of it is the named color table, which `formatColor` also uses to check names. A bundle of `parse` alone does not change.

### Where colors are read

| Source                    | Example                       | Read and replaced                                       |
| ------------------------- | ----------------------------- | ------------------------------------------------------- |
| Presentation attribute    | `fill="#f00"`                 | Yes                                                     |
| `style` attribute         | `style="fill: #f00"`          | Yes, every declaration, including overridden duplicates |
| `<style>` element         | `.st0 { fill: #f00; }`        | Yes, in declaration values only, never in selectors     |
| Paint server reference    | `fill="url(#g)"`              | The reference is reported, not followed                 |
| Fallback after `url(…)`   | `fill="url(#g) #f00"`         | Yes, the fallback color                                 |
| Gradient stops            | `<stop stop-color="#f00"/>`   | Yes, as an attribute of the `stop` element              |
| Animation values          | `<animate to="#f00"/>`        | No, deferred                                            |
| Other attributes and text | `<text>#f00</text>`, `data-*` | No                                                      |

- **Color properties are a fixed list:** `color`, `fill`, `stroke`, `stop-color`, `flood-color` and `lighting-color`, the presentation attributes with the `color` or `paint` value type (§11) in both versions. A test checks the list against the spec data, so `colors` depends on `attributes` only and pulls no spec data into a bundle (§3, rule 2).
- **By syntax (A21).** A color property is read on any element, and a value that does not parse as a color or paint is skipped, not reported as an error: `fill="freeze"` on `<animate>` is an animation attribute, not a paint, and is left alone.
- **`style` attributes** are scanned with the same tokenizer as `parseStyle` (§6). Replacing a color rewrites only the value of that declaration; `!important`, other declarations, comments and spacing stay as they are.
- **`<style>` elements** are common in editor exports: Illustrator writes `.st0{fill:#D1DAE5;}` and applies it with `class`. Their text is split into rules with the same tokenizer, and colors are read and replaced in declaration values only, inside at-rules such as `@media` too. A selector like `#fff` is an ID, not a color, and is never touched. CDATA sections and text nodes are rewritten in place, so a round trip keeps them (A6). A `<style>` element whose `type` is set and is not `text/css` is skipped.

### What is not resolved

- **No selector matching.** Which elements a rule in `<style>` applies to is not computed: `extractColors` reports the color once, at the `<style>` element, not at every element it matches. `replaceColor` therefore recolors a document whichever way it is styled.
- **No inheritance or initial values.** `<g fill="red">` is one color on the `g`, not a color on each child. An element with no `fill` is not reported as black, the initial value.
- **`url(#…)` is not followed.** A paint server is a separate element whose stop colors are found where they are written. Replacing a stop color changes every shape that uses the gradient, as it would in an editor; recoloring one shape only means copying the gradient first.
- **`currentColor` is a value of its own.** It is parsed and reported as `currentColor`, not as the `color` it inherits, and is replaced only when it is the color being replaced. `normalizeColor` keeps it as it is.
- **CSS-wide keywords** (`inherit`, `initial`, `unset`, `revert`) and `none` are not colors; `none` is reported as a paint but never replaced by a color.

These rules keep `extractColors` and `replaceColor` consistent: every color `extractColors` reports is one `replaceColor` can change, in the place it reports it.

### Finding and replacing

`extractColors(parent)` lists the colors and paints written in a document or element, and `replaceColor(parent, from, to)` replaces one color everywhere it is written (B41). Both take a document or an element, and an element is scanned itself, not only its descendants, so `extractColors(getRoot(document))` includes `<svg fill="…">`.

```ts
// <svg><style>.a { fill: #F00 }</style><path fill="url(#g) red" stroke="none"/></svg>
extractColors(document);
// [
//   { element: style, property: "fill", source: "stylesheet", value: "#F00", color: { type: "hex", … } },
//   { element: path, property: "fill", source: "attribute", value: "url(#g) red", color: { type: "named", name: "red" }, url: "#g" },
//   { element: path, property: "stroke", source: "attribute", value: "none" },
// ]
replaceColor(document, "red", "#00f"); // 2
```

- **Uses, not distinct colors.** `extractColors` returns one `SvgColorUse` per place, in document order: `element`, `property`, `source` (`"attribute"`, `"style"` or `"stylesheet"`), `value` as written without `!important`, and `color` and `url` when the value has them. Distinct colors are `normalizeColor` and `formatColor` over the result; a helper for that would only wrap one line.
- **Paints without a color are reported.** `none`, `context-fill`, `context-stroke` and `url(…)` without a fallback color are uses without `color`, so the result also tells which shapes are unpainted or use a paint server. `color`, `stop-color`, `flood-color` and `lighting-color` take a color only, so `none` there is skipped as invalid.
- **Matching is by normalized color.** `replaceColor` compares `formatColor(normalizeColor(…))`, so `#f00`, `red`, `rgb(100% 0% 0%)` and `hsl(0 100% 50%)` match each other, but not `#f008`, which has another alpha. `from` and `to` are `SvgColor` values or strings; a string that does not parse as a color throws a `TypeError`, so `none` or a value with `;` can never be written. A string `to` is written as given, trimmed, an `SvgColor` with `formatColor`.
- **Only the color is rewritten.** In an attribute, the whitespace around it stays; in a declaration, `!important`, other declarations, comments and spacing stay; after `url(…)`, only the fallback changes. A declaration value with a comment inside, such as `fill: red /* x */`, is not a color and is left alone.
- **The count is returned.** `replaceColor` returns how many colors it replaced, which the caller cannot see otherwise (A17).
- **`<style>` elements** are recognized by the unprefixed name `style`, as `getPresentationValue` ignores prefixed elements; color attributes are read on any element (A21). The text is split into rules by `scanStylesheet` in `internal`: at-rules that hold rules (`@media`, `@supports`, `@container`, `@layer`, `@scope`, `@starting-style`, `@document`, `@keyframes`, with or without a vendor prefix) are read recursively, the block of any other at-rule is read as declarations, and nested CSS rules inside a declaration block are skipped. Each text and CDATA child is read on its own, so a rule split by an XML comment is not read.
- **Corpus.** For every fixture and icon, replacing each color the document has with one it does not have changes exactly the uses `extractColors` reports for it, nothing else moves, and the result still round-trips (§7).
- **Bundle size** (Bun 1.4 `bun build --minify`): `extractColors` alone is about 11.6 kB minified, 4.6 kB gzipped, `replaceColor` about 13.9 kB and 5.4 kB, most of it `parseColor` with the named color table. A bundle of `parse` alone does not change.
