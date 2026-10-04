import { describe, expect, it } from "vitest";
import { localizeCitation, sourcesOf } from "./citation.ts";

describe("localizeCitation", () => {
  it("gives Bible references the Synodal books and numbering", () => {
    expect(localizeCitation("2 Kgs 25:8-10; Jer 52:12-14", "ru")).toBe(
      "4 Цар 25:8–10; Иер 52:12–14",
    );
    expect(localizeCitation("2 Kgs 18:13-19:37", "ru")).toBe("4 Цар 18:13–19:37");
    expect(localizeCitation("1 John 2:1", "ru")).toBe("1 Ин 2:1");
  });
  it("names the ancient works in Russian and leaves the rest", () => {
    expect(localizeCitation("Josephus, Jewish War 6.249-266", "ru")).toBe(
      "Флавий, «Иудейская война» 6.249-266",
    );
    expect(localizeCitation("I. Shaw (ed.), The Oxford History of Ancient Egypt", "ru")).toBe(
      "I. Shaw (ed.), The Oxford History of Ancient Egypt",
    );
  });
  it("changes nothing in English", () => {
    expect(localizeCitation("2 Kgs 25:8-10", "en")).toBe("2 Kgs 25:8-10");
  });
});

describe("ancient works in Russian", () => {
  it("are named in full before their authors alone", () => {
    expect(localizeCitation("Herodotus, Histories 1.178-183", "ru")).toBe(
      "Геродот, «История» 1.178-183",
    );
    expect(localizeCitation("Pliny the Elder, Natural History 5.70", "ru")).toBe(
      "Плиний Старший, «Естественная история» 5.70",
    );
    expect(localizeCitation("Amarna letters EA 287-290", "ru")).toBe("Амарнские письма EA 287-290");
  });
});

describe("sourcesOf", () => {
  const x = {
    sources: ["Egeria, Itinerarium 10-12 (the ascent of Mount Nebo)"],
    sources_ru: ["Эгерия, «Паломничество» 10–12 (восхождение на гору Нево)"],
  };
  it("reads the build's Russian lines in Russian, the written ones in English", () => {
    expect(sourcesOf(x, "ru")).toEqual(x.sources_ru);
    expect(sourcesOf(x, "en")).toEqual(x.sources);
  });
  it("falls back to the automatic pass where the build wrote no Russian", () => {
    expect(sourcesOf({ sources: ["Livy 44.45"] }, "ru")).toEqual(["Тит Ливий 44.45"]);
  });
});
