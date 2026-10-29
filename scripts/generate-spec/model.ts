/**
 * An element as the generator emits it.
 */
export interface ElementData {
  /**
   * Attribute groups the element takes all attributes of, by group name.
   */
  groups: string[];

  /**
   * Attributes of the element that are not in one of its `groups`.
   */
  attributes: string[];

  /**
   * Those of `attributes` that are presentation attributes on this element
   * only, such as the geometry properties `cx` and `r` on `circle` in SVG 2.
   */
  presentation: string[];
}

/**
 * The elements and attributes of one SVG version.
 */
export interface SpecData {
  elements: Map<string, ElementData>;

  /**
   * Attribute groups by name, as the source calls them: `Core` in the SVG 1.1
   * DTD, `core` in the SVG 2 definitions.
   */
  groups: Map<string, string[]>;

  /**
   * Presentation attributes that apply to every element taking the
   * presentation group.
   */
  presentationAttributes: string[];
}

/**
 * Compares names by UTF-16 code units, so the output does not depend on the
 * locale.
 */
export const compareNames = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Returns the names without duplicates, sorted with `compareNames`.
 */
export const sortNames = (names: Iterable<string>): string[] =>
  [...new Set(names)].sort(compareNames);
