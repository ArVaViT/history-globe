/**
 * Every link and image of the documentation and the static place and tour pages
 * (apps/web/public/docs, apps/web/public/{ru,en}) leads to a file that is there, spelt with
 * the same case. Links out
 * of the site and to the app itself (`../../../?place=…`, served by the app's own
 * index.html) are not checked.
 *
 * Usage: node scripts/check-links.ts  (after `pnpm content`)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

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

const files = ["docs", "ru", "en"].flatMap((d) => pages(join(pub, d)));
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
  const html = readFileSync(file, "utf8");
  for (const [, link = ""] of html.matchAll(/(?:href|src)="([^"#?]+)/g)) {
    if (/^(?:[a-z]+:|\/\/)/.test(link) || link.includes("{{")) continue;
    const target = normalize(join(dirname(file), decodeURIComponent(link)));
    const rel = relative(pub, target);
    // The app's root and anything above it: served by the app, not a file here.
    if (rel === "" || rel.startsWith("..")) continue;
    checked++;
    const path =
      existsSync(target) && statSync(target).isDirectory() ? join(target, "index.html") : target;
    if (!existsSync(path) || !exact(path)) broken.push(`${relative(pub, file)} → ${link}`);
  }
}
if (broken.length) {
  console.error(`links: ${String(broken.length)} broken\n${broken.slice(0, 20).join("\n")}`);
  process.exit(1);
}
console.log(`links: ${String(checked)} in ${String(files.length)} pages, none broken`);
