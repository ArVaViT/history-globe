// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { inCaseOf, russianForms } from "./russian-forms.ts";

describe("russianForms", () => {
  it("declines one word by its ending", () => {
    expect(russianForms("Иерусалим")).toEqual(
      expect.arrayContaining([
        "Иерусалим",
        "Иерусалима",
        "Иерусалиму",
        "Иерусалимом",
        "Иерусалиме",
      ]),
    );
    expect(russianForms("Самария")).toEqual(
      expect.arrayContaining(["Самарии", "Самарию", "Самарией"]),
    );
    expect(russianForms("Газа")).toContain("Газы");
    expect(russianForms("Лахис")).toContain("Лахиса");
    expect(russianForms("Афины")).toEqual(expect.arrayContaining(["Афин", "Афинах"]));
  });

  it("uses и after г, к, х and hushers", () => {
    expect(russianForms("Азека")).toContain("Азеки");
    expect(russianForms("Азека")).not.toContain("Азекы");
  });

  it("leaves names in a vowel and short names as written", () => {
    expect(russianForms("Мегиддо")).toEqual(["Мегиддо"]);
    expect(russianForms("Шоа")).toEqual(["Шоа"]);
    expect(russianForms("Ур")).toEqual(["Ур"]);
  });

  it("declines a noun and its adjective together", () => {
    const f = russianForms("Антиохия Писидийская");
    expect(f).toEqual(expect.arrayContaining(["Антиохии Писидийской", "Антиохию Писидийскую"]));
    expect(f).not.toContain("Антиохии Писидийская");
    expect(russianForms("Кесария Филиппова")).toContain("Кесарии Филипповой");
    expect(russianForms("Море Галилейское")).toContain("Морем Галилейским");
    expect(russianForms("Соленое море")).toContain("Соленого моря");
    expect(russianForms("Рамоф Галаадский")).toContain("Рамофе Галаадском");
  });

  it("declines only the first word before a name, and writes it small too", () => {
    const f = russianForms("Гора Синай");
    expect(f).toEqual(expect.arrayContaining(["Горы Синай", "горе Синай"]));
    expect(f).not.toContain("Горы Синая");
  });

  it("drops the fleeting vowel of Египет", () => {
    expect(russianForms("Египет")).toEqual(expect.arrayContaining(["Египта", "Египте", "Египтом"]));
    expect(russianForms("Египет")).not.toContain("Египете");
  });

  it("takes «Долина», «Пустыня» for nouns and a short name for no possessive", () => {
    expect(russianForms("Долина Сорек")).toEqual(
      expect.arrayContaining(["Долины Сорек", "долине Сорек"]),
    );
    expect(russianForms("Долина Изреельская")).toContain("Долины Изреельской");
    expect(russianForms("Пустыня Син")).toEqual(expect.arrayContaining(["пустыне Син"]));
    expect(russianForms("Пустыня Син")).not.toContain("Пустыне Сину");
    expect(russianForms("Аппиева площадь")).toEqual(["Аппиева площадь"]);
  });

  it("reads ё as е", () => {
    expect(russianForms("Мёртвое море")).toContain("Мертвого моря");
  });
});

describe("the quiz's choices in Russian", () => {
  it("take the case of the gap", () => {
    expect(inCaseOf("Павел вышел из Ефеса и пришёл", "Ефес", ["Вифлеем", "Ефес"])).toEqual([
      "Вифлеема",
      "Ефеса",
    ]);
    // «Самарии» is genitive, dative or prepositional: «в» decides.
    expect(inCaseOf("Филипп проповедовал в Самарии", "Самария", ["Ефес", "Самария"])).toEqual([
      "Ефесе",
      "Самарии",
    ]);
  });

  it("stay as they are when the name stands in the nominative or a choice does not decline", () => {
    expect(inCaseOf("Ефес — главный город Асии", "Ефес", ["Ефес", "Вифлеем"])).toEqual([
      "Ефес",
      "Вифлеем",
    ]);
    expect(inCaseOf("пришёл из Ефеса", "Ефес", ["Ефес", "Мегиддо"])).toEqual(["Ефес", "Мегиддо"]);
  });
});

describe("the quiz's choices in Russian, more than one gap", () => {
  it("stay as they are when the gaps stand in different cases", () => {
    expect(inCaseOf("пришёл в Ефес, а потом вышел из Ефеса", "Ефес", ["Ефес", "Вифлеем"])).toEqual([
      "Ефес",
      "Вифлеем",
    ]);
  });

  it("read the whole name, not another place's first word", () => {
    expect(
      inCaseOf("из Антиохии Сирийской в Антиохию Писидийскую", "Антиохия Писидийская", [
        "Антиохия Писидийская",
        "Самария",
      ]),
    ).toEqual(["Антиохию Писидийскую", "Самарию"]);
  });
});
