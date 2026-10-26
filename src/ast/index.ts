export type {
  SvgCData,
  SvgComment,
  SvgDoctype,
  SvgDocument,
  SvgDocumentChild,
  SvgElement,
  SvgInstruction,
  SvgNode,
  SvgText,
  XmlDeclaration,
} from "./types";
export {
  isCData,
  isComment,
  isDoctype,
  isElement,
  isInstruction,
  isText,
} from "./guards";
export { getRoot } from "./root";
