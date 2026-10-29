/**
 * A number with a percent sign or none, as in `offset="50%"` or
 * `offset="0.5"`.
 */
export interface SvgNumberOrPercentage {
  /** The number as written, `50` for `50%`. */
  value: number;
  /** `"%"` for a percentage, `""` for a plain number. */
  unit: "" | "%";
}

/**
 * Whether a character is SVG whitespace: space, tab, line feed, form feed or
 * carriage return.
 */
export function isWhitespace(char: string | undefined): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\f" ||
    char === "\r"
  );
}

const isDigit = (char: string | undefined): boolean =>
  char !== undefined && char >= "0" && char <= "9";

const skipDigits = (text: string, position: number): number => {
  while (isDigit(text[position])) position++;
  return position;
};

/**
 * Returns the end of the number that starts at `position`, or -1 if none does.
 *
 * The grammar is CSS `<number>`, which SVG 2 attributes use: an optional sign,
 * digits with an optional fraction or a fraction alone (`.5`, not `5.`), and
 * an optional exponent. An `e` that no digits follow is not an exponent, so
 * `1em` is the number `1` followed by `em`.
 */
export function scanNumber(text: string, position: number): number {
  let i = position;
  if (text[i] === "+" || text[i] === "-") i++;
  const integerEnd = skipDigits(text, i);
  let end = integerEnd;
  if (text[end] === "." && isDigit(text[end + 1])) {
    end = skipDigits(text, end + 1);
  }
  if (end === i) return -1;

  if (text[end] === "e" || text[end] === "E") {
    let exponent = end + 1;
    if (text[exponent] === "+" || text[exponent] === "-") exponent++;
    if (isDigit(text[exponent])) end = skipDigits(text, exponent);
  }
  return end;
}

/**
 * Removes SVG whitespace around a value. SVG ignores it in attribute values.
 */
export function trimWhitespace(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isWhitespace(text[start])) start++;
  while (end > start && isWhitespace(text[end - 1])) end--;
  return text.slice(start, end);
}

/**
 * Converts the text of a scanned number, or returns `undefined` if it is too
 * large to be finite, such as `1e999`.
 */
export function toFinite(text: string): number | undefined {
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Parses a whole value with a parser for one item at a position, which
 * returns the item and its end, or `undefined` for no item.
 */
export function parseWhole<T>(
  text: string,
  item: (text: string, position: number) => [T, number] | undefined,
): T | undefined {
  const value = trimWhitespace(text);
  const result = item(value, 0);
  return result?.[1] === value.length ? result[0] : undefined;
}

/**
 * Parses a list of items separated by whitespace, a comma, or both, as SVG
 * lists are (`1 2`, `1,2`, `1 , 2`). A list must have at least one item and
 * may not start or end with a comma.
 */
export function parseList<T>(
  text: string,
  item: (text: string, position: number) => [T, number] | undefined,
): T[] | undefined {
  const value = trimWhitespace(text);
  const items: T[] = [];
  let position = 0;
  for (;;) {
    const result = item(value, position);
    if (result === undefined) return undefined;
    items.push(result[0]);
    position = result[1];
    if (position === value.length) return items;

    const separator = position;
    while (isWhitespace(value[position])) position++;
    if (value[position] === ",") {
      position++;
      while (isWhitespace(value[position])) position++;
    }
    if (position === separator) return undefined;
  }
}

/**
 * Reads a number at a position.
 */
export function readNumber(
  text: string,
  position: number,
): [number, number] | undefined {
  const end = scanNumber(text, position);
  if (end === -1) return undefined;
  const value = toFinite(text.slice(position, end));
  return value === undefined ? undefined : [value, end];
}

/**
 * Parses a number, such as the value of `stroke-miterlimit` or
 * `pathLength`, or returns `undefined` if the text is not one.
 *
 * The grammar is CSS `<number>`: `1`, `-0.5`, `.5`, `+2`, `1e3`. SVG
 * whitespace around the number is ignored. `5.`, `0x10`, `Infinity` and
 * numbers too large to be finite are not numbers.
 *
 * @example
 * ```ts
 * parseNumber(" 1.5 "); // 1.5
 * parseNumber("1e-3"); // 0.001
 * parseNumber("10px"); // undefined
 * ```
 */
export function parseNumber(text: string): number | undefined {
  return parseWhole(text, readNumber);
}

/**
 * Parses an integer, such as the value of `numOctaves`, or returns
 * `undefined` if the text is not one.
 *
 * An integer is an optional sign and digits: `3`, `-1`, `+2`. A fraction or
 * an exponent makes the text a number, not an integer, so `1.0` and `1e2`
 * return `undefined`. So does an integer beyond `Number.MAX_SAFE_INTEGER`,
 * which a number cannot hold exactly.
 *
 * @example
 * ```ts
 * parseInteger("4"); // 4
 * parseInteger("1.5"); // undefined
 * ```
 */
export function parseInteger(text: string): number | undefined {
  return parseWhole(text, (value, position) => {
    let end = position;
    if (value[end] === "+" || value[end] === "-") end++;
    const digits = end;
    end = skipDigits(value, end);
    if (end === digits) return undefined;
    const integer = Number(value.slice(position, end));
    return Number.isSafeInteger(integer) ? [integer, end] : undefined;
  });
}

/**
 * Parses a list of numbers, such as the value of `rotate` on `text` or
 * `tableValues`, or returns `undefined` if the text is not one.
 *
 * Numbers are separated by whitespace, a comma, or both. An empty value is
 * not a list.
 *
 * @example
 * ```ts
 * parseNumberList("1 2,3 , 4"); // [1, 2, 3, 4]
 * parseNumberList("1,,2"); // undefined
 * ```
 */
export function parseNumberList(text: string): number[] | undefined {
  return parseList(text, readNumber);
}

/**
 * Parses one or two numbers, as in `stdDeviation`, `baseFrequency` or
 * `radius`, or returns `undefined` if the text is not one or two numbers.
 *
 * The specs define one number as the same value for both, so the result is
 * always a pair: `"2"` is `[2, 2]`.
 *
 * @example
 * ```ts
 * parseNumberPair("2"); // [2, 2]
 * parseNumberPair("2, 3"); // [2, 3]
 * parseNumberPair("1 2 3"); // undefined
 * ```
 */
export function parseNumberPair(text: string): [number, number] | undefined {
  const numbers = parseNumberList(text);
  if (numbers === undefined) return undefined;
  const [x, y = x] = numbers;
  return numbers.length <= 2 && x !== undefined && y !== undefined
    ? [x, y]
    : undefined;
}

/**
 * Parses a number or a percentage, such as `offset` on `stop` or `opacity`,
 * or returns `undefined` if the text is neither.
 *
 * The percentage is kept as written, `50` with the unit `"%"`, so it can be
 * told apart from the number `50`.
 *
 * @example
 * ```ts
 * parseNumberOrPercentage("0.5"); // { value: 0.5, unit: "" }
 * parseNumberOrPercentage("50%"); // { value: 50, unit: "%" }
 * ```
 */
export function parseNumberOrPercentage(
  text: string,
): SvgNumberOrPercentage | undefined {
  return parseWhole(
    text,
    (value, position): [SvgNumberOrPercentage, number] | undefined => {
      const number = readNumber(value, position);
      if (number === undefined) return undefined;
      const [result, end] = number;
      return value[end] === "%"
        ? [{ value: result, unit: "%" }, end + 1]
        : [{ value: result, unit: "" }, end];
    },
  );
}
