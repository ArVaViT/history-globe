// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import {
  checkTexts,
  doubledStop,
  FoldedBible,
  foldText,
  misquoted,
  otherBible,
  quotations,
  quotedParts,
  titleNamesPlace,
  type TextExceptions,
} from "./text-checks.ts";

const none: TextExceptions = {
  otherBible: {},
  titleNotMapName: new Set(),
  misquoted: {},
  sameTitle: new Set(),
};

describe("otherBible", () => {
  it("lets Russian name the Synodal text and English the KJV, and no one else", () => {
    expect(otherBible("ru", "Синодальный перевод передаёт слово как «равнина»")).toBeUndefined();
    expect(otherBible("en", "the King James Version translates the word")).toBeUndefined();
    expect(otherBible("en", "the Synodal Bible renders it")).toMatch(/Synodal/);
    expect(otherBible("de", "Die Synodalübersetzung gibt beide Verse wieder")).toMatch(/Synodal/);
    expect(otherBible("cs", "Bible krále Jakuba překládá jméno")).toMatch(/King James/);
    expect(otherBible("ru", "Библия короля Иакова переводит")).toMatch(/King James/);
    expect(otherBible("sr", "Руски синодски превод пише име")).toMatch(/Synodal/);
    expect(otherBible("de", "(in der Authorised Version Azem geschrieben)")).toMatch(/King James/);
    expect(otherBible("fr", "Ivah dans la version autorisée")).toMatch(/King James/);
    expect(otherBible("uk", "як це пишеться в Авторизованому перекладі")).toMatch(/King James/);
    expect(otherBible("en", "Azem, as the Authorised Version spells it")).toBeUndefined();
  });

  it("finds Cyrillic in a language written in Latin letters", () => {
    expect(otherBible("fr", "la carte joint « Каин »")).toMatch(/Каин/);
    expect(otherBible("uk", "«Каин, Гива та Тимна»")).toBeUndefined();
  });

  it("leaves church councils alone", () => {
    expect(otherBible("ro", "a participat la sinodul de la Niceea")).toBeUndefined();
    expect(otherBible("de", "die Synode von Jerusalem")).toBeUndefined();
  });
});

describe("titleNamesPlace", () => {
  it("holds the map's name, or is held by it", () => {
    expect(titleNamesPlace("en", "Aphek in Asher", "Aphek 2")).toBe(true);
    expect(titleNamesPlace("uk", "Кармель", "Гора Кармель")).toBe(true);
    expect(titleNamesPlace("cs", "Achzív v Judsku", "Achzív")).toBe(true);
    expect(titleNamesPlace("uk", "Гесбон", "Хешбон")).toBe(false);
  });

  it("tells a straight apostrophe from a curly one", () => {
    expect(titleNamesPlace("fr", "Porte de l’Angle", "Porte de l'Angle")).toBe(false);
  });
});

describe("quotations", () => {
  it("reads each language's own marks", () => {
    expect(quotations("de", "„Dies sind die Kinder Ehuds“ und „mehr“")).toEqual([
      "Dies sind die Kinder Ehuds",
      "mehr",
    ]);
    expect(quotations("da", "»Kain, Gibea og Timna« og »ti Stæder«")).toEqual([
      "Kain, Gibea og Timna",
      "ti Stæder",
    ]);
    expect(quotations("en", '“Cain, Gibeah, and Timnah” and "went northward"')).toEqual([
      "Cain, Gibeah, and Timnah",
      "went northward",
    ]);
  });

  it("looks for what stands between the writer's omissions and glosses", () => {
    expect(quotedParts("Dies sind die Kinder Ehuds (die da Häupter waren) … gen Manahath")).toEqual(
      ["dies sind die kinder ehuds"],
    );
    expect(foldText("Arabië, en Kanaänieten!")).toBe("arabie en kanaanieten");
  });
});

describe("misquoted", () => {
  const en = new FoldedBible(["And he smote them from Aroer, even till thou come to Minnith"]);
  const de = new FoldedBible(["Und er schlug sie von Aroer an, bis wo man kommt gen Minnith"]);
  const english = "Jephthah “smote them from Aroer, even till thou come to Minnith”.";

  it("passes a quotation word for word from the language's Bible", () => {
    const text = "Jeftah „schlug sie von Aroer an, bis wo man kommt gen Minnith“.";
    expect(misquoted("de", text, english, { en, own: de })).toEqual([]);
  });

  it("refuses a word or ending of the writer's inside the marks", () => {
    const text = "Jeftah „schlug sie von Aroer an, bis man kommt nach Minnith“.";
    expect(misquoted("de", text, english, { en, own: de })).toHaveLength(1);
  });

  it("leaves alone what the English does not quote from the KJV", () => {
    const josephus = "Josephus says “the city was taken by storm in the night”.";
    const text = "Josephus sagt, „die Stadt wurde nachts im Sturm genommen“.";
    expect(misquoted("de", text, josephus, { en, own: de })).toEqual([]);
  });
});

describe("checkTexts", () => {
  const record = (fr: string) => ({
    key: "articles/kain",
    place: "a765bd8",
    texts: { en: ["Kain", "The map joins the two verses."], fr: ["Kaïn", fr] },
  });
  const mapName = (l: string) => (l === "fr" ? "Kaïn" : "Kain");

  it("reports a text that names another Bible", () => {
    const errors = checkTexts(
      [record("La Bible synodale rend « Каин »")],
      ["en", "fr"],
      mapName,
      none,
    );
    expect(errors.join("\n")).toMatch(/articles\/kain: the fr text names the Russian Synodal/);
  });

  it("fails on an exception that passes now, so the lists only shrink", () => {
    const passed = { ...none, otherBible: { "articles/kain": "fr" } };
    const errors = checkTexts(
      [record("La carte joint les deux versets.")],
      ["en", "fr"],
      mapName,
      passed,
    );
    expect(errors).toEqual([
      "text-exceptions: the fr text of articles/kain names no other Bible now",
    ]);
  });

  it("refuses two articles with one title in a language", () => {
    const two = [
      { key: "articles/jericho", place: "a1", texts: { en: ["Jericho"] } },
      { key: "articles/jericho-herodian", place: "a2", texts: { en: ["Jericho"] } },
    ];
    expect(checkTexts(two, ["en"], () => "Jericho", none)).toEqual([
      "articles: jericho, jericho-herodian bear one en title «jericho»",
    ]);
  });
});

describe("doubledStop", () => {
  it("finds a full stop doubled after an abbreviation", () => {
    expect(doubledStop("finished in 515 v. Chr..")).toBe(true);
    expect(doubledStop("опубліковані 1997 р.. Для кордону")).toBe(true);
  });

  it("keeps an ellipsis and a question's two stops", () => {
    expect(doubledStop("and so on... and so on")).toBe(false);
    expect(doubledStop("какая нам часть в Давиде?.. по шатрам")).toBe(false);
    expect(doubledStop("в 515 г. до н. э.")).toBe(false);
  });
});
