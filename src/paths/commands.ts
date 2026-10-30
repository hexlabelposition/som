/**
 * The arguments of each command, by its lowercase letter, in the order they
 * are written. `largeArc` and `sweep` are flags; the others are numbers.
 */
export const commandArguments: ReadonlyMap<string, readonly string[]> = new Map(
  [
    ["m", ["x", "y"]],
    ["l", ["x", "y"]],
    ["h", ["x"]],
    ["v", ["y"]],
    ["c", ["x1", "y1", "x2", "y2", "x", "y"]],
    ["s", ["x2", "y2", "x", "y"]],
    ["q", ["x1", "y1", "x", "y"]],
    ["t", ["x", "y"]],
    ["a", ["rx", "ry", "rotation", "largeArc", "sweep", "x", "y"]],
    ["z", []],
  ],
);

/** Whether an argument is a flag, written as `0` or `1`. */
export const isFlag = (name: string): boolean =>
  name === "largeArc" || name === "sweep";

/**
 * Returns the arguments of a command letter, or `undefined` if it is not one.
 * Both cases are commands; other letters are not.
 */
export function argumentsOf(letter: string): readonly string[] | undefined {
  if (letter.length !== 1) return undefined;
  const lower = letter.toLowerCase();
  // Only ASCII letters have a different case; `toLowerCase` of any other
  // character never matches a key.
  return commandArguments.get(lower);
}
