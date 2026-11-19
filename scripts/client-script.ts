/**
 * The static pages' and the documentation's own scripts, written as TypeScript in
 * scripts/client/ (checked and linted with the rest) and served as plain JavaScript: each
 * file's types are stripped (TypeScript's transpileModule), its imports and exports dropped,
 * and the files joined in one function that runs at once. A client file imports only files
 * with no imports of their own (packages/model/src/fold.ts), which are joined before it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..");

/** The script of `files` (paths from the repository root), the last one's `run()` started. */
export function clientScript(...files: string[]): string {
  const code = files.map((file) =>
    ts
      .transpileModule(readFileSync(join(root, file), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      })
      .outputText.replace(/^import [^;]*;\n/gm, "")
      .replace(/^export (?=function|const)/gm, "")
      .replace(/^export \{\};\n/gm, "")
      .trim(),
  );
  return `(() => {\n${code.join("\n\n")}\n\nrun();\n})();\n`;
}
