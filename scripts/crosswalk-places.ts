/**
 * docs/crosswalk/places.csv: refresh our side of the crosswalk from the current build.
 *
 * Our columns (name, kind, point, Wikidata, Pleiades and TIPNR ids) come from
 * apps/web/public/api/v1/places.json; OpenBible's own links (openbible_wikidata,
 * openbible_pleiades, openbible_tipnr) from pipeline/.cache/openbible-ancient.jsonl. The
 * Theographic columns stay as the match of 2026-10-17 left them: Theographic Bible Metadata is
 * CC BY-SA 4.0 (ADR 0008), so only its record ids are kept here and its coordinates are never
 * in the repository. `theographic_km` is recomputed only when the Theographic places file is
 * given, from a copy outside the repository: --theographic <path to json/places.json>.
 * Without it the distance keeps its last value, which is stale for a place whose point moved.
 *
 * Usage: node scripts/crosswalk-places.ts [--theographic <path>]  (after `pnpm content`)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const CSV = join(root, "docs/crosswalk/places.csv");
const SOURCES = { wikidata: "s7cc8b2", pleiades: "s2428ed", tipnr: "s3b25cf" } as const;
const COLUMNS = [
  "id",
  "name",
  "kind",
  "lon",
  "lat",
  "openbible_url",
  "wikidata",
  "pleiades",
  "tipnr",
  "theographic_id",
  "theographic_lookup",
  "theographic_canonical",
  "theographic_same_place_records",
  "theographic_km",
  "match_method",
  "confidence",
  "openbible_wikidata",
  "openbible_pleiades",
  "openbible_tipnr",
] as const;
type Row = Record<(typeof COLUMNS)[number], string>;

const theographicPath = (() => {
  const i = process.argv.indexOf("--theographic");
  return i === -1 ? null : process.argv[i + 1];
})();

/** A CSV line → fields (RFC 4180 quoting, as the file was written). */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? "";
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}
const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

const [header = "", ...lines] = readFileSync(CSV, "utf8").split("\n").filter(Boolean);
const oldColumns = parseLine(header);
const old = new Map(
  lines.map((l) => {
    const f = parseLine(l);
    const row = Object.fromEntries(oldColumns.map((c, i) => [c, f[i] ?? ""])) as Row;
    return [row.id, row];
  }),
);

interface ApiPlace {
  id: string;
  name: string;
  kind: string;
  lon: number;
  lat: number;
  wikidata?: string;
  pleiades?: string;
  tipnr?: string;
}
const places = JSON.parse(
  readFileSync(join(root, "apps/web/public/api/v1/places.json"), "utf8"),
) as ApiPlace[];

interface AncientRecord {
  id: string;
  linked_data?: { [source: string]: { id?: string; modifier?: string } };
}
const links = new Map<string, Record<keyof typeof SOURCES, string>>();
for (const line of readFileSync(join(root, "pipeline/.cache/openbible-ancient.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)) {
  const r = JSON.parse(line) as AncientRecord;
  const of = (key: keyof typeof SOURCES) => {
    const link = r.linked_data?.[SOURCES[key]];
    // A link OpenBible marks "not" (another place) or "modern" keeps the mark, as the
    // 2026-10-17 file had it: Q2605670[not].
    return link?.id ? (link.modifier ? `${link.id}[${link.modifier}]` : link.id) : "";
  };
  links.set(r.id, { wikidata: of("wikidata"), pleiades: of("pleiades"), tipnr: of("tipnr") });
}

// Theographic points, read from a file outside the repository, for the distance only.
const theographic = new Map<string, [number, number]>();
if (theographicPath) {
  const records = JSON.parse(readFileSync(theographicPath, "utf8")) as {
    id: string;
    fields: { latitude?: string; longitude?: string };
  }[];
  for (const r of records) {
    const lon = Number(r.fields.longitude);
    const lat = Number(r.fields.latitude);
    if (r.fields.longitude && r.fields.latitude && Number.isFinite(lon) && Number.isFinite(lat))
      theographic.set(r.id, [lon, lat]);
  }
}
const km = ([lo1, la1]: [number, number], [lo2, la2]: [number, number]) => {
  const p = Math.PI / 180;
  const h =
    Math.sin(((la2 - la1) * p) / 2) ** 2 +
    Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(((lo2 - lo1) * p) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const rows: Row[] = [];
let added = 0;
let distances = 0;
const byId = new Map(places.map((p) => [p.id, p]));
const order = [...old.keys()].filter((id) => byId.has(id));
const fresh = places
  .filter((p) => !old.has(p.id))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((p) => p.id);
for (const id of [...order, ...fresh]) {
  const p = byId.get(id);
  if (!p) continue;
  const was = old.get(id);
  if (!was) added += 1;
  const link = links.get(id) ?? { wikidata: "", pleiades: "", tipnr: "" };
  let theographicKm = was?.theographic_km ?? "";
  const theirs = was?.theographic_id ? theographic.get(was.theographic_id) : undefined;
  if (theirs) {
    theographicKm = km([p.lon, p.lat], theirs).toFixed(1);
    distances += 1;
  }
  rows.push({
    id,
    name: p.name,
    kind: p.kind,
    lon: String(p.lon),
    lat: String(p.lat),
    openbible_url: `https://www.openbible.info/geo/ancient/${id}`,
    wikidata: p.wikidata ?? "",
    pleiades: p.pleiades ?? "",
    tipnr: p.tipnr ?? "",
    theographic_id: was?.theographic_id ?? "",
    theographic_lookup: was?.theographic_lookup ?? "",
    theographic_canonical: was?.theographic_canonical ?? "",
    theographic_same_place_records: was?.theographic_same_place_records ?? "",
    theographic_km: theographicKm,
    match_method: was?.match_method ?? "",
    confidence: was?.confidence ?? "",
    openbible_wikidata: link.wikidata,
    openbible_pleiades: link.pleiades,
    openbible_tipnr: link.tipnr,
  });
}
writeFileSync(
  CSV,
  `${[COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => quote(r[c])).join(","))].join("\n")}\n`,
);
const dropped = [...old.keys()].filter((id) => !byId.has(id)).length;
console.log(
  `crosswalk: ${String(rows.length)} places (${String(added)} new, ${String(dropped)} gone), TIPNR ids for ${String(rows.filter((r) => r.tipnr).length)}, ${String(distances)} Theographic distances recomputed${theographicPath ? "" : " (no --theographic: distances kept)"}`,
);
