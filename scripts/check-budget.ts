/**
 * JS budget (ADR 0010): everything needed before the first map frame, the entry chunk,
 * the renderer chunk it loads at once and MapLibre's own files under vendor/ (library,
 * worker and the module they share), at most 440 kB gzip (1 kB = 1000 bytes); raised from
 * 400 for the settings window and the timeline zoom, then from 420 to finish the feature
 * list before launch (ADR 0011).
 *
 * Usage: node scripts/check-budget.ts  (after `pnpm build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 440;
const dist = join(import.meta.dirname, "../apps/web/dist");
const js = readdirSync(dist, { recursive: true, encoding: "utf8" })
  .filter((f) => /^(assets|vendor)\//.test(f) && /\.m?js$/.test(f))
  .map((f) => join(dist, f));
if (!js.some((f) => relative(dist, f).startsWith("assets")))
  throw new Error("no built JS: run `pnpm build` first");
if (!js.some((f) => f.endsWith("maplibre-gl-worker.mjs")))
  throw new Error("MapLibre's worker is missing from the build (vite.config.ts)");

// Before the first frame: the entry chunk and every chunk it imports statically, the
// renderer chunk the app imports at once (useGlobe.ts) with its own static imports, and
// MapLibre's files. A chunk loaded later by `import()` (a panel opened on demand) is not
// on that path: it counts toward the total for everything, which has its own ceiling, and
// counts there once per reader, not once per language (ADR 0011, update of 11.10.2026).
const TOTAL_KB = 560;
const html = readFileSync(join(dist, "index.html"), "utf8");
const entry = [...html.matchAll(/<script[^>]+src="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1] ?? "");
if (entry.length === 0)
  throw new Error("no entry script in dist/index.html: the budget would count nothing");
const first = new Set<string>();
const visit = (rel: string) => {
  if (first.has(rel)) return;
  first.add(rel);
  const code = readFileSync(join(dist, rel), "utf8");
  // Static imports only: `import ... from "./x.js"` and `import "./x.js"`, not `import("./x.js")`.
  for (const m of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
    visit(`assets/${m[1] ?? ""}`);
  }
};
for (const e of entry) visit(e);
for (const f of js) {
  const rel = relative(dist, f);
  if (rel.startsWith("vendor/") || /^assets\/maplibre-renderer-/.test(rel)) visit(rel);
}

/**
 * The language a chunk belongs to, when all it holds is one language's words: its UI
 * dictionary (apps/web/src/i18n/<l>.json) or its model data (packages/model/src/locales/<l>.ts),
 * as the chunk's source map says. A reader fetches only the language shown.
 */
const languageOf = (file: string): string | undefined => {
  let sources: string[];
  try {
    sources = (JSON.parse(readFileSync(`${file}.map`, "utf8")) as { sources: string[] }).sources;
  } catch {
    return undefined;
  }
  const langs = new Set(
    sources.map((s) => /(?:\/i18n\/|\/locales\/)([a-z]{2})\.(?:json|ts)$/.exec(s)?.[1] ?? "-"),
  );
  const [lang] = langs;
  return langs.size === 1 && lang !== "-" ? lang : undefined;
};

let total = 0;
let shared = 0;
const perLanguage = new Map<string, number>();
for (const f of js) {
  const rel = relative(dist, f);
  const kb = gzipSync(readFileSync(f)).length / 1000;
  const lang = first.has(rel) ? undefined : languageOf(f);
  if (lang) perLanguage.set(lang, (perLanguage.get(lang) ?? 0) + kb);
  else shared += kb;
  const now = first.has(rel);
  if (now) total += kb;
  console.log(
    `${rel.padEnd(56)} ${kb.toFixed(1)} kB gzip${now ? "" : lang ? `  (on demand, ${lang})` : "  (on demand)"}`,
  );
}
// Everything a reader can fetch: the shared code and one language, the heaviest. Each
// language added is a file of its own that the readers of the others never fetch.
const [heaviest = "", heaviestKb = 0] = [...perLanguage].sort((a, b) => b[1] - a[1])[0] ?? [];
const all = shared + heaviestKb;
console.log(`total ${total.toFixed(1)} kB gzip, budget ${String(BUDGET_KB)} kB`);
console.log(
  `all JS ${all.toFixed(1)} kB gzip (one language: ${heaviest}, ${heaviestKb.toFixed(1)} kB; ${String(perLanguage.size)} languages), ceiling ${String(TOTAL_KB)} kB`,
);
if (total > BUDGET_KB) {
  console.error(`over the JS budget by ${(total - BUDGET_KB).toFixed(1)} kB (ADR 0010)`);
  process.exit(1);
}
if (all > TOTAL_KB) {
  console.error(`all JS over its ceiling by ${(all - TOTAL_KB).toFixed(1)} kB (ADR 0011)`);
  process.exit(1);
}
