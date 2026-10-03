import { describe, expect, it } from "vitest";
import { readUrl, viewSearch } from "./url";

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
    expect(readUrl("?locale=uk").locale).toBeUndefined();
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

  it("reads the embed mode only as embed=1", () => {
    expect(readUrl("?embed=1").embed).toBe(true);
    expect(readUrl("?embed=yes").embed).toBeUndefined();
    expect(readUrl("?year=30", "/").embed).toBeUndefined();
    expect(readUrl("?ref=Acts.16", "/embed/v1").embed).toBe(true);
  });
});
