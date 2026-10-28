import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";

// Every public export has a TSDoc comment and every exported function an
// explicit return type (ARCHITECTURE §4). The public API is whatever
// src/index.ts exports, so internal files are not checked.

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

const program = ts.createProgram([entry], {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.Preserve,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
});
const checker = program.getTypeChecker();

const hasDoc = (node: ts.Node): boolean =>
  ts.getJSDocCommentsAndTags(node).length > 0;

/**
 * Formats a declaration as `name (file:line)` for failure messages.
 */
function describe(name: string, node: ts.Node): string {
  const file = node.getSourceFile();
  const { line } = file.getLineAndCharacterOfPosition(node.getStart());
  const path = file.fileName.slice(file.fileName.indexOf("src/"));
  return `${name} (${path}:${String(line + 1)})`;
}

/**
 * Whether a function declaration is the implementation of an overloaded
 * function, which callers never see.
 */
function isOverloadImplementation(
  node: ts.FunctionDeclaration,
  declarations: ts.Declaration[],
): boolean {
  return node.body !== undefined && declarations.length > 1;
}

/**
 * Lists every public declaration, interface field and class member that has
 * no TSDoc, and every exported function without a return type.
 */
function findProblems(): string[] {
  const source = program.getSourceFile(entry);
  const module = source && checker.getSymbolAtLocation(source);
  if (module === undefined) throw new Error("src/index.ts not found");

  const problems: string[] = [];
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported;
    const declarations = symbol.declarations ?? [];

    for (const declaration of declarations) {
      const name = describe(exported.name, declaration);
      if (ts.isFunctionDeclaration(declaration)) {
        if (isOverloadImplementation(declaration, declarations)) continue;
        if (declaration.type === undefined) {
          problems.push(`${name}: no return type`);
        }
      }

      const documented = ts.isVariableDeclaration(declaration)
        ? declaration.parent.parent
        : declaration;
      if (!hasDoc(documented)) problems.push(`${name}: no TSDoc`);

      if (
        ts.isInterfaceDeclaration(declaration) ||
        ts.isClassDeclaration(declaration)
      ) {
        for (const member of declaration.members) {
          const modifiers = ts.canHaveModifiers(member)
            ? (ts.getModifiers(member) ?? [])
            : [];
          if (
            modifiers.some(
              (modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
            )
          ) {
            continue;
          }
          const memberName = member.name?.getText() ?? "constructor";
          if (!hasDoc(member)) {
            problems.push(
              `${describe(`${exported.name}.${memberName}`, member)}: no TSDoc`,
            );
          }
        }
      }
    }
  }
  return problems;
}

test("every public export has TSDoc and an explicit return type", () => {
  expect(findProblems()).toEqual([]);
});
