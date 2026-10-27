export type {
  SvgCData,
  SvgChild,
  SvgComment,
  SvgDoctype,
  SvgDocument,
  SvgDocumentChild,
  SvgElement,
  SvgInstruction,
  SvgNode,
  SvgParent,
  SvgText,
  XmlDeclaration,
} from "./types";
export { clone } from "./clone";
export {
  isCData,
  isComment,
  isDoctype,
  isElement,
  isInstruction,
  isText,
} from "./guards";
export { getRoot } from "./root";
export { find, findAll, walk } from "./walk";
