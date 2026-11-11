/**
 * The arguments of a transform function, in the order they are written, and
 * the numbers of arguments it can be written with.
 */
export interface FunctionArguments {
  /** Every argument name, the optional ones last. */
  names: readonly string[];
  /** The allowed numbers of arguments, such as 1 or 3 for `rotate`. */
  counts: readonly number[];
}

/**
 * The transform functions of SVG 1.1, by name. Names are case-sensitive, as
 * browsers read them in the `transform` attribute (ARCHITECTURE §15).
 */
const transformFunctions: ReadonlyMap<string, FunctionArguments> = new Map([
  ["matrix", { names: ["a", "b", "c", "d", "e", "f"], counts: [6] }],
  ["translate", { names: ["x", "y"], counts: [1, 2] }],
  ["scale", { names: ["x", "y"], counts: [1, 2] }],
  ["rotate", { names: ["angle", "cx", "cy"], counts: [1, 3] }],
  ["skewX", { names: ["angle"], counts: [1] }],
  ["skewY", { names: ["angle"], counts: [1] }],
]);

/**
 * Returns the arguments of a transform function, or `undefined` if the name
 * is not one.
 */
export const argumentsOf = (name: string): FunctionArguments | undefined =>
  transformFunctions.get(name);
