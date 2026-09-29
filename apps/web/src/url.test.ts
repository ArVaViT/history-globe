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
