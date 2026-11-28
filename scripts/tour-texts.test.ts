import { describe, expect, it } from "vitest";
import type { TourFile } from "../packages/model/src/content.ts";
import { tourTextErrors, withoutTexts } from "./tour-texts.ts";

const stop = (story?: Record<string, string>) =>
  ({ place: "a1", ref: "Acts.13.4", note: { en: "x" }, ...(story ? { story } : {}) }) as const;
const tour = (extra: object, stops: ReturnType<typeof stop>[]) =>
  ({ id: "t", stops, ...extra }) as unknown as TourFile;

describe("tour page texts", () => {
  it("passes a tour with no texts at all", () => {
    expect(tourTextErrors(tour({}, [stop()]), ["en"])).toEqual([]);
  });

  it("wants sources and a story at every stop in every language with an intro", () => {
    const t = tour({ intro: { en: ["i"] } }, [stop({ en: "s" }), stop()]);
    expect(tourTextErrors(t, ["en", "ru"])).toEqual([
      "tours/t.yaml: an intro without sources",
      "tours/t.yaml: stop 2 has no en story",
      "tours/t.yaml: no ru intro",
      "tours/t.yaml: stop 1 has no ru story",
      "tours/t.yaml: stop 2 has no ru story",
    ]);
  });

  it("refuses stories without an intro", () => {
    expect(tourTextErrors(tour({}, [stop({ en: "s" })]), ["en"])).toHaveLength(1);
  });

  it("keeps the texts out of the map's tours", () => {
    const t = tour({ intro: { en: ["i"] }, sources: ["s"] }, [stop({ en: "s" })]);
    const m = withoutTexts(t);
    expect(m).not.toHaveProperty("intro");
    expect(m).not.toHaveProperty("sources");
    expect(m.stops[0]).not.toHaveProperty("story");
    expect(t.stops[0]).toHaveProperty("story");
  });
});
