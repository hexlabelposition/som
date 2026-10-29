import type {
  Identifier,
  SupportStatement,
} from "@mdn/browser-compat-data/types";

/**
 * Browser engines, by the BCD browser that stands for each.
 */
const engines = {
  blink: "chrome",
  gecko: "firefox",
  webkit: "safari",
} as const;

type Engine = keyof typeof engines;

/**
 * Browser support of an element or attribute.
 */
export interface Support {
  deprecated: boolean;
  standardTrack: boolean;

  /**
   * First version with full, unprefixed support that has not been removed
   * since, per engine; `false` if there is none.
   */
  versions: Record<Engine, string | false>;
}

/**
 * Browser support of an element and its attributes.
 */
export interface ElementSupport extends Support {
  attributes: Map<string, Support>;
}

/**
 * Names the support data is limited to: BCD also has entries that are not
 * elements or attributes, such as `data_attributes` or `svgView`, and
 * support never adds anything to the spec data (ARCHITECTURE §11).
 */
export interface KnownNames {
  elements: Map<string, Set<string>>;
  globalAttributes: Set<string>;
}

/**
 * Reads the support data from BCD's `svg.elements` and
 * `svg.global_attributes`.
 */
export const readSupport = (
  svg: Identifier,
  known: KnownNames,
): {
  elements: Map<string, ElementSupport>;
  globalAttributes: Map<string, Support>;
} => {
  const elements = new Map<string, ElementSupport>();
  for (const [name, feature] of features(svg.elements)) {
    const attributes = known.elements.get(name);
    if (attributes === undefined) {
      continue;
    }
    const element: ElementSupport = {
      ...support(feature, `svg.elements.${name}`),
      attributes: new Map(),
    };
    for (const [key, child] of features(feature)) {
      const attribute = attributeName(key);
      if (attributes.has(attribute) || known.globalAttributes.has(attribute)) {
        element.attributes.set(
          attribute,
          support(child, `svg.elements.${name}.${key}`),
        );
      }
    }
    elements.set(name, element);
  }

  const globalAttributes = new Map<string, Support>();
  for (const [key, feature] of features(svg.global_attributes)) {
    const attribute = attributeName(key);
    if (known.globalAttributes.has(attribute)) {
      globalAttributes.set(
        attribute,
        support(feature, `svg.global_attributes.${key}`),
      );
    }
  }

  return { elements, globalAttributes };
};

/**
 * BCD writes `xml:lang` as `xml_lang` and `xlink:href` as `xlink_href`.
 */
const attributeName = (key: string): string =>
  key.replace(/^(xml|xlink)_/, "$1:");

const features = (identifier: Identifier | undefined): [string, Identifier][] =>
  Object.entries(identifier ?? {}).filter(
    (entry): entry is [string, Identifier] => entry[0] !== "__compat",
  );

const support = (feature: Identifier, path: string): Support => {
  const compat = feature.__compat;
  if (compat === undefined) {
    throw new Error(`BCD: ${path} has no compatibility data`);
  }
  const versions = {} as Record<Engine, string | false>;
  for (const [engine, browser] of Object.entries(engines) as [
    Engine,
    (typeof engines)[Engine],
  ][]) {
    versions[engine] = firstVersion(compat.support[browser]);
  }
  return {
    deprecated: compat.status?.deprecated ?? false,
    standardTrack: compat.status?.standard_track ?? false,
    versions,
  };
};

const firstVersion = (
  statements: SupportStatement | undefined,
): string | false => {
  for (const statement of [statements ?? []].flat()) {
    if (
      statement.prefix === undefined &&
      statement.alternative_name === undefined &&
      statement.flags === undefined &&
      statement.partial_implementation !== true &&
      statement.version_removed === undefined &&
      statement.version_added !== false
    ) {
      return statement.version_added;
    }
  }
  return false;
};
