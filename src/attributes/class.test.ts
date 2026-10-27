import { describe, expect, test } from "vitest";
import type { SvgElement } from "../ast";
import { addClass, hasClass, removeClass, toggleClass } from "./class";

function path(value?: string): SvgElement {
  return {
    type: "element",
    name: "path",
    attributes: value === undefined ? {} : { class: value },
    children: [],
  };
}

describe("hasClass", () => {
  test("finds a class among whitespace-separated tokens", () => {
    const element = path(" icon\t\nactive  ");
    expect(hasClass(element, "icon")).toBe(true);
    expect(hasClass(element, "active")).toBe(true);
    expect(hasClass(element, "act")).toBe(false);
    expect(hasClass(element, "icon active")).toBe(false);
    expect(hasClass(element, "")).toBe(false);
  });

  test("returns false without the attribute", () => {
    expect(hasClass(path(), "icon")).toBe(false);
  });
});

describe("addClass", () => {
  test("appends a missing class", () => {
    const element = path("icon");
    addClass(element, "active");
    expect(element.attributes.class).toBe("icon active");
  });

  test("creates the attribute", () => {
    const element = path();
    addClass(element, "icon");
    expect(element.attributes.class).toBe("icon");
  });

  test("leaves the attribute as it is when the class is present", () => {
    const element = path(" a  b a ");
    addClass(element, "b");
    expect(element.attributes.class).toBe(" a  b a ");
  });

  test("normalizes spacing and duplicates when it changes the list", () => {
    const element = path(" a  b a ");
    addClass(element, "c");
    expect(element.attributes.class).toBe("a b c");
  });
});

describe("removeClass", () => {
  test("removes every occurrence of a class", () => {
    const element = path("a b a c");
    removeClass(element, "a");
    expect(element.attributes.class).toBe("b c");
  });

  test("removes the attribute when no class is left", () => {
    const element = path(" a a ");
    removeClass(element, "a");
    expect(element.attributes).toEqual({});
  });

  test("leaves the attribute as it is without the class", () => {
    const element = path(" a  a ");
    removeClass(element, "b");
    expect(element.attributes.class).toBe(" a  a ");
    removeClass(path(), "b");
  });
});

describe("toggleClass", () => {
  test("adds and removes a class and returns whether it is present", () => {
    const element = path("icon");
    expect(toggleClass(element, "active")).toBe(true);
    expect(element.attributes.class).toBe("icon active");
    expect(toggleClass(element, "active")).toBe(false);
    expect(element.attributes.class).toBe("icon");
  });
});

test.each([addClass, removeClass, toggleClass])(
  "%o rejects empty names and names with whitespace",
  (helper) => {
    expect(() => {
      helper(path("a"), "");
    }).toThrow(TypeError);
    expect(() => {
      helper(path("a"), "a b");
    }).toThrow(TypeError);
  },
);
