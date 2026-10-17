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

/**
 * Links checked against Wikidata on 2026-10-17 (docs/crosswalk/their-errors.md). Left out: the
 * item is a disambiguation page, or another place (Madmenah of Isaiah 10:31 linked to
 * Madmannah of Joshua 15:31). Followed: items since merged into another (a redirect).
 */
const NOT_THE_PLACE: Readonly<Partial<Record<string, string>>> = {
  a67297a: "Q6728293 is Madmannah (Josh 15:31), not Madmenah (Isa 10:31)",
  ad4ad26: "Q4716077 is a disambiguation page",
  ad68510: "Q5397937 is a disambiguation page",
  a9ef72b: "Q61862532 is a disambiguation page",
  ad27541: "Q412380 is a disambiguation page",
  af0ac29: "Q3721153 redirects to Q1303899, a disambiguation page",
};
const MERGED: Readonly<Partial<Record<string, string>>> = {
  Q54991090: "Q1323297",
  Q28220401: "Q6573228",
  Q4832126: "Q7217851",
  Q60790206: "Q25492503",
  Q5207462: "Q20502682",
  Q27627879: "Q18500022",
  Q1488020: "Q591994",
  Q96379011: "Q56322109",
  Q25493256: "Q11298139",
  Q6373489: "Q117704182",
  Q65086594: "Q1742404",
  Q48968605: "Q11944059",
  Q12971071: "Q1651088",
};

interface AncientRecord {
  id: string;
  linked_data?: { [source: string]: { id?: string; modifier?: string } };
}
const places: { [id: string]: string } = {};
for (const line of readFileSync(join(root, "pipeline/.cache/openbible-ancient.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)) {
  const r = JSON.parse(line) as AncientRecord;
  const link = r.linked_data?.[WIKIDATA];
  if (link?.id && /^Q\d+$/.test(link.id) && !link.modifier && !NOT_THE_PLACE[r.id])
    places[r.id] = MERGED[link.id] ?? link.id;
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
