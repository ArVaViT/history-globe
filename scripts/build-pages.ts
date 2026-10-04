/**
 * Writes a plain HTML page for every place with verses and for every tour, in Russian and
 * English (apps/web/public/{ru,en}/…), with an index of each, so search engines and link
 * previews find what the map holds: «где находился Вифсаида» lands on Bethsaida's page,
 * and its "Open on the map" button opens the globe there. The pages carry the place's
 * names, where it is today, its dates and events, its article, its verses (with their
 * text) and the tours through it. No script, no app bundle: they load at once.
 *
 * With SITE_URL set (https://example.org, no trailing slash) the pages also get canonical
 * and hreflang links and Open Graph tags, and sitemap.xml is written; these need absolute
 * URLs, so without it they are left out.
 *
 * Usage: node scripts/build-pages.ts  (after build-content; verse texts are used when
 * build-verses has run)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentRelease, PlaceLife } from "../packages/model/src/content.ts";
import { formatRef, NT_BOOKS } from "../packages/model/src/scripture.ts";
import { sourcesOf } from "../packages/model/src/citation.ts";
import { formatYear } from "../packages/model/src/time.ts";
import { siteCertainty } from "../packages/model/src/sites.ts";
import { placeSlugs } from "./slugs.ts";
import { distanceKm, roundKm } from "../apps/web/src/distance.ts";
import { splitPlaces, textPlacesFrom, type TextPlaces } from "../apps/web/src/text-places-core.ts";

const root = join(import.meta.dirname, "..");

const RU_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "день", few: "дня" };

/** Whether a tour's stops read from both testaments (as ToursPanel.tsx groups them). */
const testamentOf = (stops: readonly { readonly ref: string }[]): "whole" | "ot" | "nt" => {
  const nt = stops.map((s) => NT_BOOKS.has(s.ref.split(".")[0] ?? ""));
  return nt.includes(true) && nt.includes(false) ? "whole" : nt.includes(true) ? "nt" : "ot";
};
const pub = join(root, "apps/web/public");
const data = join(pub, "data");
const site = process.env.SITE_URL?.replace(/\/+$/, "") ?? "";

type Lang = "ru" | "en";
const LANGS: readonly Lang[] = ["ru", "en"];

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

const places = (
  JSON.parse(readFileSync(join(data, "places.geojson"), "utf8")) as {
    features: { geometry: { coordinates: [number, number] }; properties: Props }[];
  }
).features;
const content = JSON.parse(readFileSync(join(data, "content.json"), "utf8")) as ContentRelease & {
  where_ru?: Record<string, string>;
};
/** What ancient authors say of places (content/ancient-authors.yaml, via build-content.ts). */
const ancientAuthors = (
  existsSync(join(data, "ancient-authors.json"))
    ? JSON.parse(readFileSync(join(data, "ancient-authors.json"), "utf8"))
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
  existsSync(join(data, "questions.json"))
    ? JSON.parse(readFileSync(join(data, "questions.json"), "utf8"))
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
const articles = existsSync(join(data, "articles.json"))
  ? (JSON.parse(readFileSync(join(data, "articles.json"), "utf8")) as Record<string, Article>)
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
/** A description cut at a word under `n` characters, with an ellipsis when cut. */
const clip = (s: string, n = 200) =>
  s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,;:.\s]+$/, "")}…`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nameOf = (p: Props, l: Lang) => (l === "ru" ? (content.names[p.id]?.ru ?? p.name) : p.name);
const refOf = (osis: string, l: Lang) => {
  try {
    return formatRef(osis, l);
  } catch {
    return osis;
  }
};

const T = {
  ru: {
    site: "History Globe — карта библейской истории",
    open: "Открыть на карте",
    tour_open: "Пройти экскурсию на карте",
    // The sea as the stop says it: «, по морю» or «, по морю, 5 дней (Деян 20:6)».
    leg: (km: string, road: string | null, sea: string) =>
      `≈\u00a0${km}\u00a0км по прямой${road ? `, ≈\u00a0${road}\u00a0км по\u00a0римским\u00a0дорогам` : ""}${sea}`,
    sea: (days?: number, ref?: string, about?: boolean) =>
      days
        ? `, по морю, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${RU_DAYS[new Intl.PluralRules("ru").select(days)] ?? "дней"} (${ref ?? ""})`
        : ", по морю",
    today: "Где сегодня",
    english: "По-английски",
    ancient: "У древних авторов",
    untold: ", путь в тексте не прослежен",
    life: "Время существования",
    ruins: "В руинах",
    events: "События",
    battles: "Битвы и осады",
    article: "История",
    scripture: "Писание",
    sources: "Источники",
    checked: "Статья сверена с источниками; историк её ещё не читал.",
    reviewed: "Статью прочитал историк",
    verses: (n: number) => `Стихи (${String(n)})`,
    more: (n: number) => `ещё ${String(n)} — на карте`,
    tours: "Экскурсии через это место",
    places: "Все места",
    skip: "К содержанию",
    sections: "Разделы",
    tour: "Экскурсия",
    toursAll: "Все экскурсии",
    placesTitle: "Места библейской истории",
    articlesTitle: "Статьи о городах",
    disputed: "Место спорное",
    photoShows: (site: string) => `На снимке ${site} — одна из версий.`,
    allPlaces: "Все места",
    toursTitle: "Экскурсии по библейской истории",
    questions: "Вопросы",
    questionsTitle: "Вопросы о местах и истории Библии",
    question: "Вопрос",
    showMap: "Показать на карте",
    checkedQ: "Ответ сверен с источниками; историк его ещё не читал.",
    testament: { whole: "Вся Библия", ot: "Ветхий Завет", nt: "Новый Завет" },
    asks: { where: "Где", when: "Когда", how: "Как далеко и как долго", who: "Кто" },
    stop: "Остановка",
    translation: "Синодальный перевод",
    circa: "ок.",
    title: (n: string) => `${n} — где это было, история, стихи Библии`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) на карте библейской истории: где это место сегодня, его история и упоминания в Библии (${String(v)}).`,
    about: "О проекте",
    photo: "Фото",
    pd: "общественное достояние",
    other: "English",
  },
  en: {
    site: "History Globe — a map of biblical history",
    open: "Open on the map",
    tour_open: "Take the tour on the map",
    leg: (km: string, road: string | null, sea: string) =>
      `≈\u00a0${km}\u00a0km in a straight line${road ? `, ≈\u00a0${road}\u00a0km by\u00a0Roman\u00a0roads` : ""}${sea}`,
    sea: (days?: number, ref?: string, about?: boolean) =>
      days
        ? `, by sea, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0day${days === 1 ? "" : "s"} (${ref ?? ""})`
        : ", by sea",
    today: "Today",
    english: "In English",
    ancient: "In ancient writers",
    untold: ", the way is not told",
    life: "Lifetime",
    ruins: "In ruins",
    events: "Events",
    battles: "Battles and sieges",
    article: "History",
    scripture: "Scripture",
    sources: "Sources",
    checked: "Checked against its sources; not yet read by a historian.",
    reviewed: "Read by a historian",
    verses: (n: number) => `Verses (${String(n)})`,
    more: (n: number) => `${String(n)} more on the map`,
    tours: "Tours through this place",
    places: "All places",
    skip: "Skip to content",
    sections: "Sections",
    tour: "Tour",
    toursAll: "All tours",
    placesTitle: "Places of biblical history",
    articlesTitle: "City articles",
    disputed: "Location disputed",
    photoShows: (site: string) => `Shown: ${site}, one of the proposed sites.`,
    allPlaces: "All places",
    toursTitle: "Tours of biblical history",
    questions: "Questions",
    questionsTitle: "Questions about the places and history of the Bible",
    question: "Question",
    showMap: "Show on the map",
    checkedQ: "Checked against its sources; not yet read by a historian.",
    testament: { whole: "The whole Bible", ot: "Old Testament", nt: "New Testament" },
    asks: { where: "Where", when: "When", how: "How far and how long", who: "Who" },
    stop: "Stop",
    translation: "King James Version",
    circa: "c.",
    title: (n: string) => `${n} — where it is, its history, Bible verses`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) on the map of biblical history: where it is today, its history and the Bible verses that name it (${String(v)}).`,
    about: "About",
    photo: "Photo",
    pd: "public domain",
    other: "Русский",
  },
} as const;

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

/** The page shell: the same look as about.html, light and without a script. */
function page(o: {
  l: Lang;
  title: string;
  desc: string;
  path: string;
  other: string;
  body: string;
  depth: number;
  ld?: object;
  /** The preview image, relative to the site root (the place's photo). */
  image?: string;
}): string {
  const up = "../".repeat(o.depth);
  const abs = (p: string) => `${site}/${p}`;
  const meta = site
    ? `
    <link rel="canonical" href="${abs(o.path)}" />
    <link rel="alternate" hreflang="${o.l}" href="${abs(o.path)}" />
    <link rel="alternate" hreflang="${o.l === "ru" ? "en" : "ru"}" href="${abs(o.other)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="History Globe" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.desc)}" />
    <meta property="og:url" content="${abs(o.path)}" />
    <meta property="og:image" content="${abs(o.image ?? "og.jpg")}" />
    <meta name="twitter:card" content="summary_large_image" />`
    : "";
  const ld = o.ld
    ? `\n    <script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!doctype html>
<html lang="${o.l}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#fbf8f2" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0f141b" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${up}favicon.svg" type="image/svg+xml" />
    <title>${esc(o.title)} | History Globe</title>
    <meta name="description" content="${esc(o.desc)}" />${meta}${ld}
    <link rel="stylesheet" href="${up}pages.css" />
  </head>
  <body>
    <a class="skip" href="#main">${T[o.l].skip}</a>
    <header class="bar">
      <a class="brand" href="${up}?locale=${o.l}"><img src="${up}favicon.svg" alt="" width="22" height="22" />History Globe</a>
      <nav aria-label="${T[o.l].sections}"><a href="${up}${o.l}/places/">${T[o.l].places}</a><a href="${up}${o.l}/tours/">${T[o.l].toursAll}</a><a href="${up}${o.l}/questions/">${T[o.l].questions}</a><a class="lang" href="${up}${o.other}" hreflang="${o.l === "ru" ? "en" : "ru"}" lang="${o.l === "ru" ? "en" : "ru"}">${T[o.l].other}</a></nav>
    </header>
${o.body}
    <footer class="foot"><a href="${up}docs/${o.l === "ru" ? "ru/" : ""}">${T[o.l].about}</a> · OpenBible.info (CC BY 4.0), Cliopatria (CC BY 4.0)</footer>
  </body>
</html>
`;
}

const hasPhoto = (id: string) => existsSync(join(data, "photos", `${id}.jpg`));

/** The place's photo with its credit (content/photos.yaml), or nothing. */
function photoHtml(id: string, name: string, l: Lang): string {
  const ph = content.photos?.[id];
  // Only when the image is there: a build without `pnpm data` has no photos to show.
  if (!ph || !hasPhoto(id)) return "";
  const page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ph.file.replaceAll(" ", "_"))}`;
  const lic = ph.license === "Public domain" ? T[l].pd : ph.license;
  const shows = ph.shows && (l === "ru" ? (ph.shows.ru ?? ph.shows.en) : ph.shows.en);
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
const write = (path: string, html: string) => {
  const file = join(pub, path, "index.html");
  mkdirSync(join(pub, path), { recursive: true });
  if (!existsSync(file) || readFileSync(file, "utf8") !== html) writeFileSync(file, html);
  urls.push(`${path}/`);
};

for (const l of LANGS) {
  const o = l === "ru" ? "en" : "ru";
  // Namesakes (two Antiochs) get where they are today in the page's title, as in the index.
  const sameName = new Map<string, number>();
  for (const f of shown)
    if (!f.properties.dup)
      sameName.set(nameOf(f.properties, l), (sameName.get(nameOf(f.properties, l)) ?? 0) + 1);
  for (const f of shown) {
    const p = f.properties;
    const name = nameOf(p, l);
    const kind = ui[l].kind[p.kind] ?? p.kind;
    const where = l === "ru" ? content.where_ru?.[p.id] : p.where;
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
      <ul class="facts">${today ? `<li><span>${T[l].today}</span> ${esc(today)}</li>` : ""}${l === "ru" && name !== p.name ? `<li><span>${T[l].english}</span> <span lang="en">${esc(p.name)}</span></li>` : ""}${note ? `<li class="warn">${esc(note)}</li>` : ""}</ul>
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
      <ul class="cards">${tours.map((t) => `<li><a href="../../tour/${t.id}/">${esc(t.title[l])} <span aria-hidden="true">→</span></a></li>`).join("")}</ul>`
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
        other: `${o}/place/${slug}/`,
        body,
        depth: 3,
        ...(content.photos?.[p.id] && hasPhoto(p.id) ? { image: `data/photos/${p.id}.jpg` } : {}),
        ld: {
          "@context": "https://schema.org",
          "@type": "Place",
          name,
          ...(where ? { description: where } : {}),
          geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lon },
        },
      }),
    );
  }

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
        other: `${o}/q/${q.id}/`,
        body,
        depth: 3,
        ld: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: title,
              acceptedAnswer: { "@type": "Answer", text: q.answer[l].join(" ") },
            },
          ],
        },
      }),
    );
  }
  if (questions.length > 0)
    write(
      `${l}/questions`,
      page({
        l,
        title: T[l].questionsTitle,
        desc: T[l].questionsTitle,
        path: `${l}/questions/`,
        other: `${o}/questions/`,
        depth: 2,
        body: `    <main id="main" class="page">
      <h1>${T[l].questionsTitle}</h1>
      ${(["where", "when", "how", "who"] as const)
        .map((g) => {
          // By what is asked, read from the id (where-was-…, how-far-…); the rest are “where”.
          const group = questions
            .filter((q) => (/^(when|how|who)-/.exec(q.id)?.[1] ?? "where") === g)
            .sort((a, b) => a.question[l].localeCompare(b.question[l], l));
          return group.length
            ? `<h2>${T[l].asks[g]} · ${String(group.length)}</h2>
      <ul class="cards">${group
        .map((q) => `<li><a href="../q/${q.id}/">${esc(q.question[l])}</a></li>`)
        .join("")}</ul>`
            : "";
        })
        .join("\n      ")}
    </main>`,
      }),
    );

  for (const t of content.tours) {
    const title = t.title[l];
    const path = `${l}/tour/${t.id}`;
    const body = `    <main id="main" class="page">
      <p class="kicker">${T[l].tour} · ${esc(year({ year: t.year, approximate: t.approximate === true }, l))}</p>
      <h1>${esc(title)}</h1>
      <p class="actions"><a class="button" href="../../../?tour=${t.id}&amp;locale=${l}">${T[l].tour_open} →</a></p>
      <ol class="stops">${t.stops
        .map((s, i) => {
          const f = byId.get(s.place);
          const n = f ? nameOf(f.properties, l) : s.place;
          const link =
            f && f.properties.verses > 0
              ? `<a href="../../place/${slugOf.get(s.place) ?? s.place}/">${esc(n)}</a>`
              : esc(n);
          const leg = legOf(t, i);
          return `<li><p class="stop"><b>${link}</b> <span class="ref">${esc(refOf(s.ref, l))}${leg ? ` · ${esc(leg)}` : ""}</span></p><p>${esc(s.note[l])}</p><a class="more" href="../../../?tour=${t.id}&amp;stop=${String(i + 1)}&amp;locale=${l}">${T[l].open} →</a></li>`;
        })
        .join("\n        ")}</ol>
    </main>`;
    const first = t.stops[0]?.note[l] ?? "";
    write(
      path,
      page({
        l,
        title,
        desc: clip(`${title}: ${first}`),
        path: `${path}/`,
        other: `${o}/tour/${t.id}/`,
        body,
        depth: 3,
      }),
    );
  }

  const coll = new Intl.Collator(l);
  const list = [...shown].sort((a, b) =>
    coll.compare(nameOf(a.properties, l), nameOf(b.properties, l)),
  );
  // Places with an article first: the pages worth reading, not lost among 1200 names.
  const withArticle = list.filter((f) => articles[f.properties.id]);
  // Duplicate records keep their pages (old links) but are not listed twice.
  const listed = list.filter((f) => !f.properties.dup);
  // A place with an article is listed by the article's title: the land of Babylonia is
  // not the city, though the Synodal text calls both Вавилон.
  const shownName = (f: (typeof list)[number]) =>
    articles[f.properties.id]?.title[l] ?? nameOf(f.properties, l);
  // Namesakes in the index (two Antiochs) are told apart by where they are today.
  listed.sort((a, b) => coll.compare(shownName(a), shownName(b)));
  const named = new Map<string, number>();
  for (const f of list)
    if (!f.properties.dup) named.set(shownName(f), (named.get(shownName(f)) ?? 0) + 1);
  const link = (f: (typeof list)[number]) => {
    const name = shownName(f);
    const where = l === "ru" ? content.where_ru?.[f.properties.id] : f.properties.where;
    const tell =
      (named.get(name) ?? 0) > 1 && where && where !== name
        ? ` <span class="note">(${esc(where)})</span>`
        : "";
    return `<li><a href="../place/${slugOf.get(f.properties.id) ?? f.properties.id}/">${esc(name)}</a>${tell}</li>`;
  };
  write(
    `${l}/places`,
    page({
      l,
      title: T[l].placesTitle,
      desc: T[l].placesTitle,
      path: `${l}/places/`,
      other: `${o}/places/`,
      depth: 2,
      body: `    <main id="main" class="page">
      <h1>${T[l].placesTitle}</h1>
      <h2>${T[l].articlesTitle} · ${String(withArticle.length)}</h2>
      <ul class="columns">${[...withArticle]
        .sort((a, b) => coll.compare(shownName(a), shownName(b)))
        .map(link)
        .join("")}</ul>
      <h2>${T[l].allPlaces} · ${String(listed.length)}</h2>
      <ul class="columns">${listed.map(link).join("")}</ul>
    </main>`,
    }),
  );
  write(
    `${l}/tours`,
    page({
      l,
      title: T[l].toursTitle,
      desc: T[l].toursTitle,
      path: `${l}/tours/`,
      other: `${o}/tours/`,
      depth: 2,
      body: `    <main id="main" class="page">
      <h1>${T[l].toursTitle}</h1>
      ${(["whole", "ot", "nt"] as const)
        .map((g) => {
          // By testament, as the app's list: a tour reading from both is the whole Bible's.
          const group = [...content.tours]
            .filter((t) => testamentOf(t.stops) === g)
            .sort((a, b) => a.year - b.year);
          return group.length
            ? `<h2>${T[l].testament[g]} · ${String(group.length)}</h2>
      <ul class="cards">${group
        .map(
          (t) =>
            `<li><a href="../tour/${t.id}/">${esc(t.title[l])} <span class="note">${esc(year({ year: t.year, approximate: t.approximate === true }, l))}</span></a></li>`,
        )
        .join("")}</ul>`
            : "";
        })
        .join("\n      ")}
    </main>`,
    }),
  );
}

// Pages of places or tours that are gone.
const kept = new Set(urls.map((u) => u.replace(/\/$/, "")));
for (const l of LANGS)
  for (const kind of ["place", "tour"]) {
    const dir = join(pub, l, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir))
      if (!kept.has(`${l}/${kind}/${name}`))
        rmSync(join(dir, name), { recursive: true, force: true });
  }

const sitemap = join(pub, "sitemap.xml");
if (site) {
  writeFileSync(
    sitemap,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["", "docs/", "docs/methodology.html", "docs/embedding.html", "docs/sources.html", "docs/author.html", "docs/ru/", "docs/ru/methodology.html", "docs/ru/embedding.html", "docs/ru/sources.html", "docs/ru/author.html", ...urls].map((u) => `  <url><loc>${esc(`${site}/${u}`)}</loc></url>`).join("\n")}
</urlset>
`,
  );
} else rmSync(sitemap, { force: true });
console.log(
  `pages: ${String(urls.length)} (${String(shown.length)} places and ${String(content.tours.length)} tours in ${String(LANGS.length)} languages)${site ? ", sitemap.xml" : "; no SITE_URL, so no sitemap or canonical links"}`,
);
