/**
 * A built data release as CSV, one file per table of db/migrations/0001_init.sql, for
 * `\copy` into Supabase (db/README.md). Reads apps/web/public/data after `pnpm data`;
 * writes db/seed/*.csv (not committed: rebuilt from the release).
 *
 * Geometry goes as EWKT ("SRID=4326;POINT(35.2345 31.7767)"), which PostGIS casts to
 * geography on copy. Years stay astronomical, as in the release (ADR 0003).
 *
 * Usage: node scripts/export-db.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");
const out = join(root, "db/seed");
mkdirSync(out, { recursive: true });

type Json = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the shape of the file
const read = <T>(file: string): T => JSON.parse(readFileSync(join(data, file), "utf8")) as T;

/** One CSV field: quoted when needed, arrays as Postgres array literals, null as empty. */
function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v))
    v = `{${v.map((x) => `"${String(x).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
  else if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
const counts: Record<string, number> = {};
function table(name: string, columns: string[], rows: unknown[][]): void {
  const lines = [columns.join(","), ...rows.map((r) => r.map(field).join(","))];
  writeFileSync(join(out, `${name}.csv`), `${lines.join("\n")}\n`);
  counts[name] = rows.length;
}

const point = ([lon, lat]: number[]) => `SRID=4326;POINT(${String(lon)} ${String(lat)})`;
function multipolygon(g: { type: string; coordinates: unknown }): string {
  const ring = (r: number[][]) => `(${r.map(([x, y]) => `${String(x)} ${String(y)}`).join(",")})`;
  const poly = (p: number[][][]) => `(${p.map(ring).join(",")})`;
  const polys =
    g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  return `SRID=4326;MULTIPOLYGON(${polys.map(poly).join(",")})`;
}

// --- release and sources -------------------------------------------------------------
const manifest = read<{
  built_at: string;
  schema_version: number;
  sources: Record<string, { license: string; credit: string; url: string }>;
}>("manifest.json");
const releaseId = manifest.built_at.slice(0, 10);
table(
  "release",
  ["id", "built_at", "schema_version", "notes"],
  [[releaseId, manifest.built_at, manifest.schema_version, null]],
);
const sources: unknown[][] = Object.entries(manifest.sources).map(([id, s]) => [
  id,
  id,
  s.url,
  s.license,
  null,
  s.credit,
]);
sources.push(
  [
    "stepbible-tipnr",
    "STEP Bible TIPNR",
    "https://github.com/STEPBible/STEPBible-Data",
    "CC BY 4.0",
    "https://creativecommons.org/licenses/by/4.0/",
    "People and family links: STEP Bible (www.STEPBible.org), CC BY 4.0, modified",
  ],
  [
    "pleiades",
    "Pleiades: A Gazetteer of Past Places",
    "https://pleiades.stoa.org",
    "CC BY 3.0",
    "https://creativecommons.org/licenses/by/3.0/us/",
    "Periods of places: Pleiades (ISAW, NYU), CC BY 3.0, modified",
  ],
);
table("source", ["id", "title", "url", "license", "license_url", "credit"], sources);

// --- places --------------------------------------------------------------------------
type PlaceFeature = { geometry: { coordinates: number[] }; properties: Json };
const places = read<{ features: PlaceFeature[] }>("places.geojson").features;
const content = read<{
  names: Record<string, { ru: string; osis?: string }>;
  where_ru?: Record<string, string>;
  life?: Record<string, Json>;
  events?: Json[];
  tours: Json[];
  photos?: Record<string, Json>;
  pleiades?: Record<string, { id: string; from?: number; to?: number }>;
  chapter_years?: Record<string, [number, number, number][]>;
}>("content.json");
const pleiades = content.pleiades ?? {};
const osisOf = (p: Json): string[] =>
  Array.isArray(p.osis)
    ? (p.osis as string[])
    : typeof p.osis === "string"
      ? (JSON.parse(p.osis) as string[])
      : [];
table(
  "place",
  [
    "id",
    "name",
    "kind",
    "geom",
    "coord_source",
    "disputed",
    "confidence",
    "verse_count",
    "ot",
    "nt",
    "rank",
    "pleiades_id",
    "wikidata_id",
    "attested_from",
    "attested_to",
  ],
  places.map(({ geometry, properties: p }) => {
    const id = String(p.id);
    const pl = pleiades[id];
    return [
      id,
      p.name,
      p.kind,
      point(geometry.coordinates),
      p.coord ?? "openbible",
      Boolean(p.disputed),
      p.confidence ?? null,
      p.verses ?? 0,
      Boolean(p.ot),
      Boolean(p.nt),
      p.rank ?? 3,
      pl?.id ?? null,
      null,
      pl?.from ?? null,
      pl?.to ?? null,
    ];
  }),
);
const placeIds = new Set(places.map((f) => String(f.properties.id)));
const names: unknown[][] = [];
for (const f of places)
  names.push([f.properties.id, "en", f.properties.name, true, null, "openbible"]);
for (const [id, n] of Object.entries(content.names)) {
  if (placeIds.has(id)) names.push([id, "ru", n.ru, true, n.osis ?? null, null]);
}
table("place_name", ["place_id", "lang", "name", "is_main", "osis", "source_id"], names);
const today: unknown[][] = [];
for (const f of places) {
  if (f.properties.where) today.push([f.properties.id, "en", f.properties.where]);
}
for (const [id, text] of Object.entries(content.where_ru ?? {})) {
  if (placeIds.has(id)) today.push([id, "ru", text]);
}
table("place_today", ["place_id", "lang", "text"], today);
table(
  "place_verse",
  ["place_id", "osis"],
  places.flatMap((f) => [...new Set(osisOf(f.properties))].map((o) => [f.properties.id, o])),
);

// Candidate sites: ids are their order in the file, stable for one release.
type SiteFeature = { geometry: { coordinates: number[] }; properties: Json };
const sites = read<{ features: SiteFeature[] }>("sites.geojson").features.filter((s) =>
  placeIds.has(String(s.properties.place)),
);
table(
  "place_site",
  ["id", "place_id", "geom", "share", "rank"],
  sites.map((s, i) => [
    i + 1,
    s.properties.place,
    point(s.geometry.coordinates),
    s.properties.share ?? null,
    s.properties.rank ?? 0,
  ]),
);
table(
  "place_site_i18n",
  ["site_id", "lang", "label"],
  sites.flatMap((s, i) => [
    ...(s.properties.label ? [[i + 1, "en", s.properties.label]] : []),
    ...(s.properties.label_ru ? [[i + 1, "ru", s.properties.label_ru]] : []),
  ]),
);

// --- when places stood ---------------------------------------------------------------
type Y = { year: number; approximate: boolean } | undefined;
// A place's own years only: inherited ones (a gate shares its city's) are derived again
// from the place links, so the database keeps one record per fact.
const life = Object.entries(content.life ?? {}).filter(
  ([id, l]) => placeIds.has(id) && l.inherited !== true,
);
table(
  "place_life",
  [
    "place_id",
    "from_year",
    "from_approx",
    "until_year",
    "until_approx",
    "gap_from",
    "gap_until",
    "inherited_from",
    "sources",
  ],
  life.map(([id, l]) => {
    const from = l.from as Y;
    const until = l.until as Y;
    const gap = l.gap as { from: Y; until: Y } | undefined;
    return [
      id,
      from?.year ?? null,
      from?.approximate ?? false,
      until?.year ?? null,
      until?.approximate ?? false,
      gap?.from?.year ?? null,
      gap?.until?.year ?? null,
      null,
      (l.sources as string[] | undefined) ?? [],
    ];
  }),
);
table(
  "place_life_i18n",
  ["place_id", "lang", "note"],
  life.flatMap(([id, l]) =>
    Object.entries((l.note as Record<string, string> | undefined) ?? {}).map(([lang, note]) => [
      id,
      lang,
      note,
    ]),
  ),
);
table(
  "place_photo",
  ["place_id", "commons_file", "author", "license", "license_url", "shows"],
  Object.entries(content.photos ?? {})
    .filter(([id]) => placeIds.has(id))
    .map(([id, p]) => [
      id,
      p.file,
      p.author ?? null,
      p.license,
      p.license_url ?? null,
      p.shows ?? null,
    ]),
);

// --- articles, events, tours ---------------------------------------------------------
const articles = Object.values(read<Record<string, Json>>("articles.json"));
table(
  "article",
  ["id", "place_id", "status", "sources"],
  articles.map((a) => [a.id, a.place, a.status ?? "draft", a.sources ?? []]),
);
table(
  "article_i18n",
  ["article_id", "lang", "title", "body"],
  articles.flatMap((a) =>
    Object.entries(a.body as Record<string, string[]>).map(([lang, paras]) => [
      a.id,
      lang,
      (a.title as Record<string, string>)[lang] ?? "",
      paras.join("\n\n"),
    ]),
  ),
);
const ancientPath = join(root, "content/ancient-sites.json");
const ancient = existsSync(ancientPath)
  ? (
      JSON.parse(readFileSync(ancientPath, "utf8")) as {
        sites: {
          id: string;
          en: string;
          ru: string;
          lon: number;
          lat: number;
          from: number;
          to: number;
          approx?: boolean;
          kind: string;
          rank: number;
          sources: string[];
        }[];
      }
    ).sites
  : [];
table(
  "ancient_site",
  ["id", "geom", "from_year", "to_year", "approximate", "kind", "rank", "sources"],
  ancient.map((a) => [
    a.id,
    point([a.lon, a.lat]),
    a.from,
    a.to,
    Boolean(a.approx),
    a.kind,
    a.rank,
    a.sources,
  ]),
);
table(
  "ancient_site_i18n",
  ["site_id", "lang", "name"],
  ancient.flatMap((a) => [
    [a.id, "en", a.en],
    [a.id, "ru", a.ru],
  ]),
);
table(
  "chapter_year",
  ["book", "from_chapter", "to_chapter", "year"],
  Object.entries(content.chapter_years ?? {}).flatMap(([book, runs]) =>
    runs.map(([from, to, year]) => [book, from, to, year]),
  ),
);
const events = content.events ?? [];
table(
  "event",
  ["id", "year", "approximate", "place_id", "site_id", "sources"],
  events.map((e) => [
    e.id,
    e.year,
    Boolean(e.approximate),
    e.place ?? null,
    (e.site as { id?: string } | undefined)?.id ?? null,
    e.sources ?? [],
  ]),
);
table(
  "event_i18n",
  ["event_id", "lang", "title"],
  events.flatMap((e) =>
    Object.entries(e.title as Record<string, string>).map(([lang, title]) => [e.id, lang, title]),
  ),
);
table(
  "tour",
  ["id", "year", "approximate"],
  content.tours.map((t) => [t.id, t.year, Boolean(t.approximate)]),
);
table(
  "tour_i18n",
  ["tour_id", "lang", "title"],
  content.tours.flatMap((t) =>
    Object.entries(t.title as Record<string, string>).map(([lang, title]) => [t.id, lang, title]),
  ),
);
type Stop = { place: string; ref: string; year?: number; note?: Record<string, string> };
table(
  "tour_stop",
  ["tour_id", "position", "place_id", "osis", "year"],
  content.tours.flatMap((t) =>
    (t.stops as Stop[]).map((s, i) => [t.id, i + 1, s.place, s.ref, s.year ?? null]),
  ),
);
table(
  "tour_stop_i18n",
  ["tour_id", "position", "lang", "note"],
  content.tours.flatMap((t) =>
    (t.stops as Stop[]).flatMap((s, i) =>
      Object.entries(s.note ?? {}).map(([lang, note]) => [t.id, i + 1, lang, note]),
    ),
  ),
);

// --- states --------------------------------------------------------------------------
type Polity = { geometry: { type: string; coordinates: unknown }; properties: Json };
const polities = [
  ...read<{ features: Polity[] }>("polities.geojson").features,
  ...read<{ features: Polity[] }>("polities-late.geojson").features,
];
table(
  "polity_shape",
  ["id", "name", "y0", "y1", "related", "color", "geom", "source"],
  // A shape an override cut to an empty span (y0 = y1) is never drawn: not exported.
  polities
    .filter(
      (f) =>
        Number(f.properties.y1) > Number(f.properties.y0) &&
        // A shape cut to nothing by an override has no geometry left to load.
        JSON.stringify(f.geometry.coordinates) !== "[]",
    )
    .map((f, i) => [
      i + 1,
      f.properties.name,
      f.properties.y0,
      f.properties.y1,
      Boolean(f.properties.rel),
      f.properties.c ?? 0,
      multipolygon(f.geometry),
      f.properties.src ?? "cliopatria",
    ]),
);
const polityNames = new Map<string, string>();
for (const f of polities) {
  const ru = f.properties.name_ru;
  if (typeof ru === "string") polityNames.set(String(f.properties.name), ru);
}
const polityRows: unknown[][] = [];
for (const name of new Set(polities.map((f) => String(f.properties.name)))) {
  polityRows.push([name, "en", name]);
  const ru = polityNames.get(name);
  if (ru) polityRows.push([name, "ru", ru]);
}
table("polity_name", ["name", "lang", "label"], polityRows);

// --- people --------------------------------------------------------------------------
const people = read<{
  people: [
    string,
    string,
    string | null,
    string,
    number[],
    number[],
    number[],
    number[],
    number?,
  ][];
  places: Record<string, [number, number, string][]>;
}>("people.json");
const pid = (i: number) => people.people[i]?.[0];
table(
  "person",
  ["id", "name", "female", "verses"],
  people.people.map(([id, name, , g, , , , , verses]) => [id, name, g === "f", verses ?? 0]),
);
table(
  "person_name",
  ["person_id", "lang", "name"],
  people.people.flatMap(([id, , ru]) => (ru ? [[id, "ru", ru]] : [])),
);
const rel = new Set<string>();
const relations: unknown[][] = [];
const addRel = (from: string | undefined, to: string | undefined, kind: string) => {
  if (!from || !to) return;
  const key = `${from}|${to}|${kind}`;
  if (rel.has(key)) return;
  rel.add(key);
  relations.push([from, to, kind]);
};
for (const [id, , , , fathers, mothers, spouses] of people.people) {
  for (const f of fathers) addRel(pid(f), id, "father");
  for (const m of mothers) addRel(pid(m), id, "mother");
  for (const s of spouses) addRel(pid(s), id, "spouse");
}
table("person_relation", ["from_id", "to_id", "kind"], relations);
table(
  "place_person",
  ["place_id", "person_id", "tier", "osis"],
  Object.entries(people.places)
    .filter(([place]) => placeIds.has(place))
    .flatMap(([place, rows]) =>
      rows.map(([i, tier, verse]) => [place, pid(i), tier, verse || null]),
    ),
);

console.log(
  `db seed (${releaseId}): ${Object.entries(counts)
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(", ")}`,
);
