// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Every link and image of the site's own pages (apps/web/public: the documentation, the
 * static pages in each language, and the pages at the root, the embed and the licences)
 * leads to a file that is there, spelt with the same case, and a link to a part of a page
 * (`#review`) to an element of that page with the id. Links out of the site and to the app
 * itself (`../../../?place=…`, served by the app's own index.html) are not checked.
 *
 * Usage: node scripts/check-links.ts  (after `pnpm content`)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { withoutScriptText } from "./html-read.ts";

const pub = join(import.meta.dirname, "..", "apps/web/public");
const pages = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory()
          ? pages(join(dir, d.name))
          : d.name.endsWith(".html")
            ? [join(dir, d.name)]
            : [],
      )
    : [];

// Everything but the data release, which has no pages.
const files = readdirSync(pub)
  .filter((d) => d !== "data")
  .flatMap((d) =>
    statSync(join(pub, d)).isDirectory()
      ? pages(join(pub, d))
      : d.endsWith(".html")
        ? [join(pub, d)]
        : [],
  );
/** The ids a page carries, read once. */
const ids = new Map<string, Set<string>>();
const idsOf = (path: string) => {
  let found = ids.get(path);
  if (!found)
    ids.set(
      path,
      (found = new Set(
        [...readFileSync(path, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ""),
      )),
    );
  return found;
};
/** The file is there with this very spelling: the host is case-sensitive, a Mac is not. */
const listings = new Map<string, Set<string>>();
const exact = (path: string) => {
  const rel = relative(pub, path).split(/[\\/]/);
  let dir = pub;
  for (const part of rel) {
    let names = listings.get(dir);
    if (!names) listings.set(dir, (names = new Set(existsSync(dir) ? readdirSync(dir) : [])));
    if (!names.has(part)) return false;
    dir = join(dir, part);
  }
  return true;
};
let checked = 0;
const broken: string[] = [];
for (const file of files) {
  // A script builds its links from data (the index pages' search): not links of the page.
  const html = withoutScriptText(readFileSync(file, "utf8"));
  for (const [, link = "", fragment] of html.matchAll(
    /(?:href|src)="([^"#?]*)(?:\?[^"#]*)?(?:#([^"]*))?"/g,
  )) {
    if (/^(?:[a-z]+:|\/\/)/.test(link) || link.includes("{{")) continue;
    if (link === "") {
      // A link within the page.
      if (fragment) {
        checked++;
        if (!idsOf(file).has(decodeURIComponent(fragment)))
          broken.push(`${relative(pub, file)} → #${fragment}`);
      }
      continue;
    }
    const target = normalize(join(dirname(file), decodeURIComponent(link)));
    const rel = relative(pub, target);
    // The app's root and anything above it: served by the app, not a file here.
    if (rel === "" || rel.startsWith("..")) continue;
    checked++;
    const path =
      existsSync(target) && statSync(target).isDirectory() ? join(target, "index.html") : target;
    if (!existsSync(path) || !exact(path)) broken.push(`${relative(pub, file)} → ${link}`);
    else if (fragment && path.endsWith(".html") && !idsOf(path).has(decodeURIComponent(fragment)))
      broken.push(`${relative(pub, file)} → ${link}#${fragment}`);
  }
}
if (broken.length) {
  console.error(`links: ${String(broken.length)} broken\n${broken.slice(0, 20).join("\n")}`);
  process.exit(1);
}
console.log(`links: ${String(checked)} in ${String(files.length)} pages, none broken`);
