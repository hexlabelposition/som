import {
  sortNames,
  type ElementData,
  type SpecData,
  type ValueKind,
  type ValueType,
} from "./model";

/**
 * The value kind of each DTD datatype entity, such as `%Length.datatype;`.
 * `enum` takes the keywords from the entity's value, such as
 * `( nonzero | evenodd | inherit )`. An unknown datatype fails the generator.
 */
const datatypes: Readonly<Record<string, ValueKind | "enum">> = {
  BaselineShiftValue: "css",
  Boolean: "enum",
  ClassList: "string",
  ClipFillRule: "enum",
  ClipPathValue: "css",
  ClipValue: "css",
  Color: "color",
  ContentType: "string",
  Coordinate: "length",
  Coordinates: "length-list",
  CursorValue: "css",
  EnableBackgroundValue: "css",
  ExtensionList: "string",
  FeatureList: "string",
  FilterValue: "css",
  FontFamilyValue: "css",
  FontSizeAdjustValue: "css",
  FontSizeValue: "css",
  GlyphOrientationHorizontalValue: "css",
  GlyphOrientationVerticalValue: "css",
  Integer: "integer",
  KerningValue: "css",
  LanguageCode: "string",
  LanguageCodes: "string",
  Length: "length",
  Lengths: "length-list",
  LinkTarget: "string",
  MarkerValue: "css",
  MaskValue: "css",
  MediaDesc: "string",
  Number: "number",
  NumberOptionalNumber: "number-optional-number",
  NumberOrPercentage: "number-or-percentage",
  Numbers: "number-list",
  OpacityValue: "number",
  Paint: "paint",
  PathData: "path-data",
  Points: "points",
  PreserveAspectRatioSpec: "preserve-aspect-ratio",
  Script: "script",
  SpacingValue: "css",
  StrokeDashArrayValue: "css",
  StrokeDashOffsetValue: "length",
  StrokeMiterLimitValue: "number",
  StrokeWidthValue: "length",
  StyleSheet: "style",
  SVGColor: "color",
  Text: "string",
  TextDecorationValue: "css",
  TransformList: "transform-list",
  URI: "url",
  ViewBoxSpec: "view-box",
};

/**
 * Reads the elements and attributes of SVG 1.1 from its flat DTD.
 *
 * The DTD is processed the way an XML processor reads an external subset:
 * parameter entities are expanded, the first declaration of an entity wins,
 * and conditional sections are included or ignored by their keyword. External
 * entities are never loaded; the flat DTD already contains every module.
 *
 * Attribute groups are the collection entities such as `%SVG.Core.attrib;`
 * that an `<!ATTLIST>` references directly; their name in the output is the
 * part between `SVG.` and `.attrib`.
 */
export const readSvg11 = (text: string): SpecData => {
  const dtd = readDtd(text);

  const valueType = (token: string): ValueType => {
    const datatype = /^%([A-Za-z]+)\.datatype;$/.exec(token)?.[1];
    if (datatype !== undefined) {
      const kind = datatypes[datatype];
      if (kind === undefined) {
        throw new Error(`DTD: unknown datatype %${datatype}.datatype;`);
      }
      return kind === "enum" ? keywords(dtd.expand(token).trim(), token) : kind;
    }
    return token.startsWith("(") ? keywords(token, token) : "string";
  };

  const elements = new Map<string, ElementData>();
  const elementValues = new Map<string, Map<string, ValueType>>();
  for (const name of dtd.elements) {
    elements.set(name, { groups: [], attributes: [], presentation: [] });
    elementValues.set(name, new Map());
  }

  const groups = new Map<string, string[]>();
  const groupValues = new Map<string, Map<string, ValueType>>();
  const groupAttributes = (group: string): string[] => {
    let attributes = groups.get(group);
    if (attributes === undefined) {
      const value = dtd.entities.get(`SVG.${group}.attrib`);
      if (value === undefined) {
        throw new Error(`DTD: no entity for attribute group ${group}`);
      }
      const definitions = attributeDefinitions(tokenize(value));
      const values = new Map<string, ValueType>();
      for (const { name, type } of definitions) {
        setOnce(values, name, valueType(type), `group ${group}`);
      }
      groupValues.set(group, values);
      attributes = sortNames(definitions.map(({ name }) => name));
      groups.set(group, attributes);
    }
    return attributes;
  };

  for (const { raw } of dtd.attlists) {
    const tokens = tokenize(dtd.expandKeepingDatatypes(raw));
    const name = tokens.shift();
    const element = name === undefined ? undefined : elements.get(name);
    const values = name === undefined ? undefined : elementValues.get(name);
    if (element === undefined || values === undefined) {
      throw new Error(`DTD: <!ATTLIST> for undeclared element ${String(name)}`);
    }

    const inGroups = new Set<string>();
    for (const [, group = ""] of raw.matchAll(groupReference)) {
      element.groups.push(group);
      for (const attribute of groupAttributes(group)) {
        inGroups.add(attribute);
      }
    }
    for (const { name: attribute, type } of attributeDefinitions(tokens)) {
      if (!inGroups.has(attribute)) {
        element.attributes.push(attribute);
        setOnce(values, attribute, valueType(type), `element ${String(name)}`);
      }
    }
  }

  for (const element of elements.values()) {
    element.groups = sortNames(element.groups);
    element.attributes = sortNames(element.attributes);
  }

  // Groups not used directly by any element, such as the parts of
  // %SVG.Presentation.attrib;, stay out of the output.
  const used = new Set([...elements.values()].flatMap((e) => e.groups));
  for (const group of groups.keys()) {
    if (!used.has(group)) {
      groups.delete(group);
      groupValues.delete(group);
    }
  }

  const presentationAttributes = groupAttributes("Presentation");
  return {
    elements,
    groups,
    presentationAttributes,
    values: { elements: elementValues, groups: groupValues },
  };
};

/**
 * Sets a value type, failing if the attribute already has a different one.
 */
const setOnce = (
  values: Map<string, ValueType>,
  name: string,
  type: ValueType,
  where: string,
): void => {
  const existing = values.get(name);
  if (existing !== undefined && String(existing) !== String(type)) {
    throw new Error(
      `DTD: ${name} in ${where} is ${String(type)}, elsewhere ${String(existing)}`,
    );
  }
  values.set(name, type);
};

/**
 * Splits an enumeration such as `( nonzero | evenodd )` into its keywords.
 */
const keywords = (group: string, source: string): string[] => {
  if (!group.startsWith("(") || !group.endsWith(")")) {
    throw new Error(`DTD: ${source} is not an enumeration`);
  }
  return group
    .slice(1, -1)
    .split("|")
    .map((keyword) => keyword.trim());
};

/**
 * A reference to an attribute collection, such as `%SVG.Core.attrib;`.
 * Single attributes such as `%SVG.id.attrib;` start with a lowercase letter.
 */
const groupReference = /%SVG\.([A-Z][A-Za-z]*)\.attrib;/g;

const parameterReference = /%([A-Za-z_][\w.-]*);/g;

interface Dtd {
  /** Internal parameter entities with their replacement text. */
  entities: Map<string, string>;
  /** Names of external parameter entities, which are never loaded. */
  external: Set<string>;
  /** Element names, after entity expansion. */
  elements: string[];
  /** `<!ATTLIST>` bodies before entity expansion. */
  attlists: { raw: string }[];
  /** Expands parameter entity references in declaration text. */
  expand: (text: string) => string;
  /** Expands them too, but leaves datatype references such as `%Length.datatype;`. */
  expandKeepingDatatypes: (text: string) => string;
}

const readDtd = (input: string): Dtd => {
  const entities = new Map<string, string>();
  const external = new Set<string>();
  const elements: string[] = [];
  const attlists: { raw: string }[] = [];

  const expandWith = (
    text: string,
    keepDatatypes: boolean,
    depth = 0,
  ): string => {
    if (depth > 32) {
      throw new Error("DTD: parameter entities nest too deep");
    }
    return text.replace(parameterReference, (reference, name: string) => {
      if (keepDatatypes && name.endsWith(".datatype")) {
        return reference;
      }
      const value = entities.get(name);
      if (value === undefined) {
        throw new Error(
          external.has(name)
            ? `DTD: external parameter entity %${name}; is not loaded`
            : `DTD: undefined parameter entity %${name};`,
        );
      }
      return expandWith(value, keepDatatypes, depth + 1);
    });
  };
  const expand = (text: string): string => expandWith(text, false);
  const expandKeepingDatatypes = (text: string): string =>
    expandWith(text, true);

  let text = input;
  let position = 0;
  let openSections = 0;

  // Typed explicitly, so the compiler knows the calls below do not return.
  const fail: (message: string) => never = (message) => {
    throw new Error(`DTD: ${message} at offset ${String(position)}`);
  };

  for (;;) {
    position = skipWhitespace(text, position);
    if (position >= text.length) {
      break;
    }

    if (text.startsWith("<!--", position)) {
      const end = text.indexOf("-->", position + 4);
      if (end === -1) fail("unterminated comment");
      position = end + 3;
    } else if (text.startsWith("<![", position)) {
      const open = text.indexOf("[", position + 3);
      if (open === -1) fail("unterminated conditional section");
      const keyword = expand(text.slice(position + 3, open)).trim();
      position = open + 1;
      if (keyword === "INCLUDE") {
        openSections++;
      } else if (keyword === "IGNORE") {
        position = skipIgnoredSection(text, position);
      } else {
        fail(`unknown conditional section keyword ${keyword}`);
      }
    } else if (text.startsWith("]]>", position)) {
      if (openSections === 0) fail("]]> outside a conditional section");
      openSections--;
      position += 3;
    } else if (text[position] === "%") {
      const match = /^%([A-Za-z_][\w.-]*);/.exec(text.slice(position));
      if (match === null) fail("malformed parameter entity reference");
      // A reference between declarations is replaced by its text in place.
      const replacement = expand(match[0]);
      text = ` ${replacement} ${text.slice(position + match[0].length)}`;
      position = 0;
    } else if (text.startsWith("<!", position)) {
      const end = declarationEnd(text, position);
      const declaration = text.slice(position + 2, end);
      position = end + 1;
      const [keyword = ""] = declaration.split(/\s/, 1);
      const body = declaration.slice(keyword.length);

      if (keyword === "ENTITY") {
        readEntity(body, entities, external, expandKeepingDatatypes);
      } else if (keyword === "ELEMENT") {
        const [name] = tokenize(expand(body));
        if (name === undefined) fail("<!ELEMENT> without a name");
        elements.push(name);
      } else if (keyword === "ATTLIST") {
        attlists.push({ raw: body });
      } else if (keyword !== "NOTATION") {
        fail(`unknown declaration <!${keyword}`);
      }
    } else {
      fail(`unexpected ${JSON.stringify(text.slice(position, position + 20))}`);
    }
  }

  if (openSections !== 0) {
    throw new Error("DTD: unterminated conditional section");
  }

  return {
    entities,
    external,
    elements,
    attlists,
    expand,
    expandKeepingDatatypes,
  };
};

const readEntity = (
  body: string,
  entities: Map<string, string>,
  external: Set<string>,
  expand: (text: string) => string,
): void => {
  const match = /^\s*(%\s+)?([A-Za-z_][\w.-]*)\s+([\s\S]*)$/.exec(body);
  if (match === null) {
    throw new Error(`DTD: malformed <!ENTITY${body}>`);
  }
  const [, parameter, name = "", rest = ""] = match;
  // General entities do not affect elements or attributes.
  if (parameter === undefined) {
    return;
  }
  // The first declaration of an entity is binding; later ones are ignored.
  if (entities.has(name) || external.has(name)) {
    return;
  }
  const value = rest.trim();
  if (value.startsWith("PUBLIC") || value.startsWith("SYSTEM")) {
    external.add(name);
    return;
  }
  const quote = value[0];
  const end = quote === undefined ? -1 : value.indexOf(quote, 1);
  if ((quote !== '"' && quote !== "'") || end === -1) {
    throw new Error(`DTD: malformed value of %${name};`);
  }
  // References in an entity value are expanded when it is declared, except
  // datatypes, which stay as references so attributes keep their type.
  entities.set(name, expand(value.slice(1, end)));
};

const skipWhitespace = (text: string, position: number): number => {
  while (/\s/.test(text[position] ?? "")) {
    position++;
  }
  return position;
};

/**
 * Returns the position after the `]]>` that closes an ignored section,
 * counting the conditional sections nested in it.
 */
const skipIgnoredSection = (text: string, position: number): number => {
  let depth = 1;
  while (depth > 0) {
    const open = text.indexOf("<![", position);
    const close = text.indexOf("]]>", position);
    if (close === -1) {
      throw new Error("DTD: unterminated ignored section");
    }
    if (open !== -1 && open < close) {
      depth++;
      position = open + 3;
    } else {
      depth--;
      position = close + 3;
    }
  }
  return position;
};

/**
 * Returns the position of the `>` that ends the declaration starting at
 * `position`, skipping quoted literals.
 */
const declarationEnd = (text: string, position: number): number => {
  let quote: string | undefined;
  for (let i = position + 2; i < text.length; i++) {
    const char = text[i];
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return i;
    }
  }
  throw new Error(
    `DTD: unterminated declaration at offset ${String(position)}`,
  );
};

/**
 * Splits expanded declaration text into names, `(…)` groups and quoted
 * literals.
 */
const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  let position = 0;
  while ((position = skipWhitespace(text, position)) < text.length) {
    const char = text[position];
    let end: number;
    if (char === "(") {
      end = text.indexOf(")", position) + 1;
    } else if (char === '"' || char === "'") {
      end = text.indexOf(char, position + 1) + 1;
    } else {
      end = position;
      while (end < text.length && !/[\s("']/.test(text[end] ?? "")) {
        end++;
      }
    }
    if (end <= position) {
      throw new Error(`DTD: unterminated token in ${text.slice(position)}`);
    }
    tokens.push(text.slice(position, end));
    position = end;
  }
  return tokens;
};

/**
 * Reads attribute definitions from their tokens: a name, a type and a
 * default each.
 */
const attributeDefinitions = (
  tokens: string[],
): { name: string; type: string }[] => {
  const definitions: { name: string; type: string }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const name = tokens[i++];
    const type = tokens[i++];
    if (name === undefined || type === undefined) {
      throw new Error(`DTD: incomplete attribute definition ${String(name)}`);
    }
    if (type === "NOTATION") i++;
    if (tokens[i++] === "#FIXED") i++;
    if (i > tokens.length) {
      throw new Error(`DTD: attribute ${name} has no default`);
    }
    definitions.push({ name, type });
  }
  return definitions;
};
