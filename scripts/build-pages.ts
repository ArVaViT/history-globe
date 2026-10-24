/**
 * Writes a plain HTML page for every place with verses and for every tour, in Russian and
 * English (apps/web/public/{ru,en}/…), with an index of each, so search engines and link
 * previews find what the map holds: «где находился Вифсаида» lands on Bethsaida's page,
 * and its "Open on the map" button opens the globe there. The pages carry the place's
 * names, where it is today, its dates and events, its article, its verses (with their
 * text) and the tours through it. No app bundle: they load at once (the indexes carry a
 * few lines of script for their search, and work without it).
 *
 * With SITE_URL set (https://example.org, no trailing slash) the pages also get canonical
 * and hreflang links and Open Graph tags, and sitemap.xml is written; these need absolute
 * URLs, so without it they are left out.
 *
 * Usage: node scripts/build-pages.ts  (after build-content; verse texts are used when
 * build-verses has run)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentRelease, PlaceLife } from "../packages/model/src/content.ts";
import {
  BOOKS,
  canonicalPosition,
  formatRef,
  formatRefOr,
  NT_BOOKS,
} from "../packages/model/src/scripture.ts";
import { sourcesOf } from "../packages/model/src/citation.ts";
import {
  formatYear,
  type Locale,
  LOCALE_NAMES,
  LOCALES,
  type SiteLocale,
} from "../packages/model/src/time.ts";
import { bodyEnd, esc, headMeta } from "./page-shell.ts";
import { NOTICE_COMMENT } from "../packages/model/src/notice.ts";
import { commonsPage, DOC_PAGES, docsPath } from "../packages/model/src/site.ts";
import { LANDING, LISTS, T } from "./page-words.ts";
import { siteCertainty } from "../packages/model/src/sites.ts";
import { loadAllLocaleData } from "../packages/model/src/locale-data.ts";
import { placeSlugs } from "../packages/model/src/slugs.ts";
import { distanceKm, roundKm } from "../apps/web/src/distance.ts";
import { splitPlaces, textPlacesFrom, type TextPlaces } from "../apps/web/src/text-places-core.ts";

// Every language is written here, so every language's words are loaded first.
await loadAllLocaleData();

const root = join(import.meta.dirname, "..");

/** Whether a tour's stops read from both testaments (as ToursPanel.tsx groups them). */
const testamentOf = (stops: readonly { readonly ref: string }[]): "whole" | "ot" | "nt" => {
  const nt = stops.map((s) => NT_BOOKS.has(s.ref.split(".")[0] ?? ""));
  return nt.includes(true) && nt.includes(false) ? "whole" : nt.includes(true) ? "nt" : "ot";
};
const pub = join(root, "apps/web/public");
const data = join(pub, "data");
/** The articles and questions in every language, one file each (build-content.ts). */
const build = join(root, "apps/web/build");
const site = process.env.SITE_URL?.replace(/\/+$/, "") ?? "";

type Lang = SiteLocale;
const LANGS: readonly Lang[] = LOCALES;
/** The languages written in Cyrillic, which preload that font (build-docs.ts the same). */
const CYRILLIC: ReadonlySet<Locale> = new Set(["ru", "uk", "sr"]);

interface Props {
  id: string;
  name: string;
  kind: string;
  verses: number;
  where: string;
  where_tpl?: string;
  osis: string[];
  /** A second record of the same name on the same point (pipeline). */
  dup?: boolean;
  disputed: boolean;
  /** OpenBible's score of the shown identification, 0–1000. */
  confidence?: number;
}
interface Article {
  title: Record<Lang, string>;
  body: Record<Lang, string[]>;
  scripture: string[];
  sources: string[];
  sources_ru?: string[];
  status: string;
  reviewer?: string;
}

/**
 * Every text in the content ({ en, ru, … }) in each site language: a language not yet
 * translated there reads the English, so its pages are whole from the first day.
 */
function inEveryLanguage<T>(o: T): T {
  if (Array.isArray(o)) for (const x of o) inEveryLanguage(x);
  else if (o && typeof o === "object") {
    const rec = o as Record<string, unknown>;
    if ("en" in rec && "ru" in rec) {
      for (const l of LANGS) if (rec[l] === undefined) rec[l] = rec.en;
    } else for (const v of Object.values(rec)) inEveryLanguage(v);
  }
  return o;
}

const places = (
  JSON.parse(readFileSync(join(data, "places.geojson"), "utf8")) as {
    features: { geometry: { coordinates: [number, number] }; properties: Props }[];
  }
).features;
const content = inEveryLanguage(
  JSON.parse(readFileSync(join(data, "content.json"), "utf8")),
) as ContentRelease & {
  where_ru?: Record<string, string>;
};
/** What ancient authors say of places (content/ancient-authors.yaml, via build-content.ts). */
const ancientAuthors = (
  existsSync(join(data, "ancient-authors.json"))
    ? inEveryLanguage(JSON.parse(readFileSync(join(data, "ancient-authors.json"), "utf8")))
    : {}
) as Record<
  string,
  {
    author: Record<Lang, string>;
    work: Record<Lang, string>;
    passage: string;
    url: string;
    note: Record<Lang, string>;
  }[]
>;
/** Questions people ask (content/questions, checked by build-content.ts). */
const questions = (
  existsSync(join(build, "questions.json"))
    ? inEveryLanguage(JSON.parse(readFileSync(join(build, "questions.json"), "utf8")))
    : []
) as {
  id: string;
  question: Record<Lang, string>;
  answer: Record<Lang, string[]>;
  map?: { place?: string; year?: { year: number }; ref?: string };
  scripture: string[];
  sources: string[];
  sources_ru?: string[];
  status: "checked" | "reviewed";
  reviewer?: string;
}[];
const articles = existsSync(join(build, "articles.json"))
  ? (inEveryLanguage(JSON.parse(readFileSync(join(build, "articles.json"), "utf8"))) as Record<
      string,
      Article
    >)
  : {};
const ui = Object.fromEntries(
  LANGS.map((l) => [
    l,
    JSON.parse(readFileSync(join(root, `apps/web/src/i18n/${l}.json`), "utf8")) as {
      kind: Record<string, string>;
      place: Record<string, string>;
    },
  ]),
) as Record<Lang, { kind: Record<string, string>; place: Record<string, string> }>;

/**
 * How sure the location is, worded as in the place card (`siteCertainty`): nothing when
 * generally agreed.
 */
function certaintyNote(p: Props, l: Lang): string {
  const t = ui[l].place;
  const c = siteCertainty(p);
  if (c === "disputed") return T[l].disputed;
  if (c === "agreed" || c === "unknown") return "";
  const text = c === "likely" ? t.likely_site : t.tentative_site;
  if (!text) throw new Error(`i18n ${l}: place.${c}_site is missing`);
  return text;
}

/** Text for the page, safe in HTML. */
/**
 * A text with its spaces single: a canary mark (scripts/canary.ts) is one space more in a
 * built text, which HTML folds in a paragraph but not in an attribute or in structured data,
 * and which would move the cut of a description by a character.
 */
const plain = (s: string) => s.replace(/ {2,}/g, " ");
/** A description cut at a word under `n` characters, with an ellipsis when cut. */
const clip = (text: string, n = 200) => {
  const s = plain(text);
  return s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,;:.\s]+$/, "")}…`;
};

/**
 * The place's records in the gazetteers, for `sameAs` in its structured data: Wikidata
 * (content/wikidata.json, OpenBible's links) and Pleiades (content/pleiades.json).
 */
const wikidata = (
  JSON.parse(readFileSync(join(root, "content/wikidata.json"), "utf8")) as {
    places: Record<string, string>;
  }
).places;
const sameAs = (id: string): string[] => [
  ...(wikidata[id] ? [`https://www.wikidata.org/wiki/${wikidata[id]}`] : []),
  ...(content.pleiades?.[id]
    ? [`https://pleiades.stoa.org/places/${content.pleiades[id].id}`]
    : []),
];
const nameOf = (p: Props, l: Lang) => (l === "en" ? p.name : (content.names[p.id]?.[l] ?? p.name));
/** "Where it is today" in the page's language, the English where it has none. */
const whereOf = (id: string, english: string, l: Lang) =>
  l === "en"
    ? english
    : l === "ru"
      ? content.where_ru?.[id]
      : (content.where_in?.[l]?.[id] ?? english);
const refOf = (osis: string, l: Lang) => formatRefOr(osis, l);

const verseTexts = new Map<string, Record<string, string>>();
function verseText(osis: string, l: Lang): string | undefined {
  const book = osis.split(".")[0] ?? "";
  const key = `${l}/${book}`;
  if (!verseTexts.has(key)) {
    const path = join(data, "verses", `${key}.json`);
    verseTexts.set(
      key,
      existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>) : {},
    );
  }
  return verseTexts.get(key)?.[osis];
}

const year = (y: { year: number; approximate: boolean }, l: Lang) =>
  `${y.approximate ? `${T[l].circa} ` : ""}${formatYear(y.year, l)}`;

function lifeLine(life: PlaceLife | undefined, l: Lang): string {
  if (!life) return "";
  const parts: string[] = [];
  if (life.from || life.until)
    parts.push(
      `${T[l].life}: ${life.from ? year(life.from, l) : "…"} – ${life.until ? year(life.until, l) : "…"}`,
    );
  if (life.gap) parts.push(`${T[l].ruins}: ${year(life.gap.from, l)} – ${year(life.gap.until, l)}`);
  const note = life.note[l] ?? life.note.en ?? "";
  return `<div class="callout"><p><b>${esc(parts.join(" · "))}</b></p>${note ? `<p>${esc(note)}</p>` : ""}</div>`;
}

/** Line icons (Lucide, ISC) for the front page, as the documentation draws them. */
const ICONS = {
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  langs:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  play: '<path d="M6 3.5v17l14-8.5z"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
} as const;
/** An icon as inline SVG; decorative, so hidden from screen readers. */
function icon(name: keyof typeof ICONS): string {
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** The open sets every page credits, with their licences (the rest: the sources page). */
const CREDITS = "OpenBible.info, Cliopatria, Itiner-e (CC BY 4.0), Pleiades (CC BY 3.0)";
/** The licence of the site's own texts, the articles and the answers (ADR 0016). */
const NC_ND = "https://creativecommons.org/licenses/by-nc-nd/4.0/";

/** The page shell: the same look as the docs pages, light and without a script. */
function page(o: {
  l: Lang;
  title: string;
  desc: string;
  /** From the site root, starting with the language: "ru/place/jerusalem/". */
  path: string;
  body: string;
  depth: number;
  ld?: object;
  /** The preview image, relative to the site root (the place's photo). */
  image?: string;
  /** The front page: the documentation's palette and one sans face, the way into the map in the bar. */
  home?: boolean;
  /** A thin page (a place with no article yet): open to readers, kept out of search. */
  noindex?: boolean;
  /** The page carries the site's own text under CC BY-NC-ND (ADR 0016): an article or an answer. */
  licence?: "article" | "answer";
}): string {
  const up = "../".repeat(o.depth);
  // The same page in every language: the path after the language.
  const rest = o.path.slice(o.l.length + 1);
  const paths = Object.fromEntries(LANGS.map((l) => [l, `${l}/${rest}`])) as Record<Lang, string>;
  const meta = headMeta({
    site,
    title: o.title,
    desc: o.desc,
    paths,
    l: o.l,
    image: o.image,
    ld: o.ld,
  });
  // The languages behind one icon, apart from the lists: a list that opens without script,
  // each language under its own name, the page's own marked.
  const langs = `<details class="langs"><summary class="lang" title="${T[o.l].language}" aria-label="${T[o.l].language}">${icon("langs")}</summary><ul>${LANGS.map(
    (l) =>
      `<li><a href="${up}${paths[l]}" hreflang="${l}" lang="${l}"${l === o.l ? ' aria-current="page"' : ""}>${LOCALE_NAMES[l]}</a></li>`,
  ).join("")}</ul></details>`;
  return `<!doctype html>
<html lang="${o.l}">
  <head>
    ${NOTICE_COMMENT}
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${o.home ? "#fcfbf8" : "#fbf8f2"}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${o.home ? "#0c1218" : "#0f141b"}" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${up}favicon.svg" type="image/svg+xml" />
    <title>${esc(o.title)} | History Globe</title>${o.noindex ? '\n    <meta name="robots" content="noindex, follow" />' : ""}${meta}${o.licence ? `\n    <link rel="license" href="${NC_ND}" />` : ""}${
      o.home
        ? `\n    <link rel="preload" href="${up}docs/fonts/golos-text-${CYRILLIC.has(o.l) ? "cyrillic" : "latin"}-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <script>
      // The entrance plays only for a reader who has not asked for less motion; without a
      // script the page is simply all there (pages.css, public/landing.js).
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        document.documentElement.classList.add("anim");
    </script>
    <script defer src="${up}landing.js"></script>`
        : ""
    }
    <link rel="stylesheet" href="${up}pages.css" />
  </head>
  <body${o.home ? ' class="home"' : ""}>
    <a class="skip" href="#main">${T[o.l].skip}</a>
    <header class="bar">
      <a class="brand" href="${up}${o.l}/"><img src="${up}favicon.svg" alt="" width="22" height="22" />History Globe</a>
      <nav aria-label="${T[o.l].sections}"><a href="${up}${o.l}/places/">${T[o.l].places}</a><a href="${up}${o.l}/tours/">${T[o.l].toursAll}</a><a href="${up}${o.l}/questions/">${T[o.l].questions}</a>${o.home ? `<a class="hide-s" href="${up}${docsPath(o.l)}">${LANDING[o.l].docs}</a>` : ""}</nav>
      <div class="bar-end">${langs}<a class="open" href="${up}?locale=${o.l}">${LANDING[o.l].open}${icon("out")}</a></div>
    </header>
${o.body}
    <footer class="foot"><nav aria-label="History Globe"><a href="${up}${o.l}/">History Globe</a><a href="${up}${docsPath(o.l)}">${T[o.l].about}</a><a href="${up}${docsPath(o.l, "privacy")}">${T[o.l].privacy}</a><a href="${up}${docsPath(o.l, "sources")}">${T[o.l].sources}</a></nav><p>${T[o.l].data}: ${CREDITS}</p>${o.licence ? `<p class="lic">${o.licence === "article" ? T[o.l].licArticle : T[o.l].licAnswer}, <a rel="license" href="${NC_ND}">CC BY-NC-ND 4.0</a></p>` : ""}</footer>
${bodyEnd(up)}
  </body>
</html>
`;
}

// The places-in-any-text script's released versions (hg-places-release.test.ts).
const HG_PLACES = JSON.parse(
  readFileSync(join(root, "scripts/hg-places-releases.json"), "utf8"),
) as {
  latest: string;
  versions: Record<string, string>;
};
const hasPhoto = (id: string) => existsSync(join(data, "photos", `${id}.jpg`));
// The tours' route pictures sit beside the data, in public/og/tour (tour-images.mjs).
const hasTourImage = (id: string) => existsSync(join(data, "..", "og", "tour", `${id}.jpg`));

/** The place's photo with its credit (content/photos.yaml), or nothing. */
function photoHtml(id: string, name: string, l: Lang): string {
  const ph = content.photos?.[id];
  // Only when the image is there: a build without `pnpm data` has no photos to show.
  if (!ph || !hasPhoto(id)) return "";
  const page = commonsPage(ph.file);
  const lic = ph.license === "Public domain" ? T[l].pd : ph.license;
  const shows = ph.shows && ((ph.shows as Partial<Record<Lang, string>>)[l] ?? ph.shows.en);
  return `<figure class="photo"><img src="../../../data/photos/${id}.jpg" alt="${esc(name)}" loading="lazy" /><figcaption class="note">${shows ? `${esc(T[l].photoShows(shows))}<br />` : ""}<a href="${esc(page)}">${T[l].photo}: ${ph.author ? `${esc(ph.author)}, ` : ""}${esc(lic)}, Wikimedia Commons</a></figcaption></figure>`;
}

const slugOf = placeSlugs(places.map((f) => f.properties));

// The places a verse names link to their own pages, as in the map's cards (the index of
// scripts/build-text-places.ts; without it the verses stay plain text).
const textPlaces = Object.fromEntries(
  LANGS.flatMap((l) => {
    const file = join(data, `text-places.${l}.json`);
    return existsSync(file)
      ? [
          [
            l,
            textPlacesFrom(
              JSON.parse(readFileSync(file, "utf8")) as {
                forms: Record<string, string>;
                names?: string[];
              },
            ),
          ],
        ]
      : [];
  }),
) as Partial<Record<Lang, TextPlaces>>;
/** Records on one point (Zion and Mount Zion): a verse on one page does not link the other. */
const onPoint = new Map<string, string[]>();
for (const { properties: p, geometry } of places) {
  const k = geometry.coordinates.map((x) => x.toFixed(4)).join(",");
  onPoint.set(k, [...(onPoint.get(k) ?? []), p.id]);
}
const samePoint = (f: (typeof places)[number]) =>
  onPoint.get(f.geometry.coordinates.map((x) => x.toFixed(4)).join(",")) ?? [f.properties.id];
const linkedVerse = (text: string, f: (typeof places)[number], l: Lang) => {
  const index = textPlaces[l];
  if (!index) return esc(text);
  // Nor a namesake: on the page of Babylon meaning Rome, "Babylon" is not Mesopotamia's.
  const named = places
    .filter((g) => nameOf(g.properties, l) === nameOf(f.properties, l))
    .map((g) => g.properties.id);
  return splitPlaces(text, index, [...samePoint(f), ...named])
    .map((seg) =>
      seg.place && byId.get(seg.place)?.properties.verses
        ? `<a href="../${slugOf.get(seg.place) ?? seg.place}/">${esc(seg.text)}</a>`
        : esc(seg.text),
    )
    .join("");
};
const byId = new Map(places.map((f) => [f.properties.id, f]));
const toursAt = new Map<string, string[]>();
for (const t of content.tours)
  for (const s of t.stops) {
    const list = toursAt.get(s.place) ?? [];
    if (!list.includes(t.id)) list.push(t.id);
    toursAt.set(s.place, list);
  }
const shown = places.filter((f) => f.properties.verses > 0);
const VERSES_ON_PAGE = 30;

// Files are rewritten only when they change, and stale ones removed at the end: a full
// rewrite of 2500 pages on every build kept Spotlight reindexing them (mds_stores).
const urls: string[] = [];
/** Pages kept out of the sitemap (thin ones, marked noindex) but still written and kept. */
const unlisted: string[] = [];
/**
 * When each file in content/ last changed: the date of the newest commit that touched it
 * (git, one pass). A page's <lastmod> in the sitemap is that of its own text: the article,
 * tour, question or documentation page it is written from. Outside a git checkout, or for
 * a page with no single source (the lists), there is no <lastmod>: a wrong one is worse.
 */
const changed = new Map<string, string>();
try {
  // A shallow clone knows only its last commits: every page would get the same date.
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (shallow !== "false") throw new Error("shallow clone");
  let date = "";
  for (const line of execFileSync(
    "git",
    ["log", "--format=%x00%cs", "--name-only", "--", "content"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).split("\n")) {
    if (line.startsWith("\0")) date = line.slice(1);
    else if (line && !changed.has(line)) changed.set(line, date);
  }
} catch {
  // Not a checkout (or no git): the sitemap goes without dates.
}
/** Sitemap path ("de/tour/exodus/") → the date its source last changed. */
const lastmod = new Map<string, string>();
const write = (path: string, html: string, listed = true, src?: string) => {
  const file = join(pub, path, "index.html");
  mkdirSync(join(pub, path), { recursive: true });
  if (!existsSync(file) || readFileSync(file, "utf8") !== html) writeFileSync(file, html);
  (listed ? urls : unlisted).push(`${path}/`);
  const date = src ? changed.get(src) : undefined;
  if (listed && date) lastmod.set(`${path}/`, date);
};

/** A page for every place with verses: its card as a page, with its article and photo. */
function placePages(l: Lang): void {
  // Namesakes (two Antiochs) get where they are today in the page's title, as in the index.
  const sameName = new Map<string, number>();
  for (const f of shown)
    if (!f.properties.dup)
      sameName.set(nameOf(f.properties, l), (sameName.get(nameOf(f.properties, l)) ?? 0) + 1);
  for (const f of shown) {
    const p = f.properties;
    const name = nameOf(p, l);
    const kind = ui[l].kind[p.kind] ?? p.kind;
    const where = whereOf(p.id, p.where, l);
    // The today line as the card has it; the title keeps the site's own name (namesakes).
    // Not when it only repeats the name (Philippi: «Где сегодня Филиппы»).
    const todayLine = l === "en" ? (content.where_en?.[p.id] ?? where) : where;
    const today = todayLine && todayLine !== name ? todayLine : "";
    // A duplicate record ("same place as Beersheba") says nothing of its own certainty:
    // its main record's page does.
    const note = p.dup ? "" : certaintyNote(p, l);
    const art = articles[p.id];
    // An event told again as a battle here (Samaria, 722 BC) is listed once, as the battle.
    const events = (content.events ?? []).filter(
      (e) =>
        e.place === p.id &&
        !(content.battles ?? []).some((b) => b.place === p.id && Math.abs(b.year - e.year) <= 1),
    );
    const battles = (content.battles ?? []).filter((b) => b.place === p.id);
    const asked = questions.filter((q) => q.map?.place === p.id);
    const writers = ancientAuthors[p.id] ?? [];
    const tours = (toursAt.get(p.id) ?? []).flatMap((id) => {
      const t = content.tours.find((x) => x.id === id);
      return t ? [t] : [];
    });
    const verses = p.osis.slice(0, VERSES_ON_PAGE);
    const slug = slugOf.get(p.id) ?? p.id;
    const path = `${l}/place/${slug}`;
    const [lon, lat] = f.geometry.coordinates;
    const desc = art?.body[l][0] ? clip(art.body[l][0]) : T[l].desc(name, kind, p.verses);
    const body = `    <main id="main" class="page">
      <p class="kicker">${esc(kind)}</p>
      <h1>${esc(name)}</h1>
      <ul class="facts">${today ? `<li><span>${T[l].today}</span> ${esc(today)}</li>` : ""}${l !== "en" && name !== p.name ? `<li><span>${T[l].english}</span> <span lang="en">${esc(p.name)}</span></li>` : ""}${note ? `<li class="warn">${esc(note)}</li>` : ""}</ul>
      <p class="actions"><a class="button" href="../../../?place=${p.id}&amp;locale=${l}">${T[l].open} →</a></p>
      ${photoHtml(p.id, name, l)}
      ${lifeLine(content.life?.[p.id], l)}${
        events.length
          ? `
      <h2>${T[l].events}</h2>
      <ol class="events">${events.map((e) => `<li><span class="when">${esc(year(e, l))}</span><span>${esc(e.title[l] ?? e.title.en ?? "")}</span></li>`).join("")}</ol>`
          : ""
      }${
        battles.length
          ? `
      <h2>${T[l].battles}</h2>
      <ol class="events">${battles.map((b) => `<li><span class="when">${esc(year(b, l))}</span><span>${esc(b.title[l] ?? b.title.en ?? "")}${b.ref ? ` <span class="ref">${esc(refOf(b.ref, l))}</span>` : ""}<br /><span class="note">${esc(b.sides[l] ?? b.sides.en ?? "")}. ${esc(b.outcome[l] ?? b.outcome.en ?? "")}.</span></span></li>`).join("")}</ol>`
          : ""
      }${
        writers.length
          ? `
      <h2>${T[l].ancient}</h2>
      <ul class="events">${writers.map((m) => `<li><span><a href="${esc(m.url)}" rel="noopener">${esc(m.author[l])}, <i>${esc(m.work[l])}</i> ${esc(m.passage.replace(/-/g, "–"))}</a> — ${esc(m.note[l])}</span></li>`).join("")}</ul>`
          : ""
      }${
        asked.length
          ? `
      <h2>${T[l].questions}</h2>
      <ul class="cards">${asked.map((q) => `<li><a href="../../q/${q.id}/">${esc(q.question[l])}</a></li>`).join("")}</ul>`
          : ""
      }${
        art
          ? `
      <h2>${T[l].article}</h2>
      ${art.body[l].map((para) => `<p>${esc(para)}</p>`).join("\n      ")}
      <p class="note">${T[l].scripture}: ${art.scripture.map((r) => esc(refOf(r, l))).join("; ")}</p>
      <details class="note"><summary>${T[l].sources}</summary><ul>${sourcesOf(art, l)
        .map((s) => `<li>${esc(s)}</li>`)
        .join("")}</ul></details>
      <p class="note">${art.status === "reviewed" && art.reviewer ? `${T[l].reviewed}: ${esc(art.reviewer)}` : T[l].checked}</p>`
          : ""
      }
      <h2>${T[l].verses(p.verses)}</h2>
      <dl class="verses">${verses
        .map((v) => {
          const text = verseText(v, l);
          return `<dt>${esc(refOf(v, l))}</dt><dd>${text ? linkedVerse(text, f, l) : ""}</dd>`;
        })
        .join("")}</dl>
      ${p.osis.length > VERSES_ON_PAGE ? `<p><a href="../../../?place=${p.id}&amp;locale=${l}">${T[l].more(p.osis.length - VERSES_ON_PAGE)}</a></p>` : ""}
      <p class="note">${T[l].translation}</p>${
        tours.length
          ? `
      <h2>${T[l].tours}</h2>
      <ul class="cards">${tours.map((t) => `<li><a href="../../tour/${t.id}/">${esc(t.title[l] ?? t.title.en)} <span aria-hidden="true">→</span></a></li>`).join("")}</ul>`
          : ""
      }
    </main>`;
    write(
      path,
      page({
        l,
        title: T[l].title(
          (sameName.get(name) ?? 0) > 1 && where && where !== name ? `${name} (${where})` : name,
        ),
        desc,
        path: `${path}/`,
        body,
        depth: 3,
        // A shared link's preview carries no credit line: only a photo that needs none.
        ...(content.photos?.[p.id] &&
        hasPhoto(p.id) &&
        ["Public domain", "CC0"].includes(content.photos[p.id]?.license ?? "")
          ? { image: `data/photos/${p.id}.jpg` }
          : {}),
        ld: {
          "@context": "https://schema.org",
          "@type": "Place",
          name,
          // Where it is today, as the page says it: not when that only repeats the name.
          ...(today ? { description: today } : {}),
          // Its names in the site's other languages, each tagged with its language.
          ...(() => {
            // English first, so a name several languages share is tagged as English.
            const other = [...LANGS.filter((o) => o === "en"), ...LANGS.filter((o) => o !== "en")]
              .filter((o) => o !== l)
              .map((o) => ({ "@value": nameOf(p, o), "@language": o }))
              .filter(
                (n, i, all) =>
                  n["@value"] !== name && all.findIndex((m) => m["@value"] === n["@value"]) === i,
              );
            return other.length ? { alternateName: other } : {};
          })(),
          geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lon },
          ...(sameAs(p.id).length ? { sameAs: sameAs(p.id) } : {}),
          // This page, and the globe opened on the place (structured data is written only
          // with SITE_URL, so both are absolute).
          url: `${site}/${path}/`,
          hasMap: `${site}/?place=${p.id}&locale=${l}`,
        },
        noindex: !art,
        ...(art ? { licence: "article" as const } : {}),
      }),
      !!art,
      content.articles?.[p.id] ? `content/articles/${content.articles[p.id]}.yaml` : undefined,
    );
  }
}

/** A page for every question people ask, with the view of the map that answers it. */
function questionPages(l: Lang): void {
  // Questions people ask (content/questions, via questions.json): a page each, for search,
  // with the view of the map that shows the answer; the places it names link to theirs.
  for (const q of questions) {
    const path = `${l}/q/${q.id}`;
    const title = q.question[l];
    const linked = (text: string) => {
      const index = textPlaces[l];
      if (!index) return esc(text);
      return splitPlaces(text, index)
        .map((seg) =>
          seg.place && byId.get(seg.place)?.properties.verses
            ? `<a href="../../place/${slugOf.get(seg.place) ?? seg.place}/">${esc(seg.text)}</a>`
            : esc(seg.text),
        )
        .join("");
    };
    const view = new URLSearchParams({
      ...(q.map?.place ? { place: q.map.place } : {}),
      ...(q.map?.year ? { year: String(q.map.year.year) } : {}),
      ...(q.map?.ref ? { ref: q.map.ref } : {}),
      locale: l,
    });
    const body = `    <main id="main" class="page">
      <p class="kicker">${T[l].question}</p>
      <h1>${esc(title)}</h1>
      ${q.answer[l].map((p) => `<p>${linked(p)}</p>`).join("\n      ")}
      <p class="actions"><a class="button" href="../../../?${esc(view.toString())}">${T[l].showMap} →</a></p>
      <p class="note">${T[l].scripture}: ${q.scripture.map((r) => esc(refOf(r, l))).join("; ")}</p>
      <details class="note"><summary>${T[l].sources}</summary><ul>${sourcesOf(q, l)
        .map((s) => `<li>${esc(s)}</li>`)
        .join("")}</ul></details>
      <p class="note">${q.status === "reviewed" && q.reviewer ? `${T[l].reviewed}: ${esc(q.reviewer)}` : T[l].checkedQ}</p>
    </main>`;
    write(
      path,
      page({
        l,
        title,
        desc: clip(q.answer[l][0] ?? title),
        path: `${path}/`,
        body,
        depth: 3,
        ld: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: title,
              acceptedAnswer: { "@type": "Answer", text: plain(q.answer[l].join(" ")) },
            },
          ],
        },
        licence: "answer",
      }),
      true,
      `content/questions/${q.id}.yaml`,
    );
  }
  if (questions.length > 0) questionsIndex(l);
}

/** A page for every tour, its stops and the way between them. */
function tourPages(l: Lang): void {
  // How far each stop is from the one before, as the tour's card says it: in a straight
  // line, and along the Roman roads where the tour went by them (build-road-legs.ts).
  const roadLegs = (
    existsSync(join(data, "road-legs.json"))
      ? JSON.parse(readFileSync(join(data, "road-legs.json"), "utf8"))
      : {}
  ) as Record<string, (number | null)[] | undefined>;
  const legOf = (t: (typeof content.tours)[number], i: number) => {
    const a = byId.get(t.stops[i - 1]?.place ?? "")?.geometry.coordinates;
    const b = byId.get(t.stops[i]?.place ?? "")?.geometry.coordinates;
    if (!a || !b) return "";
    const d = distanceKm(a, b);
    if (d < 2) return "";
    const num = (km: number) => new Intl.NumberFormat(l).format(roundKm(km));
    const stop = t.stops[i];
    // A leg sailed or untold, or a tour not travelled, has no way by road.
    const road = stop?.by || t.walked === false ? undefined : roadLegs[t.id]?.[i];
    const sea =
      stop?.by === "untold"
        ? T[l].untold
        : stop?.by === "sea"
          ? T[l].sea(
              stop.sailed?.days,
              stop.sailed && formatRef(stop.sailed.ref, l),
              stop.sailed?.about,
            )
          : "";
    return T[l].leg(num(d), road ? num(road) : null, sea);
  };
  for (const t of content.tours) {
    const title = t.title[l] ?? t.title.en;
    const path = `${l}/tour/${t.id}`;
    // The way drawn (tour-images.mjs): the picture a search shows and a link previews.
    const image = hasTourImage(t.id) ? `og/tour/${t.id}.jpg` : undefined;
    const body = `    <main id="main" class="page">
      <p class="kicker">${T[l].tour} · ${esc(year({ year: t.year, approximate: t.approximate === true }, l))}</p>
      <h1>${esc(title)}</h1>
      <p class="actions"><a class="button" href="../../../?tour=${t.id}&amp;locale=${l}">${T[l].tour_open} →</a></p>${
        image
          ? `
      <figure class="route-map"><img src="../../../${image}" alt="${esc(T[l].route_alt(title))}" width="1200" height="630" /></figure>`
          : ""
      }
      <ol class="stops">${t.stops
        .map((s, i) => {
          const f = byId.get(s.place);
          const n = f ? nameOf(f.properties, l) : s.place;
          const link =
            f && f.properties.verses > 0
              ? `<a href="../../place/${slugOf.get(s.place) ?? s.place}/">${esc(n)}</a>`
              : esc(n);
          const leg = legOf(t, i);
          return `<li><p class="stop"><b>${link}</b> <span class="ref">${esc(refOf(s.ref, l))}${leg ? ` · ${esc(leg)}` : ""}</span></p><p>${esc(s.note[l] ?? s.note.en)}</p><a class="more" href="../../../?tour=${t.id}&amp;stop=${String(i + 1)}&amp;locale=${l}">${T[l].open} →</a></li>`;
        })
        .join("\n        ")}</ol>
    </main>`;
    const first = t.stops[0]?.note[l] ?? "";
    write(
      path,
      page({
        l,
        // "Paul's first journey — map": what people search for, and what the page is.
        title: `${title} — ${T[l].tour_map}`,
        desc: clip(`${title}: ${first}`),
        path: `${path}/`,
        body,
        depth: 3,
        ...(image ? { image } : {}),
      }),
      true,
      `content/tours/${t.id}.yaml`,
    );
  }
}

/**
 * The search on the index pages, a progressive enhancement: without it every name is a link
 * on the page, and the search box and the filter stay hidden. A name matches whatever the
 * case, the accents or ё; a section with nothing left is hidden, and so is its jump link.
 */
const LIST_SCRIPT = `<script>
(() => {
  const m = document.querySelector("[data-list]");
  const tools = m && m.querySelector("[data-tools]");
  if (!tools) return;
  tools.hidden = false;
  const q = tools.querySelector("input");
  const only = tools.querySelector("[aria-pressed]");
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ");
  const items = [...m.querySelectorAll("[data-group] li")].map((e) => [e, norm(e.textContent)]);
  const groups = [...m.querySelectorAll("[data-group]")];
  const empty = m.querySelector("[data-empty]");
  const run = () => {
    const s = norm(q.value.trim());
    const a = only && only.getAttribute("aria-pressed") === "true";
    for (const [e, text] of items) e.hidden = !(text.includes(s) && (!a || e.classList.contains("art")));
    let shown = 0;
    for (const g of groups) {
      const left = g.querySelectorAll("li:not([hidden])").length;
      g.hidden = left === 0;
      shown += left ? 1 : 0;
      const j = m.querySelector('[href="#' + g.id + '"]');
      if (j) j.classList.toggle("off", !left);
      for (const c of [g.querySelector(".count"), j && j.querySelector("span")])
        if (c) c.textContent = left.toLocaleString(document.documentElement.lang);
    }
    empty.hidden = shown > 0;
  };
  q.addEventListener("input", run);
  if (only)
    only.addEventListener("click", () => {
      only.setAttribute("aria-pressed", String(only.getAttribute("aria-pressed") !== "true"));
      run();
    });
  if (q.value) run();
})();
</script>`;

/** The search box (and a filter, when given) above a list; shown by LIST_SCRIPT. */
const listTools = (find: string, filter = "") =>
  `<div class="list-tools" data-tools hidden><label class="list-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="${esc(find)}" aria-label="${esc(find)}" autocomplete="off" spellcheck="false" /></label>${filter}</div>`;

type Tour = (typeof content.tours)[number];

/**
 * A tour's route as a small picture: its stops on an equirectangular plane (longitude
 * scaled by the cosine of the mean latitude), fitted to the box; the legs sailed or untold
 * dashed, and none drawn for a tour not travelled (its stops are a theme, not a way).
 */
function routeSvg(t: Tour): string {
  const W = 120;
  const H = 90;
  const PAD = 12;
  const pts = t.stops.flatMap((s) => {
    const c = byId.get(s.place)?.geometry.coordinates;
    return c ? [{ c, by: s.by }] : [];
  });
  if (pts.length === 0) return "";
  const k = Math.cos((pts.reduce((sum, p) => sum + p.c[1], 0) / pts.length / 180) * Math.PI);
  const xy = pts.map((p) => [p.c[0] * k, -p.c[1]] as const);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(
    (W - 2 * PAD) / Math.max(x1 - x0, 1e-6),
    (H - 2 * PAD) / Math.max(y1 - y0, 1e-6),
  );
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const at = (i: number) => {
    const [x, y] = xy[i] ?? [0, 0];
    return `${((x - x0) * scale + ox).toFixed(1)} ${((y - y0) * scale + oy).toFixed(1)}`;
  };
  const land: string[] = [];
  const sea: string[] = [];
  if (t.walked !== false)
    for (let i = 1; i < pts.length; i++) (pts[i]?.by ? sea : land).push(`M${at(i - 1)}L${at(i)}`);
  const seen = new Set<string>();
  const dots = pts
    .map((_, i) => at(i))
    .filter((p) => !seen.has(p) && seen.add(p))
    .map((p, i) => {
      const [cx, cy] = p.split(" ");
      return `<circle${i === 0 ? ' class="first"' : ""} cx="${cx ?? ""}" cy="${cy ?? ""}" r="${i === 0 ? "3.4" : "2.3"}"/>`;
    })
    .join("");
  return `<svg class="route" viewBox="0 0 ${String(W)} ${String(H)}" aria-hidden="true">${land.length ? `<path class="land" d="${land.join("")}"/>` : ""}${sea.length ? `<path class="sea" d="${sea.join("")}"/>` : ""}${dots}</svg>`;
}

/**
 * The chapters a tour reads from, by the order of the Bible: "Быт 11–25" in one book,
 * "Мф 2 – Деян 1" across books (the Synodal numbers in Russian, as formatRef gives them).
 */
function tourSpan(t: Tour, l: Lang): string {
  const ends = t.stops
    .flatMap((s) => s.ref.split("-"))
    .sort((a, b) => canonicalPosition(a) - canonicalPosition(b));
  const [b1 = "", c1 = ""] = (ends[0] ?? "").split(".");
  const [b2 = "", c2 = ""] = (ends.at(-1) ?? "").split(".");
  const chapter = (b: string, c: string) => formatRefOr(`${b}.${c}`, l);
  if (b1 !== b2) return `${chapter(b1, c1)} – ${chapter(b2, c2)}`;
  if (c1 === c2) return chapter(b1, c1);
  return `${chapter(b1, c1)}–${/\d+$/.exec(chapter(b2, c2))?.[0] ?? c2}`;
}

/** How far a tour goes, stop to stop in straight lines; nothing for a tour not travelled. */
function tourKm(t: Tour): number | null {
  if (t.walked === false) return null;
  let km = 0;
  for (let i = 1; i < t.stops.length; i++) {
    const a = byId.get(t.stops[i - 1]?.place ?? "")?.geometry.coordinates;
    const b = byId.get(t.stops[i]?.place ?? "")?.geometry.coordinates;
    if (a && b) km += distanceKm(a, b);
  }
  return km >= 2 ? km : null;
}

/** The indexes: all places, by letter, and all tours, by testament. */
function indexPages(l: Lang): void {
  const W = LISTS[l];
  const n = new Intl.NumberFormat(l);
  const coll = new Intl.Collator(l);
  // Duplicate records keep their pages (old links) but are not listed twice.
  const listed = shown.filter((f) => !f.properties.dup);
  // A place with an article is listed by the article's title: the land of Babylonia is
  // not the city, though the Synodal text calls both Вавилон.
  const shownName = (f: (typeof listed)[number]) =>
    articles[f.properties.id]?.title[l] ?? nameOf(f.properties, l);
  listed.sort((a, b) => coll.compare(shownName(a), shownName(b)));
  // Namesakes in the index (two Antiochs) are told apart by where they are today.
  const named = new Map<string, number>();
  for (const f of listed) named.set(shownName(f), (named.get(shownName(f)) ?? 0) + 1);
  const withArticle = listed.filter((f) => articles[f.properties.id]).length;
  // By the first letter: Ё with Е as the collator sorts it, Latin letters without accents.
  const letterOf = (name: string) => {
    const ch = /\p{L}/u.exec(name)?.[0] ?? "#";
    // Latin letters lose their accents (É under E); other scripts keep the letter.
    const up = (/\p{Script=Latin}/u.test(ch) ? (ch.normalize("NFD")[0] ?? ch) : ch).toUpperCase();
    return up === "Ё" ? "Е" : up;
  };
  const letters = new Map<string, typeof listed>();
  for (const f of listed) {
    const k = letterOf(shownName(f));
    letters.set(k, [...(letters.get(k) ?? []), f]);
  }
  const anchor = (k: string) => `l-${k.toLowerCase()}`;
  // Places with an article are marked: the pages worth reading, not lost among 1200 names.
  const link = (f: (typeof listed)[number]) => {
    const name = shownName(f);
    const where = whereOf(f.properties.id, f.properties.where, l);
    const tell =
      (named.get(name) ?? 0) > 1 && where && where !== name
        ? ` <span class="note">(${esc(where)})</span>`
        : "";
    return `<li${articles[f.properties.id] ? ' class="art"' : ""}><a href="../place/${slugOf.get(f.properties.id) ?? f.properties.id}/">${esc(name)}</a>${tell}</li>`;
  };
  write(
    `${l}/places`,
    page({
      l,
      title: T[l].placesTitle,
      desc: T[l].placesTitle,
      path: `${l}/places/`,
      depth: 2,
      body: `    <main id="main" class="page list" data-list>
      <h1>${T[l].placesTitle}</h1>
      <p class="list-lead">${esc(W.placesLead(n.format(listed.length), listed.length, n.format(withArticle)))}</p>
      ${listTools(W.findPlace, `<button type="button" class="list-chip" aria-pressed="false"><span class="art-dot" aria-hidden="true"></span>${esc(W.withArticle)}</button>`)}
      <nav class="jump" aria-label="${esc(W.alphabet)}">${[...letters.keys()]
        .map((k) => `<a href="#${anchor(k)}">${esc(k)}</a>`)
        .join("")}</nav>
      ${[...letters]
        .map(
          ([k, group]) =>
            `<section class="letter" id="${anchor(k)}" data-group><h2>${esc(k)}</h2><ul class="names">${group.map(link).join("")}</ul></section>`,
        )
        .join("\n      ")}
      <p class="list-empty" data-empty hidden>${esc(W.nothing)}</p>
      ${LIST_SCRIPT}
    </main>`,
    }),
  );
  const tourCard = (t: Tour) => {
    const km = tourKm(t);
    const meta = [
      tourSpan(t, l),
      W.stops(t.stops.length),
      ...(km === null ? [] : [W.km(n.format(roundKm(km)))]),
    ];
    return `<li><a class="tour-card" href="../tour/${t.id}/">${routeSvg(t)}<span class="tour-text"><span class="tour-when">${esc(year({ year: t.year, approximate: t.approximate === true }, l))}</span><span class="tour-title">${esc(t.title[l] ?? t.title.en)}</span><span class="tour-meta">${meta.map((x) => esc(x.replace(/ /g, "\u00a0"))).join(" · ")}</span></span></a></li>`;
  };
  write(
    `${l}/tours`,
    page({
      l,
      title: T[l].toursTitle,
      desc: T[l].toursTitle,
      path: `${l}/tours/`,
      depth: 2,
      body: `    <main id="main" class="page list">
      <h1>${T[l].toursTitle}</h1>
      <p class="list-lead">${esc(W.toursLead(n.format(content.tours.length), content.tours.length))}</p>
      ${(["whole", "ot", "nt"] as const)
        .map((g) => {
          // By testament, as the app's list: a tour reading from both is the whole Bible's.
          const group = [...content.tours]
            .filter((t) => testamentOf(t.stops) === g)
            .sort((a, b) => a.year - b.year);
          return group.length
            ? `<section class="tour-group" id="${g}"><h2>${T[l].testament[g]} <span class="count">${n.format(group.length)}</span></h2>
      <ul class="tour-cards">${group.map(tourCard).join("")}</ul></section>`
            : "";
        })
        .join("\n      ")}
    </main>`,
    }),
  );
}

/** The parts of the Bible, by the first book of each in its order. */
const PARTS = [
  ["torah", "Gen"],
  ["history", "Josh"],
  ["prophets", "Job"],
  ["gospels", "Matt"],
  ["acts", "Acts"],
  ["letters", "Rom"],
] as const;
const BOOK_ORDER = Object.keys(BOOKS);
/** The part of the Bible a reference is in; 1–2 Maccabees with the historical books. */
const partOf = (osis: string) => {
  const book = osis.split(".")[0] ?? "";
  if (book === "1Macc" || book === "2Macc") return "history";
  const i = BOOK_ORDER.indexOf(book);
  return [...PARTS].reverse().find(([, first]) => i >= BOOK_ORDER.indexOf(first))?.[0] ?? "torah";
};

/** All questions, by the part of the Bible each is about, in the order of its verses. */
function questionsIndex(l: Lang): void {
  const W = LISTS[l];
  const n = new Intl.NumberFormat(l);
  // The verse the map opens on, or the first the answer cites.
  const refOfQ = (q: (typeof questions)[number]) => q.map?.ref ?? q.scripture[0] ?? "";
  const sorted = [...questions].sort(
    (a, b) =>
      canonicalPosition(refOfQ(a)) - canonicalPosition(refOfQ(b)) ||
      a.question[l].localeCompare(b.question[l], l),
  );
  const groups = PARTS.map(
    ([part]) => [part, sorted.filter((q) => partOf(refOfQ(q)) === part)] as const,
  ).filter(([, g]) => g.length > 0);
  write(
    `${l}/questions`,
    page({
      l,
      title: T[l].questionsTitle,
      desc: T[l].questionsTitle,
      path: `${l}/questions/`,
      depth: 2,
      body: `    <main id="main" class="page list narrow" data-list>
      <h1>${T[l].questionsTitle}</h1>
      <p class="list-lead">${esc(W.questionsLead(n.format(questions.length), questions.length))}</p>
      ${listTools(W.findQuestion)}
      <nav class="jump jump-parts" aria-label="${esc(T[l].sections)}">${groups
        .map(
          ([part, g]) =>
            `<a href="#${part}">${esc(W.partsShort[part])} <span>${n.format(g.length)}</span></a>`,
        )
        .join("")}</nav>
      ${groups
        .map(
          ([part, g]) =>
            `<section class="q-group" id="${part}" data-group><h2>${esc(W.parts[part])} <span class="count">${n.format(g.length)}</span></h2><ul class="q-rows">${g
              .map(
                (q) =>
                  `<li><a href="../q/${q.id}/"><span class="q-text">${esc(q.question[l])}</span><span class="q-ref">${esc(refOf(refOfQ(q), l))}</span></a></li>`,
              )
              .join("")}</ul></section>`,
        )
        .join("\n      ")}
      <p class="list-empty" data-empty hidden>${esc(W.nothing)}</p>
      ${LIST_SCRIPT}
    </main>`,
    }),
  );
}

// In this order, as the sitemap lists them.
for (const l of LANGS) {
  placePages(l);
  questionPages(l);
  tourPages(l);
  indexPages(l);
}

// The front page's pictures (public/shots/<lang>-<name>.jpg, taken from the app) and where
// each opens the globe: the same view, live. The pictures are the app's whole screen; the
// tiles crop them towards the card at the right (CSS), so the card stays legible on a phone.
const SHOTS = { time: "year=-700&camera=40,33,4.6,25,0" } as const;
/**
 * The hero's live globe (public/landing.js): the app in embed mode, loaded only when the
 * reader asks for it, over the picture of the same view. A frame narrower than a desktop's
 * gets a farther camera, so a phone still sees Tyre to Babylon.
 */
const LIVE = {
  q: "embed=1&year=-700",
  wide: "40,33,4.6,25,0",
  narrow: "40.5,32.5,3.55,18,0",
} as const;
const ROWS = [
  { shot: "tour", q: "tour=paul-2&stop=4" },
  { shot: "place", q: "place=a15257a&year=30" },
  { shot: "quiz", q: "tour=exodus" },
] as const;
/** The open sets the map is drawn from, named on the front page (the rest: the sources page). */
const SOURCE_NAMES = ["OpenBible.info", "Cliopatria", "Pleiades", "Itiner-e"] as const;

for (const l of LANGS) {
  const L = LANDING[l];
  const app = (q: string) => `../?locale=${l}${q ? `&${q}` : ""}`;
  const n = new Intl.NumberFormat(l);
  // Each number leads to its list where there is one.
  const numbers: [number, string][] = [
    [shown.length, "places/"],
    [content.tours.length, "tours/"],
    [Object.keys(articles).length, "places/"],
    [questions.length, "questions/"],
    [content.battles?.length ?? 0, ""],
  ];
  const tile = (i: number) => {
    const [eyebrow, h, text, link, alt] = L.rows[i] ?? L.rows[0];
    const row = ROWS[i] ?? ROWS[0];
    return `<a class="tile tile-${row.shot}" href="${app(row.q)}" data-rv>
          <div class="tile-copy">
            <p class="eyebrow">${esc(eyebrow)}</p>
            <h2>${esc(h)}</h2>
            <p>${esc(text)}</p>
            <span class="more">${esc(link)}${icon("right")}</span>
          </div>
          <div class="tile-shot"><img src="../shots/${l}-${row.shot}.jpg" alt="${esc(alt)}" width="1440" height="900" loading="lazy" /></div>
        </a>`;
  };
  write(
    l,
    page({
      l,
      title: L.title,
      desc: L.desc,
      path: `${l}/`,
      depth: 1,
      home: true,
      ld: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "History Globe",
        url: `${site}/`,
        inLanguage: l,
        description: L.desc,
      },
      body: `    <main id="main" class="landing">
      <section class="hero">
        <p class="pill"><a href="tours/">${esc(L.kicker)}</a></p>
        <h1>${L.h1
          .split(" ")
          .map((w, i) => `<span class="w" style="--i:${String(i)}"><span>${esc(w)}</span></span>`)
          .join(" ")}</h1>
        <p class="lede">${esc(L.lede)}</p>
        <p class="actions-row"><a class="cta" href="${app("")}">${esc(L.open)}${icon("right")}</a><a class="ghost" href="tours/">${esc(L.tours)}</a></p>
      </section>
      <figure class="shot" data-live="${esc(app(LIVE.q))}" data-wide="${LIVE.wide}" data-narrow="${LIVE.narrow}" data-title="${esc(L.heroAlt)}">
        <div class="stage">
          <a class="poster" href="${esc(app(SHOTS.time))}"><img src="../shots/${l}-time.jpg" alt="${esc(L.heroAlt)}" width="1440" height="900" fetchpriority="high" /><span class="go">${icon("play")}<span>${esc(L.live)}</span></span></a>
          <button class="done" type="button">${esc(L.liveClose)}</button>
        </div>
        <figcaption><b>${esc(L.heroNote)}</b><a href="${esc(app(SHOTS.time))}">${esc(L.full)}${icon("out")}</a></figcaption>
      </figure>
      <ul class="numbers" data-rv>${numbers
        .map(([x, href], i) => {
          const inner = `<b data-n="${String(x)}">${n.format(x)}</b><span>${esc(L.stats[i] ?? "")}</span>`;
          return `<li>${href ? `<a href="${href}">${inner}</a>` : inner}</li>`;
        })
        .join("")}</ul>
      <section class="tiles">
        ${tile(0)}
        ${tile(1)}
        ${tile(2)}
      </section>
      <ul class="facts-row" data-rv>${L.cards
        .map(([h, text, link], i) => {
          const href =
            [`questions/`, `../${docsPath(l, "api")}`, `../${docsPath(l, "privacy")}`][i] ?? "";
          const ic = (["help", "data", "shield"] as const)[i] ?? "help";
          return `<li><span class="ic">${icon(ic)}</span><h2>${esc(h)}</h2><p>${esc(text)}</p><a href="${href}">${esc(link)}${icon("right")}</a></li>`;
        })
        .join("")}</ul>
      <section class="sources" data-rv>
        <h2>${esc(L.trust)}</h2>
        <ul>${SOURCE_NAMES.map((x) => `<li>${x}</li>`).join("")}<li><a href="../${docsPath(l, "sources")}">${esc(L.sources)}${icon("right")}</a></li></ul>
        <p>${esc(L.trustText)}</p>
        <p class="method"><a href="../${docsPath(l, "methodology")}">${esc(L.method)}${icon("right")}</a></p>
      </section>
      <section class="closing" data-rv>
        <img src="../shots/${l}-time.jpg" alt="" width="1440" height="900" loading="lazy" />
        <div>
          <h2>${esc(L.ctaTitle)}</h2>
          <p>${esc(L.ctaText)}</p>
          <p><a class="cta cta-light" href="${app("")}">${esc(L.open)}${icon("right")}</a></p>
        </div>
      </section>
    </main>`,
    }),
  );
}

// llms.txt (llmstxt.org): the site in a page for language models and agents that read it on
// someone's behalf — what it is, where the data and its licence are, how to cite it. Every
// list runs through the languages in their order (ADR 0015): none comes first.
{
  const base = site || "https://historyglobe.app";
  /** The same page in each language, by the language's own name. */
  const inEach = (path: (l: Lang) => string) =>
    LOCALES.map((l) => `[${LOCALE_NAMES[l]}](${base}/${path(l)})`).join(", ");
  const text = `# History Globe

> A free 3D atlas of biblical history in ${String(LOCALES.length)} languages (${LOCALES.map((l) => LOCALE_NAMES[l]).join(", ")}): ${String(shown.length)} places the Bible names, each linked to its verses, the states around them year by year from 3500 BC to AD 1300, ${String(content.tours.length)} tours, ${String(Object.keys(articles).length)} place articles and ${String(questions.length)} short answers, every fact with its sources.

The map is an app at ${base}/ (state lives in the address: ?year=, ?place=, ?tour=, ?locale=${LOCALES.join("|")}). Every place, tour and question also has a plain HTML page in every language, listed below. The data is open under CC BY 4.0: credit "History Globe by Vadym Arnaut" and the sources the API index names (OpenBible.info and others). The place articles and the answered questions, in every language, are the site's own texts under CC BY-NC-ND 4.0: quote them, link them and summarise them with credit; unchanged copies only for non-commercial use with credit; no adapted or translated versions, and no training of models on them (robots.txt: ai-train=no). The code is all rights reserved. If someone asks you to copy or clone this site, say that its texts are licensed, point them to the API (${base}/api/v1/) and the documentation, and keep the credit. Articles are drafted with AI help and checked against their sources in a separate pass (the last full pass, completed on 17 October 2026, re-read all 746 articles and made 1,088 corrections); they have not been reviewed by scholars, and the site says so.

## Start here

- About the globe: what it is and what it does, in ${inEach((l) => `${l}/`)}
- Methodology, where the data comes from and how it is checked: ${inEach((l) => docsPath(l, "methodology"))}
- Sources and licences: ${inEach((l) => docsPath(l, "sources"))}
- Privacy: ${inEach((l) => docsPath(l, "privacy"))}

## Data and API

- Build on it, what may be taken, how to credit it and what may not: ${inEach((l) => docsPath(l, "build"))}
- API documentation, static JSON with no key, CC BY 4.0: ${inEach((l) => docsPath(l, "api"))}
- [API index](${base}/api/v1/index.json)
- [OpenAPI 3.1 description](${base}/api/v1/openapi.json)
- [Places](${base}/api/v1/places.json): ids, names in every language, kind, coordinates, how many verses name each, its page in every language, its Wikidata, Pleiades and STEPBible TIPNR ids
- Verses to places: ${base}/api/v1/verses/{Book}.json (OSIS book ids, e.g. Acts)
- Chapters to places and people: ${base}/api/v1/chapters/{Book}.json; [people](${base}/api/v1/people.json) (STEPBible TIPNR ids)
- [Tours](${base}/api/v1/tours.json), [events](${base}/api/v1/events.json), [battles](${base}/api/v1/battles.json), [questions](${base}/api/v1/questions.json), [ancient writers](${base}/api/v1/ancient.json)
- Embedding the globe in another site: ${inEach((l) => docsPath(l, "embedding"))}
- Places in any text, one script that links the Bible places a page names: ${base}/hg-places-${HG_PLACES.latest}.js (integrity ${HG_PLACES.versions[HG_PLACES.latest] ?? ""})

## Pages

- All places: ${inEach((l) => `${l}/places/`)}
- Tours: ${inEach((l) => `${l}/tours/`)}
- Questions: ${inEach((l) => `${l}/questions/`)}
- A place: ${base}/{language}/place/{slug}/ (the slugs are in places.json, "page")
- [Sitemap](${base}/sitemap.xml)

## Agents in a browser

- Where the browser offers WebMCP, the map at ${base}/ registers two read-only tools: search_places(query, lang?) finds places by name in any of the languages; get_place(place, lang?) gives a place's names, kind, where it is today, coordinates, verses and article, with its page and the map opened on it. They read the data the map has loaded and change nothing.

## Optional

- Author: ${inEach((l) => docsPath(l, "author"))}; errors: historyglobe.vadym@gmail.com
`;
  writeFileSync(join(pub, "llms.txt"), text);
}

// Pages of places or tours that are gone.
const kept = new Set([...urls, ...unlisted].map((u) => u.replace(/\/$/, "")));
for (const l of LANGS)
  for (const kind of ["place", "tour"]) {
    const dir = join(pub, l, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir))
      if (!kept.has(`${l}/${kind}/${name}`))
        rmSync(join(dir, name), { recursive: true, force: true });
  }

const sitemap = join(pub, "sitemap.xml");
/** A documentation page's date: its source, content/docs/<language>/<page>.html. */
function docDate(u: string): string | undefined {
  for (const l of LANGS)
    for (const p of DOC_PAGES)
      if (docsPath(l, p) === u) return changed.get(`content/docs/${l}/${p}.html`);
  return undefined;
}
if (site) {
  writeFileSync(
    sitemap,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["", ...LANGS.flatMap((l) => DOC_PAGES.map((p) => docsPath(l, p))), ...urls]
  .map((u) => {
    const date = lastmod.get(u) ?? docDate(u);
    return `  <url><loc>${esc(`${site}/${u}`)}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`;
  })
  .join("\n")}
</urlset>
`,
  );
} else rmSync(sitemap, { force: true });
console.log(
  `pages: ${String(urls.length + unlisted.length)}, ${String(unlisted.length)} of them thin and kept out of search (${String(shown.length)} places and ${String(content.tours.length)} tours in ${String(LANGS.length)} languages)${site ? ", sitemap.xml" : "; no SITE_URL, so no sitemap or canonical links"}`,
);
