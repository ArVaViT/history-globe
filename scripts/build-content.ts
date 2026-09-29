/**
 * Validates everything in content/ against the single schema (ADR 0007) and writes
 * apps/web/public/data/content.json. Fails loudly on any invalid record, and on tour
 * stops that point at places missing from the data build.
 *
 * Usage: node scripts/build-content.ts  (after `python3 pipeline/build_data.py`)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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

const errors: string[] = [];
const warnings: string[] = [];
const names: Record<string, { ru: string }> = {};
const nameEntries = PlaceNamesFile.parse(load("content/place-names.yaml")).places;
const seenIds = new Set<string>();
for (const p of nameEntries) {
  if (seenIds.has(p.id)) errors.push(`place-names: ${p.id} (${p.en}) is listed twice`);
  seenIds.add(p.id);
  if (!known.has(p.id)) errors.push(`place-names: ${p.id} (${p.en}) is not in the data build`);
  // The evidence must actually contain the name: compare the first three letters of the
  // last word, which survive Russian case endings (Вифлеем → в Вифлееме).
  if (p.evidence) {
    const stem = (p.ru.split(/\s+/).at(-1) ?? "").slice(0, 3).toLocaleLowerCase("ru");
    if (!p.evidence.excerpt.toLocaleLowerCase("ru").includes(stem)) {
      errors.push(
        `place-names: ${p.id} "${p.ru}" is not found in its evidence "${p.evidence.excerpt}"`,
      );
    }
  }
  names[p.id] = { ru: p.ru };
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
writeFileSync(labelsPath, JSON.stringify(labels));

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const release: ContentRelease = { schema_version: 1, names, tours };
writeFileSync(join(out, "content.json"), JSON.stringify(release));
console.log(`content: ${Object.keys(names).length} names, ${tours.length} tours`);
