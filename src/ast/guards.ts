import type {
  SvgCData,
  SvgComment,
  SvgDoctype,
  SvgDocumentChild,
  SvgElement,
  SvgInstruction,
  SvgNode,
  SvgText,
} from "./types";

/**
 * Checks whether a node is an element.
 *
 * Narrows the type, so it also works as an array filter.
 *
 * @example
 * ```ts
 * const elements = svg.children.filter(isElement);
 * // elements: SvgElement[]
 * ```
 */
export function isElement(
  node: SvgNode | SvgDocumentChild,
): node is SvgElement {
  return node.type === "element";
}

/**
 * Checks whether a node is text, including whitespace between elements.
 *
 * @example
 * ```ts
 * const text = element.children.filter(isText).map((node) => node.value);
 * ```
 */
export function isText(node: SvgNode | SvgDocumentChild): node is SvgText {
  return node.type === "text";
}

/**
 * Checks whether a node is a CDATA section.
 *
 * @example
 * ```ts
 * const css = style.children.filter(isCData).map((node) => node.value);
 * ```
 */
export function isCData(node: SvgNode | SvgDocumentChild): node is SvgCData {
  return node.type === "cdata";
}

/**
 * Checks whether a node is a comment.
 *
 * @example
 * ```ts
 * // Drop comments from an element.
 * svg.children = svg.children.filter((node) => !isComment(node));
 * ```
 */
export function isComment(
  node: SvgNode | SvgDocumentChild,
): node is SvgComment {
  return node.type === "comment";
}

/**
 * Checks whether a node is a processing instruction.
 *
 * @example
 * ```ts
 * const stylesheets = document.children
 *   .filter(isInstruction)
 *   .filter((node) => node.target === "xml-stylesheet");
 * ```
 */
export function isInstruction(
  node: SvgNode | SvgDocumentChild,
): node is SvgInstruction {
  return node.type === "instruction";
}

/**
 * Checks whether a node is a document type declaration.
 *
 * @example
 * ```ts
 * // Drop the doctype from a document.
 * document.children = document.children.filter((node) => !isDoctype(node));
 * ```
 */
export function isDoctype(
  node: SvgNode | SvgDocumentChild,
): node is SvgDoctype {
  return node.type === "doctype";
}
