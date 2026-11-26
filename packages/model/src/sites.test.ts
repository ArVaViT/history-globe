// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { shareText, siteLabelIn } from "./sites.ts";

const ru = (id: string) => ({ a818a40: "Авила", a217d18: "Вавилон" })[id];

describe("siteLabelIn", () => {
  it("names the place first, in the nominative", () => {
    expect(
      siteLabelIn(
        "ru",
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
      siteLabelIn(
        "ru",
        { label: "same place as Abila", tpl: "same", ref: "a818a40", ref_text: "Abila" },
        ru,
      ),
    ).toBe("там же, где Авила");
  });

  it("keeps the English label without a name in the language or a template", () => {
    expect(
      siteLabelIn(
        "ru",
        { label: "same place as Zer", tpl: "same", ref: "a000001", ref_text: "Zer" },
        ru,
      ),
    ).toBeUndefined();
    expect(siteLabelIn("ru", { label: "in the region north of the Dead Sea" }, ru)).toBeUndefined();
  });

  it("names a modern place in Russian when its form is known", () => {
    const withModern = (id: string) => ({ m123456: "Телль-Хум" })[id] ?? ru(id);
    expect(
      siteLabelIn(
        "ru",
        { label: "Tell Hum", tpl: "name", ref: "m123456", ref_text: "Tell Hum" },
        withModern,
      ),
    ).toBe("Телль-Хум");
  });

  it("keeps a label wholly in English when its Russian form is unknown", () => {
    expect(
      siteLabelIn(
        "ru",
        { label: "Tell Hum", tpl: "name", ref: "m123456", ref_text: "Tell Hum" },
        ru,
      ),
    ).toBeUndefined();
    expect(
      siteLabelIn(
        "ru",
        { label: "along Wadi el Esh", tpl: "along", ref: "m6dddbb", ref_text: "Wadi el Esh" },
        ru,
      ),
    ).toBeUndefined();
  });

  it("says where a place's own name points to its other verses", () => {
    expect(
      siteLabelIn(
        "ru",
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

describe("shareText", () => {
  it("prints whole per cent, and one decimal where the build gives it", () => {
    expect(shareText("en", { share: 80 })).toBe("80");
    expect(shareText("en", { share: 20, share_fine: 19.7 })).toBe("19.7");
    expect(shareText("ru", { share: 20, share_fine: 20.2 })).toBe("20,2");
    expect(shareText("de", { share: 20, share_fine: 20 })).toBe("20,0");
  });
});
