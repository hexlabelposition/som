import { expect, test } from "vitest";
import { SvgParseError, type SvgParseErrorCode } from "./errors";
import {
  MAX_DEPTH,
  MAX_ENTITY_EXPANSIONS,
  MAX_EXPANDED_LENGTH,
  MAX_INPUT_LENGTH,
} from "./limits";
import { parse } from "./parse";

function expectError(input: string, code: SvgParseErrorCode): SvgParseError {
  try {
    parse(input);
  } catch (error) {
    expect(error).toBeInstanceOf(SvgParseError);
    expect((error as SvgParseError).code).toBe(code);
    return error as SvgParseError;
  }
  throw new Error("parse() did not throw");
}

function nested(depth: number): string {
  return "<g>".repeat(depth) + "</g>".repeat(depth);
}

test("accepts input up to the maximum length", () => {
  const svg = "<svg/>";
  expect(() =>
    parse(svg + " ".repeat(MAX_INPUT_LENGTH - svg.length)),
  ).not.toThrow();
});

test("rejects longer input", () => {
  const error = expectError(
    `<svg/>${" ".repeat(MAX_INPUT_LENGTH)}`,
    "MAX_INPUT_LENGTH_EXCEEDED",
  );
  expect(error.offset).toBe(MAX_INPUT_LENGTH);
});

test("accepts elements nested up to the maximum depth", () => {
  expect(() => parse(nested(MAX_DEPTH))).not.toThrow();
  expect(() =>
    parse(`${"<g>".repeat(MAX_DEPTH - 1)}<g/>${"</g>".repeat(MAX_DEPTH - 1)}`),
  ).not.toThrow();
});

test("rejects deeper nesting at the element that is too deep", () => {
  const error = expectError(nested(MAX_DEPTH + 1), "MAX_DEPTH_EXCEEDED");
  expect(error.offset).toBe(MAX_DEPTH * 3);
  expectError(
    `${"<g>".repeat(MAX_DEPTH)}<g/>${"</g>".repeat(MAX_DEPTH)}`,
    "MAX_DEPTH_EXCEEDED",
  );
});

test("accepts entity expansions up to the maximum count", () => {
  const references = "&e;".repeat(MAX_ENTITY_EXPANSIONS);
  expect(() =>
    parse(`<!DOCTYPE svg [<!ENTITY e "x">]><svg>${references}</svg>`),
  ).not.toThrow();
});

test("counts expansions across the document and in attributes", () => {
  const half = "&e;".repeat(MAX_ENTITY_EXPANSIONS / 2);
  expectError(
    `<!DOCTYPE svg [<!ENTITY e "x">]><svg a="${half}">${half}&e;</svg>`,
    "MAX_ENTITY_EXPANSIONS_EXCEEDED",
  );
});

test("does not count predefined entities and character references", () => {
  const references = "&amp;&#65;".repeat(MAX_ENTITY_EXPANSIONS);
  expect(() => parse(`<svg>${references}</svg>`)).not.toThrow();
});

test("rejects exponential entity expansion", () => {
  const entities = ['<!ENTITY a0 "lol">'];
  for (let level = 1; level <= 9; level++) {
    entities.push(
      `<!ENTITY a${String(level)} "${`&a${String(level - 1)};`.repeat(10)}">`,
    );
  }
  const input = `<!DOCTYPE svg [${entities.join("")}]><svg>&a9;</svg>`;
  const error = expectError(input, "MAX_ENTITY_EXPANSIONS_EXCEEDED");
  expect(error.offset).toBe(input.indexOf("&a9;</svg>"));
});

test("rejects entities that expand to too much text", () => {
  const value = "x".repeat(MAX_EXPANDED_LENGTH / 4);
  const document = `<!DOCTYPE svg [<!ENTITY e "${value}">]><svg>`;
  expect(() => parse(`${document}&e;&e;&e;&e;</svg>`)).not.toThrow();
  expectError(
    `${document}&e;&e;&e;&e;&e;</svg>`,
    "MAX_EXPANDED_LENGTH_EXCEEDED",
  );
});

test("counts text from nested entities once", () => {
  const value = "x".repeat(MAX_EXPANDED_LENGTH / 2);
  expect(() =>
    parse(
      `<!DOCTYPE svg [<!ENTITY a "${value}"><!ENTITY b "&a;">]><svg>&b;&b;</svg>`,
    ),
  ).not.toThrow();
});
