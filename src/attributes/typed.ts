import type { SvgElement } from "../ast";
import { parseKeyword } from "./keyword";
import {
  parseAngle,
  parseLength,
  parseLengthList,
  type SvgAngle,
  type SvgLength,
} from "./length";
import {
  parseInteger,
  parseNumber,
  parseNumberList,
  parseNumberOrPercentage,
  parseNumberPair,
  type SvgNumberOrPercentage,
} from "./number";
import {
  parsePreserveAspectRatio,
  parseViewBox,
  type SvgPreserveAspectRatio,
  type SvgViewBox,
} from "./view-box";

// Element-level reads (ARCHITECTURE §6): each reads one attribute and parses
// it with the value-level function of the same name. A missing attribute and
// a value that does not parse both return undefined, so reading a document
// from any source never throws.

const read = <T>(
  element: SvgElement,
  name: string,
  parse: (text: string) => T | undefined,
): T | undefined => {
  const value = element.attributes[name];
  return value === undefined ? undefined : parse(value);
};

/**
 * Reads an attribute as a number, as {@link parseNumber} parses it.
 *
 * Returns `undefined` if the attribute is missing or is not a number. Any
 * attribute can be read, including unknown ones; the specs are not
 * consulted.
 *
 * @example
 * ```ts
 * // <path pathLength="100"/>
 * getNumber(path, "pathLength"); // 100
 * getNumber(path, "d"); // undefined
 * ```
 */
export function getNumber(
  element: SvgElement,
  name: string,
): number | undefined {
  return read(element, name, parseNumber);
}

/**
 * Reads an attribute as an integer, as {@link parseInteger} parses it.
 *
 * Returns `undefined` if the attribute is missing or is not an integer.
 *
 * @example
 * ```ts
 * // <feTurbulence numOctaves="3"/>
 * getInteger(turbulence, "numOctaves"); // 3
 * ```
 */
export function getInteger(
  element: SvgElement,
  name: string,
): number | undefined {
  return read(element, name, parseInteger);
}

/**
 * Reads an attribute as a list of numbers, as {@link parseNumberList} parses
 * it.
 *
 * Returns `undefined` if the attribute is missing or is not a list of
 * numbers.
 *
 * @example
 * ```ts
 * // <feFuncR tableValues="0 0.5 1"/>
 * getNumberList(func, "tableValues"); // [0, 0.5, 1]
 * ```
 */
export function getNumberList(
  element: SvgElement,
  name: string,
): number[] | undefined {
  return read(element, name, parseNumberList);
}

/**
 * Reads an attribute as one or two numbers, as {@link parseNumberPair}
 * parses it; one number is used for both.
 *
 * Returns `undefined` if the attribute is missing or is not one or two
 * numbers.
 *
 * @example
 * ```ts
 * // <feGaussianBlur stdDeviation="2"/>
 * getNumberPair(blur, "stdDeviation"); // [2, 2]
 * ```
 */
export function getNumberPair(
  element: SvgElement,
  name: string,
): [number, number] | undefined {
  return read(element, name, parseNumberPair);
}

/**
 * Reads an attribute as a number or a percentage, as
 * {@link parseNumberOrPercentage} parses it.
 *
 * Returns `undefined` if the attribute is missing or is neither.
 *
 * @example
 * ```ts
 * // <stop offset="50%"/>
 * getNumberOrPercentage(stop, "offset"); // { value: 50, unit: "%" }
 * ```
 */
export function getNumberOrPercentage(
  element: SvgElement,
  name: string,
): SvgNumberOrPercentage | undefined {
  return read(element, name, parseNumberOrPercentage);
}

/**
 * Reads an attribute as a length, as {@link parseLength} parses it.
 *
 * Returns `undefined` if the attribute is missing or is not a length. The
 * unit is kept, not converted.
 *
 * @example
 * ```ts
 * // <rect width="50%" height="10"/>
 * getLength(rect, "width"); // { value: 50, unit: "%" }
 * getLength(rect, "height"); // { value: 10, unit: "" }
 * ```
 */
export function getLength(
  element: SvgElement,
  name: string,
): SvgLength | undefined {
  return read(element, name, parseLength);
}

/**
 * Reads an attribute as a list of lengths, as {@link parseLengthList} parses
 * it.
 *
 * Returns `undefined` if the attribute is missing or is not a list of
 * lengths.
 *
 * @example
 * ```ts
 * // <text x="10 20"/>
 * getLengthList(text, "x"); // [{ value: 10, unit: "" }, { value: 20, unit: "" }]
 * ```
 */
export function getLengthList(
  element: SvgElement,
  name: string,
): SvgLength[] | undefined {
  return read(element, name, parseLengthList);
}

/**
 * Reads an attribute as an angle, as {@link parseAngle} parses it.
 *
 * Returns `undefined` if the attribute is missing or is not an angle, such
 * as `orient="auto"`.
 *
 * @example
 * ```ts
 * // <marker orient="45deg"/>
 * getAngle(marker, "orient"); // { value: 45, unit: "deg" }
 * ```
 */
export function getAngle(
  element: SvgElement,
  name: string,
): SvgAngle | undefined {
  return read(element, name, parseAngle);
}

/**
 * Reads the `viewBox` attribute of an element, as {@link parseViewBox}
 * parses it.
 *
 * Returns `undefined` if the attribute is missing or is not a valid view
 * box.
 *
 * @example
 * ```ts
 * // <svg viewBox="0 0 24 24"/>
 * getViewBox(svg); // { x: 0, y: 0, width: 24, height: 24 }
 * ```
 */
export function getViewBox(element: SvgElement): SvgViewBox | undefined {
  return read(element, "viewBox", parseViewBox);
}

/**
 * Reads the `preserveAspectRatio` attribute of an element, as
 * {@link parsePreserveAspectRatio} parses it.
 *
 * Returns `undefined` if the attribute is missing or is not valid; the
 * default that applies then is `xMidYMid meet`.
 *
 * @example
 * ```ts
 * // <svg preserveAspectRatio="xMinYMin slice"/>
 * getPreserveAspectRatio(svg);
 * // { defer: false, align: "xMinYMin", meetOrSlice: "slice" }
 * ```
 */
export function getPreserveAspectRatio(
  element: SvgElement,
): SvgPreserveAspectRatio | undefined {
  return read(element, "preserveAspectRatio", parsePreserveAspectRatio);
}

/**
 * Reads an attribute as one keyword of a fixed set, as {@link parseKeyword}
 * parses it.
 *
 * Returns `undefined` if the attribute is missing or is none of the
 * keywords.
 *
 * @example
 * ```ts
 * // <linearGradient gradientUnits="userSpaceOnUse"/>
 * getKeyword(gradient, "gradientUnits", ["userSpaceOnUse", "objectBoundingBox"]);
 * // "userSpaceOnUse"
 * ```
 */
export function getKeyword<const K extends string>(
  element: SvgElement,
  name: string,
  keywords: readonly K[],
): K | undefined {
  return read(element, name, (text) => parseKeyword(text, keywords));
}
