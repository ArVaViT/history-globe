/**
 * The open data as static JSON, for other sites and apps (docs/…/api.html): which places a
 * verse names, the places with their coordinates and Russian names, the dated events with
 * the passage that tells them, and the tours. Written to apps/web/public/api/v1/, served
 * as files with `Access-Control-Allow-Origin: *` (vercel.json); no server, no key.
 *
 *   index.json           what is here, the licence and the credits it asks for
 *   places.json          every place: id, names, kind, point, how many verses name it
 *   verses/<Book>.json   "Gen.12.6" → the ids of the places that verse names, one file a book
 *   events.json          dated events, with `ref` where the Bible tells the event
 *   battles.json         battles and sieges: place, year, sides, outcome, `ref` where told
 *   tours.json           the tours: their stops in order, each with its passage and note
 *   questions.json       questions people ask, answered (the /q/ pages), with their sources
 *   ancient.json         what ancient writers outside the Bible say of a place: the passage,
 *                        a free text of it, and a summary in English and Russian
 *
 * Usage: node scripts/build-api.ts  (after the data and content builds)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeSlugs } from "./slugs.ts";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");
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
  names: Record<string, { ru: string }>;
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
  "History Globe by Vadym Arnaut (https://github.com/ArVaViT/history-globe), CC BY 4.0",
  "Places, verse tags and points: OpenBible.info Bible Geocoding Data (CC BY 4.0, modified)",
  "Russian names: read from the Russian Synodal translation (public domain)",
];

// Fresh each build: a book or file that is gone must not linger.
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "verses"), { recursive: true });
const write = (file: string, value: unknown) => {
  writeFileSync(join(out, file), JSON.stringify(value));
};

const slugs = placeSlugs(places.map((f) => f.properties));
write(
  "places.json",
  places.map(({ properties: p, geometry: g }) => ({
    id: p.id,
    name: p.name,
    ...(content.names[p.id] ? { name_ru: content.names[p.id]?.ru } : {}),
    kind: p.kind,
    lon: g.coordinates[0],
    lat: g.coordinates[1],
    ...(p.disputed ? { disputed: true } : {}),
    // Another record of the same place under a repeated name (OpenBible keeps both).
    ...(p.dup ? { duplicate: true } : {}),
    verses: p.verses,
    // A page only for a place some verse names (scripts/build-pages.ts writes no other).
    ...(p.verses > 0
      ? {
          page: {
            en: `/en/place/${slugs.get(p.id) ?? p.id}/`,
            ru: `/ru/place/${slugs.get(p.id) ?? p.id}/`,
          },
        }
      : {}),
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
const questions = existsSync(join(data, "questions.json"))
  ? (JSON.parse(readFileSync(join(data, "questions.json"), "utf8")) as {
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
    page: { en: `/en/q/${q.id}/`, ru: `/ru/q/${q.id}/` },
  })),
);

// What ancient writers say of places (content/ancient-authors.yaml): place id → mentions.
if (existsSync(join(data, "ancient-authors.json")))
  write("ancient.json", JSON.parse(readFileSync(join(data, "ancient-authors.json"), "utf8")));

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
    "places.json": "every place: id, name, name_ru, kind, lon, lat, verses, page",
    "verses/{Book}.json": "a verse (OSIS) → the ids of the places it names; one file a book",
    "events.json": "dated events; ref where the Bible tells the event",
    "battles.json": "battles and sieges: place, year, sides, outcome; ref where the Bible tells it",
    "questions.json":
      "questions people ask, answered in English and Russian, with the map's view and sources",
    "ancient.json":
      "place id → what ancient writers outside the Bible say of it: author, work, passage, url, summary",
    "tours.json":
      "tours: stops in order, each with its passage and note; by sea, and the days sailed where the text says",
  },
  books: [...books.keys()],
});

console.log(
  `api: ${String(places.length)} places, ${String(books.size)} books of verses, ${String(content.events?.length ?? 0)} events, ${String(content.battles?.length ?? 0)} battles, ${String(content.tours.length)} tours`,
);
