/**
 * The nodes of the 8-point Gauss-Legendre rule on [-1, 1], the positive half;
 * the rule is symmetric.
 */
const nodes = [
  0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];

/**
 * The weights of the nodes above, in the same order.
 */
const weights = [
  0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

/**
 * The deepest the interval is halved. 2^20 pieces of an interval are far
 * more than any smooth integrand needs; the limit only stops the recursion on
 * one that is not smooth, such as at a cusp.
 */
const maxDepth = 20;

/**
 * Integrates `f` over `[a, b]` with the 8-point Gauss-Legendre rule, which
 * is exact for polynomials up to degree 15.
 */
export function gaussLegendre(
  f: (t: number) => number,
  a: number,
  b: number,
): number {
  const half = (b - a) / 2;
  const middle = (a + b) / 2;
  let sum = 0;
  for (const [index, node] of nodes.entries()) {
    const offset = half * node;
    sum += (weights[index] ?? 0) * (f(middle - offset) + f(middle + offset));
  }
  return sum * half;
}

/**
 * Integrates `f` over `[a, b]` to within `tolerance`, halving an interval
 * until the rule over it agrees with the sum over its halves.
 */
function adaptive(
  f: (t: number) => number,
  a: number,
  b: number,
  whole: number,
  tolerance: number,
  depth: number,
): number {
  const middle = (a + b) / 2;
  const left = gaussLegendre(f, a, middle);
  const right = gaussLegendre(f, middle, b);
  if (depth >= maxDepth || Math.abs(left + right - whole) <= tolerance) {
    return left + right;
  }
  return (
    adaptive(f, a, middle, left, tolerance / 2, depth + 1) +
    adaptive(f, middle, b, right, tolerance / 2, depth + 1)
  );
}

/**
 * Integrates `f` over `[a, b]` to within an absolute `tolerance`, with the
 * Gauss-Legendre rule over intervals that are halved where `f` changes fast.
 *
 * @example
 * ```ts
 * integrate(Math.sin, 0, Math.PI, 1e-12); // 2
 * ```
 */
export const integrate = (
  f: (t: number) => number,
  a: number,
  b: number,
  tolerance: number,
): number => adaptive(f, a, b, gaussLegendre(f, a, b), tolerance, 0);
