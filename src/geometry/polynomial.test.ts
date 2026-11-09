import { describe, expect, test } from "vitest";
import { cubicRoots, quadraticRoots } from "./polynomial";

describe("quadraticRoots", () => {
  test.each<[number, number, number, number[]]>([
    [1, -1, 0.21, [0.3, 0.7]],
    [0, 2, -1, [0.5]],
    [0, 0, 1, []],
    [1, 0, 1, []],
    [1, -2, 0, []],
  ])("solves %d t² + %d t + %d", (a, b, c, expected) => {
    const found = quadraticRoots(a, b, c).sort((x, y) => x - y);
    expect(found).toHaveLength(expected.length);
    for (const [index, root] of expected.entries()) {
      expect(found[index]).toBeCloseTo(root, 12);
    }
  });
});

describe("cubicRoots", () => {
  test.each<[number, number, number, number, number[]]>([
    // (t - 0.2) (t - 0.5) (t - 0.9)
    [1, -1.6, 0.73, -0.09, [0.2, 0.5, 0.9]],
    // (t - 0.5)³: a triple root
    [1, -1.5, 0.75, -0.125, [0.5]],
    [0, 1, -1, 0.21, [0.3, 0.7]],
    [0, 0, 2, -1, [0.5]],
    [0, 0, 0, 1, []],
    [1, 0, 0, 1, []],
    // Roots at 0 and 1 are outside the open interval.
    [1, -1, 0, 0, []],
  ])("solves %d t³ + %d t² + %d t + %d", (a, b, c, d, expected) => {
    const found = cubicRoots(a, b, c, d);
    expect(found).toHaveLength(expected.length);
    for (const [index, root] of expected.entries()) {
      expect(found[index]).toBeCloseTo(root, 6);
    }
  });
});
