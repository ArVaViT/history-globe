import { describe, expect, it } from "vitest";
import {
  alsoHere,
  markRussianDuplicates,
  beforeItsTime,
  groupSites,
  foldName,
  russianStem,
  searchPlaces,
  siteCertainty,
  type LoadedData,
  type PlaceProps,
} from "./data";

function place(
  id: string,
  name: string,
  name_ru: string | undefined,
  rank: number,
  verses: number,
): PlaceProps {
  return {
    id,
    name,
    ...(name_ru ? { name_ru } : {}),
    kind: "settlement",
    sites: 1,
    disputed: false,
    verses,
    nt: 0,
    ot: verses,
    rank,
    where: "",
    osis: [],
    coord: "openbible",
  };
}

const list = [
  place("a1", "Jerusalem", "Иерусалим", 0, 800),
  place("a2", "Jericho", "Иерихон", 1, 60),
  place("a3", "Jeruel", undefined, 3, 1),
  place("a4", "Bethlehem", "Вифлеем", 0, 40),
  place("a6", "Egypt", "Египет", 0, 600),
];
const data = {
  byId: new Map(
    list.map((p) => [p.id, { props: p, info: { id: p.id, at: [0, 0] as const, kind: p.kind } }]),
  ),
} as unknown as LoadedData;

describe("searchPlaces", () => {
  it("needs at least two characters", () => {
    expect(searchPlaces(data, "И")).toEqual([]);
  });

  it("finds by Russian and by English name, prefix matches first, then importance", () => {
    expect(searchPlaces(data, "иер").map((r) => r.props.id)).toEqual(["a1", "a2"]);
    expect(searchPlaces(data, "jer").map((r) => r.props.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("also matches inside a name, after prefix matches", () => {
    expect(searchPlaces(data, "лее").map((r) => r.props.id)).toEqual(["a4"]);
  });

  it("ignores ё, accents, hyphens and spaces", () => {
    expect(foldName("Беф-Шемеш")).toBe(foldName("беф шемеш"));
    expect(foldName("Самарянка")).toBe("самарянка");
    expect(foldName("Ёмкость")).toBe("емкость");
    expect(foldName("Tell Ḥum")).toBe("tellhum");
    expect(foldName("Beʼer Sheva")).toBe("beersheva");
    expect(searchPlaces(data, "иер ус").map((r) => r.props.id)).toEqual(["a1"]);
  });

  it("finds a Russian name in another case, after a preposition", () => {
    expect(searchPlaces(data, "в Иерусалиме").map((r) => r.props.id)).toEqual(["a1"]);
    expect(searchPlaces(data, "из Иерусалима").map((r) => r.props.id)).toEqual(["a1"]);
    expect(russianStem("в Вифлееме")).toBe("вифлеем");
    expect(russianStem("Дамаска")).toBe("дамаск");
    expect(searchPlaces(data, "в Египте").map((r) => r.props.id)).toEqual(["a6"]);
    // Too short to strip, or not Russian: the query is used as typed.
    expect(russianStem("Ура")).toBeNull();
    expect(russianStem("Jerusalem")).toBeNull();
  });

  it("finds a place by the Russian form of its modern name", () => {
    const jericho = {
      ...place("a7", "Jericho", "Иерихон", 1, 60),
      where: "Tell es Sultan",
      where_tpl: "name",
      where_ru: "Телль-эс-Султан",
    };
    const withRu = {
      ...data,
      byId: new Map([
        [
          jericho.id,
          { props: jericho, info: { id: "a7", at: [0, 0] as const, kind: "settlement" } },
        ],
      ]),
    } as unknown as typeof data;
    expect(searchPlaces(withRu, "султан").map((r) => r.props.id)).toEqual(["a7"]);
  });

  it("finds a place by its modern name, after its own names", () => {
    const capernaum = {
      ...place("a5", "Capernaum", "Капернаум", 1, 18),
      where: "Tell Hum",
      where_tpl: "name",
    };
    const withToday = {
      byId: new Map([
        ["a5", { props: capernaum, info: { id: "a5", at: [0, 0], kind: "settlement" } }],
      ]),
    } as unknown as LoadedData;
    expect(searchPlaces(withToday, "tell hum").map((r) => r.props.id)).toEqual(["a5"]);
    // A description is not a name: "south of Hebron" does not answer "Hebron".
    const described = { ...capernaum, where: "south of Hebron", where_tpl: undefined };
    const withDescription = {
      byId: new Map([
        ["a5", { props: described, info: { id: "a5", at: [0, 0], kind: "settlement" } }],
      ]),
    } as unknown as LoadedData;
    expect(searchPlaces(withDescription, "hebron")).toEqual([]);
  });
});

describe("groupSites", () => {
  it("groups candidates by place, most supported first", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [1, 1] },
          properties: { place: "p", label: "B", share: 38 },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [2, 2] },
          properties: { place: "p", label: "A", share: 53 },
        },
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [3, 3] },
          properties: { place: "q", label: "C", share: 100 },
        },
      ],
    };
    const g = groupSites(fc);
    expect(g.get("p")?.map((s) => s.label)).toEqual(["A", "B"]);
    expect(g.get("p")?.[0]?.at).toEqual([2, 2]);
    expect(g.get("q")?.length).toBe(1);
  });

  it("keeps unrated candidates in source order, with no share", () => {
    const pt = (label: string) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [0, 0] },
      properties: { place: "u", label },
    });
    const g = groupSites({ type: "FeatureCollection", features: [pt("X"), pt("Y"), pt("Z")] });
    expect(g.get("u")?.map((s) => [s.label, s.share])).toEqual([
      ["X", null],
      ["Y", null],
      ["Z", null],
    ]);
  });
});

describe("beforeItsTime", () => {
  it("fades New Testament-only places before 6 BC, and nothing else", () => {
    expect(beforeItsTime({ ot: 0 }, -1200)).toBe(true);
    expect(beforeItsTime({ ot: 0 }, 30)).toBe(false);
    expect(beforeItsTime({ ot: 3 }, -1200)).toBe(false);
  });

  it("uses the known years of a place instead", () => {
    // Nineveh (OT) destroyed in 612 BC = -611, last year inclusive -> life_until -610.
    expect(beforeItsTime({ ot: 27, life_until: -610 }, -700)).toBe(false);
    expect(beforeItsTime({ ot: 27, life_until: -610 }, -600)).toBe(true);
    // Caesarea (NT only) from 22 BC = -21: shown from then, not only from 6 BC.
    expect(beforeItsTime({ ot: 0, life_from: -21 }, -10)).toBe(false);
    expect(beforeItsTime({ ot: 0, life_from: -21 }, -30)).toBe(true);
    // Corinth: own record with a gap only, standing before and after it.
    expect(beforeItsTime({ ot: 0, gap_from: -145, gap_until: -43, life_own: true }, -300)).toBe(
      false,
    );
    // In ruins between two lives: Jerusalem 586-539 BC, last year inclusive -> [-585, -537).
    const jerusalem = { ot: 800, gap_from: -585, gap_until: -537, life_own: true };
    expect(beforeItsTime(jerusalem, -600)).toBe(false);
    expect(beforeItsTime(jerusalem, -560)).toBe(true);
    expect(beforeItsTime(jerusalem, 30)).toBe(false);
    // A New Testament gate inside Jerusalem shares its ruin but stays faded before 6 BC.
    const gate = { ot: 0, gap_from: -585, gap_until: -537, life_until: 71 };
    expect(beforeItsTime(gate, -1000)).toBe(true);
    expect(beforeItsTime(gate, 30)).toBe(false);
    expect(beforeItsTime(gate, 80)).toBe(true);
  });
});

describe("alsoHere", () => {
  it("lists the other names on the same point, not the same name twice", () => {
    const at = (props: PlaceProps, coordinates: number[]) => ({
      geometry: { type: "Point" as const, coordinates },
      properties: props,
    });
    const got = alsoHere(
      [
        at(place("b1", "Babylon", "Вавилон", 0, 296), [44.4, 32.5]),
        at(place("b2", "Babylonia", "Вавилония", 1, 15), [44.4, 32.5]),
        at(place("b3", "Babylon", "Вавилон", 3, 2), [44.4, 32.5]),
        at(place("j1", "Jerusalem", "Иерусалим", 0, 800), [35.2, 31.8]),
      ],
      "ru",
    );
    expect(got.get("b1")).toEqual(["b2"]);
    expect(got.get("b2")).toEqual(["b1"]);
    expect(got.has("j1")).toBe(false);
    // Babel is "Вавилон" in Russian too: listed on Babylon in English only.
    const pair = [
      at(place("b1", "Babylon", "Вавилон", 0, 296), [1, 1]),
      at(place("b4", "Babel", "Вавилон", 3, 2), [1, 1]),
    ];
    expect(alsoHere(pair, "ru").has("b1")).toBe(false);
    expect(alsoHere(pair, "en").get("b1")).toEqual(["b4"]);
  });

  it("lists in Russian only the records with a Russian name", () => {
    const at = (props: PlaceProps) => ({
      geometry: { type: "Point" as const, coordinates: [35.2, 31.8] },
      properties: props,
    });
    const group = [
      at(place("j1", "Jerusalem", "Иерусалим", 0, 800)),
      at(place("z1", "Zion", "Сион", 1, 150)),
      at(place("r1", "Beyond the River", undefined, 3, 20)),
    ];
    expect(alsoHere(group, "ru").get("j1")).toEqual(["z1"]);
    expect(alsoHere(group, "en").get("j1")).toEqual(["z1", "r1"]);
  });
});

describe("markRussianDuplicates", () => {
  it("keeps the most mentioned of one Russian name on one point", () => {
    const features = [
      {
        geometry: { type: "Point" as const, coordinates: [1, 1] },
        properties: place("b4", "Babel", "Вавилон", 3, 2),
      },
      {
        geometry: { type: "Point" as const, coordinates: [1, 1] },
        properties: place("b1", "Babylon", "Вавилон", 0, 296),
      },
      {
        geometry: { type: "Point" as const, coordinates: [2, 2] },
        properties: place("b9", "Babel", "Вавилон", 3, 1),
      },
    ];
    expect([...markRussianDuplicates(features)]).toEqual(["b4"]);
    // A record already hidden as an English duplicate never keeps the Russian label.
    const lydia = [
      {
        geometry: { type: "Point" as const, coordinates: [3, 3] },
        properties: { ...place("l1", "Lud", "Лидия", 3, 2), dup: true },
      },
      {
        geometry: { type: "Point" as const, coordinates: [3, 3] },
        properties: place("l2", "Lydia", "Лидия", 3, 0),
      },
    ];
    expect([...markRussianDuplicates(lydia)]).toEqual([]);
    expect(features.map((f) => Boolean(f.properties.dup_ru))).toEqual([true, false, false]);
  });
});

describe("siteCertainty", () => {
  it("says agreed only when OpenBible is sure, and nothing without a score", () => {
    expect(siteCertainty({ disputed: true, confidence: 1000 })).toBe("disputed");
    expect(siteCertainty({ disputed: false })).toBe("unknown");
    expect(siteCertainty({ disputed: false, confidence: 800 })).toBe("agreed");
    expect(siteCertainty({ disputed: false, confidence: 799 })).toBe("likely");
    expect(siteCertainty({ disputed: false, confidence: 600 })).toBe("likely");
    expect(siteCertainty({ disputed: false, confidence: 599 })).toBe("tentative");
    expect(siteCertainty({ disputed: false, confidence: 0 })).toBe("tentative");
  });
});
