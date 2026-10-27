/**
 * The reason `parse()` rejected its input.
 *
 * Codes are stable: an existing code changes only in a major release, new
 * codes may appear in a minor one.
 *
 * - `MALFORMED_XML`: the input is not well-formed XML.
 * - `MISSING_ROOT`: the input has no root element.
 * - `UNDECLARED_PREFIX`: an element or attribute name uses a namespace prefix
 *   that is not declared with `xmlns:prefix`.
 * - `UNDEFINED_ENTITY`: an entity reference such as `&nbsp;` is neither
 *   predefined in XML nor declared in the doctype.
 * - `EXTERNAL_ENTITY`: an entity reference points to an external entity,
 *   which is never loaded.
 * - `UNSUPPORTED_ENTITY`: an entity contains markup, or the doctype uses
 *   parameter entities.
 */
export type SvgParseErrorCode =
  | "MALFORMED_XML"
  | "MISSING_ROOT"
  | "UNDECLARED_PREFIX"
  | "UNDEFINED_ENTITY"
  | "EXTERNAL_ENTITY"
  | "UNSUPPORTED_ENTITY";

/**
 * The error thrown by `parse()` for input it does not accept.
 *
 * Check `code` rather than `message`: codes are stable, message text may
 * change in any release.
 *
 * @example
 * ```ts
 * try {
 *   parse('<svg><circle r="8"></svg>');
 * } catch (error) {
 *   if (error instanceof SvgParseError) {
 *     error.code; // "MALFORMED_XML"
 *     error.line; // 1
 *     error.column; // 20
 *   }
 * }
 * ```
 */
export class SvgParseError extends Error {
  /**
   * Always `"SvgParseError"`.
   */
  override readonly name = "SvgParseError" as const;
  /**
   * The reason the input was rejected.
   */
  readonly code: SvgParseErrorCode;
  /**
   * The line of the problem, starting at 1. Line breaks are `\n`, `\r\n` and
   * `\r`.
   */
  readonly line: number;
  /**
   * The column of the problem, starting at 1 and counted in UTF-16 code units
   * like string indexes.
   */
  readonly column: number;
  /**
   * The index of the problem in the input string, starting at 0.
   */
  readonly offset: number;

  /**
   * Creates an error. The position is appended to the message.
   */
  constructor(
    code: SvgParseErrorCode,
    message: string,
    position: { line: number; column: number; offset: number },
  ) {
    super(
      `${message} (line ${String(position.line)}, column ${String(position.column)})`,
    );
    this.code = code;
    this.line = position.line;
    this.column = position.column;
    this.offset = position.offset;
  }
}

/**
 * Creates an `SvgParseError` for a problem at `offset` in `input`.
 */
export function createParseError(
  code: SvgParseErrorCode,
  message: string,
  input: string,
  offset: number,
): SvgParseError {
  let line = 1;
  let lineStart = 0;

  for (let index = 0; index < offset; index++) {
    const char = input.charCodeAt(index);
    if (char === 0xd && input.charCodeAt(index + 1) === 0xa) index++;
    if (char === 0xa || char === 0xd) {
      line++;
      lineStart = index + 1;
    }
  }

  return new SvgParseError(code, message, {
    line,
    column: Math.max(offset - lineStart, 0) + 1,
    offset,
  });
}
