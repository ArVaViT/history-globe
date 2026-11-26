// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { maskPlace, quizOptions } from "./quiz";

describe("a quiz", () => {
  const index = {
    pattern: /(?<![\p{L}])(?:Иерусалим|Иерусалима|Иерусалиме)(?![\p{L}])/gu,
    forms: { Иерусалим: "a1", Иерусалима: "a1", Иерусалиме: "a1" },
  };
  it("takes the place out of the text, every mention and case, the others kept", () => {
    expect(
      maskPlace("Из Иерусалима в Вифлеем, и снова в Иерусалиме.", index, "a1", ["Иерусалим"], "ru"),
    ).toBe("Из ______ в Вифлеем, и снова в ______.");
  });
  it("takes a short Russian name in any case, but not a longer name it begins", () => {
    expect(maskPlace("Колено идёт до Дана; в Дане живёт Даниил.", null, "x", ["Дан"], "ru")).toBe(
      "Колено идёт до ______; в ______ живёт Даниил.",
    );
  });
  it("leaves a word that only begins like the name", () => {
    expect(maskPlace("Paul appeals to Caesar at Caesarea.", null, "x", ["Caesarea"], "en")).toBe(
      "Paul appeals to Caesar at ______.",
    );
    expect(maskPlace("Daniel goes to Dan.", null, "x", ["Dan"], "en")).toBe(
      "Daniel goes to ______.",
    );
    expect(maskPlace("требую суда кесарева в Кесарии", null, "x", ["Кесария"], "ru")).toBe(
      "требую суда кесарева в ______",
    );
  });
  it("takes out a name the index does not know, by its stem", () => {
    expect(maskPlace("Отплывают из Антиохии.", null, "x", ["Антиохия"], "ru")).toBe(
      "Отплывают из ______.",
    );
    expect(maskPlace("В Антиохии Писидийской.", null, "x", ["Антиохия Писидийская"], "ru")).toBe(
      "В ______.",
    );
  });
  it("takes out Polish and Czech names with their case endings", () => {
    expect(maskPlace("Paweł płynie z Antiochii.", null, "x", ["Antiochia"], "pl")).toBe(
      "Paweł płynie z ______.",
    );
    expect(maskPlace("Pavel byl v Jeruzalémě.", null, "x", ["Jeruzalém"], "cs")).toBe(
      "Pavel byl v ______.",
    );
    expect(maskPlace("Павле је у Јерусалиму.", null, "x", ["Јерусалим"], "sr")).toBe(
      "Павле је у ______.",
    );
  });
  it("takes out Hungarian, Finnish and Romanian names with their suffixes", () => {
    expect(maskPlace("Pál Jeruzsálemben volt.", null, "x", ["Jeruzsálem"], "hu")).toBe(
      "Pál ______ volt.",
    );
    expect(maskPlace("Jézus Betániában volt.", null, "x", ["Betánia"], "hu")).toBe(
      "Jézus ______ volt.",
    );
    expect(maskPlace("Paavali oli Jerusalemissa.", null, "x", ["Jerusalem"], "fi")).toBe(
      "Paavali oli ______.",
    );
    expect(maskPlace("Joosef meni Egyptiin.", null, "x", ["Egypti"], "fi")).toBe(
      "Joosef meni ______.",
    );
    // Romanian puts its article and case at the end too.
    expect(maskPlace("Lazăr era din satul Betaniei.", null, "x", ["Betania"], "ro")).toBe(
      "Lazăr era din satul ______.",
    );
    expect(maskPlace("Ierusalimul a căzut.", null, "x", ["Ierusalim"], "ro")).toBe(
      "______ a căzut.",
    );
    // Vietnamese does not decline a name: the whole word only.
    expect(maskPlace("Phao-lô ở Giê-ru-sa-lem.", null, "x", ["Giê-ru-sa-lem"], "vi")).toBe(
      "Phao-lô ở ______.",
    );
  });
  it("offers the answer and three others, once each, in name order", () => {
    const o = quizOptions("Листра", ["Дервия", "Листра", "Икония", "Дервия", "Пергия", "Паф"], 3);
    expect(o).toHaveLength(4);
    expect(o).toContain("Листра");
    expect(new Set(o).size).toBe(4);
    expect([...o].sort((a, b) => a.localeCompare(b))).toEqual(o);
    expect(quizOptions("Листра", ["Листра", "Икония"], 1)).toEqual(["Икония", "Листра"]);
  });
});
