import { describe, expect, it } from "vitest";
import { inCaseOf, maskPlace, quizOptions, readableLink } from "./print";

describe("readableLink", () => {
  it("prints a lesson's name in its own letters, and types back to the same link", () => {
    const q = new URLSearchParams({ lesson: "a15257a~30", title: "Павел в Афинах: R&D #1 + 50%" });
    const link = `https://example.org/?${q.toString()}`;
    const shown = readableLink(link);
    expect(shown).toContain("title=Павел+в+Афинах:+R%26D+%231+%2B+50%25");
    expect(new URL(shown).searchParams.get("title")).toBe(q.get("title"));
    expect(new URL(shown).searchParams.get("lesson")).toBe("a15257a~30");
  });

  it("leaves a link with no query as it is", () => {
    expect(readableLink("https://example.org/")).toBe("https://example.org/");
  });
});

describe("a quiz", () => {
  const index = {
    pattern: /(?<![\p{L}])(?:Иерусалим|Иерусалима|Иерусалиме)(?![\p{L}])/gu,
    forms: { Иерусалим: "a1", Иерусалима: "a1", Иерусалиме: "a1" },
  };
  it("takes the place out of the text, every mention and case, the others kept", () => {
    expect(
      maskPlace("Из Иерусалима в Вифлеем, и снова в Иерусалиме.", index, "a1", ["Иерусалим"]),
    ).toBe("Из ______ в Вифлеем, и снова в ______.");
  });
  it("takes a short Russian name in any case, but not a longer name it begins", () => {
    expect(maskPlace("Колено идёт до Дана; в Дане живёт Даниил.", null, "x", ["Дан"])).toBe(
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
    expect(maskPlace("требую суда кесарева в Кесарии", null, "x", ["Кесария"])).toBe(
      "требую суда кесарева в ______",
    );
  });
  it("takes out a name the index does not know, by its stem", () => {
    expect(maskPlace("Отплывают из Антиохии.", null, "x", ["Антиохия"])).toBe(
      "Отплывают из ______.",
    );
    expect(maskPlace("В Антиохии Писидийской.", null, "x", ["Антиохия Писидийская"])).toBe(
      "В ______.",
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
