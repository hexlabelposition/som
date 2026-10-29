import type { svg11Elements, svg11Groups } from "./generated/svg11";
import type { svg2Elements, svg2Groups } from "./generated/svg2";

/**
 * The generated data of each version, as types only: nothing from
 * `generated/` ends up in a bundle through these types.
 */
interface SpecData {
  "1.1": { elements: typeof svg11Elements; groups: typeof svg11Groups };
  "2": { elements: typeof svg2Elements; groups: typeof svg2Groups };
}

type Item<T> = T extends readonly (infer I)[] ? I : never;

/**
 * The attributes of element `E` in version `V`: its own attributes and those
 * of its attribute groups. Distributes over unions of versions and elements.
 */
type AttributesOf<V extends SvgVersion, E> = V extends SvgVersion
  ? E extends keyof SpecData[V]["elements"]
    ? SpecData[V]["elements"][E] extends {
        groups: infer G;
        attributes: infer A;
      }
      ? | Item<A>
        | Item<SpecData[V]["groups"][Item<G> & keyof SpecData[V]["groups"]]>
      : never
    : never
  : never;

/**
 * An SVG version the spec types cover: SVG 1.1 Second Edition or SVG 2
 * (ARCHITECTURE §11).
 *
 * The spec types take it as their last parameter. Leaving it out means any
 * version: a name is accepted if one of the versions defines it.
 *
 * @example
 * ```ts
 * const version: SvgVersion = "2";
 * ```
 */
export type SvgVersion = "1.1" | "2";

/**
 * The name of an element defined in SVG version `V`, or in any version when
 * `V` is left out.
 *
 * Names are case-sensitive and written without a namespace prefix, as the
 * specs define them: `linearGradient`, `feGaussianBlur`.
 *
 * @example
 * ```ts
 * const any: SvgElementName = "altGlyph"; // SVG 1.1 only
 * const svg2: SvgElementName<"2"> = "feDropShadow";
 * // @ts-expect-error: altGlyph was removed in SVG 2
 * const removed: SvgElementName<"2"> = "altGlyph";
 * ```
 */
export type SvgElementName<V extends SvgVersion = SvgVersion> =
  V extends SvgVersion ? keyof SpecData[V]["elements"] & string : never;

/**
 * The name of an attribute that element `E` allows in SVG version `V`, or in
 * any version when `V` is left out.
 *
 * It covers the element's own attributes and those of its attribute groups,
 * such as the core and presentation attributes, as the specs list them.
 * Attributes the specs do not list, such as `data-*` or attributes in an
 * editor's namespace, are not included. With a union of elements, it is the
 * attributes any of them allows.
 *
 * @example
 * ```ts
 * const any: SvgAttributeName<"rect"> = "enable-background"; // SVG 1.1 only
 * const svg2: SvgAttributeName<"rect", "2"> = "rx";
 * // @ts-expect-error: enable-background is not in SVG 2
 * const removed: SvgAttributeName<"rect", "2"> = "enable-background";
 * ```
 */
export type SvgAttributeName<
  E extends SvgElementName<V>,
  V extends SvgVersion = SvgVersion,
> = AttributesOf<V, E>;
