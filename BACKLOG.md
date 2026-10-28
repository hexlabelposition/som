# Backlog

Milestones in the order they are planned. Not tied to dates. A1-A17 refer to decisions in [ARCHITECTURE.md](./ARCHITECTURE.md).

Items are numbered so early commits can point to them, for example `feat(parse): strict parsing (B18)`. Numbers are not reused.

## Project setup

An empty project that builds, lints and tests.

- [x] **B1** Check that the `som` name is available on npm and GitHub: taken on npm, published as `@hexlabelposition/som`
- [x] **B53** Reserve the name on npm by hand so the trusted publisher (B9) can be configured: `npm stage publish` makes npm create its `0.0.0-stage` placeholder; the staged version is never approved; no Git tag or GitHub release
- [x] **B2** Set up tooling: Bun, tsdown, TypeScript 6, Vitest 5 (node + browser), fast-check, ESLint, Prettier, publint, attw
- [x] **B3** `package.json`: ESM, `sideEffects: false`, Node >= 22, `exports`, `packageManager`
- [x] **B4** tsdown: entry `src/index.ts`, `platform: "neutral"`, `target: "es2022"`
- [x] **B5** Folder structure from ARCHITECTURE §3
- [x] **B6** ESLint rules: imports only through folder `index.ts`, no cycles, `internal/` not exported, `parse` and `stringify` don't import each other (A14)
- [x] **B7** CI: lint, format, Markdown check (`docs:check`), typecheck, build and `npm pack --dry-run` on Node 24; tests on Node 22/24/26, Bun 1.2.23 + latest, Chromium/Firefox/WebKit
- [x] **B8** actionlint for workflow changes
- [x] **B10** Dependabot for GitHub Actions: SHA pins, weekly, 7-day cooldown (A13)
- [x] **B11** Dependabot for npm tooling: one grouped PR, weekly, 7-day cooldown, TypeScript minor/major ignored (A13)
- [x] **B12** `build`, `lint`, `format:check`, `docs:check`, `typecheck` and `test` pass locally and in CI
- [x] **B9** Release workflow on `vX.Y.Z` tags: version check, CI, build without publishing permissions, `npm stage publish` with trusted publishing (OIDC, provenance), GitHub release with generated notes

## v0.1 - parse, stringify, ast, attributes

Parse SVG into a plain-object tree, edit it, write it back without losing anything.

- [x] **B14** Decide which `attributes` helpers go into v0.1 (ARCHITECTURE §6): `style` and `class` (A16)
- [x] **B15** Decide whether mutating helpers return `void` or the node: `void`, except `toggleClass` returns `boolean` (A17)
- [x] **B16** Node types (A4), `getRoot`, type guards (`isElement`, `isText`, …)
- [x] **B17** `clone`, `walk` (with parent, skip, stop), `find` / `findAll`
- [x] **B18** `parse`: strict, keeps whitespace (A10)
- [x] **B19** `SvgParseError` with stable codes and position (A12)
- [x] **B20** Resource limits (A11): input length, nesting depth, entity expansions, expanded text length (`MAX_*_EXCEEDED` codes)
- [x] **B21** `stringify`: writes the tree as is, with escaping and XML character checks
- [x] **B22** `attributes` helpers (A16): `parseStyle`, `stringifyStyle`, `get`/`set`/`removeStyleProperty`, `has`/`add`/`remove`/`toggleClass`
- [x] **B23** Round-trip tests from ARCHITECTURE §5 (A6), including property-based
- [x] **B24** Test corpus: icon sets and editor exports (Figma, Illustrator, Inkscape, SVGO), with licenses
- [x] **B25** Every corpus file parses, round-trips and produces stable output
- [x] **B26** Benchmarks for `parse` and `stringify` vs svgson and svg-parser
- [x] **B27** Speed claims in README come only from the benchmarks
- [x] **B28** Every public export has TSDoc and an explicit return type
- [ ] **B29** publint and attw pass
- [ ] **B54** Right before v0.1.0: create the `npm` GitHub environment (only `v*` tags) and the trusted publisher with `npm trust github … --allow-stage-publish`; the first publish has to follow within 2 days
- [ ] **B30** Release v0.1.0

## v0.2 - Spec types

Know which elements and attributes exist in each SVG version.

- [ ] **B31** Decide the data sources for SVG 1.1 and SVG 2 (W3C, MDN BCD, webref), given browsers don't implement all of SVG 2
- [ ] **B32** `scripts/generate-spec` → `src/spec/generated` (committed, reproducible)
- [ ] **B33** Types: allowed attributes per element and SVG version
- [ ] **B34** Value types per attribute (length, color, path data, enums, …)
- [ ] **B35** Runtime check: is an attribute valid for an element
- [ ] **B36** Typed reads: `getNumber`, `getLength`, …
- [ ] **B56** Effective value of a presentation attribute versus the same property in `style` (ARCHITECTURE §6)
- [ ] **B37** Release v0.2.0

## v0.3 - Colors

Find, normalize and replace colors in a document.

- [ ] **B38** Decide how to handle `style`, `<style>`, `url(#gradient)` and inheritance
- [ ] **B39** `parseColor`, `formatColor`
- [ ] **B40** Normalize hex, rgb, hsl, named colors, `currentColor`
- [ ] **B41** `extractColors`, `replaceColor`, tested on the corpus
- [ ] **B42** Release v0.3.0

## v0.4 - Paths

Read, write and normalize path data (`d`).

- [ ] **B43** Decide numeric precision and output format
- [ ] **B44** `parsePath`, `stringifyPath`; every corpus path round-trips
- [ ] **B45** Normalize: relative → absolute, shorthand → full commands
- [ ] **B46** Release v0.4.0

## Later

- [ ] **B47** Geometry: bounds, center, path length
- [ ] **B48** Transforms: parse and compose matrices, apply to paths
- [ ] **B49** Optimization passes
- [ ] **B50** Options, only when really needed (A15): trim whitespace, source positions, custom limits, pretty print
- [ ] **B51** Subpath exports (`@hexlabelposition/som/parse`, …) once modules settle (A7)
- [ ] **B55** Consider tsdown `exports: true` to generate `exports` from the entries once there are subpath exports (B51)
- [ ] **B52** Deno in CI

## Open questions

- A lenient `parse` mode may be added later, although strict parsing is currently a guarantee (A10).
- JSX/React integration may be added later, as a subpath export or a separate package (A7).
