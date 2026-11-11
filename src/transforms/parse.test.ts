import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { parseTransform } from "./parse";
import { stringifyTransform } from "./stringify";
import type { SvgTransformFunction } from "./types";

describe("parseTransform", () => {
  test("reads every function", () => {
    expect(
      parseTransform(
        "matrix(1 2 3 4 5 6) translate(7) translate(8 9) scale(10) scale(11 12) rotate(13) rotate(14 15 16) skewX(17) skewY(18)",
      ),
    ).toEqual([
      { type: "matrix", a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
      { type: "translate", x: 7 },
      { type: "translate", x: 8, y: 9 },
      { type: "scale", x: 10 },
      { type: "scale", x: 11, y: 12 },
      { type: "rotate", angle: 13 },
      { type: "rotate", angle: 14, cx: 15, cy: 16 },
      { type: "skewX", angle: 17 },
      { type: "skewY", angle: 18 },
    ]);
  });

  test("leaves optional arguments out when they are not written", () => {
    const [translate] = parseTransform("translate(10)") ?? [];
    expect(translate).toStrictEqual({ type: "translate", x: 10 });
  });

  test.each<[string, SvgTransformFunction[]]>([
    ["", []],
    [" \t\n\r\f", []],
    [
      "translate(10)scale(2)",
      [
        { type: "translate", x: 10 },
        { type: "scale", x: 2 },
      ],
    ],
    [
      "translate(10),scale(2)",
      [
        { type: "translate", x: 10 },
        { type: "scale", x: 2 },
      ],
    ],
    [
      "translate(10) ,\nscale(2)",
      [
        { type: "translate", x: 10 },
        { type: "scale", x: 2 },
      ],
    ],
    [" translate (10) ", [{ type: "translate", x: 10 }]],
    ["translate( 10 , 20 )", [{ type: "translate", x: 10, y: 20 }]],
    ["translate(10\t20)", [{ type: "translate", x: 10, y: 20 }]],
    ["translate(-10-20)", [{ type: "translate", x: -10, y: -20 }]],
    ["translate(1.5.5)", [{ type: "translate", x: 1.5, y: 0.5 }]],
    ["translate(+.5e1 1E-1)", [{ type: "translate", x: 5, y: 0.1 }]],
    ["rotate(45,5,5)", [{ type: "rotate", angle: 45, cx: 5, cy: 5 }]],
    [
      "matrix(1,0,0,-1,6,15)",
      [{ type: "matrix", a: 1, b: 0, c: 0, d: -1, e: 6, f: 15 }],
    ],
  ])("reads %j", (text, expected) => {
    expect(parseTransform(text)).toEqual(expected);
  });

  // What browsers ignore in the attribute is invalid; the browser test below
  // checks these against Chromium, Firefox and WebKit.
  test.each(invalid())("rejects %j", (text) => {
    expect(parseTransform(text)).toBeUndefined();
  });

  test("does not read names of Object.prototype", () => {
    expect(parseTransform("constructor(1)")).toBeUndefined();
    expect(parseTransform("__proto__(1)")).toBeUndefined();
  });
});

/**
 * Transform lists that are not valid in the `transform` attribute.
 */
function invalid(): string[] {
  return [
    // CSS syntax, which browsers apply only in the CSS property.
    "rotate(45deg)",
    "translate(10px, 5px)",
    "translate(1in)",
    "translate(50%)",
    "rotate(45, 5px, 5px)",
    "translateX(10)",
    "translateY(10)",
    "scaleX(2)",
    "scaleY(2)",
    "skew(10)",
    "rotateZ(45)",
    "none",
    "ROTATE(45)",
    "Translate(10)",
    // Argument counts.
    "translate()",
    "translate(10 20 30)",
    "rotate(45 5)",
    "matrix(1 0 0 1 7)",
    "matrix(1 0 0 1 7 0 0)",
    "skewX(10 20)",
    "scale(1 2 3 4 5 6 7 8)",
    // Separators.
    "translate(10,)",
    "translate(,10)",
    "translate(10,,20)",
    "translate(10),",
    ", translate(10)",
    "translate(10),,scale(2)",
    "translate(10) , , scale(2)",
    // Numbers and parentheses.
    "translate(5.)",
    "translate(1e999)",
    "translate(0x10)",
    "translate(10 20",
    "translate 10 20",
    "translate(10))",
    "translate(10) none",
    "translate(10) scale",
    "matrix",
  ];
}

// Random lists, written in any valid way, read back as the same list.

/**
 * Random transform functions with the given numbers.
 */
const functionOf = (
  number: fc.Arbitrary<number>,
): fc.Arbitrary<SvgTransformFunction> =>
  fc.oneof(
    fc.record({
      type: fc.constant("matrix" as const),
      a: number,
      b: number,
      c: number,
      d: number,
      e: number,
      f: number,
    }),
    fc.record(
      { type: fc.constant("translate" as const), x: number, y: number },
      { requiredKeys: ["type", "x"] },
    ),
    fc.record(
      { type: fc.constant("scale" as const), x: number, y: number },
      { requiredKeys: ["type", "x"] },
    ),
    fc.record({ type: fc.constant("rotate" as const), angle: number }),
    fc.record({
      type: fc.constant("rotate" as const),
      angle: number,
      cx: number,
      cy: number,
    }),
    fc.record({ type: fc.constant("skewX" as const), angle: number }),
    fc.record({ type: fc.constant("skewY" as const), angle: number }),
  );

const transformFunction = functionOf(
  fc.oneof(
    fc.integer({ min: -1000, max: 1000 }),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
  ),
);

/**
 * Functions with numbers that 32-bit floats keep finite, as browsers read
 * them.
 */
const browserFunction = functionOf(
  fc.integer({ min: -100_000, max: 100_000 }).map((value) => value / 100),
);

/**
 * Writes a list with random separators, spacing and number spellings.
 */
const anySpelling = (
  functions: readonly SvgTransformFunction[],
): fc.Arbitrary<string> => {
  const space = fc.constantFrom("", " ", "  ", "\n", "\t");
  const separator = fc.constantFrom(" ", ",", " , ", ",\n", "\t");
  const written = functions.map((fn) => {
    const values = stringifyTransform([fn]).slice(fn.type.length + 1, -1);
    const numbers = values.split(" ").map(Number);
    return fc
      .tuple(
        space,
        space,
        fc.array(separator, {
          minLength: numbers.length,
          maxLength: numbers.length,
        }),
        fc.array(fc.boolean(), {
          minLength: numbers.length,
          maxLength: numbers.length,
        }),
      )
      .map(([before, inside, separators, exponent]) => {
        const args = numbers
          .map((value, index) => {
            const text =
              exponent[index] === true && value !== 0
                ? value.toExponential()
                : String(value);
            return index === 0 ? text : `${separators[index] ?? " "}${text}`;
          })
          .join("");
        return `${fn.type}${before}(${inside}${args}${inside})`;
      });
  });
  const between = fc.constantFrom("", " ", ",", " , ", "\n");
  return fc
    .tuple(
      fc.tuple(...written),
      fc.array(between, {
        minLength: functions.length,
        maxLength: functions.length,
      }),
      space,
    )
    .map(([parts, separators, edge]) => {
      const text = parts
        .map((part, index) =>
          index === 0 ? part : `${separators[index] ?? " "}${part}`,
        )
        .join("");
      return `${edge}${text}${edge}`;
    });
};

describe("parseTransform with random lists", () => {
  test("reads any valid spelling of a list as that list", () => {
    const list = fc.array(transformFunction, { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(
        list.chain((functions) =>
          anySpelling(functions).map((text) => [functions, text] as const),
        ),
        ([functions, text]) => {
          expect(parseTransform(text)).toEqual(
            functions.map((fn) =>
              // -0 is written as 0.
              Object.fromEntries(
                Object.entries(fn).map(([key, value]) => [
                  key,
                  typeof value === "number" ? value + 0 : value,
                ]),
              ),
            ),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// Browsers ignore an invalid list as a whole and apply a valid one. The
// global is typed here, because the library and its tests have no DOM types.
interface TransformElement {
  setAttribute(name: string, value: string): void;
  transform: { baseVal: { numberOfItems: number } };
  remove(): void;
}
const { document } = globalThis as {
  document?: {
    createElementNS(namespace: string, name: string): TransformElement;
    body: { append(node: TransformElement): void };
  };
};

describe.skipIf(document === undefined)("parseTransform in a browser", () => {
  test("accepts what browsers apply and rejects what they ignore", () => {
    if (document === undefined) return;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const element = document.createElementNS(namespace, "rect");
    document.body.append(svg);
    (svg as unknown as { append(node: TransformElement): void }).append(
      element,
    );
    const items = (text: string): number => {
      element.setAttribute("transform", text);
      return element.transform.baseVal.numberOfItems;
    };
    try {
      for (const text of invalid()) {
        // Firefox reads several commas between functions, as the SVG 1.1
        // grammar does; Chromium and WebKit do not, and neither does som.
        if (/\)\s*,\s*,/.test(text)) continue;
        expect(items(text), text).toBe(0);
      }
      fc.assert(
        fc.property(
          fc
            .array(browserFunction, { minLength: 1, maxLength: 5 })
            .chain(anySpelling),
          (text) => {
            expect(items(text), text).toBe(parseTransform(text)?.length);
          },
        ),
        { numRuns: 300 },
      );
    } finally {
      svg.remove();
    }
  });
});
