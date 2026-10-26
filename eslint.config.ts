import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * Folders under `src/` and the modules each one may import (ARCHITECTURE §3).
 * Imports go only through a module's `index.ts`. A module may depend only on
 * modules listed above it, which keeps the graph free of cycles.
 */
const modules: Record<string, string[]> = {
  internal: [],
  ast: ["internal"],
  parse: ["ast", "internal"],
  stringify: ["ast", "internal"],
  attributes: ["ast", "internal"],
  spec: ["ast", "internal"],
};

const order = Object.keys(modules);
for (const [name, deps] of Object.entries(modules)) {
  for (const dep of deps) {
    if (!order.includes(dep) || order.indexOf(dep) >= order.indexOf(name)) {
      throw new Error(`eslint.config.ts: ${name} may not depend on ${dep}`);
    }
  }
}

const publicModules = Object.keys(modules).filter(
  (name) => name !== "internal",
);

const moduleIndex = (names: string[]) =>
  names.map((name) => ({
    element: {
      type: "module",
      captured: { name },
      fileInternalPath: "index.ts",
    },
  }));

export default defineConfig(
  globalIgnores(["dist/", "coverage/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },
  {
    files: ["src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { node: { extensions: [".ts"] } },
      "boundaries/include": ["src/**/*.ts"],
      "boundaries/dependency-nodes": ["import", "dynamic-import", "export"],
      "boundaries/legacy-templates": false,
      "boundaries/elements": [
        { type: "module", pattern: "src/*", capture: ["name"] },
      ],
      "boundaries/files": [
        { category: "entry", pattern: "src/index.ts" },
        { category: "test", pattern: "src/**/*.test.ts" },
      ],
    },
    rules: {
      // Every file in src/ belongs to a module, except the root entry.
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          // Also check packages, Node.js built-ins and unresolved imports.
          // Imports between files of one module are not checked.
          checkAllOrigins: true,
          checkUnknownLocals: true,
          default: "disallow",
          message:
            "{{ from.file.path }} cannot import {{ dependency.source }} (ARCHITECTURE §3)",
          policies: [
            // A module imports the modules listed in `modules`, through their index.ts.
            ...Object.entries(modules)
              .filter(([, deps]) => deps.length > 0)
              .map(([name, deps]) => ({
                from: { element: { type: "module", captured: { name } } },
                allow: { to: moduleIndex(deps) },
              })),
            // The root entry re-exports every public module.
            {
              from: { file: { categories: "entry" } },
              allow: { to: moduleIndex(publicModules) },
            },
            // `internal` is never part of the public API, not even as a re-export.
            {
              disallow: {
                to: {
                  element: { type: "module", captured: { name: "internal" } },
                },
                dependency: { nodeKind: "export" },
              },
            },
            // Tests may use packages such as vitest and fast-check, but no Node.js built-ins.
            {
              from: { file: { categories: "test" } },
              allow: { to: { module: { origin: "external" } } },
            },
          ],
        },
      ],
    },
  },
  prettier,
);
