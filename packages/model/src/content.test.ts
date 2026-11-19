import { describe, expect, it } from "vitest";
import {
  AncientAuthorsFile,
  ArticleFile,
  PhotosFile,
  PlaceLifeFile,
  PlaceNamesFile,
  PolityOverridesFile,
  QuestionFile,
  TourFile,
} from "./content.ts";

describe("PlaceNamesFile", () => {
  const entry = {
    id: "aa21f26",
    en: "Etam",
    ru: "Ефам",
    evidence: { osis: "2Chr.11.6", excerpt: "Он укрепил Вифлеем и Ефам" },
  };

  it("keeps the evidence (it must never be silently dropped)", () => {
    expect(PlaceNamesFile.parse({ places: [entry] }).places[0]?.evidence?.excerpt).toBe(
      entry.evidence.excerpt,
    );
  });

  it("rejects unknown fields instead of dropping them", () => {
    expect(() => PlaceNamesFile.parse({ places: [{ ...entry, source: "x" }] })).toThrow();
  });

  it("rejects an invalid verse reference in the evidence, saying what is wrong", () => {
    expect(() =>
      PlaceNamesFile.parse({
        places: [{ ...entry, evidence: { ...entry.evidence, osis: "Enoch.1.1" } }],
      }),
    ).toThrow();
    expect(() =>
      PlaceNamesFile.parse({
        places: [{ ...entry, evidence: { ...entry.evidence, osis: "Acts.28.32" } }],
      }),
    ).toThrow("no such verse");
  });
});

describe("TourFile", () => {
  const tour = {
    id: "t",
    title: { en: "T", ru: "Т" },
    year: "AD 47",
    stops: [
      { place: "ae41ab4", ref: "Acts.13.1", note: { en: "a", ru: "а" } },
      { place: "a6d306d", ref: "Acts.13.4", note: { en: "b", ru: "б" } },
    ],
  };

  it("converts the year label to an astronomical year", () => {
    expect(TourFile.parse(tour).year).toBe(47);
  });

  it("refuses an approximate year instead of rounding it silently", () => {
    expect(() => TourFile.parse({ ...tour, year: "c. 47 AD" })).toThrow("give the exact year");
    expect(() => TourFile.parse({ ...tour, year: "47" })).toThrow("not a year label");
  });

  it("rejects misspelt fields in the tour and in its stops", () => {
    expect(() => TourFile.parse({ ...tour, yaer: "AD 47" })).toThrow();
    const [first, second] = tour.stops;
    expect(() => TourFile.parse({ ...tour, stops: [{ ...first, nte: "x" }, second] })).toThrow();
  });

  it("takes a stop told outside the Bible, with its source, at an ancient site", () => {
    const source = {
      cite: { en: "Josephus, Jewish War 4.1", ru: "Иосиф Флавий" },
      url: "https://x.org/",
    };
    const [first, second] = tour.stops;
    const told = { place: "678146", source, note: { en: "c", ru: "в" } };
    expect(TourFile.parse({ ...tour, stops: [first, told] }).stops[1]?.source?.url).toBe(
      "https://x.org/",
    );
    // A verse or a source: never neither, never both.
    const bare = { place: told.place, note: told.note };
    expect(() => TourFile.parse({ ...tour, stops: [first, bare] })).toThrow();
    expect(() => TourFile.parse({ ...tour, stops: [first, { ...second, source }] })).toThrow();
  });
});

describe("PolityOverridesFile", () => {
  const entry = {
    polity: "Kingdom of Judah",
    last_year: "586 BC",
    reason: "Judah lasted until Jerusalem fell.",
    sources: ["2 Kgs 25"],
  };

  it("reads the last year as an astronomical year", () => {
    expect(PolityOverridesFile.parse({ overrides: [entry] }).overrides[0]?.last_year).toBe(-585);
  });

  it("requires a source", () => {
    expect(() => PolityOverridesFile.parse({ overrides: [{ ...entry, sources: [] }] })).toThrow();
  });
});

describe("PlaceLifeFile", () => {
  const entry = {
    id: "ac9adc9",
    en: "Tiberias",
    note: { en: "a", ru: "а" },
    sources: ["Josephus"],
  };

  it("keeps an approximate year as approximate", () => {
    const got = PlaceLifeFile.parse({ places: [{ ...entry, from: "c. AD 20" }] }).places[0];
    expect(got?.from).toEqual({ year: 20, approximate: true });
  });

  it("needs a year and a source, and a from before its until", () => {
    expect(() => PlaceLifeFile.parse({ places: [entry] })).toThrow();
    expect(() =>
      PlaceLifeFile.parse({ places: [{ ...entry, from: "AD 20", sources: [] }] }),
    ).toThrow();
    expect(() =>
      PlaceLifeFile.parse({ places: [{ ...entry, from: "AD 20", until: "10 BC" }] }),
    ).toThrow();
  });

  it("marks a city rebuilt beside an older town of its name", () => {
    const got = PlaceLifeFile.parse({ places: [{ ...entry, from: "c. 290 BC", older: true }] })
      .places[0];
    expect(got?.older).toBe(true);
    // Only true: "older: false" says nothing and is refused rather than read as a claim.
    expect(() =>
      PlaceLifeFile.parse({ places: [{ ...entry, from: "c. 290 BC", older: false }] }),
    ).toThrow();
  });
});

describe("PhotosFile", () => {
  const photo = (license: string) => ({ photos: [{ place: "ac9adc9", file: "x.jpg", license }] });

  it.each(["CC0", "CC0 1.0", "CC BY 2.5", "CC BY 4.0", "Public domain"])("takes %s", (license) => {
    expect(PhotosFile.parse(photo(license)).photos[0]?.license).toBe(license);
  });

  // ADR 0008: nothing share-alike or non-commercial.
  it.each(["CC BY-SA 4.0", "CC BY-NC 2.0", "CC BY 4.0 ", "GFDL"])("refuses %s", (license) => {
    expect(() => PhotosFile.parse(photo(license))).toThrow();
  });
});

describe("texts in every language", () => {
  const paragraph = (c: string) => c.repeat(60);
  const article = {
    id: "x",
    place: "ac9adc9",
    title: { en: "X", ru: "Х" },
    body: { en: [paragraph("a"), paragraph("b")], ru: [paragraph("а"), paragraph("б")] },
    scripture: ["Acts.13.4"],
    sources: ["Josephus"],
    status: "checked",
  };

  it("has as many paragraphs in every language as in the English", () => {
    expect(ArticleFile.parse(article).body.ru).toHaveLength(2);
    const de = [paragraph("c"), paragraph("d"), paragraph("e")];
    expect(() => ArticleFile.parse({ ...article, body: { ...article.body, de } })).toThrow(
      "as many paragraphs",
    );
  });

  it("refuses a language the code does not know and a review inside the article", () => {
    expect(() => ArticleFile.parse({ ...article, title: { ...article.title, ua: "Х" } })).toThrow();
    expect(() => ArticleFile.parse({ ...article, status: "reviewed" })).toThrow("content/reviews");
    expect(() => ArticleFile.parse({ ...article, reviewer: "Dr X" })).toThrow();
  });

  it("measures a distance between two different places", () => {
    const question = {
      id: "how-far",
      question: { en: "How far?", ru: "Как далеко?" },
      answer: { en: ["e".repeat(40)], ru: ["р".repeat(40)] },
      map: { measure: ["ac9adc9", "ac9adc9"] },
      scripture: ["Acts.13.4"],
      sources: ["Josephus"],
      status: "checked",
    };
    expect(() => QuestionFile.parse(question)).toThrow("two different places");
    expect(
      QuestionFile.parse({ ...question, map: { measure: ["ac9adc9", "ae41ab4"] } }).map?.measure,
    ).toEqual(["ac9adc9", "ae41ab4"]);
  });

  it("allows a summary its own length in each language", () => {
    const mention = {
      place: "ac9adc9",
      author: { en: "Josephus", ru: "Флавий" },
      work: { en: "Jewish War", ru: "Иудейская война" },
      passage: "3.7",
      url: "https://x.org/",
      note: { en: "e".repeat(20), ru: "р".repeat(360), zh: "中".repeat(6) },
    };
    expect(AncientAuthorsFile.parse({ mentions: [mention] }).mentions[0]?.note.zh).toBe(
      "中".repeat(6),
    );
    const long = { ...mention, note: { ...mention.note, en: "e".repeat(321) } };
    expect(() => AncientAuthorsFile.parse({ mentions: [long] })).toThrow();
  });
});
