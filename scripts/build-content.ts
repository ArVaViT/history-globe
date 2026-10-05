/**
 * Validates everything in content/ against the single schema (ADR 0007) and writes
 * apps/web/public/data/content.json. Fails loudly on any invalid record, and on tour
 * stops that point at places missing from the data build.
 *
 * Usage: node scripts/build-content.ts  (after `python3 pipeline/build_data.py`)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  AncientSitesFile,
  ChapterYearsFile,
  PlaceNamesFile,
  ModernNamesFile,
  PlaceLifeFile,
  EventsFile,
  BattlesFile,
  type HistoryBattle,
  type HistoryEvent,
  type PlaceLife,
  TourFile,
  ArticleFile,
  QuestionFile,
  AncientAuthorsFile,
  type AncientMention,
  PhotosFile,
  type ContentRelease,
  type PleiadesLink,
  type PlacePhoto,
  SourcesRuFile,
} from "../packages/model/src/content.ts";
import { inheritLife } from "../packages/model/src/place-life-links.ts";
import { buildPolities } from "./build-polities.ts";
import { packChapterYears } from "../packages/model/src/chapter-years.ts";
import { YEAR_MAX, YEAR_MIN } from "../packages/core/src/engine.ts";
import { inFocus } from "../packages/core/src/style.ts";
import { canonicalPosition, refCovers } from "../packages/model/src/scripture.ts";
import { siteLabelRu, type SiteLabelParts } from "../packages/model/src/sites.ts";

const root = join(import.meta.dirname, "..");
const out = join(root, "apps/web/public/data");

function load(path: string): unknown {
  return parse(readFileSync(join(root, path), "utf8"));
}

if (!existsSync(join(out, "places.geojson"))) {
  console.error("content: no data build in apps/web/public/data; run `pnpm data` first");
  process.exit(1);
}
const places = JSON.parse(readFileSync(join(out, "places.geojson"), "utf8")) as {
  features: {
    geometry: { coordinates: number[] };
    properties: {
      id: string;
      name: string;
      rank: number;
      ot: number;
      disputed: boolean;
      where: string;
      where_tpl?: SiteLabelParts["tpl"];
      where_ref?: string;
      where_ref_text?: string;
      where_n?: string;
      where_unit?: "km" | "m";
    };
  }[];
};
const known = new Set(places.features.map((f) => f.properties.id));
// Places the pipeline left out for licence reasons (ADR 0008): their names stay parked.
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as {
  excluded_places?: string[];
};
const parked = new Set(manifest.excluded_places ?? []);

const errors: string[] = [];
const warnings: string[] = [];
// Nothing is written until every check has passed: a failed run leaves the data untouched.
const writes: [path: string, text: string][] = [];

// The verses OpenBible tags for each place (English numbering). Evidence must come from
// one of them: this catches Synodal verse numbers and verses about a namesake.
const openbible = join(root, "pipeline/.cache/openbible-ancient.jsonl");
const versesOf = new Map<string, Set<string>>();
if (!existsSync(openbible)) {
  warnings.push(
    "no OpenBible cache (pipeline/.cache): evidence and tour stops are not checked against its tags",
  );
} else {
  for (const line of readFileSync(openbible, "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line) as { id: string; verses?: { osis: string }[] };
    versesOf.set(r.id, new Set((r.verses ?? []).map((v) => v.osis)));
  }
}
/** Tour stops whose passage leaves the place to the preceding chapters. */
const NAMED_BY_CONTEXT = new Set([
  // Acts 27:1 sails from Caesarea, named in 25:13-24 where Paul is held.
  "paul-rome a58735e",
  // The tomb is in the garden "in the place where He was crucified" (John 19:41),
  // Golgotha, named in 19:17.
  "resurrection a631d35",
  // David waits at Mahanaim (2 Sam 17:24, 27) for the news of the battle (18:19-33).
  // OpenBible's tag on 18:23 passes the check today, but the verse does not name it.
  "absalom ae5bfe9",
]);

/** Tour stops drawn faded in their year on purpose, with the reason. */
const FADED_ON_PURPOSE = new Set([
  // Word of Jerusalem's fall reaches Ezekiel (Ezek 33:21): the city lies in ruins.
  "ezekiel a15257a Ezek.33.21-Ezek.33.22",
]);

/** Evidence read where the Synodal text has words the English one lacks. */
const SYNODAL_ONLY = new Set([
  // Exod 1:11 adds "и Он, иначе Илиополь" from the Septuagint.
  "acd9137 Exod.1.11",
]);

const names: Record<string, { ru: string; osis?: string }> = {};
const nameEntries = PlaceNamesFile.parse(load("content/place-names.yaml")).places;
const seenIds = new Set<string>();
for (const p of nameEntries) {
  if (seenIds.has(p.id)) errors.push(`place-names: ${p.id} (${p.en}) is listed twice`);
  seenIds.add(p.id);
  if (parked.has(p.id))
    warnings.push(`place-names: ${p.id} (${p.en}) is parked: no licensed point`);
  else if (!known.has(p.id)) errors.push(`place-names: ${p.id} (${p.en}) is not in the data build`);
  // A map label, not a note: no glosses in brackets, no markers.
  if (/[()*[\]/]/.test(p.ru)) errors.push(`place-names: ${p.id} "${p.ru}" is not a plain name`);
  // One rule for generic words: a label starts with a capital ("Гора Сион", "Поток Арнон").
  if (p.ru.charAt(0) !== p.ru.charAt(0).toLocaleUpperCase("ru"))
    errors.push(`place-names: ${p.id} "${p.ru}" must start with a capital letter`);
  // The evidence must actually contain the name: compare the first three letters of the
  // last word, which survive Russian case endings (Вифлеем → в Вифлееме).
  if (p.evidence) {
    const word = p.ru.split(/\s+/).at(-1) ?? "";
    // Three letters, fewer for short names: "Гай" must match "Гае".
    const stem = word.slice(0, Math.min(3, Math.max(2, word.length - 1))).toLocaleLowerCase("ru");
    // At the start of a word: a short name ("Ор") would otherwise match inside any word.
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const atWordStart = new RegExp(`(^|[^\\p{L}])${escaped}`, "u");
    if (!atWordStart.test(p.evidence.excerpt.toLocaleLowerCase("ru"))) {
      errors.push(
        `place-names: ${p.id} "${p.ru}" is not found in its evidence "${p.evidence.excerpt}"`,
      );
    }
  }
  const tagged = versesOf.get(p.id);
  if (p.evidence && tagged && !SYNODAL_ONLY.has(`${p.id} ${p.evidence.osis}`)) {
    const { osis } = p.evidence;
    // A whole-chapter reference (a psalm title) counts if any verse of it is tagged.
    const ok = tagged.has(osis) || [...tagged].some((v) => v.startsWith(`${osis}.`));
    if (!ok)
      errors.push(`place-names: ${p.id} (${p.en}) evidence ${osis} is not a verse of this place`);
  }
  names[p.id] = p.evidence ? { ru: p.ru, osis: p.evidence.osis } : { ru: p.ru };
}

// Sanity of the data build itself.
const featureIds = new Set<string>();
for (const f of places.features) {
  const { id } = f.properties;
  if (featureIds.has(id)) errors.push(`places: duplicate id ${id}`);
  featureIds.add(id);
  const [lon, lat] = f.geometry.coordinates;
  if (lon === undefined || lat === undefined || Math.abs(lon) > 180 || Math.abs(lat) > 85) {
    errors.push(`places: ${id} has invalid coordinates`);
  }
}
const mostMentioned = places.features
  .filter((f) => f.properties.rank === 0 && !(f.properties.id in names))
  .map((f) => f.properties.name);
if (mostMentioned.length > 0)
  warnings.push(
    `places without a Russian name among the most mentioned: ${mostMentioned.join(", ")}`,
  );

const tours: TourFile[] = [];
for (const file of readdirSync(join(root, "content/tours")).filter((f) => f.endsWith(".yaml"))) {
  const result = TourFile.safeParse(load(`content/tours/${file}`));
  if (!result.success) {
    errors.push(`tours/${file}: ${result.error.message}`);
    continue;
  }
  // The id is the tour's address in links: one file, one id, the same name.
  if (`${result.data.id}.yaml` !== file)
    errors.push(`tours/${file}: id "${result.data.id}" ≠ file name`);
  if (tours.some((t) => t.id === result.data.id))
    errors.push(`tours/${file}: id "${result.data.id}" is taken`);
  result.data.stops.forEach((s, i) => {
    // The stop's passage must name its place: some verse in the range is tagged for it.
    const tagged = versesOf.get(s.place);
    if (
      tagged &&
      !refCovers(s.ref, tagged) &&
      !NAMED_BY_CONTEXT.has(`${result.data.id} ${s.place}`)
    )
      errors.push(`tours/${file}: stop ${i + 1} (${s.place}) ${s.ref} does not name the place`);
    if (!known.has(s.place)) errors.push(`tours/${file}: stop ${s.place} is not in the data build`);
    if (s.sailed && s.by !== "sea")
      errors.push(`tours/${file}: stop ${i + 1} (${s.place}) has days sailed but no "by: sea"`);
    if (i > 0 && result.data.stops[i - 1]?.place === s.place) {
      errors.push(`tours/${file}: stop ${i + 1} repeats the previous place ${s.place}`);
    }
  });
  tours.push(result.data);
}
// A tour's people are TIPNR's (people.json, from the data build): an id that is not
// there names no one.
if (existsSync(join(out, "people.json"))) {
  const ids = new Set(
    (
      JSON.parse(readFileSync(join(out, "people.json"), "utf8")) as { people: [string][] }
    ).people.map((p) => p[0]),
  );
  for (const t of tours)
    for (const id of t.people ?? [])
      if (!ids.has(id)) errors.push(`tours/${t.id}.yaml: person "${id}" is not in people.json`);
}

// Questions people ask (content/questions): pages for search, written by build-pages.ts.
const questions: QuestionFile[] = [];
const questionsDir = join(root, "content/questions");
for (const file of existsSync(questionsDir)
  ? readdirSync(questionsDir).filter((f) => f.endsWith(".yaml"))
  : []) {
  const result = QuestionFile.safeParse(load(`content/questions/${file}`));
  if (!result.success) {
    errors.push(`questions/${file}: ${result.error.message}`);
    continue;
  }
  const q = result.data;
  if (`${q.id}.yaml` !== file) errors.push(`questions/${file}: id "${q.id}" ≠ file name`);
  if (q.map?.place && !known.has(q.map.place))
    errors.push(`questions/${file}: place ${q.map.place} is not in the data build`);
  questions.push(q);
}

// Short articles about places (content/articles, ADR 0007): loaded when a card opens.
const articles: ArticleFile[] = [];
const articlesDir = join(root, "content/articles");
for (const file of existsSync(articlesDir)
  ? readdirSync(articlesDir).filter((f) => f.endsWith(".yaml"))
  : []) {
  const result = ArticleFile.safeParse(load(`content/articles/${file}`));
  if (!result.success) {
    errors.push(`articles/${file}: ${result.error.message}`);
    continue;
  }
  const a = result.data;
  if (`${a.id}.yaml` !== file) errors.push(`articles/${file}: id "${a.id}" ≠ file name`);
  if (!known.has(a.place))
    errors.push(`articles/${file}: place ${a.place} is not in the data build`);
  // On a duplicate or a record without verses the card is rarely opened: no article there.
  const props = places.features.find((f) => f.properties.id === a.place)?.properties as
    { dup?: boolean; verses?: number } | undefined;
  if (props?.dup) errors.push(`articles/${file}: place ${a.place} is a duplicate record`);
  if (props && !props.verses) errors.push(`articles/${file}: place ${a.place} has no verses`);
  if (articles.some((x) => x.place === a.place))
    errors.push(`articles/${file}: place ${a.place} already has an article`);
  if (a.status === "reviewed" && !a.reviewer)
    errors.push(`articles/${file}: a reviewed article names its reviewer`);
  for (const lang of ["en", "ru"] as const) {
    const words = a.body[lang].join(" ").split(/\s+/).length;
    if (words > 450)
      errors.push(`articles/${file}: the ${lang} text is ${String(words)} words, more than 450`);
    if (a.body[lang].some((p) => p.includes("  ")))
      errors.push(`articles/${file}: a double space in the ${lang} text`);
  }
  // Russian typography: «» quotes, a dash and not a hyphen between words. The digital
  // Synodal text sets its dashes as hyphens; quotations from it are typeset the same way.
  for (const p of a.body.ru) {
    if (p.includes(" - ")) errors.push(`articles/${file}: a hyphen for a dash in the Russian text`);
    if (p.includes('"'))
      errors.push(`articles/${file}: straight quotes in the Russian text («» there)`);
  }
  articles.push(a);
}

// The states (Cliopatria with our corrections): scripts/build-polities.ts.
buildPolities({ out, load, places, errors, writes });

// Russian forms of modern names (content/modern-names.yaml): "Tell es Sultan" →
// «Телль-эс-Султан» in the today line and the candidate sites.
const modernFile = ModernNamesFile.parse(load("content/modern-names.yaml"));
const modern: Record<string, string> = modernFile.names;
const freeLabel = modernFile.labels ?? {};
const ruOf = (id: string) => names[id]?.ru ?? modern[id];

// The same for a place's "where it is today" line ("Вавилон, в радиусе 250 км").
const whereRu: Record<string, string> = {};
for (const f of places.features) {
  const p = f.properties;
  const tpl = p.where_tpl;
  // A description in free text ("in the region north of the Dead Sea") is translated
  // whole, from the labels of content/modern-names.yaml.
  if (!tpl) {
    const ru = freeLabel[p.where];
    if (ru) whereRu[p.id] = ru;
    continue;
  }
  const ru = siteLabelRu(
    {
      label: p.where,
      tpl,
      ...(p.where_ref ? { ref: p.where_ref } : {}),
      ...(p.where_ref_text !== undefined ? { ref_text: p.where_ref_text } : {}),
      ...(p.where_n ? { n: p.where_n } : {}),
      ...(p.where_unit ? { unit: p.where_unit } : {}),
    },
    ruOf,
    names[p.id]?.ru,
  );
  if (ru) whereRu[p.id] = ru;
}

// The English today line anew where OpenBible's modern name repeats the ancient one.
const whereEn: Record<string, string> = {};
for (const f of places.features) {
  const p = f.properties;
  const en = p.where_tpl === "name" && p.where_ref ? modernFile.names_en?.[p.where_ref] : undefined;
  if (en) whereEn[p.id] = en;
}

// "Same place as Bethlehem in other verses" tells a reader nothing where it matters, beside
// two other Bethlehems: such a record takes the today line of the record it repeats, the
// one of the same name on the same point (Beit Lahm in Galilee, not the Judean town).
for (const f of places.features) {
  const p = f.properties;
  if (p.where_tpl !== "same_name") continue;
  const [x, y] = f.geometry.coordinates;
  const twin = places.features.find(
    (g) =>
      g !== f &&
      g.properties.name === p.name &&
      g.properties.where_tpl !== "same_name" &&
      g.geometry.coordinates[0] === x &&
      g.geometry.coordinates[1] === y,
  )?.properties;
  // Both languages or neither: a Russian line must not still say «там же».
  const ru = twin && whereRu[twin.id];
  if (!twin || !ru) continue;
  whereEn[p.id] = whereEn[twin.id] ?? twin.where;
  whereRu[p.id] = ru;
}

// When places existed (content/place-life.yaml).
const life: Record<string, PlaceLife> = {};
for (const p of PlaceLifeFile.parse(load("content/place-life.yaml")).places) {
  if (!known.has(p.id)) errors.push(`place-life: ${p.id} (${p.en}) is not in the data build`);
  if (p.id in life) errors.push(`place-life: ${p.id} (${p.en}) is listed twice`);
  life[p.id] = {
    ...(p.from ? { from: p.from } : {}),
    ...(p.until ? { until: p.until } : {}),
    ...(p.gap ? { gap: p.gap } : {}),
    note: p.note,
    sources: p.sources,
  };
}

// "Same place as X" (Zion for Jerusalem) shares X's years unless it has its own. A place
// "in X" (a gate, a pool of Jerusalem) shares X's ruin and end, not its founding, and the
// note says whose years they are.
Object.assign(
  life,
  inheritLife(
    places.features.map((f) => f.properties),
    { ...life },
    (id) => names[id]?.ru,
  ),
);

// Candidate sites get a Russian label where their English one refers to a place with a
// Synodal name ("same place as Abila" -> "там же, где Авила").
const sitesPath = join(out, "sites.geojson");
const sites = JSON.parse(readFileSync(sitesPath, "utf8")) as {
  features: { properties: SiteLabelParts & { place: string; label_ru?: string } }[];
};
let sitesInRussian = 0;
for (const f of sites.features) {
  delete f.properties.label_ru;
  const ru =
    siteLabelRu(f.properties, ruOf, names[f.properties.place]?.ru) ??
    (f.properties.tpl === undefined ? freeLabel[f.properties.label] : undefined);
  if (ru) {
    f.properties.label_ru = ru;
    sitesInRussian += 1;
  }
}
// A translation nothing uses any more is stale: a free-text label on no candidate site
// or today line, a modern id no place or candidate refers to (OpenBible renamed it).
const freeTexts = new Set([
  ...sites.features.filter((f) => f.properties.tpl === undefined).map((f) => f.properties.label),
  ...places.features
    .filter((f) => f.properties.where_tpl === undefined)
    .map((f) => f.properties.where),
]);
for (const label of Object.keys(freeLabel))
  if (!freeTexts.has(label)) errors.push(`modern-names: label "${label}" is used nowhere`);
const modernRefs = new Set([
  ...sites.features.map((f) => f.properties.ref),
  ...places.features.map((f) => f.properties.where_ref),
]);
for (const id of Object.keys(modern))
  if (!modernRefs.has(id)) errors.push(`modern-names: ${id} "${modern[id] ?? ""}" is used nowhere`);
writes.push([sitesPath, JSON.stringify(sites)]);

// Biblical rivers get the verified Russian name of their place (Иордан, Евфрат, …).
for (const file of ["rivers.geojson", "river-labels.geojson"]) {
  const path = join(out, file);
  const rivers = JSON.parse(readFileSync(path, "utf8")) as {
    features: { properties: { place?: string; name_ru?: string } }[];
  };
  for (const f of rivers.features) {
    const ru = f.properties.place ? names[f.properties.place]?.ru : undefined;
    if (ru) f.properties.name_ru = ru;
  }
  writes.push([path, JSON.stringify(rivers)]);
}

// Dated events on the slider (content/events.yaml), at a place or an ancient site.
const sitesById = new Map(
  existsSync("content/ancient-sites.json")
    ? AncientSitesFile.parse(
        JSON.parse(readFileSync("content/ancient-sites.json", "utf8")),
      ).sites.map((s) => [s.id, s])
    : [],
);
const events: HistoryEvent[] = [];
for (const e of EventsFile.parse(load("content/events.yaml")).events) {
  if (e.place && !known.has(e.place))
    errors.push(`events: ${e.id} points at ${e.place}, not in the data build`);
  const site = e.site === undefined ? undefined : sitesById.get(e.site);
  if (e.site !== undefined && !site)
    errors.push(`events: ${e.id} points at ancient site ${e.site}, not in ancient-sites.json`);
  if (e.site !== undefined && e.place) errors.push(`events: ${e.id} has both a place and a site`);
  if (site && (e.year.year < site.from || e.year.year > site.to))
    errors.push(`events: ${e.id} (${String(e.year.year)}) is outside ${site.en}'s years`);
  if (events.some((x) => x.id === e.id)) errors.push(`events: ${e.id} is listed twice`);
  events.push({
    id: e.id,
    year: e.year.year,
    approximate: e.year.approximate,
    title: e.title,
    ...(e.place ? { place: e.place } : {}),
    ...(site ? { site: { id: site.id, lon: site.lon, lat: site.lat, rank: site.rank } } : {}),
    ...(e.ref ? { ref: e.ref } : {}),
    sources: e.sources,
  });
}
events.sort((a, b) => a.year - b.year);

// Battles (content/battles.yaml): at a place of the data build, drawn on the map in their
// years from battles.geojson; the list goes into content.json for the cards.
const battles: HistoryBattle[] = [];
if (existsSync(join(root, "content/battles.yaml")))
  for (const b of BattlesFile.parse(load("content/battles.yaml")).battles) {
    if (!known.has(b.place))
      errors.push(`battles: ${b.id} points at ${b.place}, not in the data build`);
    if (battles.some((x) => x.id === b.id)) errors.push(`battles: ${b.id} is listed twice`);
    battles.push({
      id: b.id,
      year: b.year.year,
      approximate: b.year.approximate,
      title: b.title,
      place: b.place,
      ...(b.ref ? { ref: b.ref } : {}),
      sides: b.sides,
      outcome: b.outcome,
      sources: b.sources,
    });
  }
battles.sort((a, b) => a.year - b.year);
const pointOf = new Map(places.features.map((f) => [f.properties.id, f.geometry.coordinates]));
writes.push([
  join(out, "battles.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: battles.map((b) => ({
      type: "Feature",
      properties: {
        id: b.id,
        place: b.place,
        year: b.year,
        ...(b.approximate ? { approx: true } : {}),
        en: b.title.en,
        ru: b.title.ru,
        ...(b.ref ? { ref: b.ref } : {}),
      },
      geometry: { type: "Point", coordinates: pointOf.get(b.place) ?? [0, 0] },
    })),
  }),
]);

// A tour stop the map draws faded in its year (not yet built, in ruins, gone, or
// named only in the New Testament before its events: apps/web/src/data.ts beforeItsTime)
// is almost always a wrong year. Warned, not refused: a stop at a ruin can be meant.
const NT_FROM = -5; // 6 BC, as in apps/web/src/data.ts
const otVerses = new Map(places.features.map((f) => [f.properties.id, f.properties.ot]));
for (const t of tours) {
  for (const [i, s] of t.stops.entries()) {
    const year = s.year ?? t.year;
    const l = life[s.place];
    if (!l || (l.inherited && !l.from)) {
      if (otVerses.get(s.place) === 0 && year < NT_FROM)
        warnings.push(
          `tours/${t.id}: stop ${String(i + 1)} (${s.place}) is named only in the New Testament, before its events`,
        );
      if (!l) continue;
    }
    const state =
      l.gap && year >= l.gap.from.year && year <= l.gap.until.year
        ? "in ruins"
        : l.until && year > l.until.year
          ? "gone"
          : l.from && year < l.from.year
            ? "not yet built"
            : null;
    if (state && !FADED_ON_PURPOSE.has(`${t.id} ${s.place} ${s.ref}`))
      warnings.push(`tours/${t.id}: stop ${String(i + 1)} (${s.place}) is ${state} in its year`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
// Photos of places (content/photos.yaml): licence and place checked here, the files
// downloaded by scripts/build-photos.ts.
const photos: Record<string, PlacePhoto> = {};
{
  const result = PhotosFile.safeParse(load("content/photos.yaml"));
  if (!result.success) errors.push(`photos.yaml: ${result.error.message}`);
  else
    for (const { place, site, ...photo } of result.data.photos) {
      if (!known.has(place)) errors.push(`photos.yaml: place ${place} is not in the data build`);
      if (photos[place]) errors.push(`photos.yaml: place ${place} has two photos`);
      // CC BY asks for the author's credit; without one the photo cannot be used.
      if (photo.license.startsWith("CC BY") && !photo.author)
        errors.push(`photos.yaml: place ${place} is CC BY but names no author`);
      // A photo of a disputed place shows one candidate: the caption names it, so the
      // picture does not settle the dispute. The candidate must be one of the place's.
      const disputed = places.features.find((f) => f.properties.id === place)?.properties.disputed;
      let shows: PlacePhoto["shows"];
      if (disputed && !site)
        errors.push(`photos.yaml: place ${place} is disputed; name the site the photo shows`);
      else if (site) {
        const c = sites.features.find(
          (f) => f.properties.place === place && f.properties.ref === site,
        );
        if (!disputed) errors.push(`photos.yaml: place ${place} is not disputed; drop site`);
        else if (!c) errors.push(`photos.yaml: ${site} is not a candidate site of ${place}`);
        else shows = { en: c.properties.label, ru: c.properties.label_ru };
      }
      photos[place] = shows ? { ...photo, shows } : photo;
    }
}

// The ancient world around the Bible: places it does not name, while they stood. A site
// within 3 km of one of our places is the same place under another name: an error.
const ancientWrites: [string, string][] = [];
if (existsSync("content/ancient-sites.json")) {
  const { sites } = AncientSitesFile.parse(
    JSON.parse(readFileSync("content/ancient-sites.json", "utf8")),
  );
  // Towns only: a region's point (Egypt, Assyria) may well lie on an ancient city.
  const ours = places.features
    .filter((f) => (f.properties as { kind?: string }).kind === "settlement")
    .map((f): [string, [number, number]] => [
      f.properties.id,
      [f.geometry.coordinates[0] ?? 0, f.geometry.coordinates[1] ?? 0],
    ]);
  const km = (a: [number, number], b: [number, number]) => {
    const r = Math.PI / 180;
    const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
    return Math.hypot(x, (b[1] - a[1]) * r) * 6371;
  };
  const seen = new Set<string>();
  for (const s of sites) {
    if (seen.has(s.id)) errors.push(`ancient-sites: ${s.id} (${s.en}) is listed twice`);
    seen.add(s.id);
    if (s.from > s.to || s.from > YEAR_MAX || s.to < YEAR_MIN)
      errors.push(`ancient-sites: ${s.id} (${s.en}) years ${String(s.from)}..${String(s.to)}`);
    const near = ours.find(([, c]) => km(c, [s.lon, s.lat]) < 3);
    if (near) errors.push(`ancient-sites: ${s.id} (${s.en}) is our place ${near[0]}`);
  }
  // Sites beyond the focus mask's outer ring (the Indus, Gaul) stay in the content but
  // are not drawn: names in the greyed-out world would undo the focus.
  const shown = sites.filter((s) => inFocus(s.lon, s.lat));
  ancientWrites.push([
    join(out, "ancient.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: shown.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          en: s.en,
          ru: s.ru,
          from: s.from,
          to: s.to,
          rank: s.rank,
          kind: s.kind,
          ...(s.approx ? { approx: true } : {}),
        },
      })),
    }),
  ]);
}

// When the chapters happen: the map's year for a chapter or a person.
const chapterYears = packChapterYears(ChapterYearsFile.parse(load("content/chapter-years.yaml")), [
  YEAR_MIN,
  YEAR_MAX,
]);
errors.push(...chapterYears.errors);

// Sources in Russian (content/sources-ru.yaml): every line a reader sees, on a card or a
// page, has its Russian; a new line without one stops the build.
const sourcesRu = SourcesRuFile.parse(load("content/sources-ru.yaml"));
const seenRu = new Set<string>();
const inRussian = (where: string, list: readonly string[]): string[] =>
  list.map((s) => {
    seenRu.add(s);
    const ru = sourcesRu[s];
    if (ru === undefined)
      errors.push(`${where}: no Russian for the source "${s}" (sources-ru.yaml)`);
    return ru ?? s;
  });
const articlesOut = articles.map((a) => ({
  ...a,
  sources_ru: inRussian(`articles/${a.id}`, a.sources),
}));
const questionsOut = questions.map((q) => ({
  ...q,
  sources_ru: inRussian(`questions/${q.id}`, q.sources),
}));
for (const [id, l] of Object.entries(life))
  if (!l.inherited) life[id] = { ...l, sources_ru: inRussian(`place-life: ${id}`, l.sources) };
for (const [id, l] of Object.entries(life))
  if (l.inherited) {
    const ru = l.sources.map((s) => sourcesRu[s] ?? s);
    life[id] = { ...l, sources_ru: ru };
  }
// A translation no line uses any more is stale.
for (const s of Object.keys(sourcesRu))
  if (!seenRu.has(s)) errors.push(`sources-ru.yaml: "${s}" is no source of anything`);

// What ancient authors say of places (content/ancient-authors.yaml): loaded when a card
// opens, place id → its mentions in the file's order.
// Read and checked before the shared error check, so a bad entry stops the build; written
// with the other files after it.
const ancientByPlace: Record<string, AncientMention[]> = {};
{
  const file = join(root, "content/ancient-authors.yaml");
  if (existsSync(file)) {
    const parsed = AncientAuthorsFile.safeParse(load("content/ancient-authors.yaml"));
    if (!parsed.success) errors.push(`ancient-authors.yaml: ${parsed.error.message}`);
    else
      for (const m of parsed.data.mentions) {
        if (!known.has(m.place))
          errors.push(`ancient-authors.yaml: place ${m.place} is not in the data build`);
        (ancientByPlace[m.place] ??= []).push(m);
      }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// Tours in the order of history, not of their file names; tours set at the same
// conventional year (the judges) in the order of the Bible.
const firstRef = (t: TourFile) => canonicalPosition(t.stops[0]?.ref ?? "Gen.1.1");
tours.sort((a, b) => a.year - b.year || firstRef(a) - firstRef(b) || a.id.localeCompare(b.id));
// Pleiades ids and attested periods, matched from the gazetteer (content/pleiades.json).
const pleiadesFile = JSON.parse(readFileSync("content/pleiades.json", "utf8")) as {
  places: Record<string, PleiadesLink>;
};
const pleiades: Record<string, PleiadesLink> = {};
for (const [id, link] of Object.entries(pleiadesFile.places)) {
  // After the shared error check above: a bad record stops the build here.
  if (!known.has(id) || !/^\d+$/.test(link.id)) {
    console.error(`pleiades: ${id} is not in the data build or has a bad id "${link.id}"`);
    process.exit(1);
  }
  pleiades[id] = link;
}

const release: ContentRelease = {
  schema_version: 1,
  names,
  tours,
  where_ru: whereRu,
  where_en: whereEn,
  life,
  events,
  battles,
  articles: Object.fromEntries(articles.map((a) => [a.place, a.id])),
  photos,
  pleiades,
  chapter_years: chapterYears.table,
  // The card names a place's questions; their answers are the /q/ pages (build-pages.ts).
  questions: questions.reduce<Record<string, { id: string; en: string; ru: string }[]>>((by, q) => {
    if (q.map?.place)
      (by[q.map.place] ??= []).push({ id: q.id, en: q.question.en, ru: q.question.ru });
    return by;
  }, {}),
};
writeFileSync(join(out, "questions.json"), JSON.stringify(questionsOut));
writeFileSync(join(out, "ancient-authors.json"), JSON.stringify(ancientByPlace));
writeFileSync(
  join(out, "articles.json"),
  JSON.stringify(Object.fromEntries(articlesOut.map((a) => [a.place, a]))),
);
for (const [path, text] of [...writes, ...ancientWrites]) writeFileSync(path, text);
writeFileSync(join(out, "content.json"), JSON.stringify(release));
console.log(
  `content: ${String(Object.keys(names).length)} names, ${String(tours.length)} tours, ` +
    `${String(sitesInRussian)} of ${String(sites.features.length)} site labels in Russian`,
);
