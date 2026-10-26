import type { SvgDocument, SvgElement } from "./types";

/**
 * Returns the root element of a document, usually `<svg>`.
 *
 * Comments, processing instructions, the doctype and whitespace around the
 * root element are skipped.
 *
 * @example
 * ```ts
 * const document = parse('<!-- logo --><svg viewBox="0 0 24 24"/>');
 * const svg = getRoot(document);
 * svg.attributes.viewBox; // "0 0 24 24"
 * ```
 *
 * @throws {TypeError} If the document does not have exactly one element among
 *   its children. A document from `parse()` always has one, so this only
 *   happens with trees built or edited by hand.
 */
export function getRoot(document: SvgDocument): SvgElement {
  let root: SvgElement | undefined;

  for (const child of document.children) {
    if (child.type !== "element") continue;

    if (root !== undefined) {
      throw new TypeError("Document has more than one root element");
    }
    root = child;
  }

  if (root === undefined) {
    throw new TypeError("Document has no root element");
  }

  return root;
}
