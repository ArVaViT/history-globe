/**
 * Validates everything in content/ against the single schema (ADR 0007) and writes
 * apps/web/public/data/content.json. Fails loudly on any invalid record, and on tour
 * stops that point at places missing from the data build.
 *
 * Usage: node scripts/build-content.ts  (after `python3 -m pipeline.build_data`)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  AncientSitesFile,
  AncientWaveCorrectionsFile,
  AncientWaveFile,
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
  type QuestionTitles,
  SourcesRuFile,
  SourcesOwnFile,
  OWN_SOURCE,
  LocaleNamesFile,
  NAME_LOCALES,
} from "../packages/model/src/content.ts";
import { LOCALES, type Locale } from "../packages/model/src/locales.ts";
import { inheritLife } from "../packages/model/src/place-life-links.ts";
import { buildPolities } from "./build-polities.ts";
import { undocumented } from "./release-doc.ts";
import { Canaries } from "./canary.ts";
import { packChapterYears } from "../packages/model/src/chapter-years.ts";
import { YEAR_MAX, YEAR_MIN } from "../packages/core/src/engine.ts";
import { distanceKm } from "../packages/model/src/distance.ts";
import { inFocus } from "../packages/core/src/style.ts";
import { canonicalPosition, refCovers } from "../packages/model/src/scripture.ts";
import { siteLabelIn, type SiteLabelParts } from "../packages/model/src/sites.ts";
import { loadAllLocaleData } from "../packages/model/src/locale-data.ts";
import { loadReviews } from "./reviews.ts";
import { readEdition, repair, SOURCES } from "./bible-text.ts";
import { checkTexts, FoldedBible, type TextRecord } from "./text-checks.ts";
import { TEXT_EXCEPTIONS } from "./text-exceptions.ts";
import {
  type Dated,
  eventBattleLinks,
  fadedState,
  fallsIn,
  lateTransfers,
  givesFigure,
  nearDistance,
  ownDistances,
  samePassageApart,
  statesDistance,
  Water,
  WATERY_KINDS,
} from "./content-checks.ts";
import { itemHash } from "./content-hash.ts";

// Every language is written here, so every language's words are loaded first.
await loadAllLocaleData();

const root = join(import.meta.dirname, "..");
const out = join(root, "apps/web/public/data");
/**
 * The build's working files, never served (apps/web/build is outside public/): the articles
 * and the questions with every language in one file, for the pages (build-pages.ts), the
 * API (build-api.ts) and the database export (export-db.ts). The app reads the articles one
 * language a file (data/articles/<language>.json, src/articles.ts): a reader fetches the
 * language shown (ADR 0015), and the whole book is not one file at a known address.
 */
const build = join(root, "apps/web/build");
mkdirSync(build, { recursive: true });

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

/**
 * The licence of the site's own texts, the articles and the questions (ADR 0016), written
 * into each of their files too: a copy carries it without the HTTP header that sends it.
 */
const NC_ND = {
  license: "CC BY-NC-ND 4.0",
  license_url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
} as const;

const errors: string[] = [];
const warnings: string[] = [];

// The repository is public and content/ is what the data is made of: it names its sources,
// never a private note a reader cannot open, and carries no "DRAFT" marker (a file not ready
// to be read stays out of it).
const PRIVATE_NOTE = /\bresearch notes? \d+|\bsession notes?\b|\bDRAFT\b/;
const contentFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? contentFiles(`${dir}/${d.name}`)
      : /\.(ya?ml|json|html|md)$/.test(d.name)
        ? [`${dir}/${d.name}`]
        : [],
  );
for (const file of contentFiles("content")) {
  const m = PRIVATE_NOTE.exec(readFileSync(join(root, file), "utf8"));
  if (m) errors.push(`${file}: «${m[0]}»: name the source itself, or leave the note out`);
}
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
  // The burning itself (2 Kgs 25:8-10), in the first year of the ruins.
  "exile a15257a 2Kgs.25.8-2Kgs.25.10",
]);

/**
 * Events, battles and questions at a place the map draws faded in their year, on purpose or
 * until the owner decides, by kind and id. An event in the very year its place falls needs no
 * entry (fallsIn).
 */
const FADED_ITEMS = new Map([
  // Fought by the springs of Paneas, where Caesarea Philippi was built two centuries later
  // (Polybius 16.18): the battle marks the field, the faded town that it was not yet built.
  ["events panium", "the town not yet built"],
  ["battles panium-200", "the town not yet built"],
  // Heraclius beat the Persians by the ruins of Nineveh (Theophanes, AM 6118).
  ["events nineveh-627", "by the ruins"],
  // Places that stood long before the New Testament names them, faded before 6 BC by the
  // rule for places only it names: place-life.yaml has no way yet to say "stood through the
  // map's years" without a founding year, which would be a guess. For the owner to decide.
  ["events sardis-taken", "awaits a way to mark a city standing through the period"],
  ["events ionian-revolt-sardis", "awaits a way to mark a city standing through the period"],
  ["events athens-burned-480", "awaits a way to mark a city standing through the period"],
  ["events pergamum-bequeathed", "awaits a way to mark a city standing through the period"],
  // Adasa is named in 1 Maccabees only, in no verse of the canon: faded by the same rule.
  ["battles adasa", "awaits a way to mark a city standing through the period"],
]);

/**
 * Events, battles, question maps and tour stops at a place whose state changes the year
 * after theirs on purpose: the event is not the transfer, or the transfer came later. By
 * kind and id (a tour stop by its number).
 */
const TRANSFER_LAG = new Map<string, string>([
  // The fall of Jerusalem is dated 587 or 586 BC. The tours of the exile and of Jeremiah and
  // the Mizpah question show the siege and the days after it at 587 BC, with the city still
  // standing (place-life.yaml); the map passes Judah to Babylon in 586 BC, the year of the
  // event jerusalem-falls and of the burning (2 Kgs 25:8).
  ["questions where-was-mizpah", "the siege year, before the fall of 586 BC"],
  ["tours exile 1", "the siege year, before the fall of 586 BC"],
  ["tours exile 2", "the siege year, before the fall of 586 BC"],
  ["tours exile 6", "the siege year, before the fall of 586 BC"],
  ["tours exile 7", "the siege year, before the fall of 586 BC"],
  ["tours jeremiah 5", "the siege year, before the fall of 586 BC"],
  ["tours jeremiah 6", "the siege year, before the fall of 586 BC"],
  ["tours jeremiah 7", "the siege year, before the fall of 586 BC"],
]);

/**
 * Items that date the same passage at the same place years apart on purpose (samePassageApart),
 * as "where where" pairs in the order of the checks (events, battles, tours, questions):
 * conventional points held two ways, or a verse cited for a name.
 */
const SAME_PASSAGE_APART = new Set([
  // The empires tour shows Ur at its height under its Third Dynasty, c. 2100 BC; the
  // patriarchs' tours and questions hold their conventional 1900 BC.
  "tours/abraham 1 tours/empires 1",
  "tours/empires 1 questions/where-was-ur-of-the-chaldees",
  // Conventional points either way: the question and the tour each hold one (taste, not a
  // date the text gives).
  "tours/abraham 11 questions/where-did-abraham-offer-isaac",
  "tours/judges 6 questions/where-did-samson-live",
  // The letters tour holds one year for all the letters; Galatians and Colossians are dated
  // apart from it in the questions, within the range held for each.
  "tours/letters 3 questions/where-was-galatia",
  "tours/letters 6 questions/where-was-colossae",
  // Acts 23:35 names Herod's praetorium, the governors' seat: Pilate's question cites it.
  "tours/paul-trials 2 questions/where-did-pilate-live",
]);

/**
 * Points drawn deeper than IN_WATER_KM inside the water on purpose, by id, with the reason.
 * Natural Earth draws today's shores at 1:10m: a submerged city, a sea battle, or an islet it
 * leaves out lies "in the sea".
 */
const IN_WATER = new Map([
  // Gen 14:3, "the vale of Siddim, which is the salt sea": the cities of the plain at
  // OpenBible's southern-basin point, disputed and shown so.
  ["a4a5cce", "Gen 14:3: the vale of Siddim, which is the salt sea"],
  ["siddim", "Gen 14:3: the battle in the vale, now the Dead Sea"],
  ["a0aa664", "the cities of the plain, under the southern Dead Sea (disputed)"],
  ["aa572e2", "the cities of the plain, under the southern Dead Sea (disputed)"],
  ["a41a054", "the cities of the plain, under the southern Dead Sea (disputed)"],
  ["abfbfb9", "the cities of the plain, under the southern Dead Sea (disputed)"],
  ["event:actium", "a sea battle"],
  ["727120", "Heracleion lies under the sea in Abu Qir Bay"],
  ["afbf1b5", "Arwad is an island Natural Earth leaves out"],
  ["854812387", "Despotiko is an islet Natural Earth leaves out"],
  ["550841", "Pordoselene is an islet of the Moschonisia Natural Earth leaves out"],
  ["599587", "Delos is an island Natural Earth leaves out"],
  ["256197", "the temple stood on the islet of Sancti Petri, off Gades"],
  ["854687", "the sea has taken part of the Taman shore where Tmutarakan stood"],
  // Wikidata's point of the Indus (OpenBible's India), at its mouth.
  ["a878481", "the Indus mouth, Wikidata's point of the river"],
  // Pleiades' point, 3 km off the Locrian shore: for the owner to check.
  ["540621", "Pleiades' point, off the shore: to check"],
]);
/** Deeper than this, a point is in the water rather than on a shore drawn at 1:10m. */
const IN_WATER_KM = 1.5;

/**
 * An ancient site on the point of a place of ours that is not a town, yet another thing
 * ("site place"): OpenBible puts a campsite or a valley of the Bible there, often as a guess.
 */
const SITE_APART = new Set([
  // The shrine of Kuntillet Ajrud; OpenBible's guess (confidence 145) puts the camps of
  // Makheloth and Kehelathah (Num 33:22-26) on it.
  "686550284 ac1fbba",
  "686550284 a32d25a",
  // Baalbek, and the valley of Aven (Amos 1:5) that OpenBible draws around it.
  "678179 a0c71dc",
  // Elusa (Haluza); OpenBible's disputed guess for Bered (Gen 16:14).
  "687890 aa3ff18",
  // The Early Bronze town of Numeira on the wadi that carries the waters of Nimrim (Isa 15:6).
  "324395699 ace3edc",
]);

/**
 * Wikipedia is never the only modern support of an article or an answer (content-guide: "one
 * to three standard modern works"): a text that cites it, or a work through it ("as cited in
 * Wikipedia", "as quoted in Wikipedia"), also cites a modern work of its own, one with a year
 * or a reference work, in a source line that does not lean on Wikipedia. These articles do
 * not yet, and wait for the works Wikipedia rests on (listed for the owner, 2026-11-19); the
 * list only shrinks.
 */
const WIKIPEDIA_ALONE = new Set([
  "straight-street", // Wikipedia only
  "mount-moriah", // Josephus; the modern topography from Wikipedia
  "gihon-eden", // Josephus; Hamblin (Smithsonian 1987) as cited in Wikipedia
  "hill-of-phinehas", // OpenBible.info and Wikipedia
  "tiphsah", // Xenophon, Arrian, Strabo; Farrell and Engels only through Wikipedia
  "trachonitis", // Strabo, Josephus; the Lajat today from Wikipedia
]);
/** A source line that leans on Wikipedia, wherever in the line it names it. */
const THROUGH_WIKIPEDIA = /\bWikipedia\b/;
const MODERN_WORK = /\b(1[5-9]\d\d|20\d\d)\b|Encyclop|Dictionary|Britannica/;
/** Whether sources that cite Wikipedia have no modern work of their own; undefined: none cite it. */
const wikipediaAlone = (sources: readonly string[]): boolean | undefined =>
  sources.some((x) => THROUGH_WIKIPEDIA.test(x))
    ? !sources.some((x) => !THROUGH_WIKIPEDIA.test(x) && MODERN_WORK.test(x))
    : undefined;

/** Evidence read where the Synodal text has words the English one lacks. */
const SYNODAL_ONLY = new Set([
  // Exod 1:11 adds "и Он, иначе Илиополь" from the Septuagint.
  "acd9137 Exod.1.11",
]);

const names: Record<string, { ru: string; osis?: string } & Partial<Record<Locale, string>>> = {};
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

// The names in the other languages (content/names-<code>.yaml), where a language has its
// file: every place with a Russian name needs one, as plain and capitalised as the Russian.
const namesIn: Partial<Record<(typeof NAME_LOCALES)[number], LocaleNamesFile>> = {};
for (const l of NAME_LOCALES) {
  if (!existsSync(join(root, `content/names-${l}.yaml`))) continue;
  const file = LocaleNamesFile.parse(load(`content/names-${l}.yaml`));
  namesIn[l] = file;
  for (const [id, n] of Object.entries(file.places)) {
    const entry = names[id];
    if (!entry) errors.push(`names-${l}: ${id} "${n}" has no Russian name (place-names.yaml)`);
    else entry[l] = n;
    if (/[()*[\]/]/.test(n)) errors.push(`names-${l}: ${id} "${n}" is not a plain name`);
    if (n.charAt(0) !== n.charAt(0).toLocaleUpperCase(l))
      errors.push(`names-${l}: ${id} "${n}" must start with a capital letter`);
  }
  for (const [id, e] of Object.entries(names))
    if (!e[l] && !parked.has(id)) errors.push(`names-${l}: no name for ${id} "${e.ru}"`);
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
/** Translators whose work is in copyright: their wording stays out of the CC BY tours. */
const PROTECTED_TRANSLATORS = /Сергеенко|Sergeenko/;
// The ancient world's sites (ADR 0018), which a tour told outside the Bible may stop at.
// A battle may be fought at one too (Gamla, Masada): their points. Only the sites the map
// draws (ancient.geojson keeps those in focus): a stop or a battle elsewhere would fly to
// nothing.
type AncientSite = {
  id: string | number;
  en: string;
  lon: number;
  lat: number;
  from: number;
  to: number;
  rank: number;
};
const ancientSites = new Map(
  readdirSync(join(root, "content"))
    .filter((f) => /^ancient-sites(-wave\d+)?\.json$/.test(f))
    .flatMap((f) => (load(`content/${f}`) as { sites: AncientSite[] }).sites)
    .filter((s) => inFocus(s.lon, s.lat))
    .map((s): [string, AncientSite] => [String(s.id), s]),
);
const ancientPoints = new Map(
  [...ancientSites].map(([id, s]): [string, [number, number]] => [id, [s.lon, s.lat]]),
);
const ancientIds = new Set(ancientSites.keys());
/** The site stands in the year, or else the map has nothing to show there. */
const standsIn = (id: string, year: number) => {
  const s = ancientSites.get(id);
  return !s || (year >= s.from && year <= s.to);
};
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
  // A translation still in copyright is not quoted in the tours, which are CC BY: M. E.
  // Sergeenko's Russian Augustine (she died in 1987) is paraphrased instead.
  if (PROTECTED_TRANSLATORS.test(JSON.stringify(result.data)))
    errors.push(
      `tours/${file}: quotes a translation in copyright (${PROTECTED_TRANSLATORS.source})`,
    );
  result.data.stops.forEach((s, i) => {
    // The stop's passage must name its place: some verse in the range is tagged for it.
    const tagged = versesOf.get(s.place);
    if (
      tagged &&
      s.ref !== undefined &&
      !refCovers(s.ref, tagged) &&
      !NAMED_BY_CONTEXT.has(`${result.data.id} ${s.place}`)
    )
      errors.push(`tours/${file}: stop ${i + 1} (${s.place}) ${s.ref} does not name the place`);
    if (!known.has(s.place) && !ancientIds.has(s.place))
      errors.push(`tours/${file}: stop ${s.place} is not in the data build`);
    // The Bible's own tours stay in it: an ancient site is a stop only where the Bible is not
    // the source.
    if (ancientIds.has(s.place) && s.ref !== undefined)
      errors.push(`tours/${file}: stop ${i + 1} (${s.place}) is an ancient site, told by a verse`);
    if (!standsIn(s.place, s.year ?? result.data.year))
      errors.push(`tours/${file}: stop ${i + 1} (${s.place}) is outside the site's years`);
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
  for (const id of q.map?.measure ?? [])
    if (!known.has(id))
      errors.push(`questions/${file}: measured place ${id} is not in the data build`);
  // The place the link opens becomes an end of the distance in the app: it must be one here.
  if (q.map?.place && q.map.measure && !q.map.measure.includes(q.map.place))
    errors.push(`questions/${file}: place ${q.map.place} is not an end of the distance measured`);
  if (wikipediaAlone(q.sources))
    errors.push(
      `questions/${file}: Wikipedia is its only modern source; cite the works it rests on`,
    );
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
  for (const lang of ["en", "ru"] as const) {
    const words = a.body[lang].join(" ").split(/\s+/).length;
    if (words > 450)
      errors.push(`articles/${file}: the ${lang} text is ${String(words)} words, more than 450`);
  }
  const alone = wikipediaAlone(a.sources);
  if (alone && !WIKIPEDIA_ALONE.has(a.id))
    errors.push(
      `articles/${file}: Wikipedia is its only modern source; cite the works it rests on`,
    );
  if (alone === false && WIKIPEDIA_ALONE.has(a.id))
    errors.push(`articles/${file}: has a modern work of its own now; take it off WIKIPEDIA_ALONE`);
  if (alone === undefined && WIKIPEDIA_ALONE.has(a.id))
    errors.push(`articles/${file}: cites no Wikipedia now; take it off WIKIPEDIA_ALONE`);
  // Every language: no double space, and a length near the English (between half and one
  // and a half times its words), or a paragraph was lost or doubled.
  const enWords = a.body.en.join(" ").split(/\s+/).length;
  for (const [lang, body] of Object.entries(a.body)) {
    if (body.some((p) => p.includes("  ")))
      errors.push(`articles/${file}: a double space in the ${lang} text`);
    const words = body.join(" ").split(/\s+/).length;
    if (words < enWords / 2 || words > enWords * 1.5)
      errors.push(
        `articles/${file}: the ${lang} text is ${String(words)} words, the English ${String(enWords)}`,
      );
  }
  // Ukrainian, Bulgarian and Serbian as the Russian below: no straight quotes, a dash and not
  // a hyphen between words. A quotation keeps its Bible's own marks (the Bulgarian Bible of
  // 1914 parts its lines with " - "), so only the text outside „…“ and «…» is read.
  for (const lang of ["uk", "bg", "sr"] as const)
    for (const p of a.body[lang] ?? []) {
      if (p.replace(/„[^“]*“|«[^»]*»/g, "").includes(" - "))
        errors.push(`articles/${file}: a hyphen for a dash in the ${lang} text`);
      if (p.includes('"')) errors.push(`articles/${file}: straight quotes in the ${lang} text`);
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
for (const id of WIKIPEDIA_ALONE)
  if (!articles.some((a) => a.id === id))
    errors.push(`WIKIPEDIA_ALONE: no article "${id}" now; take it off the list`);

// The texts of every language (ADR 0015, scripts/text-checks.ts): each speaks of its own
// Bible, an article's title names its place as the map does and no two articles bear one
// title, and a quotation of Scripture is word for word from the language's Bible, read from
// pipeline/.cache as build-verses.ts reads it.
{
  const cache = join(root, "pipeline/.cache");
  const bibles = LOCALES.every((l) => existsSync(join(cache, SOURCES[l].file)))
    ? Object.fromEntries(
        LOCALES.map((l) => [
          l,
          new FoldedBible([...readEdition(SOURCES[l], cache).values()].map((v) => repair(l, v))),
        ]),
      )
    : undefined;
  if (!bibles) warnings.push("no Bibles in pipeline/.cache: quotations are not checked");
  const records: TextRecord[] = [
    ...articles.map((a) => ({
      key: `articles/${a.id}`,
      place: a.place,
      texts: Object.fromEntries(LOCALES.map((l) => [l, [a.title[l] ?? "", ...(a.body[l] ?? [])]])),
    })),
    ...questions.map((q) => ({
      key: `questions/${q.id}`,
      texts: Object.fromEntries(
        LOCALES.map((l) => [l, [q.question[l] ?? "", ...(q.answer[l] ?? [])]]),
      ),
    })),
    ...tours.map((t) => ({
      key: `tours/${t.id}`,
      texts: Object.fromEntries(
        LOCALES.map((l) => [l, [t.title[l] ?? "", ...t.stops.map((s) => s.note[l] ?? "")]]),
      ),
    })),
  ];
  const mapName = (l: Locale, place: string) =>
    l === "en" ? nameEntries.find((p) => p.id === place)?.en : names[place]?.[l];
  errors.push(...checkTexts(records, LOCALES, mapName, TEXT_EXCEPTIONS, bibles));
}

// The states (Cliopatria with our corrections): scripts/build-polities.ts.
buildPolities({ out, from: join(root, "pipeline/.cache"), load, places, errors, writes, namesIn });

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
  const ru = siteLabelIn(
    "ru",
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

// The today line in the other languages, by the same templates (siteLabelIn): "Tell
// Balata", "within 5 km of X"; free English text from the language's own labels.
const whereIn: Partial<Record<Locale, Record<string, string>>> = {};
for (const [l, file] of Object.entries(namesIn)) {
  const nameOf = (id: string) => names[id]?.[l as Locale] ?? file.modern[id];
  const by: Record<string, string> = {};
  for (const f of places.features) {
    const p = f.properties;
    if (!p.where_tpl) {
      const own = file.labels?.[p.where];
      if (own) by[p.id] = own;
      continue;
    }
    const text = siteLabelIn(
      l,
      {
        label: p.where,
        tpl: p.where_tpl,
        ...(p.where_ref ? { ref: p.where_ref } : {}),
        ...(p.where_ref_text !== undefined ? { ref_text: p.where_ref_text } : {}),
        ...(p.where_n ? { n: p.where_n } : {}),
        ...(p.where_unit ? { unit: p.where_unit } : {}),
      },
      nameOf,
      names[p.id]?.[l as Locale],
    );
    if (text) by[p.id] = text;
  }
  whereIn[l as Locale] = by;
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
    ...(p.older ? { older: true as const } : {}),
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
    places.features.map((f) => ({ ...f.properties, point: f.geometry.coordinates })),
    { ...life },
    (id, locale) => names[id]?.[locale as Locale],
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
    siteLabelIn("ru", f.properties, ruOf, names[f.properties.place]?.ru) ??
    (f.properties.tpl === undefined ? freeLabel[f.properties.label] : undefined);
  if (ru) {
    f.properties.label_ru = ru;
    sitesInRussian += 1;
  }
  // label_uk, label_es, …: the same templates in each language with a names file.
  for (const [l, file] of Object.entries(namesIn)) {
    const key = `label_${l}`;
    Reflect.deleteProperty(f.properties, key);
    const text =
      siteLabelIn(
        l,
        f.properties,
        (id) => names[id]?.[l as Locale] ?? file.modern[id],
        names[f.properties.place]?.[l as Locale],
      ) ?? (f.properties.tpl === undefined ? file.labels?.[f.properties.label] : undefined);
    if (text) Reflect.set(f.properties, key, text);
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
for (const [l, file] of Object.entries(namesIn))
  for (const label of Object.keys(file.labels ?? {}))
    if (!freeTexts.has(label)) errors.push(`names-${l}: label "${label}" is used nowhere`);
// And every free text has its words in every language (ADR 0015): one left out had stood in
// English on Thisbe's card and under six candidate sites in 19 languages.
for (const label of freeTexts) {
  if (!freeLabel[label]) errors.push(`modern-names: no labels entry for "${label}"`);
  for (const [l, file] of Object.entries(namesIn))
    if (!file.labels?.[label]) errors.push(`names-${l}: no labels entry for "${label}"`);
}
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
    const entry = f.properties.place ? names[f.properties.place] : undefined;
    if (entry?.ru) f.properties.name_ru = entry.ru;
    // name_uk, name_es, … as the places have them.
    for (const l of NAME_LOCALES) {
      const n = entry?.[l];
      if (n) (f.properties as Record<string, string>)[`name_${l}`] = n;
    }
  }
  writes.push([path, JSON.stringify(rivers)]);
}

// Dated events on the slider (content/events.yaml), at a place or an ancient site: one
// chosen by hand or one of the waves, as long as the map draws it.
const sitesById = new Map([...ancientSites].map(([id, s]) => [id, { ...s, id }]));
const events: HistoryEvent[] = [];
for (const e of EventsFile.parse(load("content/events.yaml")).events) {
  if (e.place && !known.has(e.place))
    errors.push(`events: ${e.id} points at ${e.place}, not in the data build`);
  const site = e.site === undefined ? undefined : sitesById.get(e.site);
  if (e.site !== undefined && !site)
    errors.push(`events: ${e.id} points at ancient site ${e.site}, not on the map`);
  if (e.site !== undefined && e.place) errors.push(`events: ${e.id} has both a place and a site`);
  if (e.battlefield && (e.place || e.site !== undefined))
    errors.push(`events: ${e.id} has a battlefield and a place or a site`);
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
    ...(e.battlefield ? { battlefield: { lon: e.battlefield.lon, lat: e.battlefield.lat } } : {}),
    ...(e.ref ? { ref: e.ref } : {}),
    sources: e.sources,
  });
}
events.sort((a, b) => a.year - b.year);

// Battles (content/battles.yaml): at a place of the data build or an ancient site, drawn on
// the map in their years from battles.geojson; the list goes into content.json for the cards.
const battles: HistoryBattle[] = [];
if (existsSync(join(root, "content/battles.yaml")))
  for (const b of BattlesFile.parse(load("content/battles.yaml")).battles) {
    if (!known.has(b.place) && !ancientIds.has(b.place))
      errors.push(`battles: ${b.id} points at ${b.place}, not in the data build`);
    if (!standsIn(b.place, b.year.year))
      errors.push(`battles: ${b.id} (${String(b.year.year)}) is outside its site's years`);
    if (battles.some((x) => x.id === b.id)) errors.push(`battles: ${b.id} is listed twice`);
    battles.push({
      id: b.id,
      year: b.year.year,
      approximate: b.year.approximate,
      title: b.title,
      place: b.place,
      ...(b.event ? { event: b.event } : {}),
      ...(b.ref ? { ref: b.ref } : {}),
      sides: b.sides,
      outcome: b.outcome,
      sources: b.sources,
    });
  }
battles.sort((a, b) => a.year - b.year);
errors.push(
  ...eventBattleLinks(
    events.map((e) => ({ id: e.id, year: e.year, place: e.place, site: e.site?.id })),
    battles,
  ),
);
const pointOf = new Map(places.features.map((f) => [f.properties.id, f.geometry.coordinates]));
writes.push([
  join(out, "battles.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      ...battles.map((b) => ({
        type: "Feature",
        properties: {
          id: b.id,
          place: b.place,
          year: b.year,
          ...(b.approximate ? { approx: true } : {}),
          en: b.title.en,
          ru: b.title.ru,
          // The map's label in every language it is written in (the style falls back to English).
          ...Object.fromEntries(NAME_LOCALES.flatMap((l) => (b.title[l] ? [[l, b.title[l]]] : []))),
          ...(b.ref ? { ref: b.ref } : {}),
        },
        geometry: {
          type: "Point",
          coordinates: pointOf.get(b.place) ?? ancientPoints.get(b.place) ?? [0, 0],
        },
      })),
      // The battles of events.yaml fought at no place of the data build (Gaugamela): their
      // mark on the field, in their years, with the same name on hover; no card to open.
      ...events.flatMap((e) =>
        e.battlefield
          ? [
              {
                type: "Feature",
                properties: {
                  id: `event:${e.id}`,
                  year: e.year,
                  ...(e.approximate ? { approx: true } : {}),
                  en: e.title.en,
                  ru: e.title.ru,
                  ...Object.fromEntries(
                    NAME_LOCALES.flatMap((l) => (e.title[l] ? [[l, e.title[l]]] : [])),
                  ),
                },
                geometry: { type: "Point", coordinates: [e.battlefield.lon, e.battlefield.lat] },
              },
            ]
          : [],
      ),
    ],
  }),
]);

// A tour stop the map draws faded in its year (not yet built, in ruins, gone, or
// named only in the New Testament before its events: apps/web/src/data.ts beforeItsTime)
// is almost always a wrong year. Warned, not refused: a stop at a ruin can be meant.
const otVerses = new Map(places.features.map((f) => [f.properties.id, f.properties.ot]));
const fadedAt = (place: string, year: number) =>
  known.has(place) ? fadedState(life[place], otVerses.get(place) ?? 0, year) : null;
for (const t of tours) {
  for (const [i, s] of t.stops.entries()) {
    const state = fadedAt(s.place, s.year ?? t.year);
    if (state && !FADED_ON_PURPOSE.has(`${t.id} ${s.place} ${s.ref}`))
      warnings.push(`tours/${t.id}: stop ${String(i + 1)} (${s.place}) is ${state} in its year`);
  }
}
// An event, a battle or a question's map at a place drawn faded in its year: refused, unless
// it is the year the place falls, or listed in FADED_ITEMS with the reason.
const fadedItems: [where: string, place: string | undefined, year: number][] = [
  ...events.map((e): [string, string | undefined, number] => [`events ${e.id}`, e.place, e.year]),
  ...battles.map((b): [string, string, number] => [`battles ${b.id}`, b.place, b.year]),
  ...questions.flatMap((q): [string, string | undefined, number][] =>
    q.map?.year ? [[`questions ${q.id}`, q.map.place, q.map.year.year]] : [],
  ),
];
for (const [where, place, year] of fadedItems) {
  const state = place === undefined ? null : fadedAt(place, year);
  if (state && place !== undefined && !fallsIn(life[place], year) && !FADED_ITEMS.has(where))
    errors.push(`${where}: its place ${place} is ${state} in its year (${String(year)})`);
}
for (const where of FADED_ITEMS.keys())
  if (!fadedItems.some(([w, place, year]) => w === where && place && fadedAt(place, year)))
    errors.push(`FADED_ITEMS: ${where} is no longer drawn faded; take it out`);

// A place passes to the state that took it in the year of the event that tells it
// (content/polity-overrides.yaml, header). An event, a battle, a question's map or a tour
// stop at a place whose card names one state in its year and another the year after is a
// transfer drawn a year late: refused, unless listed in TRANSFER_LAG with the reason.
{
  const written = writes.find(([path]) => path.endsWith("rulers.json"));
  const rulers = written
    ? (JSON.parse(written[1]) as { places: Record<string, [number, number, number][]> }).places
    : {};
  const items: [where: string, place: string | undefined, year: number][] = [
    ...fadedItems,
    ...events.flatMap((e): [string, string, number][] =>
      e.site ? [[`events ${e.id}`, e.site.id, e.year]] : [],
    ),
    ...tours.flatMap((t) =>
      t.stops.map((s, i): [string, string, number] => [
        `tours ${t.id} ${String(i + 1)}`,
        s.place,
        s.year ?? t.year,
      ]),
    ),
  ];
  errors.push(...lateTransfers(items, rulers, TRANSFER_LAG));
}

// The same passage at the same place, dated years apart in two files: a tour stop at its
// tour's year where the text dates the story elsewhere. Warned, with SAME_PASSAGE_APART.
const dated: Dated[] = [
  ...events.flatMap((e): Dated[] =>
    e.ref && e.place ? [{ where: `events/${e.id}`, ref: e.ref, place: e.place, year: e.year }] : [],
  ),
  ...battles.flatMap((b): Dated[] =>
    b.ref ? [{ where: `battles/${b.id}`, ref: b.ref, place: b.place, year: b.year }] : [],
  ),
  ...tours.flatMap((t) =>
    t.stops.flatMap((s, i): Dated[] =>
      s.ref
        ? [
            {
              where: `tours/${t.id} ${String(i + 1)}`,
              ref: s.ref,
              place: s.place,
              year: s.year ?? t.year,
              tourYear: s.year === undefined,
            },
          ]
        : [],
    ),
  ),
  ...questions.flatMap((q): Dated[] =>
    q.map?.ref && q.map.place && q.map.year
      ? [{ where: `questions/${q.id}`, ref: q.map.ref, place: q.map.place, year: q.map.year.year }]
      : [],
  ),
];
const apart = samePassageApart(dated);
for (const { pair, message } of apart) if (!SAME_PASSAGE_APART.has(pair)) warnings.push(message);
for (const pair of SAME_PASSAGE_APART)
  if (!apart.some((x) => x.pair === pair))
    errors.push(`SAME_PASSAGE_APART: ${pair} no longer differ; take it out`);

// A "how far" answer states, in every language, the distance between the two points it
// measures: a point that moves later must not leave the text behind.
for (const q of questions) {
  const [from, to] = q.map?.measure ?? [];
  const a = from === undefined ? undefined : pointOf.get(from);
  const b = to === undefined ? undefined : pointOf.get(to);
  if (!a || !b) continue;
  for (const [l, ps] of Object.entries(q.answer))
    if (!statesDistance(ps.join(" "), [a[0] ?? 0, a[1] ?? 0], [b[0] ?? 0, b[1] ?? 0]))
      errors.push(
        `questions/${q.id}.yaml: the ${l} answer states no distance near the measured one`,
      );
}

// An article's distance from its own place to another (ownDistances) is the straight line
// between their points, as the answers measure it, and every language gives the same figure.
// OWN_DISTANCE_APART lists "article place" pairs whose figure is measured to another point on
// purpose, with the reason; an entry that no longer differs fails too.
const OWN_DISTANCE_APART = new Map<string, string>([
  // A lava field of some 900 km²: the figure is to its near edge, the point at its middle.
  ["trachonitis Damascus", "a region measured to its edge"],
]);
const pointsNamed = new Map<string, [number, number][]>();
for (const f of places.features) {
  const [lon, lat] = f.geometry.coordinates;
  const list = pointsNamed.get(f.properties.name) ?? [];
  if (!list.some(([x, y]) => x === lon && y === lat)) list.push([lon ?? 0, lat ?? 0]);
  pointsNamed.set(f.properties.name, list);
}
const ownApart = new Set<string>();
for (const a of articles) {
  const own = pointOf.get(a.place);
  if (!own) continue;
  const from: [number, number] = [own[0] ?? 0, own[1] ?? 0];
  a.body.en.forEach((paragraph, i) => {
    for (const { km, to } of ownDistances(a.title.en, paragraph)) {
      const there = pointsNamed.get(to);
      if (there?.length !== 1 || !there[0]) continue;
      const pair = `${a.id} ${to}`;
      if (!nearDistance(km, from, there[0])) {
        ownApart.add(pair);
        if (!OWN_DISTANCE_APART.has(pair))
          errors.push(
            `articles/${a.id}.yaml: ${String(km)} km to ${to}, but the points are ${distanceKm(from, there[0]).toFixed(1)} km apart`,
          );
      }
      for (const [l, ps] of Object.entries(a.body))
        if (!givesFigure(ps[i] ?? "", km))
          errors.push(
            `articles/${a.id}.yaml: the ${l} text does not give the ${String(km)} km to ${to}`,
          );
    }
  });
}
for (const pair of OWN_DISTANCE_APART.keys())
  if (!ownApart.has(pair))
    errors.push(`OWN_DISTANCE_APART: ${pair} no longer differs; take it out`);

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
        else
          shows = {
            en: c.properties.label,
            ru: c.properties.label_ru,
            // label_uk, label_es, …: the candidate's label in each language with a names file.
            ...Object.fromEntries(
              Object.keys(namesIn).flatMap((l) => {
                const text: unknown = Reflect.get(c.properties, `label_${l}`);
                return typeof text === "string" ? [[l, text]] : [];
              }),
            ),
          };
      }
      photos[place] = shows ? { ...photo, shows } : photo;
    }
}

// The ancient world around the Bible: places it does not name, while they stood. A site
// within 3 km of one of our places is the same place under another name: an error.
const ancientWrites: [string, string][] = [];
if (existsSync("content/ancient-sites.json")) {
  // Wikipedia articles of the sites' own Wikidata items (pipeline/ancient/fame.py), on the
  // ancient sites' ranks, one step above the places': 0 at 60 articles, 1 at 25.
  const fame = existsSync("content/fame.json")
    ? (JSON.parse(readFileSync("content/fame.json", "utf8")) as { items: Record<string, number> })
        .items
    : {};
  const rankByFame = (links: number) => (links >= 60 ? 0 : links >= 25 ? 1 : 2);
  const qidOf = (sources: readonly string[]) =>
    sources.map((u) => /wikidata\.org\/wiki\/(Q\d+)$/.exec(u)?.[1]).find(Boolean);
  // The sites chosen one by one, with their names from the names files; then the waves a
  // script chose (ADR 0018), with Wikidata's labels.
  const sites = [
    ...AncientSitesFile.parse(
      JSON.parse(readFileSync("content/ancient-sites.json", "utf8")),
    ).sites.map((s) => {
      const names: Record<string, string> = {
        ru: s.ru,
        // uk, es, …: the site's name in each language that has a names file.
        ...Object.fromEntries(
          Object.entries(namesIn).flatMap(([l, f]) => {
            const n = f.ancient?.[s.id];
            return n ? [[l, n]] : [];
          }),
        ),
      };
      return { ...s, names };
    }),
    // The waves chosen by script (pipeline/ancient), in their order.
    ...readdirSync("content")
      .filter((f) => /^ancient-sites-wave\d+\.json$/.test(f))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
      .flatMap((f) =>
        AncientWaveFile.parse(JSON.parse(readFileSync(join("content", f), "utf8"))).sites.map(
          (s) => ({ ...s, names: s.names ?? {} }),
        ),
      ),
  ];
  // A town within 3 km, or a point of another kind (a campsite, a valley, a wadi) within
  // 1 km. Not a land, a people, a sea, a river, a range or a natural area: their point may
  // well lie on an ancient city (Egypt, Assyria).
  const AREAS = new Set([
    "region",
    "people group",
    "body of water",
    "river",
    "mountain range",
    "natural area",
  ]);
  const ours = places.features
    .filter((f) => !AREAS.has((f.properties as { kind?: string }).kind ?? ""))
    .map((f): [string, [number, number], number] => [
      f.properties.id,
      [f.geometry.coordinates[0] ?? 0, f.geometry.coordinates[1] ?? 0],
      (f.properties as { kind?: string }).kind === "settlement" ? 3 : 1,
    ]);
  const seen = new Set<string>();
  for (const s of sites) {
    if (seen.has(s.id)) errors.push(`ancient-sites: ${s.id} (${s.en}) is listed twice`);
    seen.add(s.id);
    if (s.from > s.to || s.from > YEAR_MAX || s.to < YEAR_MIN)
      errors.push(`ancient-sites: ${s.id} (${s.en}) years ${String(s.from)}..${String(s.to)}`);
    const near = ours.find(
      ([id, c, within]) =>
        distanceKm(c, [s.lon, s.lat]) < within &&
        !("apart_from" in s && s.apart_from === id) &&
        !SITE_APART.has(`${s.id} ${id}`),
    );
    if (near) errors.push(`ancient-sites: ${s.id} (${s.en}) is our place ${near[0]}`);
  }
  for (const pair of SITE_APART) {
    const [sid, pid] = pair.split(" ");
    const s = sites.find((x) => x.id === sid);
    const o = ours.find(([id]) => id === pid);
    if (!s || !o || distanceKm(o[1], [s.lon, s.lat]) >= o[2])
      errors.push(`SITE_APART: ${pair} are no longer one point; take it out`);
  }
  // The corrections by hand the waves were assembled with (pipeline/ancient/assemble.py):
  // each still holds in the files, so none is stale or undone by a later edit.
  {
    const fixes = AncientWaveCorrectionsFile.parse(load("content/ancient-wave-corrections.json"));
    const ourCyrillic = JSON.parse(
      readFileSync("pipeline/ancient/names-cyrillic.json", "utf8"),
    ) as Record<string, Record<string, string>>;
    const byName = new Map(sites.map((s) => [s.en, s]));
    const site = (en: string, what: string) => {
      const s = byName.get(en);
      if (!s) errors.push(`ancient-wave-corrections: ${what} "${en}" is no ancient site`);
      return s;
    };
    for (const pattern of fixes.left_out) {
      const re = new RegExp(pattern, "i");
      for (const s of sites)
        if (re.test(s.en)) errors.push(`ancient-wave-corrections: "${s.en}" is left out`);
    }
    for (const y of fixes.years) {
      const s = site(y.site, "years of");
      if (!s) continue;
      if (s.to !== y.to || (y.from !== undefined && s.from !== y.from))
        errors.push(`ancient-wave-corrections: ${y.site} has ${String(s.from)}..${String(s.to)}`);
      if (!s.sources.some((x) => x.endsWith(`by hand: ${y.why}`)))
        errors.push(`ancient-wave-corrections: ${y.site} does not say why its years are set`);
    }
    for (const [label, en] of Object.entries(fixes.renamed)) {
      site(en, "renamed to");
      if (byName.has(label)) errors.push(`ancient-wave-corrections: "${label}" is still a name`);
    }
    for (const n of fixes.names) {
      const s = site(n.site, "a name of");
      if (s && s.names[n.lang] !== n.name)
        errors.push(`ancient-wave-corrections: ${n.site} is not "${n.name}" in ${n.lang}`);
    }
    for (const [en, langs] of Object.entries(fixes.no_names)) {
      const s = site(en, "no names of");
      // Only a name of ours (pipeline/ancient/names-cyrillic.json) stands where Wikidata's went.
      for (const l of s ? langs : [])
        if (s?.names[l] !== undefined && s.names[l] !== ourCyrillic[s.id]?.[l])
          errors.push(`ancient-wave-corrections: ${en} has Wikidata's name in ${l}`);
    }
    for (const [en, kind] of Object.entries(fixes.kinds))
      if (site(en, "the kind of")?.kind !== kind)
        errors.push(`ancient-wave-corrections: ${en} is not a ${kind}`);
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
          // ru, uk, es, …: its name in each language that has one.
          ...s.names,
          from: s.from,
          to: s.to,
          // Fame lifts a site as it lifts the Bible's towns (pipeline/build_data.py fame_rank).
          rank: Math.min(s.rank, rankByFame(fame[qidOf(s.sources) ?? ""] ?? 0)),
          kind: s.kind,
          ...(s.approx ? { approx: true } : {}),
          // Its Wikidata item, for the card's link (the id is Pleiades' where it has one).
          ...(() => {
            const qid = qidOf(s.sources);
            return qid ? { qid } : {};
          })(),
        },
      })),
    }),
  ]);
}

// A point drawn deep inside the water the map draws (water.geojson, today's shores): a
// place, an ancient site or a battlefield in the sea is a wrong point, unless it is listed
// in IN_WATER with the reason (a sunken city, a sea battle, an islet the coast leaves out).
{
  const read = (file: string) =>
    JSON.parse(readFileSync(join(out, file), "utf8")) as {
      features: { geometry: { type: string; coordinates: unknown } }[];
    };
  const rings = read("water.geojson").features.flatMap((f) =>
    (f.geometry.coordinates as [number, number][][][]).map((poly) => poly[0] ?? []),
  );
  const shores = read("coast.geojson").features.flatMap(
    (f) => f.geometry.coordinates as [number, number][][],
  );
  const water = new Water(rings, shores);
  const points: [id: string, what: string, at: [number, number]][] = [
    ...places.features
      .filter((f) => !WATERY_KINDS.has((f.properties as { kind?: string }).kind ?? ""))
      .map((f): [string, string, [number, number]] => [
        f.properties.id,
        f.properties.name,
        [f.geometry.coordinates[0] ?? 0, f.geometry.coordinates[1] ?? 0],
      ]),
    ...[...ancientSites].map(([id, a]): [string, string, [number, number]] => [
      id,
      a.en,
      [a.lon, a.lat],
    ]),
    ...battles.flatMap((b): [string, string, [number, number]][] => {
      const at = pointOf.get(b.place) ?? ancientPoints.get(b.place);
      return at ? [[b.id, b.title.en ?? b.id, [at[0] ?? 0, at[1] ?? 0]]] : [];
    }),
    ...events.flatMap((e): [string, string, [number, number]][] =>
      e.battlefield
        ? [[`event:${e.id}`, e.title.en ?? e.id, [e.battlefield.lon, e.battlefield.lat]]]
        : [],
    ),
  ];
  for (const [id, what, at] of points) {
    const depth = water.depthKm(at);
    if (depth > IN_WATER_KM && !IN_WATER.has(id))
      errors.push(`${id} (${what}) is drawn ${depth.toFixed(1)} km inside the water`);
  }
  for (const id of IN_WATER.keys())
    if (!points.some(([p, , at]) => p === id && water.depthKm(at) > IN_WATER_KM))
      errors.push(`IN_WATER: ${id} is no longer in the water; take it out`);
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
// The site's own lines among the sources (content/sources-own.yaml), in every language but
// English and Russian: a page in German reads "History-Globe-Tour „Salomo“", not the English
// line; the bibliography beside them stays as published. An own line without all of its
// languages stops the build, like a line without its Russian.
const sourcesOwn = SourcesOwnFile.parse(load("content/sources-own.yaml"));
const OWN_IN = LOCALES.filter((l) => l !== "en" && l !== "ru");
const seenOwn = new Set<string>();
const ownInEach = (
  where: string,
  list: readonly string[],
): Partial<Record<Locale, string[]>> | undefined => {
  if (!list.some((s) => OWN_SOURCE.test(s))) return undefined;
  return Object.fromEntries(
    OWN_IN.map((l) => [
      l,
      list.map((s) => {
        if (!OWN_SOURCE.test(s)) return s;
        seenOwn.add(s);
        const t = sourcesOwn[s]?.[l];
        if (t === undefined)
          errors.push(`${where}: no ${l} for the site's own source "${s}" (sources-own.yaml)`);
        return t ?? s;
      }),
    ]),
  );
};
// The marks a copy can be told by (scripts/canary.ts): none without HG_CANARY_SEED.
const canaries = new Canaries();
const inEachLanguage = (file: (l: string) => string, id: string, texts: Record<string, string[]>) =>
  Object.fromEntries(
    Object.entries(texts).map(([l, ps]) => [l, canaries.text(file(l), id, l, ps)]),
  );
// Reviews by scholars (content/reviews): each against the items it covers, and whether
// their English text has changed since the version read.
const reviewed = loadReviews(join(root, "content/reviews"), {
  article: new Map(articles.map((a) => [a.id, itemHash({ kind: "article", ...a })])),
  question: new Map(questions.map((q) => [q.id, itemHash({ kind: "question", ...q })])),
  tour: new Map(tours.map((t) => [t.id, itemHash({ kind: "tour", ...t })])),
});
errors.push(...reviewed.errors);
const reviewsOf = (kind: "article" | "question", id: string) => {
  const list = reviewed.byItem.get(`${kind}:${id}`);
  return list ? { reviews: list } : {};
};

const articlesOut = articles.map((a) => ({
  ...a,
  body: inEachLanguage((l) => `data/articles/${l}.json`, a.place, a.body),
  sources_ru: inRussian(`articles/${a.id}`, a.sources),
  ...((x) => (x ? { sources_in: x } : {}))(ownInEach(`articles/${a.id}`, a.sources)),
  ...reviewsOf("article", a.id),
}));
const questionsOut = questions.map((q) => ({
  ...q,
  answer: inEachLanguage(() => "api/v1/questions.json", q.id, q.answer),
  sources_ru: inRussian(`questions/${q.id}`, q.sources),
  ...((x) => (x ? { sources_in: x } : {}))(ownInEach(`questions/${q.id}`, q.sources)),
  ...reviewsOf("question", q.id),
}));
for (const [id, l] of Object.entries(life))
  if (!l.inherited) {
    const own = ownInEach(`place-life: ${id}`, l.sources);
    life[id] = {
      ...l,
      sources_ru: inRussian(`place-life: ${id}`, l.sources),
      ...(own ? { sources_in: own } : {}),
    };
  }
for (const [id, l] of Object.entries(life))
  if (l.inherited) {
    const ru = l.sources.map((s) => sourcesRu[s] ?? s);
    // The site's own lines in each language too, as the entry inherited from has them.
    const own = l.sources.some((s) => OWN_SOURCE.test(s))
      ? Object.fromEntries(
          OWN_IN.map((lang) => [
            lang,
            l.sources.map((s) => (OWN_SOURCE.test(s) ? (sourcesOwn[s]?.[lang] ?? s) : s)),
          ]),
        )
      : undefined;
    life[id] = { ...l, sources_ru: ru, ...(own ? { sources_in: own } : {}) };
  }
// A translation no line uses any more is stale.
for (const s of Object.keys(sourcesRu))
  if (!seenRu.has(s)) errors.push(`sources-ru.yaml: "${s}" is no source of anything`);
for (const s of Object.keys(sourcesOwn))
  if (!seenOwn.has(s)) errors.push(`sources-own.yaml: "${s}" is no source of anything`);

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

// Each language in its own script and its own quotation marks (ADR 0015): no Cyrillic in a
// language written in Latin letters, and no «» in English, which quotes with “”. The texts
// listed quote the Synodal text's own form of a name in every language (zaphon-gad:
// «перешли в Севину»; Харран and Аран); whether readers of other languages keep that note is
// the owner's call (round-2 audit of the pages, 2026-11), so until then they pass by name.
const SYNODAL_FORM_QUOTED = new Set([
  "articles/arabah",
  "articles/cush",
  "articles/gibbethon",
  "articles/javan",
  "articles/kain",
  "articles/zaphon-gad",
  "questions/where-was-haran",
]);
const CYRILLIC_LOCALES: ReadonlySet<string> = new Set(["ru", "uk", "sr", "bg"]);
const scriptOf = (
  where: string,
  texts: Readonly<Partial<Record<string, string | readonly string[]>>>,
) => {
  for (const l of LOCALES) {
    const text = [texts[l] ?? []].flat().join(" ");
    if (
      !CYRILLIC_LOCALES.has(l) &&
      !SYNODAL_FORM_QUOTED.has(where) &&
      /\p{Script=Cyrillic}/u.test(text)
    )
      errors.push(`${where}: Cyrillic in the ${l} text`);
    if (l === "en" && /[«»]/.test(text)) errors.push(`${where}: «» in the English text (“…”)`);
  }
};
for (const a of articles) {
  scriptOf(`articles/${a.id}`, a.title);
  scriptOf(`articles/${a.id}`, a.body);
}
for (const q of questions) {
  scriptOf(`questions/${q.id}`, q.question);
  scriptOf(`questions/${q.id}`, q.answer);
}
for (const t of tours) {
  scriptOf(`tours/${t.id}`, t.title);
  t.stops.forEach((s, i) => {
    scriptOf(`tours/${t.id} stop ${String(i + 1)}`, s.note);
  });
}
for (const [place, ms] of Object.entries(ancientByPlace))
  for (const m of ms) scriptOf(`ancient-authors.yaml: ${place} ${m.author.en}`, m.note);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// Tours in the order of history, not of their file names; tours set at the same
// conventional year (the judges) in the order of the Bible.
const firstRef = (t: TourFile) =>
  canonicalPosition(t.stops.find((s) => s.ref !== undefined)?.ref ?? "Rev.22.21");
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
  names: Object.fromEntries(
    Object.entries(names).map(([id, n]) => [id, canaries.keys("data/content.json", id, n)]),
  ),
  tours,
  where_ru: whereRu,
  where_en: whereEn,
  where_in: whereIn,
  life,
  events,
  battles,
  articles: Object.fromEntries(articles.map((a) => [a.place, a.id])),
  photos,
  pleiades,
  chapter_years: chapterYears.table,
};
// Every field of content.json and of the articles is described for their readers.
const unnamed = [
  ...undocumented("content.json", Object.keys(release)),
  ...undocumented(
    "articles/<lang>.json",
    articlesOut.flatMap((a) => Object.keys(a)),
  ),
];
if (unnamed.length > 0) {
  console.error(unnamed.join("\n"));
  process.exit(1);
}
writeFileSync(join(build, "questions.json"), JSON.stringify(questionsOut));
// The reviews for their pages (build-pages.ts); none written when there are none.
if (reviewed.reviews.length > 0)
  writeFileSync(join(build, "reviews.json"), JSON.stringify(reviewed.reviews));
else rmSync(join(build, "reviews.json"), { force: true });
writeFileSync(join(out, "ancient-authors.json"), JSON.stringify(ancientByPlace));
writeFileSync(
  join(build, "articles.json"),
  JSON.stringify(Object.fromEntries(articlesOut.map((a) => [a.place, a]))),
);
// One language a file for the app: the article's title and body in that language, or in
// English where the language has none (the card falls back to English as before); the
// Russian source lines only with the Russian.
const inLanguage = <T>(texts: Readonly<Record<string, T>>, l: Locale): Record<string, T> =>
  texts[l] === undefined ? { en: texts.en as T } : { [l]: texts[l] };
rmSync(join(out, "articles"), { recursive: true, force: true });
mkdirSync(join(out, "articles"));
for (const l of LOCALES)
  writeFileSync(
    join(out, "articles", `${l}.json`),
    JSON.stringify(
      Object.fromEntries(
        articlesOut.map(({ sources_ru, sources_in, ...a }) => [
          a.place,
          {
            ...a,
            ...NC_ND,
            title: inLanguage(a.title, l),
            body: inLanguage(a.body, l),
            ...(l === "ru" ? { sources_ru } : {}),
            ...(sources_in?.[l] ? { sources_in: { [l]: sources_in[l] } } : {}),
          },
        ]),
      ),
    ),
  );
// The card names a place's questions; their answers are the /q/ pages (build-pages.ts).
// The questions are the site's own texts under CC BY-NC-ND (ADR 0016), as the articles are:
// one language a file beside them, never in content.json, which is CC BY.
mkdirSync(join(out, "articles", "questions"));
for (const l of LOCALES) {
  const titles: QuestionTitles = {
    ...NC_ND,
    questions: questions.reduce<Record<string, { id: string }[]>>((by, q) => {
      if (q.map?.place) (by[q.map.place] ??= []).push({ id: q.id, ...inLanguage(q.question, l) });
      return by;
    }, {}),
  };
  writeFileSync(join(out, "articles", "questions", `${l}.json`), JSON.stringify(titles));
}
// Written to the data by earlier builds, whole: not served any more.
for (const name of [
  "articles.json",
  "questions.json",
  "polities-late.geojson",
  "polity-labels-late.geojson",
])
  rmSync(join(out, name), { force: true });
// The people's names in the other languages go into people.json (pipeline/people), beside
// the Russian slot: names.<code>.<TIPNR id>.
const peoplePath = join(out, "people.json");
if (existsSync(peoplePath)) {
  const people = JSON.parse(readFileSync(peoplePath, "utf8")) as {
    people: [string, ...unknown[]][];
    names?: Record<string, Record<string, string>>;
  };
  const ids = new Set(people.people.map(([id]) => id));
  people.names = {};
  for (const [l, file] of Object.entries(namesIn)) {
    // Only the people the site shows: the file may name more (the whole TIPNR list).
    people.names[l] = Object.fromEntries(Object.entries(file.people).filter(([id]) => ids.has(id)));
  }
  writes.push([peoplePath, JSON.stringify(people)]);
}
for (const [path, text] of [...writes, ...ancientWrites]) writeFileSync(path, text);
writeFileSync(join(out, "content.json"), JSON.stringify(release));
canaries.report("content");
console.log(
  `content: ${String(Object.keys(names).length)} names, ${String(tours.length)} tours, ` +
    `${String(sitesInRussian)} of ${String(sites.features.length)} site labels in Russian`,
);
