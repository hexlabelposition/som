import { describe, expect, test } from "vitest";
import { splitImportant } from "./important";

describe("splitImportant", () => {
  test("splits the flag off the value", () => {
    expect(splitImportant("blue !important")).toEqual({
      value: "blue",
      important: true,
    });
    expect(splitImportant("url(#a) ! IMPORTANT  ")).toEqual({
      value: "url(#a)",
      important: true,
    });
    expect(splitImportant("blue!important")).toEqual({
      value: "blue",
      important: true,
    });
  });

  test("leaves other values as they are", () => {
    expect(splitImportant("blue")).toEqual({ value: "blue", important: false });
    expect(splitImportant("important")).toEqual({
      value: "important",
      important: false,
    });
    expect(splitImportant("blue important")).toEqual({
      value: "blue important",
      important: false,
    });
  });
});
