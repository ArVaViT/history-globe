import { describe, expect, it } from "vitest";
import { isLocale } from "@hg/model";
import { localeOfTag, preferredLocale, readUrl, startLocale, viewSearch } from "./url";

describe("readUrl", () => {
  it("reads a full view", () => {
    expect(readUrl("?year=-585&place=a15257a&camera=35.2,31.7,9,45,-10&locale=en")).toEqual({
      year: -585,
      place: "a15257a",
      camera: { center: [35.2, 31.7], zoom: 9, pitch: 45, bearing: -10 },
      locale: "en",
    });
  });

  it("ignores malformed or unsafe values instead of failing", () => {
    expect(readUrl("?year=abc&place=<script>&camera=1,2,3&locale=xx")).toEqual({});
  });

  it("keeps year zero (1 BC) — it is a real astronomical year", () => {
    expect(readUrl("?year=0").year).toBe(0);
  });

  it("does not read an empty year as year zero", () => {
    expect(readUrl("?year=").year).toBeUndefined();
  });

  it("brings years and cameras from foreign links into range", () => {
    expect(readUrl("?year=5000").year).toBe(1300);
    expect(readUrl("?year=-9000").year).toBe(-3499);
    expect(readUrl("?camera=395,95,40,120,540").camera).toEqual({
      center: [35, 85],
      zoom: 22,
      pitch: 80,
      bearing: -180,
    });
  });

  it("accepts only languages the interface speaks", () => {
    expect(readUrl("?locale=xx").locale).toBeUndefined();
  });
});

describe("viewSearch", () => {
  const view = {
    year: 30,
    camera: { center: [35.2, 31.7] as const, zoom: 9, pitch: 45, bearing: -10 },
    locale: "ru" as const,
  };

  it("keeps parameters it does not own and drops a closed place", () => {
    const q = new URLSearchParams(viewSearch(view, "?theme=dark&place=a15257a&year=1"));
    expect(q.get("theme")).toBe("dark");
    expect(q.get("year")).toBe("30");
    expect(q.has("place")).toBe(false);
  });

  it("round-trips through readUrl", () => {
    expect(readUrl(`?${viewSearch({ ...view, place: "a15257a" })}`)).toEqual({
      ...view,
      place: "a15257a",
      camera: { ...view.camera, center: [35.2, 31.7] },
    });
  });
});

describe("layers and tour in the link", () => {
  const view = {
    year: 47,
    camera: { center: [35.2, 31.7] as const, zoom: 6, pitch: 30, bearing: 0 },
    locale: "ru" as const,
  };

  it("reads the hidden layers as off and the others as on", () => {
    expect(readUrl("?hide=relief,ancient").layers).toEqual({
      borders: true,
      places: true,
      relief: false,
      routes: true,
      roads: true,
      ancient: false,
      battles: true,
    });
    expect(readUrl("?hide=nonsense").layers).toBeUndefined();
  });

  it("reads an older link's listed layers as on, keeping a layer added since on", () => {
    expect(readUrl("?layers=borders,places").layers).toEqual({
      borders: true,
      places: true,
      relief: false,
      routes: false,
      roads: false,
      ancient: true,
      battles: true,
    });
    expect(readUrl("?layers=nonsense").layers).toBeUndefined();
  });

  it("reads a tour id and rejects anything else", () => {
    expect(readUrl("?tour=paul-1").tour).toBe("paul-1");
    expect(readUrl("?tour=<x>").tour).toBeUndefined();
  });

  it("writes layers only when some are off, and the running tour", () => {
    const all = {
      borders: true,
      places: true,
      relief: true,
      routes: true,
      roads: true,
      ancient: true,
      battles: true,
    };
    expect(new URLSearchParams(viewSearch({ ...view, layers: all })).has("hide")).toBe(false);
    const q = new URLSearchParams(
      viewSearch({ ...view, layers: { ...all, relief: false }, tour: "paul-1" }, "?layers=x"),
    );
    expect(q.get("hide")).toBe("relief");
    expect(q.has("layers")).toBe(false);
    expect(q.get("tour")).toBe("paul-1");
    expect(new URLSearchParams(viewSearch(view, "?tour=paul-1")).has("tour")).toBe(false);
  });

  it("keeps the tour's stop, from the second on, and only with a tour", () => {
    expect(readUrl("?tour=exodus&stop=9").stop).toBe(9);
    expect(readUrl("?tour=exodus&stop=0").stop).toBeUndefined();
    expect(readUrl("?tour=exodus&stop=2.5").stop).toBeUndefined();
    expect(readUrl("?stop=9").stop).toBeUndefined();
    const at = (stop: number) =>
      new URLSearchParams(viewSearch({ ...view, tour: "exodus", stop }, "?stop=4"));
    expect(at(9).get("stop")).toBe("9");
    expect(at(1).has("stop")).toBe(false);
    expect(new URLSearchParams(viewSearch(view, "?tour=exodus&stop=4")).has("stop")).toBe(false);
  });

  it("keeps a lesson and its name until another tour starts", () => {
    const from = "?lesson=a15257a.a112427&title=Paul&tour=lesson";
    const running = new URLSearchParams(viewSearch({ ...view, tour: "lesson" }, from));
    expect([running.get("lesson"), running.get("title")]).toEqual(["a15257a.a112427", "Paul"]);
    // A stop's place opened from the lesson: still the lesson's link.
    const place = new URLSearchParams(viewSearch({ ...view, place: "a15257a" }, from));
    expect([place.get("lesson"), place.get("tour")]).toEqual(["a15257a.a112427", null]);
    const other = new URLSearchParams(viewSearch({ ...view, tour: "exodus" }, from));
    expect(other.has("lesson") || other.has("title")).toBe(false);
  });

  it("keeps a chapter on the map, and drops a malformed one", () => {
    expect(readUrl("?ref=Acts.16").ref).toBe("Acts.16");
    expect(readUrl("?ref=Ps.9-Ps.10").ref).toBe("Ps.9-Ps.10");
    expect(readUrl("?ref=Ps.116.10-Ps.116.19").ref).toBe("Ps.116.10-Ps.116.19");
    expect(readUrl("?ref=Acts.16.1.2").ref).toBeUndefined();
    expect(readUrl("?ref=<script>").ref).toBeUndefined();
    expect(new URLSearchParams(viewSearch({ ...view, ref: "Gen.12" })).get("ref")).toBe("Gen.12");
    expect(new URLSearchParams(viewSearch(view, "?ref=Gen.12")).has("ref")).toBe(false);
  });

  it("reads two measured places, and nothing less, more or malformed", () => {
    expect(readUrl("?measure=a15257a,aaf03fa").measure).toEqual(["a15257a", "aaf03fa"]);
    expect(readUrl("?measure=a15257a%2Caaf03fa").measure).toEqual(["a15257a", "aaf03fa"]);
    expect(readUrl("?measure=a15257a").measure).toBeUndefined();
    expect(readUrl("?measure=a15257a,a15257a").measure).toBeUndefined();
    expect(readUrl("?measure=a15257a,aaf03fa,a112427").measure).toBeUndefined();
    expect(readUrl("?measure=a15257a,<script>").measure).toBeUndefined();
    expect(readUrl("?measure=,aaf03fa").measure).toBeUndefined();
    expect(readUrl("?measure=").measure).toBeUndefined();
  });

  it("writes the distance shown and takes it out of a link once it is gone", () => {
    const shown = new URLSearchParams(
      viewSearch({ ...view, measure: ["a15257a", "aaf03fa"] }, "?measure=a15257a,a112427"),
    );
    expect(shown.get("measure")).toBe("a15257a,aaf03fa");
    expect(new URLSearchParams(viewSearch(view, "?measure=a15257a,aaf03fa")).has("measure")).toBe(
      false,
    );
    expect(readUrl(`?${viewSearch({ ...view, measure: ["a15257a", "aaf03fa"] })}`).measure).toEqual(
      ["a15257a", "aaf03fa"],
    );
  });

  it("reads the embed mode only as embed=1", () => {
    expect(readUrl("?embed=1").embed).toBe(true);
    expect(readUrl("?embed=yes").embed).toBeUndefined();
    expect(readUrl("?year=30", "/").embed).toBeUndefined();
    expect(readUrl("?ref=Acts.16", "/embed/v1").embed).toBe(true);
  });
});

describe("preferredLocale", () => {
  const none = () => null;
  it("follows the browser to a published language, by its base tag", () => {
    expect(preferredLocale(["pt-BR", "en"], none)).toBe("pt");
    expect(preferredLocale(["ja", "de-AT"], none)).toBe("de");
    expect(preferredLocale(["ru-RU"], none)).toBe("ru");
  });
  it("opens in English when no language of the browser is published", () => {
    expect(preferredLocale(["ja", "ko"], none)).toBe("en");
    expect(preferredLocale([], none)).toBe("en");
  });
  it("knows the site's code for a browser tag: Norwegian is the Bokmål, Filipino the Tagalog", () => {
    for (const tag of ["no", "nn", "nb-NO", "NB"]) expect(localeOfTag(tag), tag).toBe("nb");
    for (const tag of ["fil", "fil-PH", "tl"]) expect(localeOfTag(tag), tag).toBe("tl");
    for (const tag of ["sr", "sr-Cyrl", "sr-RS", "sr-Latn-RS"])
      expect(localeOfTag(tag), tag).toBe("sr");
    expect(localeOfTag("pt-BR")).toBe("pt");
    // Wave 4: each by its base tag.
    for (const tag of ["hu-HU", "fi-FI", "vi-VN"])
      expect(localeOfTag(tag), tag).toBe(tag.slice(0, 2));
    // Wave 5: Romanian of Romania and of Moldova, Bulgarian.
    for (const tag of ["ro-RO", "ro-MD", "bg-BG"])
      expect(localeOfTag(tag), tag).toBe(tag.slice(0, 2));
    // Nynorsk opens the Bokmål once it is published; until then the browser's next language.
    expect(preferredLocale(["nn-NO", "de"], none)).toBe(isLocale("nb") ? "nb" : "de");
  });
  it("keeps the language the reader picked, over the browser's", () => {
    expect(preferredLocale(["en-US"], () => "pl")).toBe("pl");
    expect(preferredLocale(["en-US"], () => "xx")).toBe("en");
    const blocked = () => {
      throw new Error("storage off");
    };
    expect(preferredLocale(["fr-CA"], blocked)).toBe("fr");
  });
});

describe("startLocale", () => {
  it("opens in the link's language when it names one", () => {
    expect(startLocale({ locale: "pl" })).toBe("pl");
    expect(startLocale({ locale: "ru", embed: true })).toBe("ru");
  });
  it("opens a map without one in a published language", () => {
    expect(isLocale(startLocale({}))).toBe(true);
    expect(isLocale(startLocale({ embed: true }))).toBe(true);
  });
});
