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
 * The kinds of attribute values the generator tells apart. They are som's own
 * vocabulary, mapped from each source: DTD datatypes for SVG 1.1, CSS value
 * syntax and IDL reflection types for SVG 2 (ARCHITECTURE §11).
 */
export const valueKinds = [
  /** Any text: names, IDs, language tags, media queries, … */
  "string",
  "number",
  "integer",
  /** One or two numbers, such as `stdDeviation="2 3"`. */
  "number-optional-number",
  /** A number or a percentage, such as `offset` on `stop`. */
  "number-or-percentage",
  "number-list",
  /** A length or percentage; a plain number means user units. */
  "length",
  "length-list",
  "angle",
  "color",
  /** A color, `none`, or a reference to a paint server. */
  "paint",
  /** A URL or a fragment reference such as `#gradient`. */
  "url",
  "path-data",
  "points",
  "transform-list",
  "view-box",
  "preserve-aspect-ratio",
  /** Script code of an event handler such as `onclick`. */
  "script",
  /** CSS declarations, as in the `style` attribute. */
  "style",
  /** A CSS property value that none of the kinds above describes. */
  "css",
] as const;

/**
 * One of {@link valueKinds}.
 */
export type ValueKind = (typeof valueKinds)[number];

/**
 * The value type of an attribute: a kind, or the keywords of an enumeration.
 */
export type ValueType = ValueKind | string[];

/**
 * The value types of one SVG version.
 */
export interface SpecValues {
  /** By element, the value types of its own attributes. */
  elements: Map<string, Map<string, ValueType>>;
  /**
   * By group, the value types of its attributes. An attribute may have a
   * different type in another group: `xlink:show` is fixed to `embed` or
   * `other` depending on the XLink group in SVG 1.1.
   */
  groups: Map<string, Map<string, ValueType>>;
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

  values: SpecValues;
}

/**
 * The element and attribute names of a version, before value types are
 * known.
 */
export type SpecNames = Omit<SpecData, "values">;

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
