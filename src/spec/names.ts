import { svg11Elements, svg11Groups } from "./generated/svg11";
import { svg2Elements, svg2Groups } from "./generated/svg2";
import type { SvgAttributeName, SvgElementName, SvgVersion } from "./types";

/**
 * The generated data of one version, widened to plain records for lookups.
 */
interface VersionData {
  elements: Readonly<
    Record<
      string,
      {
        groups: readonly string[];
        attributes: Readonly<Record<string, unknown>>;
      }
    >
  >;
  groups: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

const versions: Readonly<Record<SvgVersion, VersionData>> = {
  "1.1": { elements: svg11Elements, groups: svg11Groups },
  "2": { elements: svg2Elements, groups: svg2Groups },
};

const versionsOf = (version: SvgVersion | undefined): VersionData[] =>
  version === undefined
    ? [versions["1.1"], versions["2"]]
    : [versions[version]];

/**
 * Checks whether an element name is defined in SVG version `version`, or in
 * any version when it is left out (ARCHITECTURE §11).
 *
 * Names are compared as the specs write them: case-sensitive and without a
 * namespace prefix, so `svg:rect` and `lineargradient` are not element names.
 * Pass the local name of a prefixed element.
 *
 * @param name - The element name to check, such as `"rect"`.
 * @param version - The SVG version, `"1.1"` or `"2"`; any version if left out.
 * @returns Whether the version defines the element.
 *
 * @example
 * ```ts
 * isSvgElementName("feDropShadow"); // true
 * isSvgElementName("altGlyph", "2"); // false: removed in SVG 2
 * isSvgElementName("div"); // false
 * ```
 */
export function isSvgElementName<V extends SvgVersion = SvgVersion>(
  name: string,
  version?: V,
): name is SvgElementName<V> {
  return versionsOf(version).some((data) => Object.hasOwn(data.elements, name));
}

/**
 * Checks whether an element allows an attribute in SVG version `version`, or
 * in any version when it is left out (ARCHITECTURE §11). Group attributes,
 * such as `id`, `class` and the presentation attributes, count for every
 * element in the group.
 *
 * Only attributes the specs list are valid: `data-*` attributes and
 * attributes in other namespaces, such as `inkscape:label`, are not. Names
 * are case-sensitive and use the prefixes the specs use (`xlink:href`,
 * `xml:space`). An element the version does not define allows no
 * attributes.
 *
 * @param element - The element name, such as `"rect"`.
 * @param attribute - The attribute name to check, such as `"rx"`.
 * @param version - The SVG version, `"1.1"` or `"2"`; any version if left out.
 * @returns Whether the element allows the attribute in the version. With an
 *   element name known at compile time, a `true` result narrows `attribute`
 *   to {@link SvgAttributeName}.
 *
 * @example
 * ```ts
 * isSvgAttributeName("rect", "rx"); // true
 * isSvgAttributeName("rect", "fill"); // true: a presentation attribute
 * isSvgAttributeName("rect", "enable-background", "2"); // false: SVG 1.1 only
 * isSvgAttributeName("rect", "cx"); // false: circle only
 * ```
 */
export function isSvgAttributeName<
  E extends SvgElementName<V>,
  V extends SvgVersion = SvgVersion,
>(
  element: E,
  attribute: string,
  version?: V,
): attribute is SvgAttributeName<E, V>;
/**
 * Checks whether an element allows an attribute in SVG version `version`, or
 * in any version when it is left out. This signature takes an element name
 * known only at run time, so the result does not narrow `attribute`.
 *
 * @param element - The element name, such as `"rect"`.
 * @param attribute - The attribute name to check, such as `"rx"`.
 * @param version - The SVG version, `"1.1"` or `"2"`; any version if left out.
 * @returns Whether the element allows the attribute in the version.
 *
 * @example
 * ```ts
 * const element: string = getRoot(parse(input)).name;
 * isSvgAttributeName(element, "viewBox"); // true for "svg"
 * ```
 */
export function isSvgAttributeName(
  element: string,
  attribute: string,
  version?: SvgVersion,
): boolean;
export function isSvgAttributeName(
  element: string,
  attribute: string,
  version?: SvgVersion,
): boolean {
  return versionsOf(version).some((data) => {
    // Object.hasOwn keeps names such as "constructor" from matching
    // Object.prototype.
    const entry = Object.hasOwn(data.elements, element)
      ? data.elements[element]
      : undefined;
    if (entry === undefined) {
      return false;
    }
    const { groups, attributes } = entry;
    return (
      Object.hasOwn(attributes, attribute) ||
      groups.some((group) => {
        const members = data.groups[group];
        return members !== undefined && Object.hasOwn(members, attribute);
      })
    );
  });
}
