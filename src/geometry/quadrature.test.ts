import { describe, expect, test } from "vitest";
import { gaussLegendre, integrate } from "./quadrature";

describe("gaussLegendre", () => {
  test("is exact for polynomials up to degree 15", () => {
    for (let degree = 0; degree <= 15; degree++) {
      // The integral of t^n over [0, 2] is 2^(n+1) / (n + 1).
      expect(
        gaussLegendre((t) => t ** degree, 0, 2),
        `t^${String(degree)}`,
      ).toBeCloseTo(2 ** (degree + 1) / (degree + 1), 9);
    }
  });

  test("is not exact for degree 16", () => {
    expect(
      Math.abs(gaussLegendre((t) => t ** 16, 0, 2) - 2 ** 17 / 17),
    ).toBeGreaterThan(1e-6);
  });

  test("works on reversed intervals", () => {
    expect(gaussLegendre((t) => t, 1, 0)).toBeCloseTo(-0.5, 12);
  });
});

describe("integrate", () => {
  test.each<[string, (t: number) => number, number, number, number]>([
    ["sin over [0, π]", Math.sin, 0, Math.PI, 2],
    ["exp over [0, 1]", Math.exp, 0, 1, Math.E - 1],
    ["sqrt over [0, 1]", Math.sqrt, 0, 1, 2 / 3],
    ["|t - 0.3| over [0, 1]", (t) => Math.abs(t - 0.3), 0, 1, 0.29],
    ["a quarter circle", (t) => Math.sqrt(1 - t * t), 0, 1, Math.PI / 4],
  ])("integrates %s", (_, f, a, b, expected) => {
    expect(Math.abs(integrate(f, a, b, 1e-12) - expected)).toBeLessThan(1e-9);
  });
});
