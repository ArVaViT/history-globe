import { describe, expect, it } from "vitest";
import { openApi, violations } from "./api-openapi.ts";

const spec = openApi("1") as {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, object> };
};
const { schemas } = spec.components;
// Philippi as api/v1/places.json has it (2026-10-17), trimmed to two languages.
const philippi = {
  id: "a49e1d0",
  name: "Philippi",
  names: { ru: "Филиппы", uk: "Філіппи" },
  name_ru: "Филиппы",
  kind: "settlement",
  lon: 24.28458,
  lat: 41.01207,
  verses: 4,
  wikidata: "Q379652",
  pleiades: "501482",
  page: { en: "/en/place/philippi/", ru: "/ru/place/philippi/" },
};

describe("the API description", () => {
  it("describes every file build-api.ts writes", () => {
    for (const path of [
      "/index.json",
      "/places.json",
      "/verses/{book}.json",
      "/chapters/{book}.json",
      "/people.json",
      "/tours.json",
      "/events.json",
      "/battles.json",
      "/questions.json",
      "/ancient.json",
      "/openapi.json",
    ])
      expect(spec.paths).toHaveProperty([path]);
  });

  it("accepts a real place, and a field it does not know (readers must ignore them)", () => {
    expect(violations(philippi, { $ref: "#/components/schemas/Place" }, schemas)).toEqual([]);
    expect(
      violations({ ...philippi, future: 1 }, { $ref: "#/components/schemas/Place" }, schemas),
    ).toEqual([]);
  });

  it("refuses a place that lost a field the importers read, or changed its type", () => {
    const noLat: Record<string, unknown> = { ...philippi };
    delete noLat.lat;
    expect(violations(noLat, { $ref: "#/components/schemas/Place" }, schemas)).toEqual([
      "$: no lat",
    ]);
    expect(
      violations({ ...philippi, verses: "4" }, { $ref: "#/components/schemas/Place" }, schemas),
    ).toEqual(["$.verses: not an integer"]);
    expect(
      violations(
        { ...philippi, wikidata: "379652" },
        { $ref: "#/components/schemas/Place" },
        schemas,
      ),
    ).toHaveLength(1);
  });

  it("checks a chapter file's values", () => {
    const chapters = {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/Chapter" },
    };
    expect(
      violations(
        { "Acts.16": { places: ["a49e1d0"], people: ["Lydia@Act.16.14-"] } },
        chapters,
        schemas,
      ),
    ).toEqual([]);
    expect(violations({ "Acts.16": { places: ["a49e1d0"] } }, chapters, schemas)).toEqual([
      "$.Acts.16: no people",
    ]);
  });
});
