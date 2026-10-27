import { describe, expect, expectTypeOf, test } from "vitest";
import { isElement, isText } from "./guards";
import type {
  SvgChild,
  SvgDocument,
  SvgElement,
  SvgNode,
  SvgParent,
  SvgText,
} from "./types";
import { find, findAll, walk } from "./walk";

function element(name: string, children: SvgNode[] = []): SvgElement {
  return { type: "element", name, attributes: {}, children };
}

// <!--c--><svg><defs><path/></defs><g><circle/>t</g></svg>
function createDocument(): SvgDocument {
  return {
    type: "document",
    children: [
      { type: "comment", value: "c" },
      element("svg", [
        element("defs", [element("path")]),
        element("g", [element("circle"), { type: "text", value: "t" }]),
      ]),
    ],
  };
}

function label(node: SvgChild): string {
  return node.type === "element" ? node.name : node.type;
}

describe("walk", () => {
  test("visits descendants in document order", () => {
    const visited: string[] = [];
    walk(createDocument(), (node) => {
      visited.push(label(node));
    });
    expect(visited).toEqual([
      "comment",
      "svg",
      "defs",
      "path",
      "g",
      "circle",
      "text",
    ]);
  });

  test("passes the parent and the index", () => {
    const document = createDocument();
    const calls: [string, SvgParent, number][] = [];
    walk(document, (node, parent, index) => {
      calls.push([label(node), parent, index]);
    });

    const svg = document.children[1] as SvgElement;
    const g = svg.children[1] as SvgElement;
    expect(calls[0]).toEqual(["comment", document, 0]);
    expect(calls[1]).toEqual(["svg", document, 1]);
    expect(calls[4]?.[1]).toBe(svg);
    expect(calls[6]).toEqual(["text", g, 1]);
  });

  test("does not visit the starting node", () => {
    const svg = createDocument().children[1] as SvgElement;
    const visited: string[] = [];
    walk(svg, (node) => {
      visited.push(label(node));
    });
    expect(visited[0]).toBe("defs");
  });

  test("skips the children of a node", () => {
    const visited: string[] = [];
    walk(createDocument(), (node) => {
      visited.push(label(node));
      if (label(node) === "defs") return "skip";
    });
    expect(visited).not.toContain("path");
    expect(visited).toContain("g");
  });

  test("stops the walk", () => {
    const visited: string[] = [];
    walk(createDocument(), (node) => {
      visited.push(label(node));
      if (label(node) === "path") return "stop";
    });
    expect(visited).toEqual(["comment", "svg", "defs", "path"]);
  });

  test("walks children replaced by the callback", () => {
    const visited: string[] = [];
    walk(createDocument(), (node) => {
      visited.push(label(node));
      if (isElement(node) && node.name === "defs") {
        node.children = [element("linearGradient")];
      }
    });
    expect(visited).toContain("linearGradient");
    expect(visited).not.toContain("path");
  });
});

describe("find", () => {
  test("returns the first match in document order", () => {
    const document = createDocument();
    const svg = document.children[1] as SvgElement;
    expect(
      find(document, (node) => isElement(node) && node.name !== "svg"),
    ).toBe(svg.children[0]);
  });

  test("returns undefined without a match", () => {
    expect(find(createDocument(), () => false)).toBeUndefined();
  });

  test("narrows the result with a type guard", () => {
    expectTypeOf(find(createDocument(), isText)).toEqualTypeOf<
      SvgText | undefined
    >();
    expect(find(createDocument(), isText)?.value).toBe("t");
  });
});

describe("findAll", () => {
  test("returns every match in document order", () => {
    expect(findAll(createDocument(), isElement).map(label)).toEqual([
      "svg",
      "defs",
      "path",
      "g",
      "circle",
    ]);
  });

  test("returns an empty array without a match", () => {
    expect(findAll(createDocument(), () => false)).toEqual([]);
  });

  test("narrows the result with a type guard", () => {
    expectTypeOf(findAll(createDocument(), isElement)).toEqualTypeOf<
      SvgElement[]
    >();
  });
});
