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
  PlaceNamesFile,
  PolityNamesFile,
  PolityOverridesFile,
  PlaceLifeFile,
  EventsFile,
  type HistoryEvent,
  type PlaceLife,
  TourFile,
  type ContentRelease,
} from "../packages/model/src/content.ts";
import { refCovers } from "../packages/model/src/scripture.ts";
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
    if (i > 0 && result.data.stops[i - 1]?.place === s.place) {
      errors.push(`tours/${file}: stop ${i + 1} repeats the previous place ${s.place}`);
    }
  });
  tours.push(result.data);
}

// Our corrections to Cliopatria (content/polity-overrides.yaml): a polity's last shape and
// labels are copied forward to its real end. Idempotent: earlier copies are dropped first.
type PolityFeature = {
  geometry: unknown;
  properties: { name: string; y0: number; y1: number; rel?: boolean; src?: string };
};
const polityPath = join(out, "polities.geojson");
const polities = JSON.parse(readFileSync(polityPath, "utf8")) as { features: PolityFeature[] };
const polityLabels = JSON.parse(readFileSync(join(out, "polity-labels.geojson"), "utf8")) as {
  features: PolityFeature[];
};
polities.features = polities.features.filter((f) => f.properties.src !== "override");
polityLabels.features = polityLabels.features.filter((f) => f.properties.src !== "override");
for (const o of PolityOverridesFile.parse(load("content/polity-overrides.yaml")).overrides) {
  const own = polities.features.filter((f) => f.properties.name === o.polity && !f.properties.rel);
  if (own.length === 0) {
    errors.push(`polity-overrides: "${o.polity}" is not in the data build`);
    continue;
  }
  const end = Math.max(...own.map((f) => f.properties.y1));
  const until = o.last_year + 1; // half-open, ADR 0003
  if (until <= end) {
    errors.push(`polity-overrides: "${o.polity}" already lasts to ${String(end - 1)}`);
    continue;
  }
  const extend = (f: PolityFeature): PolityFeature => ({
    ...f,
    properties: { ...f.properties, y0: end, y1: until, src: "override" },
  });
  polities.features.push(...own.filter((f) => f.properties.y1 === end).map(extend));
  polityLabels.features.push(
    ...polityLabels.features
      .filter((f) => f.properties.name === o.polity && f.properties.y1 === end)
      .map(extend),
  );
}

// Polity labels get their Russian name; every label on the map must have one.
const polityNames = PolityNamesFile.parse(load("content/polity-names.yaml")).polities;
const labelsPath = join(out, "polity-labels.geojson");
const labels = polityLabels as { features: { properties: { name: string; name_ru?: string } }[] };
const missing = new Set<string>();
for (const f of labels.features) {
  const ru = polityNames[f.properties.name];
  if (ru) f.properties.name_ru = ru;
  else missing.add(f.properties.name);
}
for (const name of missing) errors.push(`polity-names: no Russian name for "${name}"`);
// The shapes carry the name too: the map names a territory under the pointer.
for (const f of polities.features as { properties: { name: string; name_ru?: string } }[]) {
  const ru = polityNames[f.properties.name];
  if (ru) f.properties.name_ru = ru;
}
writes.push([polityPath, JSON.stringify(polities)]);
writes.push([labelsPath, JSON.stringify(labels)]);

// The same for a place's "where it is today" line ("Вавилон, в радиусе 250 км").
const whereRu: Record<string, string> = {};
for (const f of places.features) {
  const p = f.properties;
  const tpl = p.where_tpl;
  if (!tpl) continue;
  const ru = siteLabelRu(
    {
      label: p.where,
      tpl,
      ...(p.where_ref ? { ref: p.where_ref } : {}),
      ...(p.where_ref_text !== undefined ? { ref_text: p.where_ref_text } : {}),
      ...(p.where_n ? { n: p.where_n } : {}),
      ...(p.where_unit ? { unit: p.where_unit } : {}),
    },
    (id) => names[id]?.ru,
    names[p.id]?.ru,
  );
  if (ru) whereRu[p.id] = ru;
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
const englishName = new Map(places.features.map((f) => [f.properties.id, f.properties.name]));
const placeProps = new Map(places.features.map((f) => [f.properties.id, f.properties]));
// Only the entries of place-life.yaml: links resolve to a town with its own years, so a
// gate of Millo of Jerusalem reads "Иерусалим: …" once, whatever the order of the data.
const ownLife: Readonly<Record<string, PlaceLife>> = { ...life };
function townOf(id: string): { id: string; same: boolean } | undefined {
  let at = placeProps.get(id);
  let same = true;
  for (let hops = 0; at?.where_ref && hops < 5; hops++) {
    if (at.where_tpl !== "same" && at.where_tpl !== "at") return undefined;
    same &&= at.where_tpl === "same";
    if (ownLife[at.where_ref]) return { id: at.where_ref, same };
    at = placeProps.get(at.where_ref);
  }
  return undefined;
}
for (const f of places.features) {
  const p = f.properties;
  if (ownLife[p.id]) continue;
  const town = townOf(p.id);
  const of = town ? ownLife[town.id] : undefined;
  if (!town || !of) continue;
  const ruName = names[town.id]?.ru ?? englishName.get(town.id) ?? "";
  const enName = englishName.get(town.id) ?? "";
  const withTown = { en: `${enName}: ${of.note.en ?? ""}`, ru: `${ruName}: ${of.note.ru ?? ""}` };
  // Another name of the town: its ruin and end, not its founding (Shamir of Judg 10:1,
  // which OpenBible places at Samaria, stood before Omri built Samaria), and the note
  // says whose years they are when the name differs ("Вавилон" of 1 Pet 5:13 is Rome).
  if (town.same) {
    if (!of.gap && !of.until) continue;
    life[p.id] = {
      ...(of.until ? { until: of.until } : {}),
      ...(of.gap ? { gap: of.gap } : {}),
      note: (names[p.id]?.ru ?? p.name) === ruName ? of.note : withTown,
      sources: of.sources,
      inherited: true,
    };
  } else if (of.gap ?? of.until) {
    life[p.id] = {
      ...(of.until ? { until: of.until } : {}),
      ...(of.gap ? { gap: of.gap } : {}),
      note: withTown,
      sources: of.sources,
      inherited: true,
    };
  }
}

// Candidate sites get a Russian label where their English one refers to a place with a
// Synodal name ("same place as Abila" -> "то же место, что Авила").
const sitesPath = join(out, "sites.geojson");
const sites = JSON.parse(readFileSync(sitesPath, "utf8")) as {
  features: { properties: SiteLabelParts & { place: string; label_ru?: string } }[];
};
let sitesInRussian = 0;
for (const f of sites.features) {
  delete f.properties.label_ru;
  const ru = siteLabelRu(f.properties, (id) => names[id]?.ru, names[f.properties.place]?.ru);
  if (ru) {
    f.properties.label_ru = ru;
    sitesInRussian += 1;
  }
}
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

// Dated events on the slider (content/events.yaml).
const events: HistoryEvent[] = [];
for (const e of EventsFile.parse(load("content/events.yaml")).events) {
  if (e.place && !known.has(e.place))
    errors.push(`events: ${e.id} points at ${e.place}, not in the data build`);
  if (events.some((x) => x.id === e.id)) errors.push(`events: ${e.id} is listed twice`);
  events.push({
    id: e.id,
    year: e.year.year,
    approximate: e.year.approximate,
    title: e.title,
    ...(e.place ? { place: e.place } : {}),
    sources: e.sources,
  });
}
events.sort((a, b) => a.year - b.year);

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
    if (state)
      warnings.push(`tours/${t.id}: stop ${String(i + 1)} (${s.place}) is ${state} in its year`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// Tours in the order of history, not of their file names.
tours.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
const release: ContentRelease = {
  schema_version: 1,
  names,
  tours,
  where_ru: whereRu,
  life,
  events,
};
for (const [path, text] of writes) writeFileSync(path, text);
writeFileSync(join(out, "content.json"), JSON.stringify(release));
console.log(
  `content: ${String(Object.keys(names).length)} names, ${String(tours.length)} tours, ` +
    `${String(sitesInRussian)} of ${String(sites.features.length)} site labels in Russian`,
);
