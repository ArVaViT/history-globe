import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../packages/model/src/locales.ts";
import { textPlacesFrom } from "../packages/model/src/text-places.ts";
import {
  bounds,
  clipLine,
  clipRing,
  H,
  placeMapSvg,
  project,
  simplify,
  snap,
  SPAN,
  W,
} from "./place-map.ts";
import {
  breadcrumbLd,
  MAP_YEARS,
  mapYear,
  NEARBY_KM,
  NEARBY_MAX,
  nearbyPlaces,
  questionsAbout,
  type RelatedPlace,
  spansFor,
  stateAt,
  yearWithState,
} from "./place-related.ts";
import { placeRelatedHtml } from "./place-related-html.ts";
import { RELATED } from "./place-related-words.ts";

const town = (id: string, lon: number, lat: number, more: Partial<RelatedPlace> = {}) => ({
  id,
  kind: "settlement",
  coords: [lon, lat] as [number, number],
  disputed: false,
  confidence: 1000,
  ...more,
});
// About 0.009° of latitude to a kilometre.
const KM = 1 / 111.2;
const capernaum = town("cap", 35.575, 32.88);

describe("nearby places", () => {
  it("lists the nearest linkable towns, nearest first, with whole kilometres", () => {
    const all = [
      capernaum,
      town("far", 35.575, 32.88 + 10 * KM),
      town("near", 35.575, 32.88 + 4 * KM),
      town("thin", 35.575, 32.88 + 2 * KM),
    ];
    expect(nearbyPlaces(capernaum, all, (id) => id !== "thin")).toEqual([
      { id: "near", km: 4 },
      { id: "far", km: 10 },
    ]);
  });

  it("leaves out its own point, lands and seas, guesses, and what is too far", () => {
    const all = [
      capernaum,
      town("alias", 35.575, 32.88 + 0.3 * KM),
      town("dup", 35.575, 32.88 + 3 * KM, { dup: true }),
      town("galilee", 35.575, 32.88 + 5 * KM, { kind: "region" }),
      town("gate", 35.575, 32.88 + 5 * KM, { kind: "gate" }),
      town("disputed", 35.575, 32.88 + 6 * KM, { disputed: true }),
      town("tentative", 35.575, 32.88 + 6 * KM, { confidence: 400 }),
      town("unknown", 35.575, 32.88 + 6 * KM, { confidence: undefined }),
      town("beyond", 35.575, 32.88 + (NEARBY_KM + 2) * KM),
      town("likely", 35.575, 32.88 + 7 * KM, { confidence: 700 }),
    ];
    expect(nearbyPlaces(capernaum, all, () => true).map((n) => n.id)).toEqual(["likely"]);
  });

  it("gives a disputed place, a land or a duplicate record none", () => {
    const all = [capernaum, town("b", 35.575, 32.9)];
    for (const p of [
      town("x", 35.575, 32.88, { disputed: true }),
      town("y", 35.575, 32.88, { kind: "region" }),
      town("z", 35.575, 32.88, { dup: true }),
    ])
      expect(nearbyPlaces(p, all, () => true)).toEqual([]);
  });

  it(`shows at most ${String(NEARBY_MAX)}`, () => {
    const all = Array.from({ length: 12 }, (_, i) => town(`t${String(i)}`, 35.575, 32.9 + i * KM));
    expect(nearbyPlaces(capernaum, all, () => true)).toHaveLength(NEARBY_MAX);
  });
});

describe("questions about a place", () => {
  it("are those whose map opens on it or measures from or to it", () => {
    const qs = [
      { id: "a", map: { place: "cap" } },
      { id: "b", map: { place: "jer", measure: ["jer", "cap"] } },
      { id: "c", map: { place: "jer" } },
      { id: "d" },
    ];
    expect(questionsAbout("cap", qs).map((q) => q.id)).toEqual(["a", "b"]);
  });
});

describe("the map's year", () => {
  it("is AD 30 for a place of the New Testament, 1000 BC otherwise", () => {
    expect(mapYear({ nt: 5, ot: 1 })).toBe(MAP_YEARS.nt);
    expect(mapYear({ nt: 2, ot: 2 })).toBe(MAP_YEARS.ot);
    expect(mapYear({})).toBe(MAP_YEARS.ot);
    // Astronomical years (ADR 0003): 1 BC is 0, so 1000 BC is -999.
    expect(MAP_YEARS.ot).toBe(-999);
  });
});

describe("the breadcrumb", () => {
  it("is a BreadcrumbList with the last item, the page, unlinked", () => {
    expect(
      breadcrumbLd([
        { name: "History Globe", url: "https://h.app/en/" },
        { name: "All places", url: "https://h.app/en/places/" },
        { name: "Capernaum" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "History Globe", item: "https://h.app/en/" },
        { "@type": "ListItem", position: 2, name: "All places", item: "https://h.app/en/places/" },
        { "@type": "ListItem", position: 3, name: "Capernaum" },
      ],
    });
  });

  it("has its words, and the map's, in every language", () => {
    for (const l of LOCALES) {
      const w = RELATED[l];
      expect(w.nearby, l).toBeTruthy();
      expect(w.crumbs, l).toBeTruthy();
      expect(w.mapAlt("X"), l).toContain("X");
    }
  });
});

describe("the map", () => {
  const f = { lon: 35.5, lat: 32.9, span: SPAN.near };

  it("puts the place in the middle, north up, east right", () => {
    expect(project(f, [35.5, 32.9])).toEqual([W / 2, H / 2]);
    const [x, y] = project(f, [35.6, 33]);
    expect(x).toBeGreaterThan(W / 2);
    expect(y).toBeLessThan(H / 2);
    const [w, s, e, n] = bounds(f);
    expect(project(f, [w, n])[0]).toBeCloseTo(0, 6);
    expect(project(f, [e, s])[1]).toBeCloseTo(H, 6);
  });

  it("clips a ring to the frame and drops one outside it", () => {
    const big = clipRing([
      [-100, -100],
      [500, -100],
      [500, 500],
      [-100, 500],
    ]);
    expect(Math.min(...big.map((p) => p[0]))).toBe(-2);
    expect(Math.max(...big.map((p) => p[1]))).toBe(H + 2);
    expect(
      clipRing([
        [1000, 1000],
        [1010, 1000],
        [1010, 1010],
      ]),
    ).toEqual([]);
  });

  it("keeps the runs of a line that cross the frame", () => {
    const runs = clipLine([
      [-500, 10],
      [-400, 10],
      [10, 10],
      [20, 20],
      [900, 20],
      [1000, 20],
    ]);
    expect(runs).toEqual([
      [
        [-400, 10],
        [10, 10],
        [20, 20],
        [900, 20],
      ],
    ]);
  });

  it("simplifies a line within its tolerance", () => {
    expect(
      simplify([
        [0, 0],
        [5, 0.1],
        [10, 0],
      ]),
    ).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it("keeps a cut of no width closed on its grid (an island hung on the sea)", () => {
    // Out to an island along a cut and back the same way: the turn back stays.
    const ring = snap(
      [
        [0, 0],
        [10, 0],
        [10, 5.01],
        [12, 5],
        [12, 7],
        [10, 7],
        [10, 4.99],
        [10, 0.02],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
      0.5,
    );
    // Both sides of the cut on one line, x = 10, and the cut's foot met twice: no sliver.
    expect(ring.filter(([x]) => x > 9 && x < 11).every(([x]) => x === 10)).toBe(true);
    expect(ring.filter(([x, y]) => x === 10 && y === 0)).toHaveLength(2);
  });

  it("draws the point, with no words, in one small file", () => {
    const svg = placeMapSvg(f, { water: [], coast: [], rivers: [], states: [] });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 360 240"/);
    expect(svg).toContain(`<circle cx="${String(W / 2)}" cy="${String(H / 2)}"`);
    expect(svg).not.toMatch(/<text|<script|href=/);
  });
});

describe("the map's year, from the place's own chapters", () => {
  const chapters = {
    Esth: [[1, 10, -482]],
    Neh: [[1, 13, -444]],
    Judg: [[1, 21, -1149]],
    "1Kgs": [[16, 22, -873]],
  } as const;

  it("is the middle year of the verses that name it", () => {
    // Susa: Esther and Nehemiah, not 1000 BC.
    expect(mapYear({ ot: 3, osis: ["Esth.1.2", "Esth.2.3", "Neh.1.1"] }, chapters)).toBe(-482);
  });

  it("stays within the years the town stood", () => {
    // Samaria in a verse dated before Omri built it.
    expect(mapYear({ osis: ["Judg.1.1"] }, chapters, { from: { year: -879 } })).toBe(-879);
    expect(mapYear({ osis: ["1Kgs.16.24"] }, chapters, { until: { year: -900 } })).toBe(-900);
  });

  it("falls back on the testament for undated books", () => {
    expect(mapYear({ nt: 0, ot: 2, osis: ["Ps.1.1"] }, chapters)).toBe(MAP_YEARS.ot);
  });
});

describe("the state named under the map", () => {
  const square = (x0: number, y0: number, d: number): [number, number][][][] => [
    [
      [
        [x0, y0],
        [x0 + d, y0],
        [x0 + d, y0 + d],
        [x0, y0 + d],
        [x0, y0],
      ],
    ],
  ];
  const state = (name: string, y0: number, y1: number, x: number, d: number) => ({
    y0,
    y1,
    c: 0,
    vassal: false,
    inside: false,
    names: { en: name },
    polys: square(x, 30, d),
    box: [x, 30, x + d, 30 + d] as [number, number, number, number],
    area: d * d,
  });
  const empire = state("Empire", -700, -600, 30, 10);
  const kingdom = state("Kingdom", -650, -600, 34, 2);

  it("is the smallest state that holds the point, as the card's band picks it", () => {
    expect(stateAt([empire, kingdom], [35, 31], -640)?.names.en).toBe("Kingdom");
    expect(stateAt([empire, kingdom], [35, 31], -680)?.names.en).toBe("Empire");
    expect(stateAt([empire, kingdom], [50, 31], -680)).toBeUndefined();
  });

  it("moves to the nearest year that has one, so caption and shapes agree", () => {
    expect(yearWithState([empire], [35, 31], -710)).toMatchObject({ year: -700 });
    expect(yearWithState([empire], [35, 31], -1000)).toEqual({ year: -1000 });
  });
});

describe("the map's frame", () => {
  it("shows an island whole, and tries wider frames before giving up", () => {
    expect(spansFor("island")[0]).toBe(SPAN.island);
    expect(spansFor("settlement")).toEqual([SPAN.near, SPAN.island, SPAN.wide]);
    expect(spansFor("region")).toEqual([SPAN.wide]);
    // Cyprus is about 225 km long: within the island frame's width.
    const f = { lon: 33.2, lat: 35.1, span: SPAN.island };
    const [w, , e] = bounds(f);
    expect(e - w).toBeGreaterThan(3.2);
  });
});

describe("the blocks as HTML", () => {
  const f = (id: string, name: string, lon: number, lat: number, kind = "settlement") => ({
    geometry: { coordinates: [lon, lat] as [number, number] },
    properties: { id, name, kind, verses: 5, disputed: false, confidence: 1000, nt: 3, ot: 0 },
  });
  const cap = f("cap", "Capernaum", 35.575, 32.88);
  const places = [cap, f("cho", "Chorazin", 35.564, 32.911), f("mag", "Magdala", 35.517, 32.825)];
  const byId = new Map(places.map((p) => [p.properties.id, p]));
  const html = placeRelatedHtml({
    root: join(import.meta.dirname, ".."),
    data: "/nowhere",
    site: "https://h.app",
    places,
    byId,
    slugOf: new Map(places.map((p) => [p.properties.id, p.properties.name.toLowerCase()])),
    nameOf: (p, l) => (l === "ru" ? `${p.name}-ru` : p.name),
    indexed: () => true,
    samePoint: (x) => [x.properties.id],
    questions: [],
    textPlaces: {},
    maps: {
      render: () => ({
        src: "data/maps/cap.svg?v=abc",
        year: 30,
        state: { en: "Tetrarchy", fr: "Tétrarchie" },
        drawn: { states: true, rivers: true },
      }),
      finish: () => ({ count: 1, kb: 3, largestKb: 3, removed: 0 }),
    },
  });

  it("captions the map with the year and the state, in the language's punctuation", () => {
    const en = html.forPlace(cap, "en").map;
    expect(en).toContain("Who ruled here, AD 30: Tetrarchy.");
    expect(en).toContain('alt="Map: Capernaum and its surroundings"');
    expect(en).toContain("Map: Natural Earth; Cliopatria");
    const fr = html.forPlace(cap, "fr").map;
    expect(fr).toContain(" : Tétrarchie.");
    expect(fr).toContain("Carte : Natural Earth ; Cliopatria");
    expect(fr).toContain('alt="Carte : Capernaum et ses environs"');
  });

  it("names no year and credits no data a map does not draw", () => {
    const bare = placeRelatedHtml({
      root: join(import.meta.dirname, ".."),
      data: "/nowhere",
      site: "",
      places,
      byId,
      slugOf: new Map(),
      nameOf: (p) => p.name,
      indexed: () => true,
      samePoint: (x) => [x.properties.id],
      questions: [],
      textPlaces: {},
      maps: {
        render: () => ({
          src: "data/maps/x.svg?v=1",
          year: -710,
          drawn: { states: false, rivers: false },
        }),
        finish: () => ({ count: 1, kb: 1, largestKb: 1, removed: 0 }),
      },
    }).forPlace(cap, "en").map;
    expect(bare).toContain('<figcaption class="note">Map: Natural Earth</figcaption>');
  });

  it("lists the nearby places with whole kilometres in the language's way", () => {
    const en = html.forPlace(cap, "en").nearby;
    expect(en).toMatch(/<h2>Nearby places<\/h2>/);
    expect(en).toContain('<a href="../chorazin/">Chorazin <span class="km">≈ 4 km</span>');
    expect(html.forPlace(cap, "ru").nearby).toContain("км");
  });

  it("ends the breadcrumb with the page itself, as its structured data does", () => {
    const p = html.forPlace(cap, "ru");
    expect(p.crumbs).toMatch(/<li aria-current="page">Capernaum-ru<\/li><\/ol><\/nav>$/);
    const [, crumbs] = p.ld({}) as [object, { itemListElement: { name: string }[] }];
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([
      "History Globe",
      "Все места",
      "Capernaum-ru",
    ]);
  });
});

describe("links to pages search engines do not index (ADR 0023)", () => {
  const f = (id: string, name: string, lon: number, lat: number) => ({
    geometry: { coordinates: [lon, lat] as [number, number] },
    properties: { id, name, kind: "settlement", verses: 5, disputed: false, confidence: 1000 },
  });
  const cap = f("cap", "Capernaum", 35.575, 32.88);
  // Magdala's article is thin, so its page is noindex; Chorazin's is indexed.
  const places = [cap, f("cho", "Chorazin", 35.564, 32.911), f("mag", "Magdala", 35.517, 32.825)];
  const byId = new Map(places.map((p) => [p.properties.id, p]));
  const q = (id: string) => ({
    id,
    question: Object.fromEntries(LOCALES.map((l) => [l, id])) as Record<
      (typeof LOCALES)[number],
      string
    >,
    map: { place: "cap" },
  });
  const html = placeRelatedHtml({
    root: join(import.meta.dirname, ".."),
    data: "/nowhere",
    site: "",
    places,
    byId,
    slugOf: new Map(places.map((p) => [p.properties.id, p.properties.name.toLowerCase()])),
    nameOf: (p) => p.name,
    indexed: (id) => id !== "mag",
    questionIndexed: (id) => id !== "where-was-capernaum",
    samePoint: (x) => [x.properties.id],
    questions: [q("where-was-capernaum"), q("how-far-nazareth-to-capernaum")],
    textPlaces: {
      en: textPlacesFrom({ forms: { Chorazin: "cho", Magdala: "mag" }, names: [] }),
    },
    maps: {
      render: () => undefined,
      finish: () => ({ count: 0, kb: 0, largestKb: 0, removed: 0 }),
    },
  });
  const page = html.forPlace(cap, "en");

  it("links no thin article's place from the text, and lists it nowhere nearby", () => {
    const [para] = page.article(
      { en: ["Chorazin and Magdala lie near the lake."] } as never,
      "cap",
    );
    expect(para).toContain('<a href="../chorazin/">Chorazin</a>');
    expect(para).not.toContain("magdala/");
    expect(page.nearby).toContain("../chorazin/");
    expect(page.nearby).not.toContain("magdala/");
  });

  it("lists no question that is kept out of search", () => {
    expect(page.questions.map((x) => x.id)).toEqual(["how-far-nazareth-to-capernaum"]);
  });

  it("links no thin article's place from an answer either", () => {
    const [para] = html
      .forQuestion(q("how-far-nazareth-to-capernaum"), "en")
      .answer({ en: ["Past Magdala and Chorazin."] } as never);
    expect(para).toContain("../../place/chorazin/");
    expect(para).not.toContain("magdala/");
  });
});

describe("the map's words", () => {
  it("joins a Ukrainian name with «й» after a vowel and «і» after a consonant", () => {
    expect(RELATED.uk.mapAlt("Капернаум")).toBe("Мапа: Капернаум і околиці");
    expect(RELATED.uk.mapAlt("Кана")).toBe("Мапа: Кана й околиці");
  });

  it("gives French its narrow space before a colon and a semicolon, no other language", () => {
    for (const l of LOCALES) {
      expect(RELATED[l].colon, l).toBe(l === "fr" ? " : " : ": ");
      expect(RELATED[l].semicolon, l).toBe(l === "fr" ? " ; " : "; ");
    }
  });
});
