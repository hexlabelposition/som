import type { IdlAttributes } from "./idl";
import type {
  SpecData,
  SpecNames,
  SpecValues,
  ValueKind,
  ValueType,
} from "./model";

/**
 * Value types of SVG 2 attributes that the CSS and IDL data does not give:
 * attributes new in SVG 2 or its modules that no IDL attribute reflects, and
 * enumerations whose keywords changed since SVG 1.1. Keys are `name`, or
 * `element:name` and `group:name` where the type depends on them. Each entry
 * names the definition it comes from.
 */
const svg2Overrides: Readonly<Record<string, ValueType>> = {
  // SVG 2 linking.html: a URL, even where IDL reflects it as a string.
  href: "url",
  // HTML: tabindex is an integer, autofocus a boolean attribute.
  tabindex: "integer",
  autofocus: "string",
  lang: "string",
  role: "string",
  // SVG 2 linking.html: a language tag and a MIME type, as on HTML <a>.
  "a:hreflang": "string",
  "a:type": "string",
  // HTML: CORS settings attribute.
  crossorigin: ["anonymous", "use-credentials"],
  // SVG 2 struct.html, SVG Animations: SVGSVGElement attributes.
  playbackorder: ["forwardonly", "all"],
  timelinebegin: ["loadend", "loadstart"],
  // SVG 2 text.html#TextPathElementSideAttribute.
  "textPath:side": ["left", "right"],
  "textPath:path": "path-data",
  // SVG Animations#AnimateMotionElementPathAttribute; CDATA in the SVG 1.1 DTD.
  "animateMotion:path": "path-data",
  // SVG 2 painting.html#OrientAttribute: auto | auto-start-reverse | <angle>.
  "marker:orient": "string",
  // Filter Effects 1: <blend-mode> from Compositing and Blending 1.
  "feBlend:mode": [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
  ],
  // Filter Effects 1: `lighter` was added.
  "feComposite:operator": [
    "over",
    "in",
    "out",
    "atop",
    "xor",
    "lighter",
    "arithmetic",
  ],
  // Filter Effects 1#element-attrdef-fegaussianblur-edgemode, new.
  "feGaussianBlur:edgeMode": ["duplicate", "wrap", "none"],
  // SVG Animations: `fill` of animation elements, not the property.
  "animation timing:fill": ["freeze", "remove"],
};

/**
 * Value kinds of IDL types. `enum` and `boolean` become keyword lists.
 */
const idlKinds: Readonly<Record<string, ValueKind | "enum" | "boolean">> = {
  SVGAnimatedAngle: "angle",
  SVGAnimatedBoolean: "boolean",
  SVGAnimatedEnumeration: "enum",
  SVGAnimatedInteger: "integer",
  SVGAnimatedLength: "length",
  SVGAnimatedLengthList: "length-list",
  SVGAnimatedNumber: "number",
  SVGAnimatedNumberList: "number-list",
  SVGAnimatedPreserveAspectRatio: "preserve-aspect-ratio",
  SVGAnimatedRect: "view-box",
  SVGAnimatedString: "string",
  SVGAnimatedTransformList: "transform-list",
  SVGPointList: "points",
  SVGStringList: "string",
  DOMString: "string",
  USVString: "string",
};

/**
 * IDL attributes whose content attribute has another name.
 */
const idlNames: Readonly<Record<string, string>> = {
  className: "class",
  in1: "in",
};

/**
 * Value kinds of CSS value syntaxes. A syntax of keywords only becomes an
 * enumeration; any other syntax is `css`.
 */
const cssKinds: Readonly<Record<string, ValueKind>> = {
  "<color>": "color",
  "<'color'>": "color",
  "<paint>": "paint",
  "<number>": "number",
  "<'opacity'>": "number-or-percentage",
  "<opacity-value>": "number-or-percentage",
  "<length-percentage>": "length",
  "<length-percentage> | <number>": "length",
  "none | <transform-list>": "transform-list",
};

/**
 * The inputs the SVG 2 value types are derived from.
 */
export interface Svg2Sources {
  svg2: SpecNames & { interfaces: Map<string, string> };
  svg11: SpecData;
  /** CSS value syntax by property name, from `@webref/css`. */
  cssSyntax: Map<string, string>;
  idl: IdlAttributes;
}

/**
 * Derives the value types of SVG 2 attributes (ARCHITECTURE §11), trying in
 * order: the overrides above; for presentation attributes, the CSS value
 * syntax; for the attributes of one element, the IDL attribute that reflects
 * it; the same attribute in SVG 1.1; and the conventions for event handlers
 * (`on*`, script) and ARIA (`aria-*`, string). Anything left fails the
 * generator.
 */
export const deriveSvg2Values = ({
  svg2,
  svg11,
  cssSyntax,
  idl,
}: Svg2Sources): SpecValues => {
  const used = new Set<string>();
  const override = (...keys: string[]): ValueType | undefined => {
    for (const key of keys) {
      const type = svg2Overrides[key];
      if (type !== undefined) {
        used.add(key);
        return type;
      }
    }
    return undefined;
  };

  const fromCss = (name: string): ValueType | undefined => {
    const syntax = cssSyntax.get(name);
    if (syntax === undefined) {
      return undefined;
    }
    return (
      cssKinds[syntax] ??
      (/^[a-zA-Z-]+( \| [a-zA-Z-]+)*$/.test(syntax)
        ? syntax.split(" | ")
        : "css")
    );
  };

  const inSvg11Groups = typesByName([...svg11.values.groups.values()]);
  const inSvg11 = typesByName([
    ...svg11.values.groups.values(),
    ...svg11.values.elements.values(),
  ]);
  const only = (
    types: Map<string, ValueType> | undefined,
  ): ValueType | undefined =>
    types?.size === 1 ? [...types.values()][0] : undefined;
  /** The SVG 1.1 type of an attribute on an element, own or from a group. */
  const svg11On = (element: string, name: string): ValueType | undefined => {
    const own = svg11.values.elements.get(element)?.get(name);
    if (own !== undefined) {
      return own;
    }
    const groups = svg11.elements.get(element)?.groups ?? [];
    return only(
      typesByName(
        groups.flatMap((group) => svg11.values.groups.get(group) ?? []),
      ).get(name),
    );
  };
  // An attribute takes its SVG 1.1 type on the same element; a group
  // attribute its type on the SVG 1.1 elements that use the group in SVG 2.
  // By name alone, it takes the one type SVG 1.1 gives it in its groups or
  // anywhere.
  const fromSvg11 = (name: string, element?: string): ValueType | undefined =>
    (element === undefined ? undefined : svg11On(element, name)) ??
    only(inSvg11Groups.get(name)) ??
    only(inSvg11.get(name));
  const fromSvg11Group = (name: string, group: string): ValueType | undefined =>
    only(
      typesByName(
        [...svg2.elements]
          .filter(([, data]) => data.groups.includes(group))
          .map(([element]) => {
            const type = svg11On(element, name);
            return new Map(type === undefined ? [] : [[name, type]]);
          }),
      ).get(name),
    ) ?? fromSvg11(name);

  const conventions = (name: string): ValueType | undefined =>
    /^on[a-z]+$/.test(name)
      ? "script"
      : name.startsWith("aria-")
        ? "string"
        : undefined;

  // Collected, so one run lists every attribute that needs an override.
  const missing: string[] = [];
  const fail = (name: string, where: string): ValueType => {
    missing.push(`${name} in ${where}`);
    return "string";
  };

  const groups = new Map<string, Map<string, ValueType>>();
  for (const [group, attributes] of svg2.groups) {
    const values = new Map<string, ValueType>();
    for (const name of attributes) {
      const type =
        override(`${group}:${name}`, name) ??
        (group === "presentation"
          ? (fromCss(name) ??
            svg11.values.groups.get("Presentation")?.get(name))
          : (fromSvg11Group(name, group) ?? conventions(name)));
      values.set(name, type ?? fail(name, `group ${group}`));
    }
    groups.set(group, values);
  }

  const elements = new Map<string, Map<string, ValueType>>();
  for (const [element, data] of svg2.elements) {
    const reflected = reflectedKinds(
      idl(svg2.interfaces.get(element) ?? ""),
      data.attributes,
    );
    const fromIdl = (name: string): ValueType | undefined => {
      const kind = reflected.get(name);
      if (kind === undefined) {
        return undefined;
      }
      const previous = fromSvg11(name, element);
      if (kind === "boolean") {
        return ["false", "true"];
      }
      if (kind === "enum") {
        // IDL does not list the keywords; SVG 1.1 does.
        return Array.isArray(previous)
          ? previous
          : fail(name, `element ${element} (an enumeration)`);
      }
      // A string may be a URL or an enumeration, and a number may also take
      // a percentage; SVG 1.1 says which.
      if (
        previous !== undefined &&
        (kind === "string" ||
          (kind === "number" && previous === "number-or-percentage"))
      ) {
        return previous;
      }
      return kind;
    };
    const values = new Map<string, ValueType>();
    for (const name of data.attributes) {
      const type =
        override(`${element}:${name}`, name) ??
        fromIdl(name) ??
        (svg2.presentationAttributes.includes(name)
          ? fromCss(name)
          : undefined) ??
        fromSvg11(name, element) ??
        conventions(name);
      values.set(name, type ?? fail(name, `element ${element}`));
    }
    elements.set(element, values);
  }

  if (missing.length > 0) {
    throw new Error(
      `values: no value type for ${missing.join(", ")}; add them to svg2Overrides`,
    );
  }
  for (const key of Object.keys(svg2Overrides)) {
    if (!used.has(key)) {
      throw new Error(`values: svg2Overrides.${key} is not used; remove it`);
    }
  }

  return { elements, groups };
};

/**
 * All value types each attribute name has in the given maps, keyed by their
 * string form.
 */
const typesByName = (
  maps: readonly Map<string, ValueType>[],
): Map<string, Map<string, ValueType>> => {
  const types = new Map<string, Map<string, ValueType>>();
  for (const values of maps) {
    for (const [name, type] of values) {
      const byName = types.get(name) ?? new Map<string, ValueType>();
      byName.set(String(type), type);
      types.set(name, byName);
    }
  }
  return types;
};

/**
 * The value kinds of an element's attributes as its IDL interface reflects
 * them. Pairs such as `stdDeviationX` and `stdDeviationY` reflect one
 * attribute of one or two numbers.
 */
const reflectedKinds = (
  reflected: Map<string, string>,
  attributes: readonly string[],
): Map<string, ValueKind | "enum" | "boolean"> => {
  const byLowercase = new Map(
    attributes.map((name) => [name.toLowerCase(), name]),
  );
  const kinds = new Map<string, ValueKind | "enum" | "boolean">();

  for (const [idlName, idlType] of reflected) {
    const pair = /^(.+)X$/.exec(idlName)?.[1];
    if (
      pair !== undefined &&
      reflected.has(`${pair}Y`) &&
      attributes.includes(pair)
    ) {
      kinds.set(pair, "number-optional-number");
      continue;
    }

    // HTML reflects content attributes in camel case: crossOrigin.
    const name =
      idlNames[idlName] ??
      (attributes.includes(idlName)
        ? idlName
        : byLowercase.get(idlName.toLowerCase()));
    const kind = idlKinds[idlType];
    if (name !== undefined && kind !== undefined && !kinds.has(name)) {
      kinds.set(name, kind);
    }
  }

  return kinds;
};
