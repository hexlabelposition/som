import { getRoot, isElement, parse, type SvgElement } from "../../src";
import { sortNames, type ElementData, type SpecNames } from "./model";

/**
 * Names the definitions files refer to but do not define, by kind. The svgwg
 * build tools skip them, and so does the generator. Any other unknown name
 * fails it, and so does a name here that is no longer referred to, so a
 * change in the files is noticed.
 */
const danglingReferences: Readonly<Record<string, readonly string[]>> = {
  category: [
    // Left over from SVG 1.1. In SVG 2, its oncopy, oncut and onpaste are in
    // the "global event" category.
    "document element event",
    // The SVG 1.1 group of `class` and `style`, which are "core" in SVG 2.
    "style",
  ],
  // Removed in SVG 2; still listed in definitions-filters.xml and
  // definitions-masking.xml.
  attribute: ["externalResourcesRequired"],
};

/**
 * One parsed definitions file.
 */
interface Definitions {
  elements: SvgElement[];
  /** Attribute categories by name. */
  categories: Map<string, SvgElement>;
  /** Top-level `<attribute>` entries without `elements`, by name. */
  common: Set<string>;
  /** Top-level `<attribute>` entries with `elements`. */
  forElements: { name: string; elements: Set<string> }[];
  /** Attributes whose presentation attribute has another name. */
  renamedProperties: Set<string>;
}

/**
 * Reads the elements and attributes of SVG 2 from the svgwg definitions files.
 * The first file is the main one; the others are module files.
 *
 * Elements are resolved the way the svgwg build tools resolve them: an element
 * takes the attributes of its attribute categories, the shared attributes it
 * names in `attributes`, the shared attributes that list it in `elements`, its
 * own `<attribute>` children and its geometry properties. A module file falls
 * back to the main file for categories and shared attributes it does not
 * define. Two rules differ from the build tools, which index one spec at a
 * time: shared attributes that list their elements apply across files, and
 * the presentation attributes always come from the main file, because SVG 2
 * defines them in one list and the copy in definitions-filters.xml is the
 * older SVG 1.1 one.
 */
export const readSvg2 = (
  texts: readonly string[],
): SpecNames & { interfaces: Map<string, string> } => {
  const files = texts.map(readDefinitions);
  const [main] = files;
  if (main === undefined) {
    throw new Error("svgwg: no definitions files");
  }

  const presentationCategory = main.categories.get("presentation");
  if (presentationCategory === undefined) {
    throw new Error("svgwg: no presentation category in the main file");
  }
  const presentationAttributes = sortNames(
    list(presentationCategory, "presentationattributes").filter(
      (name) => !main.renamedProperties.has(name),
    ),
  );

  const dangling = new Set<string>();
  const reference = (kind: string, name: string, element: string): void => {
    if (!danglingReferences[kind]?.includes(name)) {
      throw new Error(`svgwg: ${element} refers to unknown ${kind} ${name}`);
    }
    dangling.add(`${kind}:${name}`);
  };

  // Shared attributes that list their elements apply whichever file defines
  // the element: SVG Animations adds `timelinebegin` to `svg`.
  const forElements = files.flatMap((file) => file.forElements);

  const elements = new Map<string, ElementData>();
  const groups = new Map<string, string[]>();
  /** The DOM interface of each element, such as `SVGRectElement`. */
  const interfaces = new Map<string, string>();

  for (const file of files) {
    for (const node of file.elements) {
      const name = attribute(node, "name");
      if (elements.has(name)) {
        throw new Error(`svgwg: element ${name} is defined twice`);
      }

      const [domInterface] = list(node, "interfaces");
      if (domInterface === undefined) {
        throw new Error(`svgwg: element ${name} has no interface`);
      }
      interfaces.set(name, domInterface);

      const element: ElementData = {
        groups: [],
        attributes: [],
        presentation: [],
      };

      for (const category of list(node, "attributecategories")) {
        const definition =
          category === "presentation"
            ? presentationCategory
            : (file.categories.get(category) ?? main.categories.get(category));
        if (definition === undefined) {
          reference("category", category, name);
          continue;
        }
        element.groups.push(category);
        if (!groups.has(category)) {
          groups.set(
            category,
            category === "presentation"
              ? presentationAttributes
              : sortNames(
                  definition.children
                    .filter(isElement)
                    .filter((child) => child.name === "attribute")
                    .map((child) => attribute(child, "name")),
                ),
          );
        }
      }

      const forElement = new Set(
        forElements
          .filter((shared) => shared.elements.has(name))
          .map((shared) => shared.name),
      );
      element.attributes.push(...forElement);

      // Elements also name presentation attributes here, such as
      // `transform` on `clipPath`, and filter primitives name `in`, which
      // they already have from the shared attribute that lists them.
      for (const shared of list(node, "attributes")) {
        if (
          file.common.has(shared) ||
          main.common.has(shared) ||
          presentationAttributes.includes(shared)
        ) {
          element.attributes.push(shared);
        } else if (!forElement.has(shared)) {
          reference("attribute", shared, name);
        }
      }

      for (const child of node.children) {
        if (isElement(child) && child.name === "attribute") {
          element.attributes.push(attribute(child, "name"));
        }
      }

      element.presentation = list(node, "geometryproperties");
      element.attributes.push(...element.presentation);

      element.groups = sortNames(element.groups);
      element.attributes = sortNames(element.attributes);
      element.presentation = sortNames(element.presentation);
      elements.set(name, element);
    }
  }

  // An attribute that is also in one of the element's groups is listed once,
  // in the group.
  for (const element of elements.values()) {
    const inGroups = new Set(
      element.groups.flatMap((group) => groups.get(group) ?? []),
    );
    element.attributes = element.attributes.filter(
      (name) => !inGroups.has(name) || element.presentation.includes(name),
    );
  }

  for (const [kind, names] of Object.entries(danglingReferences)) {
    for (const name of names) {
      if (!dangling.has(`${kind}:${name}`)) {
        throw new Error(
          `svgwg: nothing refers to ${kind} ${name}; update danglingReferences`,
        );
      }
    }
  }

  return { elements, groups, presentationAttributes, interfaces };
};

const readDefinitions = (text: string): Definitions => {
  const root = getRoot(parse(text));
  if (root.name !== "definitions") {
    throw new Error("svgwg: root element is not <definitions>");
  }

  const definitions: Definitions = {
    elements: [],
    categories: new Map(),
    common: new Set(),
    forElements: [],
    renamedProperties: new Set(),
  };

  for (const node of root.children) {
    if (!isElement(node)) {
      continue;
    }
    if (node.name === "element") {
      definitions.elements.push(node);
    } else if (node.name === "attributecategory") {
      definitions.categories.set(attribute(node, "name"), node);
    } else if (node.name === "attribute") {
      const name = attribute(node, "name");
      if (node.attributes.elements === undefined) {
        definitions.common.add(name);
      } else {
        definitions.forElements.push({
          name,
          elements: new Set(list(node, "elements")),
        });
      }
      const property = node.attributes.presentationattribute;
      if (property !== undefined && property !== name) {
        definitions.renamedProperties.add(property);
      }
    }
  }

  return definitions;
};

const attribute = (node: SvgElement, name: string): string => {
  const value = node.attributes[name];
  if (value === undefined) {
    throw new Error(`svgwg: <${node.name}> without ${name}`);
  }
  return value;
};

/**
 * Splits a comma-separated list attribute such as `attributecategories`.
 */
const list = (node: SvgElement, name: string): string[] =>
  (node.attributes[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
