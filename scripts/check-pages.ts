/**
 * What the built pages (scripts/build-pages.ts, apps/web/public/<lang>) and their style sheet
 * must hold beyond working links (check-links.ts):
 *
 * - every verse row of a place page has something under its reference: the verse, or the note
 *   that this translation numbers it otherwise with the link to it (an empty row had stood
 *   under 3,108 references, 965 of them in Romanian);
 * - a page's description is not its title again, and does not open with it ("Jacob: Jacob
 *   leaves…"): it is what a search shows under the title;
 * - pages.css uses the documentation's palette (content/docs/docs.css), its text colours are
 *   legible (WCAG AA, 4.5:1 on the paper and on a card), and every page, the 404 among them,
 *   gives the browser's bar the paper's colour.
 *
 * Usage: node scripts/check-pages.ts  (after `pnpm content`)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { LOCALES } from "../packages/model/src/locales.ts";

const root = join(import.meta.dirname, "..");
const pub = join(root, "apps/web/public");
const pages = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory()
          ? pages(join(dir, d.name))
          : d.name === "index.html"
            ? [join(dir, d.name)]
            : [],
      )
    : [];
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const errors: string[] = [];

// The palette: the tokens of a style sheet's :root, light and dark.
const tokens = (css: string, dark: boolean): Map<string, string> => {
  const block = dark
    ? /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)?.[1]
    : /(?:^|\n):root \{([^}]*)\}/.exec(css)?.[1];
  return new Map(
    [...(block ?? "").matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k = "", v = ""]) => [
      k,
      v.trim(),
    ]),
  );
};
/** WCAG's relative luminance of a #rrggbb colour. */
const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};
const pagesCss = readFileSync(join(pub, "pages.css"), "utf8");
const docsCss = readFileSync(join(root, "content/docs/docs.css"), "utf8");
/** The paper is the docs' background: --paper is --bg there, --paper-2 --bg-2. */
const inDocs = (k: string) => k.replace(/^--paper/, "--bg");
const paper: Record<"light" | "dark", string> = { light: "", dark: "" };
for (const dark of [false, true]) {
  const scheme = dark ? "dark" : "light";
  const own = tokens(pagesCss, dark);
  const docs = tokens(docsCss, dark);
  if (own.size === 0 || docs.size === 0) errors.push(`palette: no ${scheme} :root block found`);
  for (const [k, v] of own) {
    const d = docs.get(inDocs(k));
    if (d !== undefined && d !== v)
      errors.push(`palette: pages.css ${k} ${v} in the ${scheme} scheme, docs.css ${d}`);
  }
  paper[scheme] = own.get("--paper") ?? "";
  for (const text of ["--ink", "--ink-2", "--ink-soft", "--ink-faint", "--accent", "--accent-ink"])
    for (const ground of ["--paper", "--card"]) {
      const [t, g] = [own.get(text), own.get(ground)];
      if (!t || !g || !/^#[0-9a-f]{6}$/i.test(t) || !/^#[0-9a-f]{6}$/i.test(g)) continue;
      const c = contrast(t, g);
      if (c < 4.5)
        errors.push(`palette: ${text} on ${ground} is ${c.toFixed(2)}:1 in the ${scheme} scheme`);
    }
}

const files = [...LOCALES.flatMap((l) => pages(join(pub, l))), join(pub, "404.html")];
let rows = 0;
for (const file of files) {
  const html = readFileSync(file, "utf8");
  const at = relative(pub, file);
  for (const scheme of ["light", "dark"] as const) {
    const meta = new RegExp(
      `<meta name="theme-color" content="([^"]*)" media="\\(prefers-color-scheme: ${scheme}\\)"`,
    ).exec(html)?.[1];
    if (meta !== paper[scheme])
      errors.push(
        `${at}: theme-color ${meta ?? "missing"} for ${scheme}, the paper is ${paper[scheme]}`,
      );
  }
  if (file.endsWith("404.html")) continue;
  for (const [, dl = ""] of html.matchAll(/<dl class="verses">([\s\S]*?)<\/dl>/g))
    for (const [, ref = "", text = ""] of dl.matchAll(
      /<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g,
    )) {
      rows++;
      if (!text.replace(/<[^>]*>/g, "").trim()) errors.push(`${at}: the verse row ${ref} is empty`);
    }
  const title = unescape(/<title>([^<]*) \| History Globe<\/title>/.exec(html)?.[1] ?? "");
  const desc = unescape(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "");
  const h1 = unescape(/<h1>([^<]*)<\/h1>/.exec(html)?.[1] ?? "");
  if (!desc) errors.push(`${at}: no description`);
  else if (desc === title) errors.push(`${at}: the description is the title`);
  else if (h1 && desc.startsWith(`${h1}:`))
    errors.push(`${at}: the description opens with the title ("${desc.slice(0, 60)}…")`);
}

if (errors.length) {
  console.error(`pages: ${String(errors.length)} problems\n${errors.slice(0, 30).join("\n")}`);
  process.exit(1);
}
console.log(
  `pages: ${String(files.length)} pages, ${String(rows)} verse rows, descriptions and palette checked`,
);
