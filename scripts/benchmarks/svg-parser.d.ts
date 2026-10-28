// svg-parser ships no types. Only the part the benchmarks use is declared.
declare module "svg-parser" {
  export function parse(source: string): unknown;
}
