/**
 * content/wikidata.json: each place's Wikidata item, as OpenBible links it (ancient.jsonl,
 * `linked_data`, source "wikidata"). Only a plain link counts: OpenBible marks some links
 * "not" (the item is a different place: Adamah, New Gate) or "modern" (the item is today's
 * town on the site: Konya for Iconium), and those are not the ancient place. Used for
 * `sameAs` in the place pages' structured data and `wikidata` in api/v1/places.json.
 * Wikidata ids are CC0; OpenBible's linking is CC BY 4.0 (credited in the API index).
 *
 * Usage: node scripts/wikidata-links.ts  (after `pnpm data` has fetched OpenBible)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const WIKIDATA = "s7cc8b2"; // OpenBible's source id for Wikidata (data/source.jsonl)

interface Record {
  id: string;
  linked_data?: { [source: string]: { id?: string; modifier?: string } };
}
const places: { [id: string]: string } = {};
for (const line of readFileSync(join(root, "pipeline/.cache/openbible-ancient.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)) {
  const r = JSON.parse(line) as Record;
  const link = r.linked_data?.[WIKIDATA];
  if (link?.id && /^Q\d+$/.test(link.id) && !link.modifier) places[r.id] = link.id;
}
const sorted = Object.fromEntries(Object.entries(places).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  join(root, "content/wikidata.json"),
  `${JSON.stringify(
    {
      _source:
        "Wikidata items (CC0) of OpenBible.info's ancient places, as OpenBible links them (Bible Geocoding Data, CC BY 4.0); links marked 'not' or 'modern' left out. Written by scripts/wikidata-links.ts.",
      places: sorted,
    },
    null,
    2,
  )}\n`,
);
console.log(`wikidata: ${String(Object.keys(sorted).length)} places`);
