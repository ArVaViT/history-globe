import { describe, expect, it } from "vitest";
import type { PlaceLife } from "../packages/model/src/content.ts";
import {
  type Dated,
  eventBattleLinks,
  fadedState,
  fallsIn,
  givesFigure,
  kmFigures,
  nearDistance,
  ownDistances,
  samePassageApart,
  statesDistance,
  Water,
} from "./content-checks.ts";

// A square sea 0.2° a side (about 22 km), its shore the same square.
const sea: [number, number][] = [
  [35, 32],
  [35.2, 32],
  [35.2, 32.2],
  [35, 32.2],
  [35, 32],
];
const water = new Water([sea], [sea]);

describe("Water", () => {
  it("is 0 on land and the distance to the nearest shore at sea", () => {
    expect(water.depthKm([34.9, 32.1])).toBe(0);
    // 0.1° of longitude at 32°N.
    expect(water.depthKm([35.1, 32.1])).toBeCloseTo(9.4, 1);
    expect(water.depthKm([35.01, 32.1])).toBeCloseTo(0.94, 1);
  });

  it("measures the shore, not a cut joining an island to the outer ring", () => {
    // The same sea with a zero-width cut to an island in its middle: the shores leave it out.
    const island: [number, number][] = [
      [35.09, 32.09],
      [35.09, 32.11],
      [35.11, 32.11],
      [35.11, 32.09],
      [35.09, 32.09],
    ];
    const joined: [number, number][] = [
      [35, 32],
      [35.2, 32],
      [35.2, 32.2],
      [35, 32.2],
      [35, 32.09],
      [35.09, 32.09],
      ...island.slice(1),
      [35, 32.09],
      [35, 32],
    ];
    const w = new Water([joined], [sea, island]);
    expect(w.depthKm([35.1, 32.1])).toBe(0);
    // 55 m from the cut, 3.8 km from the island.
    expect(w.depthKm([35.05, 32.0905])).toBeCloseTo(3.8, 1);
  });
});

const y = (year: number) => ({ year, approximate: false });
const life = (l: Partial<PlaceLife>): PlaceLife => ({ note: { en: "" }, sources: ["s"], ...l });

describe("fadedState", () => {
  it("reads ruin, end and founding as apps/web/src/data.ts beforeItsTime does", () => {
    const jerusalem = life({ gap: { from: y(-585), until: y(-538) } });
    expect(fadedState(jerusalem, 5, -585)).toBe("in ruins");
    expect(fadedState(jerusalem, 5, -537)).toBeNull();
    expect(fadedState(life({ until: y(-611) }), 5, 627)).toBe("gone");
    expect(fadedState(life({ from: y(-2) }), 0, -199)).toBe("not yet built");
  });

  it("fades a place only the New Testament names before 6 BC, unless it has years of its own", () => {
    expect(fadedState(undefined, 0, -546)).toBe(
      "named only in the New Testament, before its events",
    );
    expect(fadedState(undefined, 0, -5)).toBeNull();
    expect(fadedState(undefined, 3, -546)).toBeNull();
    expect(fadedState(life({ until: y(1300) }), 0, -546)).toBeNull();
    expect(fadedState(life({ until: y(1300), inherited: true }), 0, -546)).not.toBeNull();
  });

  it("knows the year a place falls", () => {
    const jerusalem = life({ gap: { from: y(-585), until: y(-538) } });
    expect(fallsIn(jerusalem, -585)).toBe(true);
    expect(fallsIn(jerusalem, -584)).toBe(false);
  });
});

describe("samePassageApart", () => {
  const at = (where: string, ref: string, year: number, tourYear = false): Dated => ({
    where,
    ref,
    place: "jer",
    year,
    tourYear,
  });

  it("pairs a stop at its tour's year with the same passage dated elsewhere", () => {
    const found = samePassageApart([
      at("battles/jebus", "2Sam.5.6-2Sam.5.9", -1002),
      at("tours/david 11", "2Sam.5.7", -1009, true),
    ]);
    expect(found.map((x) => x.pair)).toEqual(["battles/jebus tours/david 11"]);
  });

  it("leaves years close together, other passages, two own years and one tour's stops", () => {
    expect(
      samePassageApart([
        at("battles/jebus", "2Sam.5.6-2Sam.5.9", -1002),
        at("tours/david 11", "2Sam.5.6", -1005, true),
        at("tours/david 12", "2Sam.17.24", -1009, true),
        at("questions/zion", "2Sam.5.7", -1100),
      ]).map((x) => x.pair),
    ).toEqual([]);
  });

  it("reads a whole chapter to its last verse", () => {
    expect(
      samePassageApart([at("events/e", "Acts.21", 57), at("tours/t 1", "Acts.21.40", 34, true)]),
    ).toHaveLength(1);
  });
});

describe("eventBattleLinks", () => {
  const events = [
    { id: "samaria-falls", year: -721, place: "sam" },
    { id: "masada", year: 73, site: "687968" },
  ];

  it("asks a battle that tells an event again to name it", () => {
    expect(eventBattleLinks(events, [{ id: "samaria-722", year: -721, place: "sam" }])).toEqual([
      "battles: samaria-722 tells the event samaria-falls again; link it (event: samaria-falls)",
    ]);
    expect(
      eventBattleLinks(events, [
        { id: "samaria-722", year: -721, place: "sam", event: "samaria-falls" },
        { id: "masada-73", year: 73, place: "687968", event: "masada" },
      ]),
    ).toEqual([]);
  });

  it("refuses an event's id, an unknown event and a link elsewhere", () => {
    expect(
      eventBattleLinks(events, [
        { id: "masada", year: 73, place: "687968", event: "masada" },
        { id: "a", year: 0, place: "x", event: "nothing" },
        { id: "b", year: -600, place: "sam", event: "samaria-falls" },
      ]),
    ).toEqual([
      "battles: masada has the id of an event",
      "battles: a names the event nothing, which is not in events.yaml",
      "battles: b names the event samaria-falls, at another place or year",
    ]);
  });
});

describe("statesDistance", () => {
  const dan: [number, number] = [35.6522, 33.2486];
  const beersheba: [number, number] = [34.84, 31.245];

  it("reads the kilometre figures of a text", () => {
    expect(kmFigures("about 236 km, or 2,305 km by sea")).toEqual([236, 2305]);
    expect(kmFigures("около 2 305 км, или 2.305 km, или 2\u00a0305 km")).toEqual([
      2305, 2305, 2305,
    ]);
    // A decimal is no figure of thousands, and a word that starts with "km" no unit.
    expect(kmFigures("2,5 km; 12 kmh")).toEqual([]);
  });

  it("finds the measured distance within 10%", () => {
    expect(statesDistance("From Dan to Beersheba is about 236 km.", dan, beersheba)).toBe(true);
    expect(statesDistance("From Dan to Beersheba is about 150 km.", dan, beersheba)).toBe(false);
    expect(statesDistance("No figure at all.", dan, beersheba)).toBe(false);
  });
});

describe("ownDistances", () => {
  const bethel: [number, number] = [35.24139, 31.92278];
  const jerusalem: [number, number] = [35.23417, 31.77667];

  it("reads the distances a sentence about the article's place gives", () => {
    expect(
      ownDistances("Bethel", "Bethel stood on the watershed road, about 16 km north of Jerusalem."),
    ).toEqual([{ km: 16, to: "Jerusalem" }]);
    expect(ownDistances("Ai", "It lies 2.5 km east of Mount Ebal.")).toEqual([
      { km: 2.5, to: "Mount Ebal" },
    ]);
  });

  it("reads a title followed by a comma or a bracket, and 'from'", () => {
    expect(ownDistances("Bethel", "Bethel, a hill town, lies 16 km from Jerusalem.")).toEqual([
      { km: 16, to: "Jerusalem" },
    ]);
    expect(ownDistances("Bethel", "Bethel (Beitin) lies 16 km north of Jerusalem.")).toEqual([
      { km: 16, to: "Jerusalem" },
    ]);
    expect(ownDistances("Hukkok", "Hukkok is put 12.5 km from Tiberias.")).toEqual([
      { km: 12.5, to: "Tiberias" },
    ]);
  });

  it("leaves a longer title, a longer name and an area alone", () => {
    expect(ownDistances("Beth", "Bethel lies 16 km north of Jerusalem.")).toEqual([]);
    expect(ownDistances("Lystra", "Lystra lay 300 km east of Asia Minor's coast.")).toEqual([]);
    expect(ownDistances("Troas", "Troas lay 200 km from Asia Minor.")).toEqual([]);
    expect(ownDistances("Taberah", "Taberah lies within about 50 km of Hazeroth.")).toEqual([]);
  });

  it("leaves other sentences and areas alone", () => {
    expect(ownDistances("Bethel", "Ai lies 2 km east of Bethel.")).toEqual([]);
    expect(ownDistances("Taberah", "Taberah is drawn within some 50 km of Hazeroth.")).toEqual([]);
  });

  it("holds the figure to the points within 10% (at least 1.5 km)", () => {
    expect(nearDistance(16, bethel, jerusalem)).toBe(true);
    expect(nearDistance(18, bethel, jerusalem)).toBe(false);
  });
});

describe("givesFigure", () => {
  it("finds a whole figure with or without km, and a decimal with a point or a comma", () => {
    expect(givesFigure("километрах в 16 к северо-западу", 16)).toBe(true);
    expect(givesFigure("about 16 km north", 16)).toBe(true);
    expect(givesFigure("about 160 km north", 16)).toBe(false);
    expect(givesFigure("1.6 km", 16)).toBe(false);
    expect(givesFigure("noin 12,5 km", 12.5)).toBe(true);
    expect(givesFigure("about 12.5 km", 12.5)).toBe(true);
    expect(givesFigure("about 12 km", 12.5)).toBe(false);
  });
});
