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
    expect(readUrl("?year=5000").year).toBe(100);
    expect(readUrl("?year=-9000").year).toBe(-1999);
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

  it("reads the listed layers as on and the others as off", () => {
    expect(readUrl("?layers=borders,places").layers).toEqual({
      borders: true,
      places: true,
      relief: false,
      routes: false,
    });
    expect(readUrl("?layers=nonsense").layers).toBeUndefined();
  });

  it("reads a tour id and rejects anything else", () => {
    expect(readUrl("?tour=paul-1").tour).toBe("paul-1");
    expect(readUrl("?tour=<x>").tour).toBeUndefined();
  });

  it("writes layers only when some are off, and the running tour", () => {
    const all = { borders: true, places: true, relief: true, routes: true };
    expect(new URLSearchParams(viewSearch({ ...view, layers: all })).has("layers")).toBe(false);
    const q = new URLSearchParams(
      viewSearch({ ...view, layers: { ...all, relief: false }, tour: "paul-1" }, "?layers=x"),
    );
    expect(q.get("layers")).toBe("borders,places,routes");
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
});
