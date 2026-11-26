// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

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

/** A source file's licence header and the blank line after it. */
const SOURCE_HEADER =
  /^\/\/ SPDX-License-Identifier: [^\n]*\n\/\/ Additional terms under section 7: [^\n]*\n\n?/;

/** The script of `files` (paths from the repository root), the last one's `run()` started. */
export function clientScript(...files: string[]): string {
  const code = files.map((file) =>
    ts
      // The licence header (scripts/spdx-headers.ts) stays in the source: the page's own
      // notice names the licence, and the CSP's hashes count the script without it.
      .transpileModule(readFileSync(join(root, file), "utf8").replace(SOURCE_HEADER, ""), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      })
      .outputText.replace(/^import [^;]*;\n/gm, "")
      .replace(/^export (?=function|const)/gm, "")
      .replace(/^export \{\};\n/gm, "")
      .trim(),
  );
  return `(() => {\n${code.join("\n\n")}\n\nrun();\n})();\n`;
}
