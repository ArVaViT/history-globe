import { describe, expect, it } from "vitest";
import { siteLabelRu } from "./sites.ts";

const ru = (id: string) => ({ a818a40: "Авила", a217d18: "Вавилон" })[id];

describe("siteLabelRu", () => {
  it("names the place first, in the nominative", () => {
    expect(
      siteLabelRu(
        {
          label: "within 250 km of Babylon",
          tpl: "within",
          ref: "a217d18",
          ref_text: "Babylon",
          n: "250",
          unit: "km",
        },
        ru,
      ),
    ).toBe("Вавилон, в радиусе 250 км");
    expect(
      siteLabelRu(
        { label: "same place as Abila", tpl: "same", ref: "a818a40", ref_text: "Abila" },
        ru,
      ),
    ).toBe("то же место, что Авила");
  });

  it("keeps the English label without a Synodal name or a template", () => {
    expect(
      siteLabelRu({ label: "same place as Zer", tpl: "same", ref: "a000001", ref_text: "Zer" }, ru),
    ).toBeUndefined();
    expect(siteLabelRu({ label: "in the region north of the Dead Sea" }, ru)).toBeUndefined();
  });

  it("leaves labels that name a modern place wholly in English", () => {
    expect(
      siteLabelRu({ label: "Tell Hum", tpl: "name", ref: "m123456", ref_text: "Tell Hum" }, ru),
    ).toBeUndefined();
    expect(
      siteLabelRu(
        { label: "along Wadi el Esh", tpl: "along", ref: "m6dddbb", ref_text: "Wadi el Esh" },
        ru,
      ),
    ).toBeUndefined();
  });

  it("says where a place's own name points to its other verses", () => {
    expect(
      siteLabelRu(
        {
          label: "same place as Abila in other verses",
          tpl: "same_name",
          ref: "a818a40",
          ref_text: "Abila",
        },
        ru,
      ),
    ).toBe("там же, где Авила в других стихах");
  });
});
