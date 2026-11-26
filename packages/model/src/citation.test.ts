// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { sourcesOf } from "./citation.ts";

describe("sourcesOf", () => {
  const x = {
    sources: [
      "Egeria, Itinerarium 10-12 (the ascent of Mount Nebo)",
      "B. Mazar, The Mountain of the Lord (1975)",
    ],
    sources_ru: [
      "Эгерия, «Паломничество» 10–12 (восхождение на гору Нево)",
      "B. Mazar, The Mountain of the Lord (1975)",
    ],
    sources_in: {
      de: [
        "Egeria, Itinerarium 10–12 (der Aufstieg auf den Berg Nebo)",
        "B. Mazar, The Mountain of the Lord (1975)",
      ],
    },
  };
  it("reads the build's lines in the reader's language", () => {
    expect(sourcesOf(x, "ru")).toEqual(x.sources_ru);
    expect(sourcesOf(x, "de")).toEqual(x.sources_in.de);
  });
  it("reads the English where the build wrote no other lines", () => {
    // English itself, and a language whose lines all read as in English.
    expect(sourcesOf(x, "en")).toEqual(x.sources);
    expect(sourcesOf(x, "fr")).toEqual(x.sources);
  });
});
