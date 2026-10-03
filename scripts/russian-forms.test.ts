import { describe, expect, it } from "vitest";
import { russianForms } from "./russian-forms.ts";

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
