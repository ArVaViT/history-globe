import { describe, expect, it } from "vitest";
import { LOCALES } from "../packages/model/src/locales.ts";
import { csv, type Release, seedProblems, seedTables } from "./export-db-core.ts";

const every = (text: (l: string) => string) => Object.fromEntries(LOCALES.map((l) => [l, text(l)]));
const pointAt = (properties: Record<string, unknown>) => ({
  geometry: { coordinates: [35.2, 31.7] },
  properties,
});

/** A release of one place, one ancient site, one tour that stops at both. */
function release(): Release {
  return {
    manifest: {
      built_at: "2026-11-18T09:15:00+00:00",
      schema_version: 1,
      sources: { openbible: { license: "CC-BY-4.0", credit: "OpenBible.info", url: "https://x" } },
    },
    extraSources: [],
    places: [
      pointAt({
        id: "a15257a",
        name: "Jerusalem",
        kind: "settlement",
        verses: 2,
        osis: ["Josh.10.1", "Josh.10.1"],
        where: "Jerusalem",
      }),
    ],
    sites: [
      pointAt({
        place: "a15257a",
        rank: 0,
        label: "site en",
        ...Object.fromEntries(LOCALES.map((l) => [`label_${l}`, `site ${l}`])),
      }),
    ],
    ancient: [
      pointAt({
        id: "383706",
        from: -700,
        to: 1300,
        kind: "city",
        rank: 1,
        approx: true,
        ...every((l) => `Nicomedia ${l}`),
      }),
    ],
    ancientSources: { "383706": ["https://pleiades.stoa.org/places/383706"] },
    content: {
      names: { a15257a: { ...every((l) => `Jerusalem ${l}`), osis: "Josh.10.1" } },
      where_ru: { a15257a: "Иерусалим" },
      where_in: Object.fromEntries(LOCALES.map((l) => [l, { a15257a: `today ${l}` }])),
      events: [
        { id: "edict", year: 313, site: { id: "383706" }, title: every((l) => `edict ${l}`) },
      ],
      tours: [
        {
          id: "councils",
          year: 313,
          title: every((l) => `tour ${l}`),
          stops: [
            { place: "a15257a", ref: "Acts.15.4", note: every((l) => `at Jerusalem ${l}`) },
            {
              place: "383706",
              source: {
                cite: every((l) => `Lactantius ${l}`),
                url: "https://www.newadvent.org/fathers/0705.htm",
              },
              note: every((l) => `at Nicomedia ${l}`),
            },
          ],
        },
      ],
    },
    wikidata: { a15257a: "Q1218" },
    articles: [],
    polities: [
      {
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        properties: {
          name: "Rome",
          y0: -27,
          y1: 476,
          ...Object.fromEntries(LOCALES.map((l) => [`name_${l}`, `Rome ${l}`])),
        },
      },
    ],
    people: { people: [], places: {} },
  };
}

describe("seedTables", () => {
  it("puts a stop at an ancient site in site_id and a stop told by a source in source_url", () => {
    const { tour_stop, tour_stop_i18n } = seedTables(release());
    expect(tour_stop?.rows).toEqual([
      ["councils", 1, "a15257a", null, "Acts.15.4", null, null],
      ["councils", 2, null, "383706", null, "https://www.newadvent.org/fathers/0705.htm", null],
    ]);
    expect(tour_stop_i18n?.rows).toContainEqual([
      "councils",
      2,
      "de",
      "at Nicomedia de",
      "Lactantius de",
    ]);
  });

  it("writes every language of the site, not only English and Russian", () => {
    const t = seedTables(release());
    for (const name of [
      "place_name",
      "place_today",
      "place_site_i18n",
      "ancient_site_i18n",
      "polity_name",
      "event_i18n",
    ]) {
      const table = t[name];
      const lang = table?.columns.indexOf("lang") ?? -1;
      expect(new Set(table?.rows.map((r) => r[lang])), name).toEqual(new Set(LOCALES));
    }
  });

  it("keeps the Synodal verse of the Russian name only, and the place's Wikidata item", () => {
    const t = seedTables(release());
    const osis = t.place_name?.rows.filter((r) => r[4] !== null).map((r) => [r[1], r[4]]);
    expect(osis).toEqual([["ru", "Josh.10.1"]]);
    expect(t.place?.rows[0]?.[12]).toBe("Q1218");
    expect(t.place_verse?.rows).toEqual([["a15257a", "Josh.10.1"]]);
  });

  it("names the release by its build time, so two releases of a day differ", () => {
    expect(seedTables(release()).release?.rows[0]?.[0]).toBe("2026-11-18T09:15:00+00:00");
  });
});

describe("seedProblems", () => {
  it("passes a consistent release", () => {
    expect(seedProblems(seedTables(release()))).toEqual([]);
  });

  it("reports what the load would refuse", () => {
    const r = release();
    r.ancient = [];
    const event = r.content.events?.[0] as { title: Record<string, string> };
    delete event.title.de;
    const problems = seedProblems(seedTables(r));
    expect(problems).toContain('event: (site_id) ["383706"] is not in ancient_site');
    expect(problems).toContain('tour_stop: (site_id) ["383706"] is not in ancient_site');
    expect(problems).toContain("event_i18n: no row in de");
  });

  it("reports a stop told by neither a verse nor a source, a duplicate key and a bad status", () => {
    const r = release();
    const stops = r.content.tours[0]?.stops as { ref?: string }[];
    delete stops[0]?.ref;
    r.articles = [{ id: "jerusalem", place: "a15257a", status: "draft", title: {}, body: {} }];
    r.places.push(r.places[0] as Release["places"][number]);
    const problems = seedProblems(seedTables(r));
    expect(problems).toContain(
      'tour_stop: ["councils","1"] is told by both or neither of a verse and a source',
    );
    expect(problems).toContain('place: duplicate primary key ["a15257a"]');
    expect(problems).toContain(
      'article: ["jerusalem"] has a status other than checked or reviewed',
    );
  });
});

describe("csv", () => {
  it("quotes what needs it, writes arrays as Postgres literals and null as empty", () => {
    expect(
      csv({
        columns: ["a", "b", "c", "d"],
        rows: [['say "hi", then', ["x", 'y"'], null, { en: 1 }]],
      }),
    ).toBe('a,b,c,d\n"say ""hi"", then","{""x"",""y\\""""}",,"{""en"":1}"\n');
  });
});
