import { describe, expect, it } from "vitest";
import type { TourFile } from "../packages/model/src/content.ts";
import { stemsOf, tipnrBook, tourNameErrors } from "./tour-names.ts";

const tour = (cs: { title: string; note: string }) =>
  ({
    id: "abraham",
    title: { en: "Abraham's journey", cs: cs.title },
    people: ["Abraham@Gen.11.26-1Pe"],
    stops: [
      {
        place: "ur",
        ref: "Gen.11.31",
        note: { en: "Terah takes Abram out of Ur, by Egypt's road.", cs: cs.note },
      },
    ],
  }) as unknown as TourFile;
const forms = {
  people: {
    "Abraham@Gen.11.26-1Pe": "Abraham",
    "Terah@Gen.11.24-Luk": "Terach",
    "Saul@1Sa.9.2-Act": "Saul",
    "Egypt@Gen.10.6-1Ch": "Micrajim",
  },
  places: { ur: "Ur" },
};
const placesEn = { ur: "Ur", egypt: "Egypt" };

describe("names in a tour's texts", () => {
  it("finds a name inflected", () => {
    expect(stemsOf("Павел", "ru").some((s) => "павла".includes(s))).toBe(true);
    expect(stemsOf("Lystra", "cs").some((s) => "lystry".includes(s))).toBe(true);
    expect(stemsOf("Assos", "cs").some((s) => "assu".includes(s))).toBe(true);
    expect(stemsOf("Гора Кармель", "uk").some((s) => "на горі кармелі".includes(s))).toBe(true);
  });

  it("does not take one name for another", () => {
    expect(stemsOf("Elias", "da").some((s) => "elija".includes(s))).toBe(false);
    expect(stemsOf("Terach", "cs").some((s) => "tarach".includes(s))).toBe(false);
  });

  it("wants the names file's form in each piece that names the person", () => {
    const bad = tour({ title: "Abrahamova cesta", note: "Tarach vyvádí Abrama z Uru." });
    expect(tourNameErrors(bad, "cs", forms, placesEn, ["Egypt"])).toEqual([
      "tours/abraham.yaml: cs stop 1 note names Terah, not as Terach",
    ]);
    const good = tour({ title: "Abrahamova cesta", note: "Terach vyvádí Abrama z Uru." });
    expect(tourNameErrors(good, "cs", forms, placesEn, ["Egypt"])).toEqual([]);
  });

  it("leaves out people of other books and people called like a state", () => {
    // Egypt the son of Ham is Egypt the state; Saul is first named in 1 Samuel, not in Genesis.
    const t = tour({ title: "Abrahamova cesta", note: "Terach vyvádí Abrama z Uru." });
    expect(tourNameErrors(t, "cs", forms, placesEn, ["Egypt"])).toEqual([]);
    expect(tourNameErrors(t, "cs", forms, placesEn)).toEqual([
      "tours/abraham.yaml: cs stop 1 note names Egypt, not as Micrajim",
    ]);
    expect(tipnrBook("1Kgs.19.8")).toBe("1Ki");
    expect(tipnrBook("Acts.13.4")).toBe("Act");
  });
});
