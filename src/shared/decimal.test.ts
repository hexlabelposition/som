import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { addExact, decimalPlaces, reflectExact } from "./decimal";

describe("decimalPlaces", () => {
  test.each<[number, number]>([
    [0, 0],
    [-0, 0],
    [12, 0],
    [0.25, 2],
    [-3.5, 1],
    [1e-7, 7],
    [1.5e-7, 8],
    [-2.25e-10, 12],
    [1e21, 0],
    [1.5e21, 0],
    [0.30000000000000004, 17],
  ])("%d has %d places", (value, places) => {
    expect(decimalPlaces(value)).toBe(places);
  });
});

describe("addExact", () => {
  test.each<[number, number, number]>([
    [0.1, 0.2, 0.3],
    [0.7, 0.1, 0.8],
    [1.1, 2.2, 3.3],
    [0.1, -0.3, -0.2],
    [10, 0.05, 10.05],
    [1e-7, 2e-7, 3e-7],
    [3, 4, 7],
    [0.1, -0.1, 0],
  ])("%d + %d = %d", (a, b, sum) => {
    expect(addExact(a, b)).toBe(sum);
  });

  test("never gives -0", () => {
    expect(Object.is(addExact(-0.1, 0.1), 0)).toBe(true);
  });

  test("keeps numbers with more places than toFixed takes", () => {
    expect(addExact(1e-200, 2e-200)).toBe(1e-200 + 2e-200);
  });

  test("keeps values that are not finite", () => {
    expect(addExact(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(addExact(0.5, Number.NaN)).toBeNaN();
  });
});

describe("reflectExact", () => {
  test.each<[number, number, number]>([
    [0.3, 0.1, 0.5],
    [1.1, 0.2, 2],
    [0, 0.7, -0.7],
    [5, 2, 8],
  ])("reflects %d across %d to %d", (current, control, reflected) => {
    expect(reflectExact(current, control)).toBe(reflected);
  });
});

// Against integer arithmetic (ARCHITECTURE §13): numbers with `places`
// decimals are integers divided by 10^places, so their exact sum is the
// integer sum divided the same way.

const integer = fc.integer({ min: -1e9, max: 1e9 });
const places = fc.integer({ min: 0, max: 6 });

describe("against integer arithmetic", () => {
  test("addExact gives the exact decimal sum", () => {
    fc.assert(
      fc.property(integer, integer, places, (a, b, k) => {
        const scale = 10 ** k;
        expect(addExact(a / scale, b / scale)).toBe((a + b) / scale + 0);
      }),
    );
  });

  test("reflectExact gives the exact decimal reflection", () => {
    fc.assert(
      fc.property(integer, integer, places, (current, control, k) => {
        const scale = 10 ** k;
        expect(reflectExact(current / scale, control / scale)).toBe(
          (2 * current - control) / scale + 0,
        );
      }),
    );
  });
});
