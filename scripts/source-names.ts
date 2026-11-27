// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

// Lists the ancient works that one language names in more than one way in its source lines
// (content/sources-<code>.yaml), so that a translator can settle each on one name. A work is
// the part of an English line before its first locator ("Josephus, Antiquities" in
// "Josephus, Antiquities 13.102"); its name in a language is the same part of the line there.
//
//   node scripts/source-names.ts [language …]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { LOCALES } from "../packages/model/src/locales.ts";

const root = join(import.meta.dirname, "..");
const head = (s: string) =>
  (/^(.*?)(?=\s\d|\ss\.v\.|\s\(|[;:]|$)/u.exec(s)?.[1] ?? "").replace(/,$/u, "").trim();
const wanted = process.argv.slice(2);
let found = 0;
for (const l of LOCALES) {
  if (l === "en" || (wanted.length > 0 && !wanted.includes(l))) continue;
  const table = parse(readFileSync(join(root, `content/sources-${l}.yaml`), "utf8")) as Record<
    string,
    string
  >;
  const names = new Map<string, Map<string, number>>();
  for (const [en, t] of Object.entries(table)) {
    const work = head(en);
    // Only "Author, Work" heads: a lone name or a modern title says nothing of one work.
    if (!work.includes(", ") || work.length > 60 || t === en) continue;
    const name = head(t);
    if (name === "" || name === work) continue;
    const seen = names.get(work) ?? new Map<string, number>();
    seen.set(name, (seen.get(name) ?? 0) + 1);
    names.set(work, seen);
  }
  for (const [work, seen] of names) {
    if (seen.size < 2) continue;
    found++;
    const list = [...seen].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${String(c)})`);
    console.log(`${l}\t${work}\t${list.join(" | ")}`);
  }
}
console.log(`${String(found)} works named in more than one way`);
