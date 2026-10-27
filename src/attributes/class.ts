import type { SvgElement } from "../ast";

/**
 * Checks whether the `class` attribute of an element contains a class.
 *
 * @example
 * ```ts
 * // <path class="icon  active"/>
 * hasClass(path, "active"); // true
 * hasClass(path, "icon active"); // false
 * ```
 */
export function hasClass(element: SvgElement, name: string): boolean {
  const value = element.attributes.class;
  return value !== undefined && splitClasses(value).includes(name);
}

/**
 * Adds a class to the end of the `class` attribute of an element, creating
 * the attribute if needed.
 *
 * As with DOM `classList`, the attribute is left as it is when it already
 * contains the class; otherwise it is written with single spaces and without
 * duplicates.
 *
 * @example
 * ```ts
 * // <path class="icon"/>
 * addClass(path, "active");
 * // <path class="icon active"/>
 * ```
 *
 * @throws {TypeError} If the name is empty or contains whitespace.
 */
export function addClass(element: SvgElement, name: string): void {
  checkClassName(name);
  const classes = splitClasses(element.attributes.class ?? "");
  if (classes.includes(name)) return;
  classes.push(name);
  element.attributes.class = joinClasses(classes);
}

/**
 * Removes a class from the `class` attribute of an element.
 *
 * As with DOM `classList`, the attribute is left as it is when it does not
 * contain the class; otherwise it is written with single spaces and without
 * duplicates. If no class is left, the `class` attribute is removed.
 *
 * @example
 * ```ts
 * // <path class="icon active"/>
 * removeClass(path, "active");
 * // <path class="icon"/>
 * removeClass(path, "icon");
 * // <path/>
 * ```
 *
 * @throws {TypeError} If the name is empty or contains whitespace.
 */
export function removeClass(element: SvgElement, name: string): void {
  checkClassName(name);
  const value = element.attributes.class;
  if (value === undefined) return;

  const classes = splitClasses(value);
  if (!classes.includes(name)) return;

  const rest = classes.filter((item) => item !== name);
  if (rest.length === 0) delete element.attributes.class;
  else element.attributes.class = joinClasses(rest);
}

/**
 * Removes a class if the element has it and adds it otherwise. Returns
 * whether the element has the class afterwards.
 *
 * @example
 * ```ts
 * // <path class="icon"/>
 * toggleClass(path, "active"); // true, class="icon active"
 * toggleClass(path, "active"); // false, class="icon"
 * ```
 *
 * @throws {TypeError} If the name is empty or contains whitespace.
 */
export function toggleClass(element: SvgElement, name: string): boolean {
  if (hasClass(element, name)) {
    removeClass(element, name);
    return false;
  }
  addClass(element, name);
  return true;
}

function splitClasses(value: string): string[] {
  return value.split(/[\t\n\f\r ]+/).filter((item) => item !== "");
}

function joinClasses(classes: string[]): string {
  return [...new Set(classes)].join(" ");
}

function checkClassName(name: string): void {
  if (name === "" || /[\t\n\f\r ]/.test(name)) {
    throw new TypeError(`Invalid class name ${JSON.stringify(name)}`);
  }
}
