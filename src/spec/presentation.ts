import type { SvgElement } from "../ast";
import { getStyleProperty } from "../attributes";
import { splitImportant } from "../shared";
import { svg11Elements, svg11PresentationAttributes } from "./generated/svg11";
import { svg2Elements, svg2PresentationAttributes } from "./generated/svg2";
import type { SvgVersion } from "./types";

/**
 * The value a property has on an element, and where it comes from: the
 * `style` attribute or a presentation attribute.
 *
 * @example
 * ```ts
 * // <path fill="red" style="fill: blue !important"/>
 * const value: SvgPresentationValue = {
 *   value: "blue",
 *   source: "style",
 *   important: true,
 * };
 * ```
 */
export interface SvgPresentationValue {
  /** The value as written, trimmed, without `!important`. */
  value: string;
  /**
   * `"style"` if a declaration in the `style` attribute sets it,
   * `"attribute"` if the presentation attribute of the same name does.
   */
  source: "style" | "attribute";
  /**
   * Whether the `style` declaration is `!important`. Always `false` for an
   * attribute, which cannot be.
   */
  important: boolean;
}

/**
 * The presentation attributes of one version, widened for lookups.
 */
interface PresentationData {
  /** The attributes of the presentation group. */
  group: readonly string[];
  /** The name of the presentation group in this version. */
  groupName: string;
  elements: Readonly<
    Record<
      string,
      { groups: readonly string[]; presentation: readonly string[] }
    >
  >;
}

const versions: Readonly<Record<SvgVersion, PresentationData>> = {
  "1.1": {
    group: svg11PresentationAttributes,
    groupName: "Presentation",
    elements: svg11Elements,
  },
  "2": {
    group: svg2PresentationAttributes,
    groupName: "presentation",
    elements: svg2Elements,
  },
};

/**
 * Whether `name` is a presentation attribute of the element in a version:
 * the element takes the presentation group and the group has the name, or
 * it is one of the element's own presentation attributes, such as `cx` on
 * `circle` in SVG 2.
 */
const isPresentationAttribute = (
  data: PresentationData,
  element: string,
  name: string,
): boolean => {
  const entry = Object.hasOwn(data.elements, element)
    ? data.elements[element]
    : undefined;
  if (entry === undefined) return false;
  return (
    entry.presentation.includes(name) ||
    (entry.groups.includes(data.groupName) && data.group.includes(name))
  );
};

/**
 * Returns the value a property has on an element, from its `style` attribute
 * or its presentation attribute, or `undefined` if neither sets it.
 *
 * The cascade on the element itself decides, as in CSS: a declaration in
 * `style` wins over the presentation attribute, and among declarations the
 * last one wins unless an earlier one is `!important`. The presentation
 * attribute counts only if it is one on this element in SVG version
 * `version`, or in any version when it is left out: `fill` on `rect`, `cx` on
 * `circle` in SVG 2, but not `fill` on an unknown element or on a prefixed one
 * such as `svg:rect`, whose name the specs do not use.
 *
 * Only the element is read: `<style>` sheets, inherited values and initial
 * values are not taken into account, and neither value is checked against
 * the property's syntax. A value such as `inherit` is returned as written.
 *
 * @example
 * ```ts
 * // <path fill="red" style="fill: blue"/>
 * getPresentationValue(path, "fill");
 * // { value: "blue", source: "style", important: false }
 *
 * // <path fill="red" stroke-width="2"/>
 * getPresentationValue(path, "stroke-width");
 * // { value: "2", source: "attribute", important: false }
 * getPresentationValue(path, "stroke"); // undefined
 * ```
 */
export function getPresentationValue(
  element: SvgElement,
  name: string,
  version?: SvgVersion,
): SvgPresentationValue | undefined {
  const declared = getStyleProperty(element, name);
  if (declared !== undefined) {
    const { value, important } = splitImportant(declared);
    return { value, source: "style", important };
  }

  const attribute = Object.hasOwn(element.attributes, name)
    ? element.attributes[name]
    : undefined;
  if (attribute === undefined) return undefined;
  const checked =
    version === undefined
      ? [versions["1.1"], versions["2"]]
      : [versions[version]];
  return checked.some((data) =>
    isPresentationAttribute(data, element.name, name),
  )
    ? { value: attribute.trim(), source: "attribute", important: false }
    : undefined;
}
