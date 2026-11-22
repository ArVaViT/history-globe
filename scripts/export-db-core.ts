/**
 * A built data release as the tables of db/migrations, and the keys that loading them into
 * Postgres would check. The pure part of scripts/export-db.ts, kept apart so the tests
 * import it without reading a release.
 *
 * Geometry goes as EWKT ("SRID=4326;POINT(35.2345 31.7767)"), which PostGIS casts to
 * geography on copy. Years stay astronomical, as in the release (ADR 0003).
 */
import { LOCALES } from "../packages/model/src/locales.ts";

type Json = Record<string, unknown>;
type I18n = Partial<Record<string, string>>;
type Point = { geometry: { coordinates: number[] }; properties: Json };
type Year = { year: number; approximate?: boolean } | undefined;

export interface Release {
  manifest: {
    built_at: string;
    schema_version: number;
    sources: Record<string, { license: string; credit: string; url: string }>;
  };
  /** Sources the data build does not fetch, credited in the database as in the API. */
  extraSources: {
    id: string;
    title: string;
    url: string;
    license: string;
    license_url: string;
    credit: string;
  }[];
  places: Point[];
  sites: Point[];
  ancient: Point[];
  /** The content files' records of the ancient sites, for their sources. */
  ancientSources: Record<string, string[]>;
  content: {
    names: Record<string, I18n>;
    where_ru?: Record<string, string>;
    where_en?: Record<string, string>;
    where_in?: Record<string, Record<string, string>>;
    life?: Record<string, Json>;
    events?: Json[];
    tours: Json[];
    photos?: Record<string, Json>;
    pleiades?: Record<string, { id: string; from?: number; to?: number }>;
    chapter_years?: Record<string, [number, number, number][]>;
  };
  wikidata: Record<string, string>;
  articles: Json[];
  polities: { geometry: { type: string; coordinates: unknown }; properties: Json }[];
  people: {
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
  };
}

export interface Table {
  columns: string[];
  rows: unknown[][];
}

const point = ([lon, lat]: number[]) => `SRID=4326;POINT(${String(lon)} ${String(lat)})`;

function multipolygon(g: { type: string; coordinates: unknown }): string {
  const ring = (r: number[][]) => `(${r.map(([x, y]) => `${String(x)} ${String(y)}`).join(",")})`;
  const poly = (p: number[][][]) => `(${p.map(ring).join(",")})`;
  const polys =
    g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  return `SRID=4326;MULTIPOLYGON(${polys.map(poly).join(",")})`;
}

/** One row per language that has a text: [...key, lang, text]. */
const perLanguage = (key: unknown[], text: (lang: string) => unknown): unknown[][] =>
  LOCALES.flatMap((lang) => {
    const t = text(lang);
    return t ? [[...key, lang, t]] : [];
  });

export function seedTables(r: Release): Record<string, Table> {
  const t: Record<string, Table> = {};
  const table = (name: string, columns: string[], rows: unknown[][]) => {
    t[name] = { columns, rows };
  };
  const { content, manifest } = r;

  // --- release and sources -------------------------------------------------------------
  table(
    "release",
    ["id", "built_at", "schema_version", "notes"],
    [[manifest.built_at, manifest.built_at, manifest.schema_version, null]],
  );
  table(
    "source",
    ["id", "title", "url", "license", "license_url", "credit"],
    [
      ...Object.entries(manifest.sources).map(([id, s]) => [
        id,
        id,
        s.url,
        s.license,
        null,
        s.credit,
      ]),
      ...r.extraSources.map((s) => [s.id, s.title, s.url, s.license, s.license_url, s.credit]),
    ],
  );

  // --- places --------------------------------------------------------------------------
  const pleiades = content.pleiades ?? {};
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
    r.places.map(({ geometry, properties: p }) => {
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
        r.wikidata[id] ?? null,
        pl?.from ?? null,
        pl?.to ?? null,
      ];
    }),
  );
  const placeIds = new Set(r.places.map((f) => String(f.properties.id)));
  const ours = <T>(entries: [string, T][]) => entries.filter(([id]) => placeIds.has(id));
  table(
    "place_name",
    ["place_id", "lang", "name", "is_main", "osis", "source_id"],
    r.places.flatMap(({ properties: p }) => {
      const id = String(p.id);
      const own = content.names[id] ?? {};
      return [
        [id, "en", p.name, true, null, "openbible"],
        // The Russian form was read from a verse of the Synodal translation.
        ...perLanguage([id], (l) => (l === "en" ? undefined : own[l])).map(([, lang, name]) => [
          id,
          lang,
          name,
          true,
          lang === "ru" ? (own.osis ?? null) : null,
          null,
        ]),
      ];
    }),
  );
  table(
    "place_today",
    ["place_id", "lang", "text"],
    r.places.flatMap(({ properties: p }) => {
      const id = String(p.id);
      return perLanguage([id], (l) =>
        l === "en"
          ? (content.where_en?.[id] ?? p.where)
          : l === "ru"
            ? content.where_ru?.[id]
            : content.where_in?.[l]?.[id],
      );
    }),
  );
  table(
    "place_verse",
    ["place_id", "osis"],
    r.places.flatMap(({ properties: p }) =>
      [...new Set(p.osis as string[] | undefined)].map((o) => [p.id, o]),
    ),
  );

  // Candidate sites: ids are their order in the file, stable for one release.
  const sites = r.sites.filter((s) => placeIds.has(String(s.properties.place)));
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
    sites.flatMap((s, i) =>
      perLanguage([i + 1], (l) => s.properties[l === "en" ? "label" : `label_${l}`]),
    ),
  );

  // --- when places stood ---------------------------------------------------------------
  // A place's own years only: inherited ones (a gate shares its city's) are derived again
  // from the place links, so the database keeps one record per fact.
  const life = ours(Object.entries(content.life ?? {})).filter(([, l]) => l.inherited !== true);
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
      "sources",
    ],
    life.map(([id, l]) => {
      const from = l.from as Year;
      const until = l.until as Year;
      const gap = l.gap as { from: Year; until: Year } | undefined;
      return [
        id,
        from?.year ?? null,
        from?.approximate ?? false,
        until?.year ?? null,
        until?.approximate ?? false,
        gap?.from?.year ?? null,
        gap?.until?.year ?? null,
        l.sources ?? [],
      ];
    }),
  );
  table(
    "place_life_i18n",
    ["place_id", "lang", "note"],
    life.flatMap(([id, l]) => perLanguage([id], (lang) => (l.note as I18n | undefined)?.[lang])),
  );
  table(
    "place_photo",
    ["place_id", "commons_file", "author", "credit", "license", "license_url", "shows"],
    ours(Object.entries(content.photos ?? {})).map(([id, p]) => [
      id,
      p.file,
      p.author ?? null,
      p.credit ?? null,
      p.license,
      p.license_url ?? null,
      p.shows ?? null,
    ]),
  );

  // --- articles, the ancient world, events, tours --------------------------------------
  table(
    "article",
    ["id", "place_id", "status", "sources"],
    r.articles.map((a) => [a.id, a.place, a.status, a.sources ?? []]),
  );
  table(
    "article_i18n",
    ["article_id", "lang", "title", "body"],
    r.articles.flatMap((a) => {
      const body = a.body as Partial<Record<string, string[]>>;
      return perLanguage([a.id], (l) => body[l]?.join("\n\n")).map(([id, lang, text]) => [
        id,
        lang,
        (a.title as I18n)[lang as string] ?? "",
        text,
      ]);
    }),
  );
  table(
    "ancient_site",
    ["id", "geom", "from_year", "to_year", "approximate", "kind", "rank", "sources"],
    r.ancient.map(({ geometry, properties: a }) => [
      a.id,
      point(geometry.coordinates),
      a.from,
      a.to,
      Boolean(a.approx),
      a.kind,
      a.rank,
      r.ancientSources[String(a.id)] ?? [],
    ]),
  );
  table(
    "ancient_site_i18n",
    ["site_id", "lang", "name"],
    r.ancient.flatMap(({ properties: a }) => perLanguage([a.id], (l) => a[l])),
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
    events.flatMap((e) => perLanguage([e.id], (l) => (e.title as I18n)[l])),
  );
  table(
    "tour",
    ["id", "year", "approximate"],
    content.tours.map((tour) => [tour.id, tour.year, Boolean(tour.approximate)]),
  );
  table(
    "tour_i18n",
    ["tour_id", "lang", "title"],
    content.tours.flatMap((tour) => perLanguage([tour.id], (l) => (tour.title as I18n)[l])),
  );
  type Stop = {
    place: string;
    ref?: string;
    source?: { cite: I18n; url: string };
    year?: number;
    note?: I18n;
  };
  const stopsOf = (tour: Json) => tour.stops as Stop[];
  table(
    "tour_stop",
    ["tour_id", "position", "place_id", "site_id", "osis", "source_url", "year"],
    content.tours.flatMap((tour) =>
      stopsOf(tour).map((s, i) => {
        const atPlace = placeIds.has(s.place);
        return [
          tour.id,
          i + 1,
          atPlace ? s.place : null,
          atPlace ? null : s.place,
          s.ref ?? null,
          s.source?.url ?? null,
          s.year ?? null,
        ];
      }),
    ),
  );
  table(
    "tour_stop_i18n",
    ["tour_id", "position", "lang", "note", "cite"],
    content.tours.flatMap((tour) =>
      stopsOf(tour).flatMap((s, i) =>
        perLanguage([tour.id, i + 1], (l) => s.note?.[l]).map((row) => [
          ...row,
          s.source?.cite[row[2] as string] ?? null,
        ]),
      ),
    ),
  );

  // --- states --------------------------------------------------------------------------
  table(
    "polity_shape",
    ["id", "name", "y0", "y1", "related", "color", "geom", "source"],
    // A shape an override cut to an empty span or to no geometry is never drawn.
    r.polities
      .filter(
        (f) =>
          Number(f.properties.y1) > Number(f.properties.y0) &&
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
  const polityNames = new Map<string, Json>();
  for (const f of r.polities) polityNames.set(String(f.properties.name), f.properties);
  table(
    "polity_name",
    ["name", "lang", "label"],
    [...polityNames].flatMap(([name, p]) =>
      perLanguage([name], (l) => (l === "en" ? name : p[`name_${l}`])),
    ),
  );

  // --- people --------------------------------------------------------------------------
  const { people } = r;
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
  const relations = new Map<string, unknown[]>();
  const relate = (from: string | undefined, to: string, kind: string) => {
    if (from) relations.set(`${from}|${to}|${kind}`, [from, to, kind]);
  };
  for (const [id, , , , fathers, mothers, spouses] of people.people) {
    for (const f of fathers) relate(pid(f), id, "father");
    for (const m of mothers) relate(pid(m), id, "mother");
    for (const s of spouses) relate(pid(s), id, "spouse");
  }
  table("person_relation", ["from_id", "to_id", "kind"], [...relations.values()]);
  table(
    "place_person",
    ["place_id", "person_id", "tier", "osis"],
    ours(Object.entries(people.places)).flatMap(([place, rows]) =>
      rows.map(([i, tier, verse]) => [place, pid(i), tier, verse || null]),
    ),
  );
  return t;
}

/** The keys and checks of db/migrations: a seed that breaks one fails the whole load. */
const KEYS: Record<
  string,
  {
    pk: string[];
    fk?: [string[], string, string[]][];
    check?: [string, string[], (v: unknown[]) => boolean];
  }
> = {
  release: { pk: ["id"] },
  source: { pk: ["id"] },
  place: { pk: ["id"] },
  place_name: {
    pk: ["place_id", "lang", "name"],
    fk: [
      [["place_id"], "place", ["id"]],
      [["source_id"], "source", ["id"]],
    ],
  },
  place_today: { pk: ["place_id", "lang"], fk: [[["place_id"], "place", ["id"]]] },
  place_verse: { pk: ["place_id", "osis"], fk: [[["place_id"], "place", ["id"]]] },
  place_site: { pk: ["id"], fk: [[["place_id"], "place", ["id"]]] },
  place_site_i18n: { pk: ["site_id", "lang"], fk: [[["site_id"], "place_site", ["id"]]] },
  place_life: { pk: ["place_id"], fk: [[["place_id"], "place", ["id"]]] },
  place_life_i18n: { pk: ["place_id", "lang"], fk: [[["place_id"], "place_life", ["place_id"]]] },
  place_photo: { pk: ["place_id"], fk: [[["place_id"], "place", ["id"]]] },
  article: {
    pk: ["id"],
    check: [
      "has a status other than checked or reviewed",
      ["status"],
      ([status]) => status === "checked" || status === "reviewed",
    ],
    fk: [[["place_id"], "place", ["id"]]],
  },
  article_i18n: { pk: ["article_id", "lang"], fk: [[["article_id"], "article", ["id"]]] },
  ancient_site: { pk: ["id"] },
  ancient_site_i18n: { pk: ["site_id", "lang"], fk: [[["site_id"], "ancient_site", ["id"]]] },
  chapter_year: { pk: ["book", "from_chapter"] },
  event: {
    pk: ["id"],
    fk: [
      [["place_id"], "place", ["id"]],
      [["site_id"], "ancient_site", ["id"]],
    ],
  },
  event_i18n: { pk: ["event_id", "lang"], fk: [[["event_id"], "event", ["id"]]] },
  tour: { pk: ["id"] },
  tour_i18n: { pk: ["tour_id", "lang"], fk: [[["tour_id"], "tour", ["id"]]] },
  tour_stop: {
    pk: ["tour_id", "position"],
    check: [
      "is told by both or neither of a verse and a source",
      ["osis", "source_url"],
      ([osis, url]) => (osis === null) !== (url === null),
    ],
    fk: [
      [["tour_id"], "tour", ["id"]],
      [["place_id"], "place", ["id"]],
      [["site_id"], "ancient_site", ["id"]],
    ],
  },
  tour_stop_i18n: {
    pk: ["tour_id", "position", "lang"],
    fk: [[["tour_id", "position"], "tour_stop", ["tour_id", "position"]]],
  },
  polity_shape: { pk: ["id"] },
  polity_name: { pk: ["name", "lang"] },
  person: { pk: ["id"] },
  person_name: { pk: ["person_id", "lang"], fk: [[["person_id"], "person", ["id"]]] },
  person_relation: {
    pk: ["from_id", "to_id", "kind"],
    fk: [
      [["from_id"], "person", ["id"]],
      [["to_id"], "person", ["id"]],
    ],
  },
  place_person: {
    pk: ["place_id", "person_id"],
    fk: [
      [["place_id"], "place", ["id"]],
      [["person_id"], "person", ["id"]],
    ],
  },
};

/**
 * What would stop the load or leave a language out: a table the schema does not know, a
 * duplicate or empty primary key, a reference to a missing row, a broken check, and a text
 * table without one of the site's languages. People's names are Russian only (people-ru.json).
 */
export function seedProblems(tables: Record<string, Table>): string[] {
  const problems: string[] = [];
  const values = (name: string, cols: string[]) => {
    const { columns, rows } = tables[name] ?? { columns: [], rows: [] };
    const at = cols.map((c) => columns.indexOf(c));
    return rows.map((row) => at.map((i) => row[i]));
  };
  const key = (v: unknown[]) => JSON.stringify(v.map(String));
  for (const name of Object.keys(tables)) {
    const keys = KEYS[name];
    if (!keys) {
      problems.push(`${name}: not a table of db/migrations`);
      continue;
    }
    const seen = new Set<string>();
    for (const pk of values(name, keys.pk)) {
      if (pk.some((v) => v === null || v === undefined || v === ""))
        problems.push(`${name}: empty primary key ${key(pk)}`);
      else if (seen.has(key(pk))) problems.push(`${name}: duplicate primary key ${key(pk)}`);
      seen.add(key(pk));
    }
    for (const [cols, target, targetCols] of keys.fk ?? []) {
      const present = new Set(values(target, targetCols).map(key));
      for (const v of values(name, cols))
        if (v.every((x) => x !== null && x !== undefined) && !present.has(key(v)))
          problems.push(`${name}: (${cols.join(", ")}) ${key(v)} is not in ${target}`);
    }
    if (keys.check) {
      const [what, cols, ok] = keys.check;
      const pks = values(name, keys.pk);
      values(name, cols).forEach((v, i) => {
        if (!ok(v)) problems.push(`${name}: ${key(pks[i] ?? [])} ${what}`);
      });
    }
    const textTable = name.endsWith("_i18n") || name === "place_name" || name === "place_today";
    if (textTable && tables[name]?.rows.length) {
      const langs = new Set(values(name, ["lang"]).map(([l]) => l));
      const missing = LOCALES.filter((l) => !langs.has(l));
      if (missing.length) problems.push(`${name}: no row in ${missing.join(", ")}`);
    }
  }
  return problems;
}

/** One CSV field: quoted when needed, arrays as Postgres array literals, null as empty. */
function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v))
    v = `{${v.map((x) => `"${String(x).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
  else if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const csv = ({ columns, rows }: Table): string =>
  `${[columns.join(","), ...rows.map((r) => r.map(field).join(","))].join("\n")}\n`;
