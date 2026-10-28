import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A benchmark input: one or more documents processed together in each
 * iteration.
 */
export interface Input {
  name: string;
  documents: string[];
}

const root = fileURLToPath(new URL("../../", import.meta.url));

const read = (path: string): string => readFileSync(join(root, path), "utf8");

const directory = (path: string): string[] =>
  readdirSync(join(root, path))
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .map((file) => read(join(path, file)));

/**
 * Names an input after its source, file count and total size.
 */
function input(source: string, documents: string[]): Input {
  const length = documents.reduce((sum, item) => sum + item.length, 0);
  const size = `${String(Math.round(length / 1024))} KB`;
  const files =
    documents.length === 1 ? "1 file" : `${String(documents.length)} files`;
  return { name: `${source} (${files}, ${size})`, documents };
}

/**
 * Inputs of different sizes, all from the pinned corpus (ARCHITECTURE §8) so
 * the numbers change only when the code changes.
 */
export const inputs: Input[] = [
  // Many small files: the typical icon workload.
  input("Bootstrap Icons", directory("node_modules/bootstrap-icons/icons")),
  // An editor export with metadata, gradients and namespaces.
  input("Inkscape export", [read("test/fixtures/inkscape/go-next-view.svg")]),
  // One large document.
  input("Bootstrap Icons sprite", [
    read("node_modules/bootstrap-icons/bootstrap-icons.svg"),
  ]),
];
