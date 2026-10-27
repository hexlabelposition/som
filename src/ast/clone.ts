import type { SvgChild, SvgDocument, SvgElement } from "./types";

/**
 * Returns a deep copy of a document or node.
 *
 * Helpers mutate the nodes they get, so copy a tree first when the original
 * has to stay as it is. Attribute order is kept. Fields that are not part of
 * the node types are copied shallowly.
 *
 * @example
 * ```ts
 * const copy = clone(document);
 * getRoot(copy).attributes.fill = "red";
 * getRoot(document).attributes.fill; // unchanged
 * ```
 */
export function clone<T extends SvgDocument | SvgChild>(node: T): T {
  if (node.type === "document") {
    return cloneDocument(node) as T;
  }
  return cloneChild(node) as T;
}

function cloneDocument(document: SvgDocument): SvgDocument {
  const copy: SvgDocument = {
    ...document,
    children: document.children.map(cloneChild),
  };
  if (document.declaration !== undefined) {
    copy.declaration = { ...document.declaration };
  }
  return copy;
}

function cloneElement(element: SvgElement): SvgElement {
  return {
    ...element,
    attributes: { ...element.attributes },
    children: element.children.map(cloneChild),
  };
}

function cloneChild<T extends SvgChild>(node: T): T;
function cloneChild(node: SvgChild): SvgChild {
  return node.type === "element" ? cloneElement(node) : { ...node };
}
