/**
 * Returns the roots of `a t² + b t + c` in the open interval (0, 1), in a
 * form that stays accurate when `a` is close to zero.
 */
export function quadraticRoots(a: number, b: number, c: number): number[] {
  let found: number[];
  if (a === 0) {
    found = b === 0 ? [] : [-c / b];
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];
    const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)) / 2;
    found = q === 0 ? [0] : [q / a, c / q];
  }
  return found.filter((t) => t > 0 && t < 1);
}

/**
 * The number of halvings that narrow a root down to the precision of a
 * double in [0, 1].
 */
const bisections = 60;

/**
 * Returns the roots of `a t³ + b t² + c t + d` in the open interval (0, 1),
 * in increasing order.
 *
 * The turning points of the polynomial split [0, 1] into pieces on which it
 * only rises or only falls, so each piece holds at most one root, which is
 * found by bisection. This works for any coefficients, also when `a` or more
 * of them are zero, where the closed formulas lose precision.
 */
export function cubicRoots(
  a: number,
  b: number,
  c: number,
  d: number,
): number[] {
  const f = (t: number): number => ((a * t + b) * t + c) * t + d;
  // A double turning point is one bound, not an empty piece between two.
  const turns = [...new Set(quadraticRoots(3 * a, 2 * b, c))].sort(
    (x, y) => x - y,
  );
  const bounds = [0, ...turns, 1];
  const found: number[] = [];

  for (let index = 0; index + 1 < bounds.length; index++) {
    let low = bounds[index] ?? 0;
    let high = bounds[index + 1] ?? 1;
    let fLow = f(low);
    const fHigh = f(high);
    if (fLow === 0) {
      if (low > 0) found.push(low);
      continue;
    }
    // A root at the upper bound is found as the lower bound of the next piece.
    if (fHigh === 0 || fLow * fHigh > 0) continue;
    for (let step = 0; step < bisections; step++) {
      const middle = (low + high) / 2;
      const fMiddle = f(middle);
      if (fMiddle === 0) {
        low = high = middle;
        break;
      }
      if (fLow * fMiddle < 0) {
        high = middle;
      } else {
        low = middle;
        fLow = fMiddle;
      }
    }
    const root = (low + high) / 2;
    if (root > 0 && root < 1) found.push(root);
  }
  return found;
}
