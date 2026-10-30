/**
 * Splits the `!important` flag off a CSS declaration value, as written in a
 * `style` attribute: `"blue !important"` is `blue`, important. The flag is
 * ASCII case-insensitive and may have whitespace after the `!`. A CSS comment
 * between `!` and `important` is not recognized.
 */
export function splitImportant(value: string): {
  value: string;
  important: boolean;
} {
  const text = value.trimEnd();
  const flag = "important";
  if (text.slice(-flag.length).toLowerCase() !== flag) {
    return { value, important: false };
  }
  let bang = text.length - flag.length - 1;
  while (bang >= 0 && isCssWhitespace(text.charAt(bang))) bang--;
  if (text.charAt(bang) !== "!") return { value, important: false };
  return { value: text.slice(0, bang).trimEnd(), important: true };
}

const isCssWhitespace = (char: string): boolean =>
  char === " " ||
  char === "\t" ||
  char === "\n" ||
  char === "\r" ||
  char === "\f";
