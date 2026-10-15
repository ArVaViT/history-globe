import { describe, expect, it } from "vitest";
import { eventsMatching, type SearchEvent } from "./SearchBox";

const ev = (id: string, en: string, ru: string, year: number): SearchEvent => ({
  id,
  year,
  approximate: false,
  title: { en, ru },
});
const events = [
  ev(
    "issus",
    "Alexander defeats Darius III at Issus",
    "Александр разбивает Дария III при Иссе",
    -332,
  ),
  ev(
    "gaugamela",
    "Alexander defeats Darius III at Gaugamela",
    "Александр разбивает Дария III при Гавгамелах",
    -330,
  ),
];

describe("events in the search", () => {
  it("finds an event by any word of its title, in the reader's language or English", () => {
    expect(eventsMatching(events, "gaugam", "en").map((e) => e.id)).toEqual(["gaugamela"]);
    // A case form: «Гавгамел» finds «при Гавгамелах».
    expect(eventsMatching(events, "Гавгамел", "ru").map((e) => e.id)).toEqual(["gaugamela"]);
    // An English word in another language's interface still finds it.
    expect(eventsMatching(events, "Issus", "ru").map((e) => e.id)).toEqual(["issus"]);
    expect(eventsMatching(events, "Darius", "en")).toHaveLength(2);
  });

  it("takes several words and a name in another case", () => {
    expect(eventsMatching(events, "Darius Issus", "en").map((e) => e.id)).toEqual(["issus"]);
    // The nominative finds the locative of the title: «Гавгамелы» → «при Гавгамелах».
    expect(eventsMatching(events, "Гавгамелы", "ru").map((e) => e.id)).toEqual(["gaugamela"]);
    expect(eventsMatching(events, "Дарий Исс", "ru").map((e) => e.id)).toEqual(["issus"]);
    // The words a search for a battle carries are not asked of the title.
    expect(eventsMatching(events, "battle of Issus", "en").map((e) => e.id)).toEqual(["issus"]);
    expect(eventsMatching(events, "битва при Гавгамелах", "ru").map((e) => e.id)).toEqual([
      "gaugamela",
    ]);
    expect(eventsMatching(events, "battle of", "en")).toEqual([]);
    // A word the title does not have leaves it out.
    expect(eventsMatching(events, "Darius Rome", "en")).toEqual([]);
  });

  it("waits for three letters and offers three at most", () => {
    expect(eventsMatching(events, "Al", "en")).toEqual([]);
    const many = Array.from({ length: 5 }, (_, i) => ev(`e${String(i)}`, "Siege of Tyre", "", i));
    expect(eventsMatching(many, "tyre", "en")).toHaveLength(3);
  });
});
