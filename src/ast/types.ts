/**
 * A parsed SVG document: the root element and everything around it.
 *
 * @example
 * ```ts
 * // <?xml version="1.0"?>
 * // <!-- logo -->
 * // <svg/>
 * const document: SvgDocument = {
 *   type: "document",
 *   declaration: { version: "1.0" },
 *   children: [
 *     { type: "text", value: "\n" },
 *     { type: "comment", value: " logo " },
 *     { type: "text", value: "\n" },
 *     { type: "element", name: "svg", attributes: {}, children: [] },
 *   ],
 * };
 * ```
 */
export interface SvgDocument {
  type: "document";
  /**
   * The `<?xml …?>` declaration at the start of the document.
   *
   * It is a field rather than a node, because it can only appear first.
   * Delete it to leave it out of the output.
   */
  declaration?: XmlDeclaration;
  /**
   * The top-level nodes in source order.
   *
   * Exactly one of them is an {@link SvgElement}, the root element. The others
   * are comments, processing instructions, the doctype and the whitespace
   * between them.
   */
  children: SvgDocumentChild[];
}

/**
 * An element, such as `<circle r="8"/>`.
 *
 * @example
 * ```ts
 * // <circle cx="12" cy="12" r="8"/>
 * const circle: SvgElement = {
 *   type: "element",
 *   name: "circle",
 *   attributes: { cx: "12", cy: "12", r: "8" },
 *   children: [],
 * };
 * ```
 */
export interface SvgElement {
  type: "element";
  /**
   * The qualified name as written in the source, prefix included.
   *
   * @example "svg", "linearGradient", "sodipodi:namedview"
   */
  name: string;
  /**
   * The attributes in source order, keyed by their qualified names.
   *
   * Values are strings with character and entity references decoded:
   * `title="a &amp; b"` becomes `{ title: "a & b" }`. Namespace declarations
   * such as `xmlns:xlink` are ordinary attributes.
   */
  attributes: Record<string, string>;
  /**
   * The child nodes in source order, including whitespace-only text.
   */
  children: SvgNode[];
}

/**
 * Character data, including whitespace between elements.
 *
 * @example
 * ```ts
 * // <text>Hello &amp; welcome</text>
 * const text: SvgText = { type: "text", value: "Hello & welcome" };
 * ```
 */
export interface SvgText {
  type: "text";
  /**
   * The text with character and entity references decoded.
   */
  value: string;
}

/**
 * A CDATA section, often used for scripts and styles.
 *
 * @example
 * ```ts
 * // <style><![CDATA[circle > rect { fill: red }]]></style>
 * const cdata: SvgCData = {
 *   type: "cdata",
 *   value: "circle > rect { fill: red }",
 * };
 * ```
 */
export interface SvgCData {
  type: "cdata";
  /**
   * The content between `<![CDATA[` and `]]>`, as written.
   */
  value: string;
}

/**
 * A comment.
 *
 * @example
 * ```ts
 * // <!-- Generator: Sketch -->
 * const comment: SvgComment = { type: "comment", value: " Generator: Sketch " };
 * ```
 */
export interface SvgComment {
  type: "comment";
  /**
   * The content between `<!--` and `-->`, including surrounding spaces.
   */
  value: string;
}

/**
 * A processing instruction.
 *
 * The XML declaration `<?xml …?>` is not one: it is stored in
 * {@link SvgDocument.declaration}.
 *
 * @example
 * ```ts
 * // <?xml-stylesheet href="style.css"?>
 * const instruction: SvgInstruction = {
 *   type: "instruction",
 *   target: "xml-stylesheet",
 *   value: 'href="style.css"',
 * };
 * ```
 */
export interface SvgInstruction {
  type: "instruction";
  /**
   * The name right after `<?`.
   */
  target: string;
  /**
   * Everything after the target and the whitespace that follows it, up to
   * `?>`.
   */
  value: string;
}

/**
 * A document type declaration. It can only appear at the top level.
 *
 * @example
 * ```ts
 * // <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
 * const doctype: SvgDoctype = {
 *   type: "doctype",
 *   value:
 *     'svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"',
 * };
 * ```
 */
export interface SvgDoctype {
  type: "doctype";
  /**
   * Everything between `<!DOCTYPE` and the closing `>`, as written, including
   * the internal subset in square brackets.
   */
  value: string;
}

/**
 * A node that can appear inside an element.
 *
 * Unlike {@link SvgDocumentChild}, it can be CDATA but never a doctype.
 */
export type SvgNode =
  SvgElement | SvgText | SvgCData | SvgComment | SvgInstruction;

/**
 * A node that can appear at the top level of a document.
 *
 * Unlike {@link SvgNode}, it can be a doctype but never CDATA.
 */
export type SvgDocumentChild =
  SvgElement | SvgText | SvgComment | SvgInstruction | SvgDoctype;

/**
 * A node that has children: the document or an element.
 *
 * Traversal helpers pass it to callbacks as the parent of the current node.
 */
export type SvgParent = SvgDocument | SvgElement;

/**
 * A node that can appear in any `children` array: {@link SvgNode} or
 * {@link SvgDocumentChild}.
 */
export type SvgChild = SvgNode | SvgDocumentChild;

/**
 * The fields of the XML declaration.
 *
 * @example
 * ```ts
 * // <?xml version="1.0" encoding="UTF-8" standalone="no"?>
 * const declaration: XmlDeclaration = {
 *   version: "1.0",
 *   encoding: "UTF-8",
 *   standalone: "no",
 * };
 * ```
 */
export interface XmlDeclaration {
  /**
   * The XML version, usually `"1.0"`.
   */
  version: string;
  /**
   * The declared encoding, as written. It is informational only: the input of
   * `parse()` is already a decoded string.
   */
  encoding?: string;
  /**
   * The declared standalone status.
   */
  standalone?: "yes" | "no";
}
