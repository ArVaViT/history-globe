/**
 * The reviewer's packet (docs/reviews/README.md): the articles, answered questions and tours
 * a scholar has agreed to read, as one PDF to print or annotate — numbered paragraphs, the
 * sources under each article, a wide right margin for notes — titled "History Globe —
 * Articles for review — <scope> — version of <date> (<commit>)". Beside it, the list of
 * links to send with it and the `version` and `items` to paste into the review's file
 * (content/reviews/<id>.yaml) when it is published: the hash of each item's English text in
 * this version, which the build compares to tell "changed since".
 *
 * Read from content/ as committed at HEAD (the texts, not the built pages: no canary marks).
 * The PDF needs Playwright (as e2e/browser.mjs finds it: PLAYWRIGHT=<folder>); without it
 * the HTML is still written, to print from a browser.
 *
 *   node scripts/review-packet.ts --scope "Lycus valley" colossae laodicea q:some-question tour:paul-2
 *   [--out <folder>]  (default pipeline/out/review-packets/, outside git)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { ArticleFile, QuestionFile, TourFile } from "../packages/model/src/content.ts";
import { formatRef } from "../packages/model/src/scripture.ts";
import { loadAllLocaleData } from "../packages/model/src/locale-data.ts";
import { placeSlugs } from "../packages/model/src/slugs.ts";
import { itemHash } from "./content-hash.ts";
import { esc } from "./page-shell.ts";
import { reviewDate } from "./review-pages.ts";

await loadAllLocaleData();

const root = join(import.meta.dirname, "..");
const REPO = "https://github.com/ArVaViT/history-globe";
const SITE = "https://historyglobe.app";

// The arguments: the scope's name, the items (an article by its id, q:<id>, tour:<id>).
const args = process.argv.slice(2);
let scope = "";
let outDir = join(root, "pipeline/out/review-packets");
const wanted: { kind: "article" | "question" | "tour"; id: string }[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i] ?? "";
  if (a === "--scope") scope = args[++i] ?? "";
  else if (a === "--out") outDir = resolve(args[++i] ?? outDir);
  else if (a.startsWith("q:")) wanted.push({ kind: "question", id: a.slice(2) });
  else if (a.startsWith("tour:")) wanted.push({ kind: "tour", id: a.slice(5) });
  else wanted.push({ kind: "article", id: a });
}
if (!scope || wanted.length === 0) {
  console.error(
    'usage: node scripts/review-packet.ts --scope "<scope>" <article id> [q:<question id>] [tour:<tour id>] … [--out <folder>]',
  );
  process.exit(2);
}

const git = (...a: string[]) =>
  execFileSync("git", a, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
const commit = git("rev-parse", "--short=7", "HEAD");
const date = git("log", "-1", "--format=%cs", "HEAD");
// The packet is of a commit: a text changed and not committed would not be the version named.
const dirty = git(
  "status",
  "--porcelain",
  "--",
  "content/articles",
  "content/questions",
  "content/tours",
);
if (dirty) {
  console.error(
    "review-packet: the articles, questions or tours have uncommitted changes; commit them first, so the packet is of one version",
  );
  process.exit(1);
}

const load = (path: string): unknown => parse(readFileSync(join(root, path), "utf8"));
// The places' English names, for a tour's stops (the data build; ids where it is missing).
const placesFile = join(root, "apps/web/public/data/places.geojson");
const placeProps = existsSync(placesFile)
  ? (
      JSON.parse(readFileSync(placesFile, "utf8")) as {
        features: { properties: { id: string; name: string; dup?: boolean } }[];
      }
    ).features.map((f) => f.properties)
  : [];
const placeName = new Map(placeProps.map((p) => [p.id, p.name]));
/** An article's page is at its place's slug, as the pages build names it (build-pages.ts). */
const slugOf = placeSlugs(placeProps);

/** "¶3": each paragraph numbered, as the reviewer cites it ("Colossae ¶3"). */
const numbered = (ps: readonly string[]) =>
  ps
    .map((p, i) => `<p class="para"><span class="n">¶${String(i + 1)}</span>${esc(p)}</p>`)
    .join("\n");
const refs = (list: readonly string[]) => list.map((r) => esc(formatRef(r, "en"))).join("; ");

const sections: string[] = [];
const links: string[] = [];
const items: string[] = [];
for (const w of wanted) {
  if (w.kind === "article") {
    const path = `content/articles/${w.id}.yaml`;
    if (!existsSync(join(root, path))) throw new Error(`no article "${w.id}" (${path})`);
    const a = ArticleFile.parse(load(path));
    sections.push(`<section>
<p class="kind">Article</p>
<h2>${esc(a.title.en)}</h2>
${numbered(a.body.en)}
<p class="meta"><b>Scripture:</b> ${refs(a.scripture)}</p>
<div class="meta"><b>Sources:</b><ol>${a.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
<p class="meta">File: ${REPO}/blob/${commit}/${path}</p>
</section>`);
    links.push(
      `- ${a.title.en}: ${SITE}/en/place/${slugOf.get(a.place) ?? a.place}/ · ${REPO}/blob/${commit}/${path}`,
    );
    items.push(`  - { article: ${a.id}, hash: "${itemHash({ kind: "article", ...a })}" }`);
  } else if (w.kind === "question") {
    const path = `content/questions/${w.id}.yaml`;
    if (!existsSync(join(root, path))) throw new Error(`no question "${w.id}" (${path})`);
    const q = QuestionFile.parse(load(path));
    sections.push(`<section>
<p class="kind">Answered question</p>
<h2>${esc(q.question.en)}</h2>
${numbered(q.answer.en)}
<p class="meta"><b>Scripture:</b> ${refs(q.scripture)}</p>
<div class="meta"><b>Sources:</b><ol>${q.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
<p class="meta">File: ${REPO}/blob/${commit}/${path}</p>
</section>`);
    links.push(`- ${q.question.en}: ${SITE}/en/q/${q.id}/ · ${REPO}/blob/${commit}/${path}`);
    items.push(`  - { question: ${q.id}, hash: "${itemHash({ kind: "question", ...q })}" }`);
  } else {
    const path = `content/tours/${w.id}.yaml`;
    if (!existsSync(join(root, path))) throw new Error(`no tour "${w.id}" (${path})`);
    const t = TourFile.parse(load(path));
    sections.push(`<section>
<p class="kind">Tour</p>
<h2>${esc(t.title.en)}</h2>
${t.stops
  .map(
    (s, i) =>
      `<p class="para"><span class="n">¶${String(i + 1)}</span><b>${esc(placeName.get(s.place) ?? s.place)}</b> (${esc(formatRef(s.ref, "en"))}). ${esc(s.note.en)}</p>`,
  )
  .join("\n")}
<p class="meta">File: ${REPO}/blob/${commit}/${path}</p>
</section>`);
    links.push(`- ${t.title.en}: ${SITE}/en/tour/${t.id}/ · ${REPO}/blob/${commit}/${path}`);
    items.push(`  - { tour: ${t.id}, hash: "${itemHash({ kind: "tour", ...t })}" }`);
  }
}

const title = `History Globe — Articles for review — ${scope} — version of ${reviewDate(date, "en")} (${commit})`;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 62mm 20mm 18mm; }
  body { font: 10.5pt/1.55 Georgia, "Times New Roman", serif; color: #111; }
  h1 { font-size: 15pt; line-height: 1.3; margin: 0 0 4mm; }
  .lead { font-size: 9.5pt; color: #444; margin: 0 0 8mm; }
  section { break-before: page; }
  section:first-of-type { break-before: auto; }
  .kind { font: 8pt/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #666; margin: 0; }
  h2 { font-size: 13pt; margin: 1mm 0 4mm; }
  .para { position: relative; margin: 0 0 3.2mm; padding-left: 9mm; }
  .n { position: absolute; left: 0; width: 7mm; text-align: right; font: 8.5pt system-ui, sans-serif; color: #666; }
  .meta { font-size: 9pt; color: #333; margin: 2mm 0; }
  .meta ol { margin: 1mm 0 0; padding-left: 6mm; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="lead">${String(wanted.length)} item${wanted.length === 1 ? "" : "s"}, the English text as it stood in commit ${commit} of ${REPO} (${date}). Paragraphs are numbered for reference ("Colossae ¶3"); the right margin is left for notes. Brief, checklist and review policy: ${SITE}/docs/reviews.html.</p>
${sections.join("\n")}
</body>
</html>
`;

const slug = scope
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const dir = join(outDir, `${date}-${slug || "packet"}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "packet.html"), html);
writeFileSync(join(dir, "links.md"), `# ${title}\n\n${links.join("\n")}\n`);
writeFileSync(
  join(dir, "items.yaml"),
  `# For content/reviews/<id>.yaml when the review is published (docs/reviews/README.md).
version: { date: "${date}", commit: "${commit}" }
items:
${items.join("\n")}
`,
);
console.log(`review packet: ${dir}/packet.html, links.md, items.yaml`);

// The PDF, with page numbers, from the HTML (Playwright as the browser checks find it).
interface Browser {
  newPage(): Promise<{
    goto(url: string): Promise<unknown>;
    pdf(o: object): Promise<unknown>;
  }>;
  close(): Promise<void>;
}
const browserModule = pathToFileURL(join(root, "e2e/browser.mjs")).href;
const { launch } = (await import(browserModule)) as { launch: () => Promise<Browser> };
const browser = await launch();
try {
  const p = await browser.newPage();
  await p.goto(pathToFileURL(join(dir, "packet.html")).href);
  await p.pdf({
    path: join(dir, "packet.pdf"),
    format: "A4",
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font:7pt sans-serif;color:#666;padding:0 18mm">${esc(title)} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
  });
  console.log(`review packet: ${dir}/packet.pdf`);
} finally {
  await browser.close();
}
