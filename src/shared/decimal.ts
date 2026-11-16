/**
 * The most decimal places `Number.prototype.toFixed` accepts.
 */
const maxFixedPlaces = 100;

/**
 * Returns the number of decimal places in the shortest form of a number, the
 * one `String(value)` writes: 2 for `0.25`, 7 for `1e-7` and 0 for an integer
 * or `1e+21`.
 */
export function decimalPlaces(value: number): number {
  if (Number.isInteger(value)) return 0;
  const text = String(value);
  const exponent = text.indexOf("e");
  const mantissa = exponent === -1 ? text : text.slice(0, exponent);
  const point = mantissa.indexOf(".");
  const fraction = point === -1 ? 0 : mantissa.length - point - 1;
  if (exponent === -1) return fraction;
  return Math.max(0, fraction - Number(text.slice(exponent + 1)));
}

/**
 * Rounds the result of adding or subtracting two numbers to the larger number
 * of decimal places of the two, which removes the binary noise of the double
 * result without rounding away data (ARCHITECTURE §13): the sum of two
 * decimals has no more places than they have, so `0.1 + 0.2` gives `0.3`, not
 * `0.30000000000000004`. A result with more places than `toFixed` takes is
 * returned as it is.
 */
function roundToOperands(result: number, a: number, b: number): number {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  if (places === 0 || places > maxFixedPlaces) return result;
  // `+ 0` turns `-0`, which `toFixed` gives for a tiny negative noise, into 0.
  return Number(result.toFixed(places)) + 0;
}

/**
 * Adds two numbers exactly as decimals, as their shortest forms are written:
 * `addExact(0.1, 0.2)` is `0.3`.
 */
export const addExact = (a: number, b: number): number =>
  roundToOperands(a + b, a, b);

/**
 * Reflects a control point coordinate across the current point, computing
 * `2 × current − control` exactly as decimals. Doubling a number adds no
 * decimal places, so the result has as many as the two operands.
 */
export const reflectExact = (current: number, control: number): number =>
  roundToOperands(2 * current - control, current, control);
