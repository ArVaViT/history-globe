import { describe, expect, it } from "vitest";
import { TourFile } from "../packages/model/src/content.ts";
import { legTime } from "../packages/model/src/travel.ts";
import {
  factsLine,
  legendWords,
  legLine,
  legsOf,
  legTimeWords,
  mapFigure,
  tourLd,
  type UiWords,
} from "./tour-page.ts";

// The map's words for time, as apps/web/src/i18n/en.json gives them.
const ui: UiWords = {
  tours: { walk: "{{walk}} on foot", by_sea: "by sea" },
  place: {
    walk_hours: "≈ {{n}} h",
    walk_days_one: "≈ {{count}} day",
    walk_days_other: "≈ {{count}} days",
  },
};
const nb = (s: string) => s.replace(/\u00a0/g, " ");

const points: Record<string, [number, number]> = {
  a6d306d: [35.922, 36.124], // Seleucia
  afa863b: [33.902, 35.185], // Salamis
  a314765: [32.404, 34.756], // Paphos
  aff04b8: [30.854, 36.96], // Perga
};
const pointOf = (id: string) => points[id];
/** A text in the two languages a content file must have. */
const loc = (en: string) => ({ en, ru: en });

/** A small voyage: Seleucia, Salamis by sea in a day, Paphos on foot, Perga by sea round a point. */
const tour = TourFile.parse({
  id: "voyage",
  title: loc("A voyage"),
  year: "AD 47",
  stops: [
    { place: "a6d306d", ref: "Acts.13.4", note: loc("Seleucia.") },
    {
      place: "afa863b",
      ref: "Acts.13.5",
      note: loc("Salamis."),
      by: "sea",
      sailed: { days: 1, ref: "Acts.13.4" },
    },
    { place: "a314765", ref: "Acts.13.6", note: loc("Paphos.") },
    {
      place: "aff04b8",
      ref: "Acts.13.13",
      note: loc("Perga."),
      by: "sea",
      via: [[31.5, 35.6]],
    },
  ],
});

describe("tour page", () => {
  it("measures a voyage through its points at sea", () => {
    const legs = legsOf(tour, pointOf, { voyage: [null, null, 150, null] });
    expect(legs[0]?.km).toBe(0);
    // Paphos → Perga through the point at sea is longer than the straight line.
    expect(legs[3]?.via).toBe(true);
    expect(legs[3]?.km).toBeGreaterThan(282);
    // The road only on a leg walked.
    expect(legs[2]?.road).toBe(150);
    expect(legs[1]?.road).toBeNull();
  });

  it("says each leg's time", () => {
    expect(legTimeWords(ui, "en", legTime({ km: 90 }))).toBe(", ≥ 3 days on foot");
    expect(legTimeWords(ui, "en", legTime({ km: 90, road: 120 }))).toBe(", ≈ 4 days on foot");
    expect(legTimeWords(ui, "en", legTime({ km: 400, took: { days: 40, ref: "1Kgs.19.8" } }))).toBe(
      ", 40 days on foot (1 Kgs 19:8)",
    );
    expect(nb(legTimeWords(ui, "en", legTime({ km: 300, by: "sea" })))).toBe(
      ", by sea, ≈ 2–4 days (estimate)",
    );
    expect(legTimeWords(ui, "en", legTime({ km: 40, by: "sea" }))).toBe(
      ", by sea, under a day (estimate)",
    );
    expect(legTimeWords(ui, "en", legTime({ km: 66, by: "sea", withinNext: true }))).toBe(
      ", by sea, within the next leg’s days",
    );
    expect(legTimeWords(ui, "en", legTime({ km: 500, by: "untold" }))).toBe(
      ", the way is not told",
    );
    expect(legTimeWords(ui, "en", legTime({ km: 1 }))).toBe("");
  });

  it("writes the stop's line: straight, by road, or along a voyage's course", () => {
    expect(nb(legLine(ui, "en", { km: 90, road: 120 }, true))).toBe(
      "≈ 90 km in a straight line, ≈ 120 km by Roman roads, ≈ 4 days on foot",
    );
    expect(nb(legLine(ui, "en", { km: 526, by: "sea", via: true }, true))).toBe(
      "≈ 525 km along the course on the map, by sea, ≈ 3–6 days (estimate)",
    );
    expect(legLine(ui, "en", { km: 1 }, true)).toBe("");
    // A tour not travelled: the distance alone.
    expect(nb(legLine(ui, "en", { km: 90 }, false))).toBe("≈ 90 km in a straight line");
  });

  it("sums the tour up under its title", () => {
    const legs = [
      { km: 0 },
      { km: 210, by: "sea" as const, sailed: { days: 1, ref: "Acts.13.4" } },
      { km: 90, road: 120 },
      { km: 66, by: "sea" as const, withinNext: true },
      { km: 300, by: "sea" as const },
      { km: 500, by: "untold" as const },
    ];
    expect(factsLine(ui, "en", tour, legs).map(nb)).toEqual([
      "4 stops",
      "≈ 1,170 km",
      "≈ 4 days on foot",
      "by sea ≈ 3–5 days (estimate)",
      "legs the text does not trace are not counted",
    ]);
    // A tour not travelled: the stops alone.
    expect(factsLine(ui, "en", { ...tour, walked: false }, legs).map(nb)).toEqual(["4 stops"]);
  });

  it("names only the kinds of line the map draws", () => {
    expect(legendWords("en", { foot: true, sea: true, untold: false })).toBe(
      "Solid line: on foot; dashed: by sea.",
    );
    expect(legendWords("en", { foot: false, sea: true, untold: true })).toBe(
      "Dashed: by sea; dotted: way not told.",
    );
    expect(legendWords("fr", { foot: true, sea: true, untold: true })).toBe(
      "Trait plein : à pied ; tirets : par mer ; pointillés : chemin non indiqué.",
    );
    // A walk alone needs no legend.
    expect(legendWords("en", { foot: true, sea: false, untold: false })).toBe("");
  });

  it("links the map as one file for every language, with its label and caption", () => {
    const written: string[] = [];
    const figure = (l: "en" | "de") =>
      mapFigure({
        l,
        t: tour,
        pointOf,
        roadPaths: {},
        layers: undefined,
        label: "Map of the route: A voyage",
        yearLabel: "AD 47",
        writeMap: (svg) => {
          written.push(svg);
          return `../../../data/tour-maps/voyage.svg?v=${String(svg.length)}`;
        },
      });
    const en = figure("en");
    expect(en).toContain('<img class="tour-map" src="../../../data/tour-maps/voyage.svg?v=');
    expect(en).toContain('alt="Map of the route: A voyage"');
    expect(en).toContain(
      '<figcaption class="note">The numbers are the stops. Solid line: on foot; dashed: by sea.</figcaption>',
    );
    figure("de");
    // The same drawing in both languages: no words in it.
    expect(written[0]).toBe(written[1]);
    expect(written[0]).not.toContain("voyage");
    // No stop with a point: no map.
    expect(
      mapFigure({
        l: "en",
        t: tour,
        pointOf: () => undefined,
        roadPaths: {},
        layers: undefined,
        label: "x",
        yearLabel: "",
        writeMap: () => "",
      }),
    ).toBe("");
  });

  it("gives the stops as an ordered list of places, and the way from the home page", () => {
    const [list, crumbs] = tourLd({
      site: "https://historyglobe.app",
      l: "en",
      t: tour,
      title: "A voyage",
      desc: "Four stops.",
      path: "en/tour/voyage/",
      toursTitle: "Tours",
      stopName: (id) => `name of ${id}`,
      pointOf,
      placePath: (id) => (id === "a6d306d" ? "en/place/seleucia/" : undefined),
    }) as [Record<string, unknown>, Record<string, unknown>];
    expect(list).toMatchObject({
      "@type": "ItemList",
      url: "https://historyglobe.app/en/tour/voyage/",
      numberOfItems: 4,
    });
    const items = list.itemListElement as { position: number; item: Record<string, unknown> }[];
    expect(items[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Place",
        name: "name of a6d306d",
        url: "https://historyglobe.app/en/place/seleucia/",
        geo: { "@type": "GeoCoordinates", latitude: 36.124, longitude: 35.922 },
      },
    });
    expect(items[1]?.item.url).toBeUndefined();
    expect(crumbs.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "History Globe",
        item: "https://historyglobe.app/en/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tours",
        item: "https://historyglobe.app/en/tours/",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "A voyage",
        item: "https://historyglobe.app/en/tour/voyage/",
      },
    ]);
  });

  it("allows a leg within the next one's days only before a leg whose days are told", () => {
    const raw = (within: number) => ({
      id: "x",
      title: loc("x"),
      year: "AD 47",
      stops: tour.stops.map((s, i) => ({
        place: s.place,
        ref: s.ref,
        note: s.note,
        ...(s.by ? { by: s.by } : {}),
        ...(s.sailed ? { sailed: s.sailed } : {}),
        ...(s.via ? { via: s.via } : {}),
        ...(i === within ? { within_next: true } : {}),
      })),
    });
    // Before Salamis, whose day the text gives: allowed.
    expect(TourFile.safeParse(raw(0)).success).toBe(true);
    // Before Perga, whose days the text does not give: refused.
    expect(TourFile.safeParse(raw(2)).success).toBe(false);
    // Waypoints only at sea.
    const walkedVia = raw(-1);
    expect(
      TourFile.safeParse({
        ...walkedVia,
        stops: walkedVia.stops.map((s, i) => (i === 2 ? { ...s, via: [[33, 35]] } : s)),
      }).success,
    ).toBe(false);
  });
});
