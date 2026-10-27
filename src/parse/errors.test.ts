import { expect, test } from "vitest";
import { createParseError, SvgParseError } from "./errors";

test("is an Error with a name, code and position", () => {
  const error = createParseError("MALFORMED_XML", "Bad", "<svg>", 2);
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(SvgParseError);
  expect(error.name).toBe("SvgParseError");
  expect(error.message).toBe("Bad (line 1, column 3)");
  expect(error).toMatchObject({
    code: "MALFORMED_XML",
    line: 1,
    column: 3,
    offset: 2,
  });
});

test.each([
  ["a\nb", 2, 2, 1],
  ["a\r\nb", 3, 2, 1],
  ["a\rb", 2, 2, 1],
  ["a\n\nbc", 4, 3, 2],
  ["abc", 3, 1, 4],
])("finds the line and column in %j at %i", (input, offset, line, column) => {
  expect(createParseError("MALFORMED_XML", "", input, offset)).toMatchObject({
    line,
    column,
  });
});
