// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// The IndexNow workflow checks out only some folders (.github/workflows/indexnow.yml) and
// runs scripts/indexnow.ts with Node alone, no install. A file the script imports from
// outside those folders is missing there, and the daily run fails while every local run
// passes. This walks the script's imports and holds each to the folders the workflow takes.

const root = join(import.meta.dirname, "..");

interface Step {
  uses?: string;
  with?: Record<string, unknown>;
}
interface Workflow {
  jobs: Record<string, { steps: Step[] }>;
}

/** The folders the workflow's checkout takes (cone mode: each with everything under it). */
function sparseFolders(): string[] {
  const wf = parse(readFileSync(join(root, ".github/workflows/indexnow.yml"), "utf8")) as Workflow;
  const checkout = Object.values(wf.jobs)
    .flatMap((j) => j.steps)
    .find((s) => s.uses?.startsWith("actions/checkout@"));
  const sparse = checkout?.with?.["sparse-checkout"];
  if (typeof sparse !== "string") return [];
  return sparse
    .split("\n")
    .map((l) => l.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** Every file the script loads, from the repository root, and every bare import it makes. */
function importGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const todo = [entry];
  while (todo.length > 0) {
    const file = todo.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const code = readFileSync(join(root, file), "utf8");
    for (const m of code.matchAll(/(?:\bfrom\s+|^\s*import\s+)["']([^"']+)["'];/gm)) {
      const spec = m[1] as string;
      if (spec.startsWith(".")) todo.push(relative(root, resolve(root, dirname(file), spec)));
      else bare.add(spec);
    }
  }
  return { files, bare };
}

describe("the IndexNow workflow", () => {
  const folders = sparseFolders();
  const { files, bare } = importGraph("scripts/indexnow.ts");

  it("checks out only some folders", () => {
    expect(folders.length).toBeGreaterThan(0);
  });

  it("has every file the script imports in those folders", () => {
    const outside = [...files].filter(
      (f) => f.includes("/") && !folders.some((d) => f.startsWith(`${d}/`)),
    );
    expect(outside).toEqual([]);
    for (const f of files) expect(existsSync(join(root, f)), f).toBe(true);
  });

  it("needs no installed package, only Node's own modules", () => {
    expect([...bare].filter((s) => !s.startsWith("node:"))).toEqual([]);
  });
});
