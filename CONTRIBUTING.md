# Contributing

som is in the design phase and is not open for outside contributions yet. This document describes how the project is developed: the setup, the rules the code follows and how changes are made. The reasons behind the rules are in [ARCHITECTURE.md](./ARCHITECTURE.md); planned work is in [BACKLOG.md](./BACKLOG.md).

## Requirements

- [Bun](https://bun.sh), the version from the `packageManager` field in `package.json`
- Node.js ≥ 22

## Setup

```sh
bun install
bunx playwright install chromium firefox webkit
```

Playwright builds its browsers for Ubuntu and Debian. On other Linux distributions WebKit usually cannot start because system libraries are missing. Run the browser tests in Chromium and Firefox locally and leave WebKit to CI, which runs the full matrix.

## Commands

| Command                | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `bun run build`        | Build `dist/` with tsdown, then run publint and attw        |
| `bun run typecheck`    | Type-check the library, test and script projects            |
| `bun run test`         | Run all tests: Node.js and every browser                    |
| `bun run test:node`    | Run the tests in Node.js                                    |
| `bun run test:browser` | Run the tests in browsers; add `--browser chromium` for one |
| `bun run lint`         | Lint with ESLint, including module boundary rules           |
| `bun run format`       | Format all files with Prettier                              |
| `bun run format:check` | Check formatting of everything except Markdown              |
| `bun run docs:check`   | Check formatting of Markdown files                          |

Before pushing, run `lint`, `format:check`, `docs:check`, `typecheck` and `test:node`. CI runs the same checks and the tests on every supported Node.js, Bun and browser version.

## Code rules

### Modules

Source code lives in domain folders under `src/` (ARCHITECTURE §3): `ast`, `parse`, `stringify`, `attributes`, `spec` and later `colors`, `paths` and others. ESLint enforces the boundaries between them.

- **A folder's `index.ts` is its public API.** Other folders import only from it, never from its internal files.
- **Dependencies flow one way** and never form cycles. `parse` and `stringify` do not import each other (A14); code shared between them goes in `internal/`.
- **`internal/` is never exported**, directly or through re-exports.
- **Value-level functions do not depend on `ast`.** `parsePath("M0 0")` and `parseColor("#fff")` work on strings; AST-level functions are built on top of them.
- **Export names are unique across the library**, because the root entry point re-exports every module: `parsePath` and `parseColor`, not two functions named `parse`.
- **No side effects at import time** and no state shared between modules, so unused code is removed by tree-shaking.

When adding a folder, register it in the `modules` table at the top of `eslint.config.ts`, below the modules it depends on, and add it to the dependency graph in ARCHITECTURE §3.

### Library code

- **No runtime dependencies** (A2): code in `src/` imports no packages and no Node.js built-ins.
- **No DOM APIs.** The library runs in Node.js, Bun and browsers alike.
- **The AST is plain data** (A4): no parent references, and new node fields are only ever optional.
- **Attribute values stay strings.** Typed parsing belongs to the module that needs it.
- **Mutation is explicit.** Helpers mutate the node they get; copying is left to `clone()`.

### Public API

- Every exported function has an explicit return type and a TSDoc comment.
- Public types are strict: no `any`, and no wider types than the data allows.
- Parse error codes are part of the API (A12): existing codes change only in a major release, new codes may appear in a minor one.
- Changing or removing anything exported is a breaking change and needs a decision in ARCHITECTURE.

## Tests

- **Unit tests** sit next to the code as `*.test.ts`. They run in Node.js and in browsers, so they must not use Node.js APIs.
- **Tests that need several modules or files on disk** go in `test/`: the round-trip property tests and the corpus tests.
- **Round trips** (A6): every change to `parse` or `stringify` keeps `parse(stringify(parse(x)))` equal to `parse(x)`. Use fast-check for property-based tests.
- **Corpus:** every fixture and icon parses, round-trips and produces stable output. Third-party fixtures keep their licenses in `test/fixtures/licenses/` and are never shipped in the package.
- **A bug fix comes with a test** that fails without the fix.

## Performance

- No regexes over the whole document, no intermediate token arrays where a single pass works, no repeated parsing within one operation chain.
- Benchmark suites live in `scripts/benchmarks/`. They measure the built `dist/` and compare `parse` and `stringify` separately with svgson and svg-parser.
- Any claim about speed in the docs comes from the benchmark suite. A change that is meant to make something faster includes the numbers before and after.

## Documentation

- **ARCHITECTURE.md** records decisions. When a decision changes, update it there in the same change, rather than leaving it implicit in code.
- **BACKLOG.md** tracks planned work. Tick an item when it is done and add new work to the right milestone.
- **README.md** describes only what is implemented or explicitly marked as planned.
- Markdown is formatted with Prettier and checked by `bun run docs:check`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org) with a short one-line subject:

- `feat` - a new feature
- `fix` - a bug fix
- `perf` - a performance improvement
- `docs` - documentation only
- `test` - tests only
- `build` - build setup, tooling and dependencies
- `ci` - GitHub Actions and Dependabot
- `chore` - anything else, including releases (`chore: release X.Y.Z`)

A scope may name the module: `feat(parse): …`, `fix(stringify): …`. One commit holds one logical change.

## Pull requests

Before opening a pull request, check that:

- [ ] lint, formatting, type checks and tests pass locally
- [ ] new public exports have TSDoc and explicit return types
- [ ] new behavior has tests; bug fixes have a regression test
- [ ] ARCHITECTURE.md and BACKLOG.md are updated if a decision or plan changed
- [ ] performance changes include benchmark numbers

## Dependencies

The library has no runtime dependencies. Tooling uses caret ranges with a committed `bun.lock`; Dependabot updates GitHub Actions and npm packages weekly with a 7-day cooldown. See ARCHITECTURE §8 for the exceptions: TypeScript and packages that affect test or benchmark results.

## Releases

A release is a `vX.Y.Z` tag on a commit whose `package.json` has the same version.

1. Update the version without creating a tag:

   ```sh
   npm version X.Y.Z --no-git-tag-version
   ```

2. Commit with `chore: release X.Y.Z`, tag and push:

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

3. The Release workflow checks that the tag matches `package.json`, runs CI, stages the package on npm with provenance and creates a GitHub release with generated notes. Versions with a pre-release part (`X.Y.Z-beta.N`) go to the `next` dist-tag and are marked as pre-releases.

4. Approve the staged version with 2FA, on the Staged Packages tab on npmjs.com or from the command line:

   ```sh
   npm stage list @hexlabelposition/som
   npm stage approve <stage-id>
   ```

A pushed tag is a release: npm versions can't be republished, so check `main` is green before tagging.
