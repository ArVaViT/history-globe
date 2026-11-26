// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import {
  bareMile,
  copied,
  englishLeft,
  eventIds,
  missingAndStale,
  notCyrillic,
  titlesMissing,
  wrongCenturies,
} from "./source-checks.ts";

describe("missingAndStale", () => {
  it("finds lines with no translation and translations of no line", () => {
    const cited = new Set(["Josephus, Life 269", "Strabo 16.2.45"]);
    const table = { "Josephus, Life 269": "Josephus, Vita 269", "Pliny 5.71": "Plinius 5.71" };
    expect(missingAndStale(cited, table)).toEqual({
      missing: ["Strabo 16.2.45"],
      stale: ["Pliny 5.71"],
    });
  });
});

describe("englishLeft", () => {
  const en = "B. Mazar, 'Jerusalem', in E. Stern (ed.), The New Encyclopedia (1993) (the walls)";
  it("lets a modern citation copied as it stands keep its English", () => {
    const t = "B. Mazar, 'Jerusalem', in: E. Stern (ed.), The New Encyclopedia (1993) (die Mauern)";
    expect(englishLeft(en, t, "de")).toEqual([]);
  });
  it("finds our own words left in English, also at the edge of a citation", () => {
    expect(
      englishLeft(
        en,
        "B. Mazar, 'Jerusalem', in E. Stern (ed.), The New Encyclopedia (1993) (стены)",
        "ru",
      ),
    ).toEqual(["in"]);
    expect(
      englishLeft(
        "Theophilus, ed. and tr. A. Mingana, BJRL 13 (1929)",
        "Феофил, ed. and tr. A. Mingana, BJRL 13 (1929)",
        "ru",
      ),
    ).toEqual(["ed.", "and", "tr."]);
  });
  it("finds a locator in English even in a line copied whole", () => {
    const line = "W. M. Ramsay, The Cities of St. Paul (1907), part V: Derbe";
    expect(englishLeft(line, line, "de")).toEqual(["part"]);
    expect(englishLeft("Leichty, RINAP 4, text 60", "Leichty, RINAP 4, testo 60", "it")).toEqual(
      [],
    );
  });
  it("takes a language's own word for its own (Dutch 'of', German 'in')", () => {
    expect(
      englishLeft(
        "Pliny 5.71 (the lake or its shore)",
        "Plinius 5.71 (het meer of de oever)",
        "nl",
      ),
    ).toEqual([]);
  });
  it("does not take a capital for the English word (German 'See', the initial 'P.')", () => {
    expect(
      englishLeft("Josephus 3.506 (the lake)", "Josephus 3.506 (der See; P. Geyer)", "de"),
    ).toEqual([]);
  });
});

describe("copied", () => {
  it("marks the words of a run copied from the English, without our words at its ends", () => {
    expect(
      copied("in E. Stern (ed.), The Encyclopedia", "у E. Stern (ed.), The Encyclopedia"),
    ).toEqual([false, true, true, true, true, true]);
  });
});

describe("notCyrillic", () => {
  it("finds names declined in Latin letters, units and Russian letters", () => {
    expect(
      notCyrillic(
        "Wikipedia, 'Calneh' (Albright's reading)",
        "Wikipedia, 'Calneh' (Albrightovo читање)",
        "sr",
      ),
    ).toEqual(["Albrightovo"]);
    expect(
      notCyrillic(
        "Wikipedia, 'Iksal' (5 km south-east)",
        "Wikipedia, 'Iksal' (5 km југоисточно)",
        "sr",
      ),
    ).toEqual(["km"]);
    expect(notCyrillic("Annals (Kullania)", "Анали (Кулания)", "sr")).toEqual(["я"]);
  });
  it("keeps modern authors, quotations, numerals and websites as published", () => {
    expect(
      notCyrillic(
        "Pliny 5.16 in Bostock and Riley (Livius translation, III)",
        "Плиније 5.16 код Bostock и Riley (превод са сајта Livius.org, III)",
        "sr",
      ),
    ).toEqual([]);
    expect(notCyrillic("Pliny 34.2 ('in Cypro')", "Плиније 34.2 („in Cypro“)", "sr")).toEqual([]);
  });
});

describe("bareMile", () => {
  it("finds a mile that does not say whose", () => {
    expect(bareMile("fem mil ovenfor Det Døde Hav")).toBe(true);
    expect(bareMile("3 miles nordøst for Anata")).toBe(true);
    expect(bareMile("fem romerske mil ovenfor")).toBe(false);
    expect(bareMile("10 engelska mil söder om Tyrus")).toBe(false);
    expect(bareMile("milepæl")).toBe(false);
  });
});

describe("wrongCenturies", () => {
  it("finds hundreds that no century of the English gives", () => {
    expect(wrongCenturies("Madaba Map (sixth century)", "Madaba-kartet (600-tallet)")).toEqual([7]);
    expect(
      wrongCenturies(
        "the temples of the 3rd and 2nd centuries BC",
        "templen från 300- och 200-talen f.Kr.",
      ),
    ).toEqual([4]);
    expect(wrongCenturies("mosaics; 1st–9th c. AD", "mosaiker; 100–800-talen e.Kr.")).toEqual([2]);
  });
  it("passes the right hundreds", () => {
    expect(wrongCenturies("Madaba Map (sixth century)", "Madaba-kartet (500-tallet)")).toEqual([]);
    expect(wrongCenturies("centre 4th–12th c.", "keskus 300–1100-luvuilla")).toEqual([]);
  });
});

describe("eventIds", () => {
  it("finds events named by their ids", () => {
    const ids = new Set(["second-temple", "cyrus-edict"]);
    expect(
      eventIds("History Globe dated events (cyrus-edict 538 BC; second-temple c. 516 BC)", ids),
    ).toEqual(["cyrus-edict", "second-temple"]);
    expect(
      eventIds("History Globe dated events (“Cyrus lets the exiles return”, 538 BC)", ids),
    ).toEqual([]);
  });
});

describe("titlesMissing", () => {
  it("finds a tour or event not given as the site titles it", () => {
    const titles = new Map([["Paul's arrest and trials", "Арестуването и съденето на Павел"]]);
    const en = "History Globe tour “Paul's arrest and trials” (AD 57)";
    expect(titlesMissing(en, "Маршрутът „Арестът и съдебните процеси на Павел“", titles)).toEqual([
      "Арестуването и съденето на Павел",
    ]);
    expect(titlesMissing(en, "Маршрутът „Арестуването и съденето на Павел“", titles)).toEqual([]);
  });
});
