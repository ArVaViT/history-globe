import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../packages/model/src/locales.ts";
import { openApi, violations } from "./api-openapi.ts";

const spec = openApi("1") as {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, object> };
};
const { schemas } = spec.components;
// Philippi as api/v1/places.json has it (2026-11-19), trimmed to two languages.
const philippi = {
  id: "a49e1d0",
  name: "Philippi",
  names: { ru: "Филиппы", uk: "Філіппи" },
  name_ru: "Филиппы",
  kind: "settlement",
  lon: 24.28458,
  lat: 41.01207,
  verses: 4,
  wikidata: "Q379652",
  pleiades: "501482",
  tipnr: "Philippi@Act.16.12-1Th",
  page: { en: "/en/place/philippi/", ru: "/ru/place/philippi/" },
};

describe("the API description", () => {
  it("describes every file build-api.ts writes", () => {
    for (const path of [
      "/index.json",
      "/places.json",
      "/verses/{book}.json",
      "/chapters/{book}.json",
      "/people.json",
      "/tours.json",
      "/events.json",
      "/battles.json",
      "/questions.json",
      "/ancient.json",
      "/openapi.json",
    ])
      expect(spec.paths).toHaveProperty([path]);
  });

  it("accepts a real place, and a field it does not know (readers must ignore them)", () => {
    expect(violations(philippi, { $ref: "#/components/schemas/Place" }, schemas)).toEqual([]);
    expect(
      violations({ ...philippi, future: 1 }, { $ref: "#/components/schemas/Place" }, schemas),
    ).toEqual([]);
  });

  it("refuses a place that lost a field the importers read, or changed its type", () => {
    const noLat: Record<string, unknown> = { ...philippi };
    delete noLat.lat;
    expect(violations(noLat, { $ref: "#/components/schemas/Place" }, schemas)).toEqual([
      "$: no lat",
    ]);
    expect(
      violations({ ...philippi, verses: "4" }, { $ref: "#/components/schemas/Place" }, schemas),
    ).toEqual(["$.verses: not an integer"]);
    expect(
      violations(
        { ...philippi, wikidata: "379652" },
        { $ref: "#/components/schemas/Place" },
        schemas,
      ),
    ).toHaveLength(1);
    expect(
      violations(
        { ...philippi, tipnr: "Philippi" },
        { $ref: "#/components/schemas/Place" },
        schemas,
      ),
    ).toHaveLength(1);
  });

  it("checks a chapter file's values", () => {
    const chapters = {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/Chapter" },
    };
    expect(
      violations(
        { "Acts.16": { places: ["a49e1d0"], people: ["Lydia@Act.16.14-"] } },
        chapters,
        schemas,
      ),
    ).toEqual([]);
    expect(violations({ "Acts.16": { places: ["a49e1d0"] } }, chapters, schemas)).toEqual([
      "$.Acts.16: no people",
    ]);
  });
});

/**
 * The fields the open data page (content/docs/<lang>/api.html) describes in words rather than by
 * name, each with the words that describe it in English. Every other field of a record must be
 * named on the page, in code or in an example, in every language: a field added to the API
 * without a word on the page fails here (tipnr did, until 2026-11-19).
 */
const IN_WORDS: Readonly<Record<string, readonly string[]>> = {
  // "TIPNR id, name, names …, sex, how many verses name them, the first"
  Person: ["sex", "first"],
  // "the tours: their stops in order"
  Tour: ["year", "title", "stops"],
  // "each with its passage and note"
  Stop: ["place", "note"],
  // "the dated events"
  Event: ["year", "title", "place", "sources"],
  // "battles and sieges: place, year, sides and outcome"
  Battle: ["year", "title", "place", "sides", "outcome", "sources"],
  // "answered in every language of the site, with the view of the map and the sources"
  Question: ["question", "answer", "map", "sources"],
  // "author, work, passage, a link to a free text, a summary"
  AncientMention: ["place", "author", "work", "passage", "url", "note"],
};
/** The records of the data files (not the index, whose fields are its own description). */
const RECORDS = ["Place", "Chapter", "Person", "Tour", "Stop", "Event", "Battle", "Question"];

describe("the open data page", () => {
  const props = (name: string) =>
    Object.keys((schemas[name] as { properties?: Record<string, unknown> }).properties ?? {});

  it("lists in words only fields the records have", () => {
    for (const [name, fields] of Object.entries(IN_WORDS))
      for (const f of fields) expect(props(name), `${name}.${f}`).toContain(f);
  });

  it.each([...LOCALES])("names every field of the records in %s", (l) => {
    const page = readFileSync(join(import.meta.dirname, `../content/docs/${l}/api.html`), "utf8");
    const named = new Set([
      ...[...page.matchAll(/<code>([^<]*)<\/code>/g)].flatMap((m) =>
        [...(m[1] ?? "").matchAll(/"?(\w+)"?(?=\s*:|$)/g)].map((k) => k[1]),
      ),
      ...[...page.matchAll(/"(\w+)":/g)].map((m) => m[1]),
    ]);
    const missing = [...RECORDS, "AncientMention"].flatMap((name) =>
      props(name)
        .filter((f) => !named.has(f) && !IN_WORDS[name]?.includes(f))
        .map((f) => `${name}.${f}`),
    );
    expect(missing).toEqual([]);
  });
});
