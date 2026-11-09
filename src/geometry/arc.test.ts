import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { arcPoint, insideArc, toCenterArc } from "./arc";

describe("toCenterArc", () => {
  test("finds the center of a half circle", () => {
    const arc = toCenterArc(0, 0, 5, 5, 0, false, true, 10, 0);
    expect(arc?.cx).toBeCloseTo(5);
    expect(arc?.cy).toBeCloseTo(0);
    expect(arc?.sweep).toBeCloseTo(Math.PI);
  });

  test("picks the center from the flags", () => {
    // Radius 5 between (0, 0) and (6, 0): the centers are (3, ±4).
    const small = toCenterArc(0, 0, 5, 5, 0, false, true, 6, 0);
    const large = toCenterArc(0, 0, 5, 5, 0, true, true, 6, 0);
    expect(small?.cy).toBeCloseTo(4);
    expect(large?.cy).toBeCloseTo(-4);
    expect(Math.abs(small?.sweep ?? 0)).toBeLessThan(Math.PI);
    expect(Math.abs(large?.sweep ?? 0)).toBeGreaterThan(Math.PI);
  });

  test("scales up radii that are too small", () => {
    const arc = toCenterArc(0, 0, 1, 2, 0, false, true, 10, 0);
    expect(arc?.rx).toBeCloseTo(5);
    expect(arc?.ry).toBeCloseTo(10);
  });

  test("uses negative radii as positive", () => {
    expect(toCenterArc(0, 0, -5, -5, 0, false, true, 10, 0)).toEqual(
      toCenterArc(0, 0, 5, 5, 0, false, true, 10, 0),
    );
  });

  test("returns undefined for a zero radius", () => {
    expect(toCenterArc(0, 0, 0, 5, 0, false, true, 10, 0)).toBeUndefined();
    expect(toCenterArc(0, 0, 5, 0, 0, false, true, 10, 0)).toBeUndefined();
  });

  test("starts and ends at the end points", () => {
    const coordinate = fc.integer({ min: -1000, max: 1000 });
    const radius = fc.double({ min: 0.1, max: 1000, noNaN: true });
    fc.assert(
      fc.property(
        coordinate,
        coordinate,
        radius,
        radius,
        fc.double({ min: -720, max: 720, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        coordinate,
        coordinate,
        (x1, y1, rx, ry, rotation, largeArc, sweep, x2, y2) => {
          fc.pre(x1 !== x2 || y1 !== y2);
          const arc = toCenterArc(
            x1,
            y1,
            rx,
            ry,
            rotation,
            largeArc,
            sweep,
            x2,
            y2,
          );
          if (arc === undefined) throw new Error("No arc");
          const tolerance = 1e-6 * Math.max(arc.rx, arc.ry);
          const [sx, sy] = arcPoint(arc, arc.start);
          const [ex, ey] = arcPoint(arc, arc.start + arc.sweep);
          expect(Math.abs(sx - x1)).toBeLessThan(tolerance);
          expect(Math.abs(sy - y1)).toBeLessThan(tolerance);
          expect(Math.abs(ex - x2)).toBeLessThan(tolerance);
          expect(Math.abs(ey - y2)).toBeLessThan(tolerance);
          expect(arc.sweep > 0).toBe(sweep);
          expect(Math.abs(arc.sweep) > Math.PI + 1e-9).toBe(
            largeArc && Math.abs(Math.abs(arc.sweep) - Math.PI) > 1e-9,
          );
        },
      ),
    );
  });
});

describe("insideArc", () => {
  const arc = toCenterArc(10, 0, 10, 10, 0, false, true, -10, 0);
  if (arc === undefined) throw new Error("No arc");

  test("follows the direction of the arc", () => {
    // From angle 0 to π through π/2, in the positive direction.
    expect(insideArc(arc, Math.PI / 2)).toBe(true);
    expect(insideArc(arc, -Math.PI / 2)).toBe(false);
    expect(insideArc(arc, (5 * Math.PI) / 2)).toBe(true);
  });

  test("leaves out the ends", () => {
    expect(insideArc(arc, 0)).toBe(false);
    expect(insideArc(arc, Math.PI)).toBe(false);
  });

  test("works for arcs in the negative direction", () => {
    const negative = toCenterArc(10, 0, 10, 10, 0, false, false, -10, 0);
    if (negative === undefined) throw new Error("No arc");
    expect(insideArc(negative, -Math.PI / 2)).toBe(true);
    expect(insideArc(negative, Math.PI / 2)).toBe(false);
  });
});
