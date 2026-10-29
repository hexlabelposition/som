import { trimWhitespace } from "./number";

/**
 * Parses a keyword from a fixed set, such as the value of `gradientUnits` or
 * `fill-rule`, or returns `undefined` if the text is none of them.
 *
 * Keywords are compared case-sensitively, as SVG attributes define them
 * (`userSpaceOnUse`); SVG whitespace around the keyword is ignored. The
 * result has the type of the keywords passed in.
 *
 * @example
 * ```ts
 * parseKeyword("evenodd", ["nonzero", "evenodd"]); // "evenodd"
 * parseKeyword("EvenOdd", ["nonzero", "evenodd"]); // undefined
 * ```
 */
export function parseKeyword<const K extends string>(
  text: string,
  keywords: readonly K[],
): K | undefined {
  const value = trimWhitespace(text);
  return keywords.find((keyword) => keyword === value);
}
