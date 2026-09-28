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
import { PlaceNamesFile, TourFile, type ContentRelease } from "../packages/model/src/index.ts";

const root = join(import.meta.dirname, "..");
const out = join(root, "apps/web/public/data");

function load(path: string): unknown {
  return parse(readFileSync(join(root, path), "utf8"));
}

const places = JSON.parse(readFileSync(join(out, "places.geojson"), "utf8")) as {
  features: { properties: { id: string } }[];
};
const known = new Set(places.features.map((f) => f.properties.id));

const errors: string[] = [];
const names: Record<string, { ru: string }> = {};
for (const p of PlaceNamesFile.parse(load("content/place-names.yaml")).places) {
  if (!known.has(p.id)) errors.push(`place-names: ${p.id} (${p.en}) is not in the data build`);
  names[p.id] = { ru: p.ru };
}

const tours: TourFile[] = [];
for (const file of readdirSync(join(root, "content/tours")).filter((f) => f.endsWith(".yaml"))) {
  const result = TourFile.safeParse(load(`content/tours/${file}`));
  if (!result.success) {
    errors.push(`tours/${file}: ${result.error.message}`);
    continue;
  }
  for (const s of result.data.stops) {
    if (!known.has(s.place)) errors.push(`tours/${file}: stop ${s.place} is not in the data build`);
  }
  tours.push(result.data);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const release: ContentRelease = { schema_version: 1, names, tours };
writeFileSync(join(out, "content.json"), JSON.stringify(release));
console.log(`content: ${Object.keys(names).length} names, ${tours.length} tours`);
