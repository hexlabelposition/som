import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { parsePath } from "./parse";
import { stringifyPath } from "./stringify";
import type { SvgPathSegment } from "./types";

describe("stringifyPath", () => {
  test("writes one form", () => {
    expect(
      stringifyPath(
        parsePath(
          "M10,20l5-5 10 0h10 .5Z m1 1 C1,2,3,4,5,6s1 2 3 4q1 2 3 4t5 6a5 5 0 015 5v-1z",
        ) ?? [],
      ),
    ).toBe(
      "M10 20 l5 -5 l10 0 h10 h0.5 Z m1 1 C1 2 3 4 5 6 s1 2 3 4 q1 2 3 4 t5 6 a5 5 0 0 1 5 5 v-1 z",
    );
  });

  test("writes numbers in their shortest form", () => {
    expect(
      stringifyPath([
        { type: "M", x: 0.1, y: -0 },
        { type: "L", x: 1e-7, y: 1e21 },
        { type: "l", x: 0.1 + 0.2, y: 10e-4 },
      ]),
    ).toBe("M0.1 0 L1e-7 1e+21 l0.30000000000000004 0.001");
  });

  test("writes an empty path as an empty string", () => {
    expect(stringifyPath([])).toBe("");
  });

  test.each<[unknown[], string]>([
    [[{ type: "L", x: 0, y: 0 }], "no moveto first"],
    [[{ type: "Z" }], "no moveto first"],
    [[{ type: "M", x: Number.NaN, y: 0 }], "NaN"],
    [[{ type: "M", x: 0, y: Number.POSITIVE_INFINITY }], "infinity"],
    [[{ type: "M", x: 0 }], "missing number"],
    [[{ type: "M", x: "1", y: 0 }], "string"],
    [[{ type: "X", x: 0, y: 0 }], "unknown command"],
    [[{ type: "MM", x: 0, y: 0 }], "unknown command"],
    [
      [
        { type: "M", x: 0, y: 0 },
        {
          type: "A",
          rx: 1,
          ry: 1,
          rotation: 0,
          largeArc: 1,
          sweep: false,
          x: 0,
          y: 0,
        },
      ],
      "flag that is not a boolean",
    ],
  ])("throws for %j (%s)", (path) => {
    expect(() => stringifyPath(path as unknown as SvgPathSegment[])).toThrow(
      TypeError,
    );
  });
});

// Property-based round trips (ARCHITECTURE §13): any path reads back from
// stringifyPath unchanged, and any way of writing a path reads as that path.

/** Finite numbers without -0, which is written as 0. */
const number = fc
  .double({ noNaN: true, noDefaultInfinity: true })
  .map((value) => (value === 0 ? 0 : value));

const point = { x: number, y: number };
const control = { x1: number, y1: number };
const control2 = { x2: number, y2: number };

const relative = <T extends string>(upper: T, lower: string) =>
  fc.constantFrom(upper, lower) as fc.Arbitrary<T>;

const drawto: fc.Arbitrary<SvgPathSegment> = fc.oneof(
  fc.record({ type: relative("M", "m"), ...point }),
  fc.record({ type: relative("L", "l"), ...point }),
  fc.record({ type: relative("H", "h"), x: number }),
  fc.record({ type: relative("V", "v"), y: number }),
  fc.record({ type: relative("C", "c"), ...control, ...control2, ...point }),
  fc.record({ type: relative("S", "s"), ...control2, ...point }),
  fc.record({ type: relative("Q", "q"), ...control, ...point }),
  fc.record({ type: relative("T", "t"), ...point }),
  fc.record({
    type: relative("A", "a"),
    rx: number,
    ry: number,
    rotation: number,
    largeArc: fc.boolean(),
    sweep: fc.boolean(),
    ...point,
  }),
  fc.record({ type: relative("Z", "z") }),
);

const path: fc.Arbitrary<SvgPathSegment[]> = fc
  .tuple(
    fc.record({ type: relative("M", "m"), ...point }),
    fc.array(drawto, { maxLength: 20 }),
  )
  .map(([first, rest]) => [first, ...rest]);

/** The names of the arguments of each command, in order. */
const argumentNames: Record<string, string[]> = {
  m: ["x", "y"],
  l: ["x", "y"],
  h: ["x"],
  v: ["y"],
  c: ["x1", "y1", "x2", "y2", "x", "y"],
  s: ["x2", "y2", "x", "y"],
  q: ["x1", "y1", "x", "y"],
  t: ["x", "y"],
  a: ["rx", "ry", "rotation", "largeArc", "sweep", "x", "y"],
  z: [],
};

/** Picks one of the given items. */
type Pick = <T>(items: readonly T[]) => T;

/**
 * Writes a path in a random valid way: with or without repeated letters,
 * with any separators the grammar allows, and with numbers in other
 * spellings.
 */
function writeLoosely(segments: SvgPathSegment[], pick: Pick): string {
  let text = pick(["", " ", "\n\t"]);
  let previous: string | undefined;
  // Whether the last token written was an arc flag: a flag is one character,
  // so anything may follow it without a separator.
  let afterFlag = false;

  /** A separator before a token; none is needed before a sign. */
  const separator = (token: string, options: string[]): string =>
    afterFlag || token.startsWith("-") || token.startsWith("+")
      ? pick(["", ...options])
      : pick(options);

  for (const segment of segments) {
    const values = segment as unknown as Record<string, number | boolean>;
    const names = argumentNames[segment.type.toLowerCase()] ?? [];
    const tokens = names.map((name) => {
      const value = values[name] ?? Number.NaN;
      if (typeof value === "boolean") return value ? "1" : "0";
      return pick([String(value), value.toExponential()]);
    });

    // A repeated command may leave out its letter, and so may a lineto
    // after a moveto of the same case; a moveto may not, since sets after
    // it are linetos.
    const implicit =
      previous !== undefined &&
      tokens.length > 0 &&
      ((previous === segment.type &&
        segment.type !== "M" &&
        segment.type !== "m") ||
        (previous === "M" && segment.type === "L") ||
        (previous === "m" && segment.type === "l")) &&
      pick([true, false]);

    if (implicit) {
      text += separator(tokens[0] ?? "", [" ", ",", " , ", "\n"]);
    } else {
      text += pick(["", " "]) + segment.type + pick(["", " ", "\n"]);
    }
    for (const [index, token] of tokens.entries()) {
      if (index > 0) text += separator(token, [" ", ",", " ,\t"]);
      text += token;
      afterFlag = isFlagName(names[index]);
    }
    if (tokens.length === 0) afterFlag = false;
    previous = segment.type;
  }

  return text + pick(["", " ", "\n"]);
}

const isFlagName = (name: string | undefined): boolean =>
  name === "largeArc" || name === "sweep";

describe("round trips", () => {
  test("parsePath reads stringifyPath back unchanged", () => {
    fc.assert(
      fc.property(path, (segments) => {
        const text = stringifyPath(segments);
        expect(parsePath(text)).toEqual(segments);
        expect(stringifyPath(parsePath(text) ?? [])).toBe(text);
      }),
    );
  });

  test("parsePath reads any spelling of a path", () => {
    fc.assert(
      fc.property(path, fc.gen(), (segments, generate) => {
        const pick: Pick = (items) =>
          items[generate(fc.nat, items.length - 1)] as (typeof items)[number];
        expect(parsePath(writeLoosely(segments, pick))).toEqual(segments);
      }),
    );
  });
});
