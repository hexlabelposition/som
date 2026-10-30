import { isXmlWhitespace, scanName, scanXmlChar } from "../shared";
import { createParseError, type SvgParseErrorCode } from "./errors";

/**
 * A cursor over the input with the low-level reading steps shared by all
 * parts of the parser.
 */
export class Scanner {
  readonly input: string;
  pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Throws an `SvgParseError` for a problem at `offset`, by default the
   * current position.
   */
  fail(
    code: SvgParseErrorCode,
    message: string,
    offset: number = this.pos,
  ): never {
    throw createParseError(code, message, this.input, offset);
  }

  /**
   * Returns the UTF-16 code unit at the current position, or `NaN` at the end.
   */
  peek(): number {
    return this.input.charCodeAt(this.pos);
  }

  startsWith(text: string): boolean {
    return this.input.startsWith(text, this.pos);
  }

  /**
   * Moves past `text` if the input continues with it.
   */
  eat(text: string): boolean {
    if (!this.startsWith(text)) return false;
    this.pos += text.length;
    return true;
  }

  expect(text: string): void {
    if (!this.eat(text)) {
      this.fail("MALFORMED_XML", `Expected '${text}'${this.found()}`);
    }
  }

  /**
   * Skips whitespace and returns whether there was any.
   */
  skipWhitespace(): boolean {
    const start = this.pos;
    while (isXmlWhitespace(this.peek())) this.pos++;
    return this.pos > start;
  }

  requireWhitespace(): void {
    if (!this.skipWhitespace()) {
      this.fail("MALFORMED_XML", `Expected whitespace${this.found()}`);
    }
  }

  readName(): string {
    const start = this.pos;
    const end = scanName(this.input, start);
    if (end === start) {
      this.fail("MALFORMED_XML", `Expected a name${this.found()}`);
    }
    this.pos = end;
    return this.input.slice(start, end);
  }

  /**
   * Reads a literal in single or double quotes without interpreting
   * references, and returns its content.
   */
  readQuoted(): string {
    const quote = this.peek();
    if (quote !== 0x22 && quote !== 0x27) {
      this.fail("MALFORMED_XML", `Expected a quoted value${this.found()}`);
    }
    const start = this.pos + 1;
    const end = this.input.indexOf(quote === 0x22 ? '"' : "'", start);
    if (end === -1) this.fail("MALFORMED_XML", "Unterminated quoted value");
    this.checkChars(start, end);
    this.pos = end + 1;
    return this.slice(start, end);
  }

  /**
   * Checks the character at `index`, which the caller did not accept on its
   * fast path, and returns the index after it.
   */
  checkChar(index: number): number {
    const next = scanXmlChar(this.input, index);
    if (next !== -1) return next;
    const char = this.input.charCodeAt(index);
    const hex = char.toString(16).toUpperCase().padStart(4, "0");
    return this.fail("MALFORMED_XML", `Invalid character U+${hex}`, index);
  }

  /**
   * Checks that every character in `[start, end)` is allowed in XML.
   */
  checkChars(start: number, end: number): void {
    let index = start;
    while (index < end) {
      const char = this.input.charCodeAt(index);
      index = char >= 0x20 && char < 0xd800 ? index + 1 : this.checkChar(index);
    }
  }

  /**
   * Returns the input in `[start, end)` with line breaks normalized to `\n`,
   * as XML requires.
   */
  slice(start: number, end: number): string {
    return normalizeLineBreaks(this.input.slice(start, end));
  }

  /**
   * Describes what is at the current position, for error messages.
   */
  found(): string {
    if (this.pos >= this.input.length) return ", found the end of input";
    const char = String.fromCodePoint(this.input.codePointAt(this.pos) ?? 0);
    return `, found ${JSON.stringify(char)}`;
  }
}

/**
 * Replaces `\r\n` and `\r` with `\n`.
 */
export function normalizeLineBreaks(text: string): string {
  return text.includes("\r") ? text.replace(/\r\n?/g, "\n") : text;
}
