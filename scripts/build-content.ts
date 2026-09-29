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
  TourFile,
  type ContentRelease,
} from "../packages/model/src/index.ts";

const root = join(import.meta.dirname, "..");
const out = join(root, "apps/web/public/data");

function load(path: string): unknown {
  return parse(readFileSync(join(root, path), "utf8"));
}

const places = JSON.parse(readFileSync(join(out, "places.geojson"), "utf8")) as {
  features: {
    geometry: { coordinates: number[] };
    properties: { id: string; name: string; rank: number };
  }[];
};
const known = new Set(places.features.map((f) => f.properties.id));
// Places the pipeline left out for licence reasons (ADR 0008): their names stay parked.
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as {
  excluded_places?: string[];
};
const parked = new Set(manifest.excluded_places ?? []);

// The verses OpenBible tags for each place (English numbering). Evidence must come from
// one of them: this catches Synodal verse numbers and verses about a namesake.
const openbible = join(root, "pipeline/.cache/openbible-ancient.jsonl");
const versesOf = new Map<string, Set<string>>();
if (existsSync(openbible)) {
  for (const line of readFileSync(openbible, "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line) as { id: string; verses?: { osis: string }[] };
    versesOf.set(r.id, new Set((r.verses ?? []).map((v) => v.osis)));
  }
}
/** Evidence read where the Synodal text has words the English one lacks. */
const SYNODAL_ONLY = new Set([
  // Exod 1:11 adds "и Он, иначе Илиополь" from the Septuagint.
  "acd9137 Exod.1.11",
]);

const errors: string[] = [];
const warnings: string[] = [];
// Nothing is written until every check has passed: a failed run leaves the data untouched.
const writes: [path: string, text: string][] = [];
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
    if (!known.has(s.place)) errors.push(`tours/${file}: stop ${s.place} is not in the data build`);
    if (i > 0 && result.data.stops[i - 1]?.place === s.place) {
      errors.push(`tours/${file}: stop ${i + 1} repeats the previous place ${s.place}`);
    }
  });
  tours.push(result.data);
}

// Polity labels get their Russian name; every label on the map must have one.
const polityNames = PolityNamesFile.parse(load("content/polity-names.yaml")).polities;
const labelsPath = join(out, "polity-labels.geojson");
const labels = JSON.parse(readFileSync(labelsPath, "utf8")) as {
  features: { properties: { name: string; name_ru?: string } }[];
};
const missing = new Set<string>();
for (const f of labels.features) {
  const ru = polityNames[f.properties.name];
  if (ru) f.properties.name_ru = ru;
  else missing.add(f.properties.name);
}
for (const name of missing) errors.push(`polity-names: no Russian name for "${name}"`);
writes.push([labelsPath, JSON.stringify(labels)]);

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

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const release: ContentRelease = { schema_version: 1, names, tours };
for (const [path, text] of writes) writeFileSync(path, text);
writeFileSync(join(out, "content.json"), JSON.stringify(release));
console.log(`content: ${Object.keys(names).length} names, ${tours.length} tours`);
