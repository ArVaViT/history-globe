import { describe, expect, it } from "vitest";
import { splitPlaces, textPlacesFrom } from "./text-places";

const index = textPlacesFrom({
  forms: {
    Иерусалим: "a1",
    Иерусалима: "a1",
    Вифлееме: "a2",
    "Антиохию Писидийскую": "a3",
    Антиохию: "",
    Jordan: "a4",
    "Мертвого моря": "a5",
  },
  names: ["Jordan"],
});
const places = (text: string, self?: string[]) =>
  splitPlaces(text, index, self)
    .filter((s) => s.place)
    .map((s) => `${s.text}:${String(s.place)}`);

describe("splitPlaces", () => {
  it("finds the places a verse names, each once", () => {
    expect(places("Из Иерусалима в Вифлееме, и снова Иерусалим.")).toEqual([
      "Иерусалима:a1",
      "Вифлееме:a2",
    ]);
  });

  it("keeps the text whole around them", () => {
    const text = "Из Иерусалима в Вифлееме.";
    expect(
      splitPlaces(text, index)
        .map((s) => s.text)
        .join(""),
    ).toBe(text);
  });

  it("never links the card's own place", () => {
    expect(places("Иерусалим и Вифлееме", ["a1"])).toEqual(["Вифлееме:a2"]);
  });

  it("prefers the longer name and leaves a blocked one alone", () => {
    expect(places("пришли в Антиохию Писидийскую")).toEqual(["Антиохию Писидийскую:a3"]);
    expect(places("пришли в Антиохию")).toEqual([]);
  });

  it("reads ё as е and a line break as a space", () => {
    expect(places("у Мёртвого\nморя")).toEqual(["Мёртвого\nморя:a5"]);
  });

  it("leaves a first name beside a capitalised word", () => {
    expect(places("Jordan Peterson spoke")).toEqual([]);
    expect(places("They crossed the Jordan.")).toEqual(["Jordan:a4"]);
  });
});
