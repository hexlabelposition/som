/**
 * Checks whether a code point is allowed in an XML 1.0 document (`Char`).
 */
export function isXmlChar(code: number): boolean {
  return (
    (code >= 0x20 && code <= 0xd7ff) ||
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

/**
 * Checks whether a code point is XML whitespace (`S`): space, tab, line feed
 * or carriage return.
 */
export function isXmlWhitespace(code: number): boolean {
  return code === 0x20 || code === 0xa || code === 0x9 || code === 0xd;
}

/**
 * Checks whether a code point can start an XML name (`NameStartChar`).
 */
export function isNameStartChar(code: number): boolean {
  if (code < 0x80) {
    return (
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x41 && code <= 0x5a) ||
      code === 0x5f ||
      code === 0x3a
    );
  }
  return (
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0x2ff) ||
    (code >= 0x370 && code <= 0x37d) ||
    (code >= 0x37f && code <= 0x1fff) ||
    (code >= 0x200c && code <= 0x200d) ||
    (code >= 0x2070 && code <= 0x218f) ||
    (code >= 0x2c00 && code <= 0x2fef) ||
    (code >= 0x3001 && code <= 0xd7ff) ||
    (code >= 0xf900 && code <= 0xfdcf) ||
    (code >= 0xfdf0 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0xeffff)
  );
}

/**
 * Checks whether a code point can appear in an XML name after the first
 * character (`NameChar`).
 */
export function isNameChar(code: number): boolean {
  if (code < 0x80) {
    return (
      isNameStartChar(code) ||
      (code >= 0x30 && code <= 0x39) ||
      code === 0x2d ||
      code === 0x2e
    );
  }
  return (
    isNameStartChar(code) ||
    code === 0xb7 ||
    (code >= 0x300 && code <= 0x36f) ||
    (code >= 0x203f && code <= 0x2040)
  );
}

/**
 * Returns the index right after the XML name that starts at `start`, or
 * `start` if no name starts there.
 */
export function scanName(text: string, start: number): number {
  let index = start;
  let code = text.codePointAt(index);
  if (code === undefined || !isNameStartChar(code)) return start;

  do {
    index += code > 0xffff ? 2 : 1;
    code = text.codePointAt(index);
  } while (code !== undefined && isNameChar(code));

  return index;
}
