import { expect, test } from "vitest";
import { clone } from "./clone";
import type { SvgDocument, SvgElement } from "./types";

const circle: SvgElement = {
  type: "element",
  name: "circle",
  attributes: { cx: "12", cy: "12", r: "8" },
  children: [],
};

const document: SvgDocument = {
  type: "document",
  declaration: { version: "1.0", encoding: "UTF-8" },
  children: [
    { type: "comment", value: " logo " },
    {
      type: "element",
      name: "svg",
      attributes: { viewBox: "0 0 24 24" },
      children: [{ type: "text", value: "\n" }, circle],
    },
  ],
};

test("copies a document deeply", () => {
  const copy = clone(document);

  expect(copy).toEqual(document);
  expect(copy).not.toBe(document);
  expect(copy.declaration).not.toBe(document.declaration);
  expect(copy.children[0]).not.toBe(document.children[0]);

  const svg = copy.children[1] as SvgElement;
  const original = document.children[1] as SvgElement;
  expect(svg).not.toBe(original);
  expect(svg.attributes).not.toBe(original.attributes);
  expect(svg.children).not.toBe(original.children);
  expect(svg.children[1]).not.toBe(circle);
});

test("copies a document without a declaration", () => {
  const copy = clone({ type: "document", children: [circle] });
  expect(copy).toEqual({ type: "document", children: [circle] });
  expect("declaration" in copy).toBe(false);
});

test("copies a single node", () => {
  const copy = clone(circle);
  expect(copy).toEqual(circle);
  expect(copy.attributes).not.toBe(circle.attributes);

  copy.attributes.fill = "red";
  expect(circle.attributes).not.toHaveProperty("fill");
});

test("keeps attribute order", () => {
  expect(Object.keys(clone(circle).attributes)).toEqual(["cx", "cy", "r"]);
});

test("keeps fields that are not part of the node types", () => {
  const node = { type: "text", value: "a", extra: 1 } as const;
  expect(clone(node)).toEqual(node);
});
