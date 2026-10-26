import { describe, expect, test } from "vitest";
import {
  isCData,
  isComment,
  isDoctype,
  isElement,
  isInstruction,
  isText,
} from "./guards";
import type { SvgDocumentChild, SvgNode } from "./types";

const nodes: (SvgNode | SvgDocumentChild)[] = [
  { type: "element", name: "svg", attributes: {}, children: [] },
  { type: "text", value: " " },
  { type: "cdata", value: "a < b" },
  { type: "comment", value: " note " },
  { type: "instruction", target: "xml-stylesheet", value: 'href="a.css"' },
  { type: "doctype", value: "svg" },
];

describe.each([
  [isElement, "element"],
  [isText, "text"],
  [isCData, "cdata"],
  [isComment, "comment"],
  [isInstruction, "instruction"],
  [isDoctype, "doctype"],
] as const)("%o", (guard, type) => {
  test(`matches only ${type} nodes`, () => {
    expect(nodes.filter(guard).map((node) => node.type)).toEqual([type]);
  });
});
