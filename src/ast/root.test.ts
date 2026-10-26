import { expect, test } from "vitest";
import { getRoot } from "./root";
import type { SvgDocument, SvgElement } from "./types";

const svg: SvgElement = {
  type: "element",
  name: "svg",
  attributes: {},
  children: [],
};

test("returns the element among the document children", () => {
  const document: SvgDocument = {
    type: "document",
    children: [
      { type: "comment", value: " logo " },
      { type: "text", value: "\n" },
      svg,
      { type: "text", value: "\n" },
    ],
  };
  expect(getRoot(document)).toBe(svg);
});

test("throws when there is no element", () => {
  const document: SvgDocument = {
    type: "document",
    children: [{ type: "comment", value: "" }],
  };
  expect(() => getRoot(document)).toThrow(
    new TypeError("Document has no root element"),
  );
});

test("throws when there is more than one element", () => {
  const document: SvgDocument = {
    type: "document",
    children: [svg, { ...svg }],
  };
  expect(() => getRoot(document)).toThrow(
    new TypeError("Document has more than one root element"),
  );
});
