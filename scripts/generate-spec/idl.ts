import { parse, type IdlType } from "webidl2";

/**
 * The IDL attributes of each interface, with inherited ones and those of the
 * mixins it includes, by attribute name. The value is the IDL type name, such
 * as `SVGAnimatedLength`.
 */
export type IdlAttributes = (name: string) => Map<string, string>;

/**
 * Reads interfaces, partial interfaces, mixins and `includes` statements from
 * Web IDL files. Interfaces and mixins defined in other files are skipped:
 * SVG elements also include HTML mixins, whose attributes are not SVG
 * element attributes.
 */
export const readIdl = (texts: readonly string[]): IdlAttributes => {
  const definitions = texts.flatMap((text) => parse(text));

  const own = new Map<string, Map<string, string>>();
  const parents = new Map<string, string>();
  const mixins = new Map<string, string[]>();

  for (const definition of definitions) {
    if (definition.type === "includes") {
      const { target = "", includes = "" } = definition;
      mixins.set(target, [...(mixins.get(target) ?? []), includes]);
    } else if (
      definition.type === "interface" ||
      definition.type === "interface mixin"
    ) {
      if (definition.inheritance) {
        parents.set(definition.name, definition.inheritance);
      }
      const attributes = own.get(definition.name) ?? new Map<string, string>();
      for (const member of definition.members ?? []) {
        if (member.type === "attribute") {
          attributes.set(member.name, typeName(member.idlType));
        }
      }
      own.set(definition.name, attributes);
    }
  }

  const resolved = new Map<string, Map<string, string>>();
  const attributesOf = (name: string): Map<string, string> => {
    const cached = resolved.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const parent = parents.get(name);
    const attributes = new Map(
      parent === undefined ? [] : attributesOf(parent),
    );
    for (const mixin of mixins.get(name) ?? []) {
      for (const [key, type] of attributesOf(mixin)) {
        attributes.set(key, type);
      }
    }
    for (const [key, type] of own.get(name) ?? []) {
      attributes.set(key, type);
    }
    resolved.set(name, attributes);
    return attributes;
  };

  return (name) => {
    if (!own.has(name)) {
      throw new Error(`IDL: no interface ${name}`);
    }
    return attributesOf(name);
  };
};

/**
 * The name of a non-union IDL type; unions such as `(DOMString or Node)` are
 * not value types the generator maps, so they get an empty name.
 */
const typeName = (type: IdlType): string =>
  typeof type.idlType === "string" ? type.idlType : "";
