import type { SvgChild, SvgParent } from "./types";

/**
 * Visits every descendant of a document or element in document order.
 *
 * The callback gets each node with its parent and its index in
 * `parent.children`. The starting node itself is not visited. The callback can
 * return:
 *
 * - `"skip"` to leave out the children of the current node;
 * - `"stop"` to end the walk;
 * - nothing to continue.
 *
 * The children of a node are read after its callback returns, so the callback
 * may change the current node, including replacing its `children`. It must not
 * add or remove siblings of the current node: collect them with
 * {@link findAll} and change the tree after the walk.
 *
 * @example
 * ```ts
 * // Count the elements outside of <defs>.
 * let count = 0;
 * walk(document, (node) => {
 *   if (node.type !== "element") return;
 *   if (node.name === "defs") return "skip";
 *   count++;
 * });
 * ```
 */
export function walk(
  parent: SvgParent,
  callback: (
    node: SvgChild,
    parent: SvgParent,
    index: number,
  ) => "skip" | "stop" | undefined,
): void {
  walkChildren(parent, callback);
}

/**
 * Walks the children of `parent` and returns `true` if the walk was stopped.
 */
function walkChildren(
  parent: SvgParent,
  callback: Parameters<typeof walk>[1],
): boolean {
  let index = 0;
  for (const node of parent.children) {
    const action = callback(node, parent, index++);
    if (action === "stop") return true;
    if (action !== "skip" && node.type === "element") {
      if (walkChildren(node, callback)) return true;
    }
  }
  return false;
}

/**
 * Returns the first descendant in document order that passes the test, or
 * `undefined` if there is none.
 *
 * The test gets the same arguments as the {@link walk} callback. A type guard
 * narrows the result.
 *
 * @example
 * ```ts
 * const title = find(
 *   document,
 *   (node) => isElement(node) && node.name === "title",
 * );
 * ```
 */
export function find<T extends SvgChild>(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => node is T,
): T | undefined;
export function find(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => boolean,
): SvgChild | undefined;
export function find(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => boolean,
): SvgChild | undefined {
  let found: SvgChild | undefined;
  walk(parent, (node, nodeParent, index) => {
    if (!test(node, nodeParent, index)) return;
    found = node;
    return "stop";
  });
  return found;
}

/**
 * Returns every descendant that passes the test, in document order.
 *
 * The test gets the same arguments as the {@link walk} callback. A type guard
 * narrows the result.
 *
 * @example
 * ```ts
 * // Remove every fill attribute.
 * for (const element of findAll(document, isElement)) {
 *   delete element.attributes.fill;
 * }
 * ```
 */
export function findAll<T extends SvgChild>(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => node is T,
): T[];
export function findAll(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => boolean,
): SvgChild[];
export function findAll(
  parent: SvgParent,
  test: (node: SvgChild, parent: SvgParent, index: number) => boolean,
): SvgChild[] {
  const found: SvgChild[] = [];
  walk(parent, (node, nodeParent, index) => {
    if (test(node, nodeParent, index)) found.push(node);
  });
  return found;
}
