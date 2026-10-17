/**
 * The open data as static JSON, for other sites and apps (docs/…/api.html): which places a
 * verse names, the places with their coordinates and names in every language of the site,
 * the dated events with the passage that tells them, and the tours. Written to apps/web/public/api/v1/, served
 * as files with `Access-Control-Allow-Origin: *` (vercel.json); no server, no key.
 *
 *   index.json           what is here, the licence and the credits it asks for
 *   places.json          every place: id, names in each language, kind, point, how many verses
 *                        name it, its page in each language
 *   verses/<Book>.json   "Gen.12.6" → the ids of the places that verse names, one file a book
 *   events.json          dated events, with `ref` where the Bible tells the event
 *   battles.json         battles and sieges: place, year, sides, outcome, `ref` where told
 *   tours.json           the tours: their stops in order, each with its passage and note
 *   questions.json       questions people ask, answered (the /q/ pages), with their sources
 *   ancient.json         what ancient writers outside the Bible say of a place: the passage,
 *                        a free text of it, and a summary in each language
 *   people.json          the people the Bible names (STEPBible TIPNR): id, name, names in the
 *                        other languages where the site has them, sex, verses, first verse
 *   chapters/<Book>.json "Acts.16" → the places and the people that chapter names
 *
 * Usage: node scripts/build-api.ts  (after the data and content builds)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeSlugs } from "../packages/model/src/slugs.ts";
import { LOCALES } from "../packages/model/src/time.ts";
import { openApi, violations } from "./api-openapi.ts";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");
/** The questions in every language in one file (build-content.ts). */
const build = join(root, "apps/web/build");
const out = join(root, "apps/web/public/api/v1");

if (!existsSync(join(data, "places.geojson")) || !existsSync(join(data, "content.json"))) {
  console.log("api: no data build yet (pnpm data, then pnpm content), nothing written");
  process.exit(0);
}

interface Place {
  geometry: { coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    kind: string;
    verses: number;
    osis: string[];
    dup?: boolean;
    disputed?: boolean;
  };
}
const places = (
  JSON.parse(readFileSync(join(data, "places.geojson"), "utf8")) as { features: Place[] }
).features;
const content = JSON.parse(readFileSync(join(data, "content.json"), "utf8")) as {
  /** Each place's names in the languages other than English ("ru", "uk", …), and `osis`. */
  names: Record<string, Record<string, string>>;
  events?: {
    id: string;
    year: number;
    approximate: boolean;
    title: Record<string, string>;
    place?: string;
    site?: { id: string; lon: number; lat: number };
    ref?: string;
    sources: string[];
  }[];
  battles?: {
    id: string;
    year: number;
    approximate: boolean;
    title: Record<string, string>;
    place: string;
    ref?: string;
    sides: Record<string, string>;
    outcome: Record<string, string>;
    sources: string[];
  }[];
  tours: {
    id: string;
    year: { year: number; approximate: boolean } | number;
    title: Record<string, string>;
    people?: string[];
    stops: {
      place: string;
      ref: string;
      note: Record<string, string>;
      by?: string;
      sailed?: { days: number; about?: true; ref: string };
    }[];
  }[];
};
const manifest = existsSync(join(data, "manifest.json"))
  ? (JSON.parse(readFileSync(join(data, "manifest.json"), "utf8")) as { built_at?: string })
  : {};

const LICENSE = "CC BY 4.0";
const CREDIT = [
  "History Globe by Vadym Arnaut (https://historyglobe.app), CC BY 4.0",
  "Places, verse tags and points: OpenBible.info Bible Geocoding Data (CC BY 4.0, modified); some points from Wikidata (CC0)",
  "Russian names: read from the Russian Synodal translation (public domain)",
  "Names in the other languages: History Globe (CC BY 4.0)",
  "Third-party parts keep their own licences: https://historyglobe.app/docs/sources.html",
  // Added with people.json and the gazetteer ids (2026-10): appended, the earlier lines unmoved.
  "People and the verses that name them: STEPBible TIPNR by Tyndale House Cambridge (www.STEPBible.org), CC BY 4.0, modified",
  "Pleiades ids: Pleiades (https://pleiades.stoa.org), CC BY 3.0; Wikidata ids: Wikidata (CC0), as OpenBible links them",
];

// Fresh each build: a book or file that is gone must not linger.
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "verses"), { recursive: true });
// The places' records in Wikidata (OpenBible's links, content/wikidata.json) and Pleiades.
const wikidata = (
  JSON.parse(readFileSync(join(root, "content/wikidata.json"), "utf8")) as {
    places: Record<string, string>;
  }
).places;
const pleiades =
  (
    JSON.parse(readFileSync(join(data, "content.json"), "utf8")) as {
      pleiades?: Record<string, { id: string }>;
    }
  ).pleiades ?? {};
// Every file is checked against the API's own description (scripts/api-openapi.ts) before
// it is written: a field renamed or dropped would break the sites that import the data
// (AO Lab's Free Use Bible API reads places.json and verses/).
const spec = openApi("1") as {
  paths: Record<
    string,
    { get: { responses: { "200": { content: { "application/json": { schema: object } } } } } }
  >;
  components: { schemas: Record<string, object> };
};
const schemaOf = (file: string) => {
  const path = `/${file.replace(/^(verses|chapters)\/[^/]+\.json$/, "$1/{book}.json")}`;
  return spec.paths[path]?.get.responses["200"].content["application/json"].schema;
};
const apiErrors: string[] = [];
const write = (file: string, value: unknown) => {
  const schema = schemaOf(file);
  if (!schema) apiErrors.push(`${file}: not described in scripts/api-openapi.ts`);
  else apiErrors.push(...violations(value, schema, spec.components.schemas, file).slice(0, 5));
  writeFileSync(join(out, file), JSON.stringify(value));
};

const slugs = placeSlugs(places.map((f) => f.properties));
// A page in every language the site is published in, under the same path.
const pages = (path: string) => Object.fromEntries(LOCALES.map((l) => [l, `/${l}/${path}`]));
/** A place's names in the languages other than English, in the order of LOCALES. */
const namesOf = (id: string): Record<string, string> => {
  const own = content.names[id] ?? {};
  return Object.fromEntries(LOCALES.flatMap((l) => (l !== "en" && own[l] ? [[l, own[l]]] : [])));
};
write(
  "places.json",
  places.map(({ properties: p, geometry: g }) => ({
    id: p.id,
    name: p.name,
    ...(content.names[p.id] ? { names: namesOf(p.id) } : {}),
    // The first version's field, the same as names.ru: kept for the sites that read it.
    ...(content.names[p.id]?.ru ? { name_ru: content.names[p.id]?.ru } : {}),
    kind: p.kind,
    lon: g.coordinates[0],
    lat: g.coordinates[1],
    ...(p.disputed ? { disputed: true } : {}),
    // Another record of the same place under a repeated name (OpenBible keeps both).
    ...(p.dup ? { duplicate: true } : {}),
    verses: p.verses,
    // The same place in the gazetteers (added in version 1: readers ignore a new field).
    ...(wikidata[p.id] ? { wikidata: wikidata[p.id] } : {}),
    ...(pleiades[p.id]?.id ? { pleiades: pleiades[p.id]?.id } : {}),
    // A page only for a place some verse names (scripts/build-pages.ts writes no other).
    ...(p.verses > 0 ? { page: pages(`place/${slugs.get(p.id) ?? p.id}/`) } : {}),
  })),
);

// Verse → places, a file per book: "Acts.16.12" → ["a49e1d0", …], in the order of the data.
const books = new Map<string, Map<string, string[]>>();
for (const { properties: p } of places)
  for (const ref of p.osis) {
    const book = ref.split(".")[0] ?? "";
    const verses = books.get(book) ?? new Map<string, string[]>();
    books.set(book, verses);
    verses.set(ref, [...(verses.get(ref) ?? []), p.id]);
  }
// In the order of the book: chapter, then verse.
const at = (ref: string) => ref.split(".").slice(1).map(Number);
for (const [book, verses] of books)
  write(
    `verses/${book}.json`,
    Object.fromEntries(
      [...verses].sort(([a], [b]) => {
        const [ca = 0, va = 0] = at(a);
        const [cb = 0, vb = 0] = at(b);
        return ca - cb || va - vb;
      }),
    ),
  );

write(
  "events.json",
  (content.events ?? []).map((e) => ({
    id: e.id,
    year: e.year,
    ...(e.approximate ? { approximate: true } : {}),
    title: e.title,
    ...(e.place ? { place: e.place } : {}),
    // Or a site of the ancient world the Bible does not name: where it is.
    ...(e.site ? { site: { id: e.site.id, lon: e.site.lon, lat: e.site.lat } } : {}),
    ...(e.ref ? { ref: e.ref } : {}),
    sources: e.sources,
  })),
);

write(
  "battles.json",
  (content.battles ?? []).map((b) => ({
    id: b.id,
    year: b.year,
    ...(b.approximate ? { approximate: true } : {}),
    title: b.title,
    place: b.place,
    ...(b.ref ? { ref: b.ref } : {}),
    sides: b.sides,
    outcome: b.outcome,
    sources: b.sources,
  })),
);

write(
  "tours.json",
  content.tours.map((t) => ({
    id: t.id,
    year: typeof t.year === "number" ? t.year : t.year.year,
    title: t.title,
    ...(t.people ? { people: t.people } : {}),
    stops: t.stops.map((s) => ({
      place: s.place,
      ref: s.ref,
      note: s.note,
      ...(s.by ? { by: s.by } : {}),
      // Days at sea, only where the text gives them.
      ...(s.sailed ? { sailed: s.sailed } : {}),
    })),
  })),
);

// The questions (content/questions, checked by build-content.ts): the /q/ pages as data.
const questions = existsSync(join(build, "questions.json"))
  ? (JSON.parse(readFileSync(join(build, "questions.json"), "utf8")) as {
      id: string;
      question: Record<string, string>;
      answer: Record<string, string[]>;
      map?: { place?: string; year?: { year: number }; ref?: string };
      scripture: string[];
      sources: string[];
    }[])
  : [];
write(
  "questions.json",
  questions.map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    ...(q.map
      ? {
          map: {
            ...(q.map.place ? { place: q.map.place } : {}),
            ...(q.map.year ? { year: q.map.year.year } : {}),
            ...(q.map.ref ? { ref: q.map.ref } : {}),
          },
        }
      : {}),
    scripture: q.scripture,
    sources: q.sources,
    page: pages(`q/${q.id}/`),
  })),
);

// What ancient writers say of places (content/ancient-authors.yaml): place id → mentions.
if (existsSync(join(data, "ancient-authors.json")))
  write("ancient.json", JSON.parse(readFileSync(join(data, "ancient-authors.json"), "utf8")));

// The people the Bible names, from STEPBible's TIPNR as the people build parsed it
// (pipeline/people/parse_tipnr.py), and the places and people of every chapter. Only people
// named in the text: TIPNR's records for the unnamed ("daughter_of_Lot") are left out, as on
// the map. A chapter is listed when it names a place or a person.
const TIPNR = join(root, "pipeline/.cache/people/tipnr-parsed.json");
const NAMED_FORMS = new Set([
  "Named",
  "Spelled",
  "Mentioned",
  "Aramaic",
  "Name combined",
  "(same form with Variant)",
  "(same ref[s] with Variant)",
]);
let peopleCount = 0;
const chapters = new Map<string, Map<string, { places: Set<string>; people: Set<string> }>>();
const chapterOf = (ref: string) => {
  const [book = "", chapter = ""] = ref.split(".");
  const inBook =
    chapters.get(book) ?? new Map<string, { places: Set<string>; people: Set<string> }>();
  chapters.set(book, inBook);
  const key = `${book}.${chapter}`;
  const at = inBook.get(key) ?? { places: new Set<string>(), people: new Set<string>() };
  inBook.set(key, at);
  return at;
};
for (const { properties: p } of places) for (const ref of p.osis) chapterOf(ref).places.add(p.id);
if (existsSync(TIPNR)) {
  const site = (
    existsSync(join(data, "people.json"))
      ? JSON.parse(readFileSync(join(data, "people.json"), "utf8"))
      : { people: [], names: {} }
  ) as {
    people: [string, string, string | null, ...unknown[]][];
    names: Record<string, Record<string, string>>;
  };
  const ru = new Map(site.people.map((row) => [row[0], row[2]]));
  const records = (
    JSON.parse(readFileSync(TIPNR, "utf8")) as {
      kind: string;
      key: string;
      name: string;
      type: string;
      forms?: { significance: string; translated: string; refs?: string[] }[];
    }[]
  ).filter((r) => {
    const base = r.key.split("@")[0] ?? "";
    return (
      r.kind.includes("PERSON") &&
      (r.type === "Male" || r.type === "Female") &&
      !(base.slice(0, 1) === base.slice(0, 1).toLowerCase() || /_(wives|woman)$/.test(base))
    );
  });
  // The people build's own reading of each record (pipeline/people/build.py): which are
  // unnamed ("Unnamed#3"), and which are eponyms. An eponym whose name is also a tribe's or a
  // nation's (Jacob-Israel, Judah, Ephraim, Heth: TIPNR has a Group form for them; and
  // Jacob's sons) keeps only the verses about the man: Genesis, Exodus 1-6 and the
  // genealogies (1 Chr 1-2, Matt 1, Luke 3); "the Jews" in Gal 2 or Israel in Amos are the
  // people. Abraham, Isaac or Sarah, eponyms of no nation, keep every verse.
  const built = join(root, "pipeline/.cache/people/tipnr-people.json");
  const reading = new Map(
    (existsSync(built)
      ? (
          JSON.parse(readFileSync(built, "utf8")) as {
            people: { id: string; anonymous: boolean; life_refs_note: string | null }[];
          }
        ).people
      : []
    ).map((p) => [p.id, p]),
  );
  const TRIBES = new Set(["Dan", "Gad", "Issachar", "Naphtali", "Simeon", "Joseph"]);
  const ownLife = (ref: string) => {
    const [book = "", chapter = 0] = ref.split(".").map((x, i) => (i === 1 ? Number(x) : x));
    return (
      book === "Gen" ||
      (book === "Exod" && Number(chapter) <= 6) ||
      (book === "1Chr" && Number(chapter) <= 2) ||
      (book === "Matt" && chapter === 1) ||
      (book === "Luke" && chapter === 3)
    );
  };
  const people = records.flatMap((r) => {
    const read = reading.get(r.key);
    if (read?.anonymous) return [];
    const eponym =
      (read?.life_refs_note?.startsWith("eponym") ?? false) &&
      ((r.forms ?? []).some((f) => f.significance === "Group") || TRIBES.has(r.name));
    // Only where the text names the person: not where TIPNR tags the people called after
    // them (Javan for "Greek", Judah for "Jews"), a form with another meaning, or the LXX.
    const named = (r.forms ?? []).filter(
      (f) =>
        NAMED_FORMS.has(f.significance) ||
        (f.significance === "Greek" && f.translated.split(/[ =,]/)[0] === r.name),
    );
    const refs = [...new Set(named.flatMap((f) => f.refs ?? []))].filter(
      (ref) => /^[1-3]?[A-Z][A-Za-z]+\.\d+\.\d+/.test(ref) && (!eponym || ownLife(ref)),
    );
    if (refs.length === 0) return [];
    for (const ref of refs) chapterOf(ref).people.add(r.key);
    const names = Object.fromEntries(
      LOCALES.flatMap((l) => {
        const name = l === "ru" ? ru.get(r.key) : site.names[l]?.[r.key];
        return l !== "en" && name ? [[l, name]] : [];
      }),
    );
    return [
      {
        id: r.key,
        name: r.name,
        ...(Object.keys(names).length ? { names } : {}),
        sex: r.type === "Female" ? "f" : "m",
        verses: refs.length,
        first: r.key.split("@")[1]?.split("-")[0] ?? "",
      },
    ];
  });
  peopleCount = people.length;
  write("people.json", people);
} else
  console.log("api: no TIPNR parse (pnpm people), people.json and the chapters' people left out");
mkdirSync(join(out, "chapters"), { recursive: true });
const chapterNumber = (key: string) => Number(key.split(".")[1]);
for (const [book, inBook] of chapters)
  write(
    `chapters/${book}.json`,
    Object.fromEntries(
      [...inBook]
        .sort(([a], [b]) => chapterNumber(a) - chapterNumber(b))
        .map(([key, at]) => [key, { places: [...at.places], people: [...at.people] }]),
    ),
  );

write("index.json", {
  name: "History Globe open data",
  version: 1,
  ...(manifest.built_at ? { built_at: manifest.built_at } : {}),
  license: LICENSE,
  license_url: "https://creativecommons.org/licenses/by/4.0/",
  credit: CREDIT,
  years: "astronomical: 1 BC is 0, 586 BC is -585",
  refs: "OSIS with English book abbreviations and KJV numbering: Gen.12.6, Acts.16.12-Acts.16.15",
  files: {
    "places.json":
      "every place: id, name (English), names (each other language: ru, uk, …), kind, lon, lat, verses, page (each language); name_ru, the same as names.ru, is kept for the first version's readers",
    "verses/{Book}.json": "a verse (OSIS) → the ids of the places it names; one file a book",
    "events.json": "dated events; ref where the Bible tells the event",
    "battles.json": "battles and sieges: place, year, sides, outcome; ref where the Bible tells it",
    "questions.json":
      "questions people ask, answered in each language, with the map's view and sources",
    "ancient.json":
      "place id → what ancient writers outside the Bible say of it: author, work, passage, url, summary",
    "tours.json":
      "tours: stops in order, each with its passage and note; by sea, and the days sailed where the text says",
    "people.json":
      "the people the Bible names (STEPBible TIPNR ids): name, names (other languages where the site has them), sex, verses, first (TIPNR's first verse, STEPBible abbreviations)",
    "chapters/{Book}.json":
      "a chapter (OSIS book.chapter, e.g. Acts.16) → places (our ids) and people (TIPNR ids) it names; one file a book",
    "openapi.json": "this API described in OpenAPI 3.1",
  },
  fields_added: {
    "places.json":
      "wikidata (Wikidata item, as OpenBible links it) and pleiades (Pleiades id), 2026-10",
  },
  books: [...books.keys()],
});

write("openapi.json", openApi("1"));
if (apiErrors.length) {
  console.error(
    `api: the files break their description:\n  ${apiErrors.slice(0, 20).join("\n  ")}`,
  );
  process.exit(1);
}

console.log(
  `api: ${String(places.length)} places, ${String(peopleCount)} people, ${String(chapters.size)} books of chapters, ${String(books.size)} books of verses, ${String(content.events?.length ?? 0)} events, ${String(content.battles?.length ?? 0)} battles, ${String(content.tours.length)} tours`,
);
