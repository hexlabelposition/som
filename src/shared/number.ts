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

/** Returns the index after the ASCII digits that start at `position`. */
export const skipDigits = (text: string, position: number): number => {
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
 * Converts the text of a scanned number, or returns `undefined` if it is too
 * large to be finite, such as `1e999`.
 */
export function toFinite(text: string): number | undefined {
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}
