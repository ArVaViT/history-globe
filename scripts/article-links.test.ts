import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { textPlacesFrom } from "../packages/model/src/text-places.ts";
import {
  BLOCK,
  DENY,
  linkedPlaces,
  linkParagraphs,
  ONLY_FROM,
  QUOTES,
  quoteRuns,
  refusal,
} from "./article-links.ts";

const index = textPlacesFrom({
  forms: {
    Jerusalem: "jer",
    Jérusalem: "jer",
    Jerusalén: "jer",
    Damascus: "dam",
    Damasco: "dam",
    Galilee: "gal",
    "Sea of Galilee": "sea",
    Nazareth: "naz",
    Bethsaida: "bet",
    Иерусалим: "jer",
    Иерусалима: "jer",
    Jordan: "jor",
    Dothan: "dot",
    Rameses: "ram",
    Elam: "ela",
    Syria: "syr",
    Сирии: "syr",
    Neapolis: "a6a7150",
    Susa: "sus",
  },
  names: ["Jordan"],
});
const all = () => true;
/** The paragraphs as text with the links marked [like this](id). */
const marked = (paras: string[], o: Partial<Parameters<typeof linkParagraphs>[2]> = {}) =>
  linkParagraphs(paras, index, { linkable: all, lang: "en", ...o }).map((segs) =>
    segs.map((s) => (s.place ? `[${s.text}](${s.place})` : s.text)).join(""),
  );

describe("links in an article's text", () => {
  it("links each place once, at its first mention in the whole text", () => {
    expect(
      marked(["From Nazareth to Jerusalem.", "Back in Nazareth, then Bethsaida and Jerusalem."]),
    ).toEqual([
      "From [Nazareth](naz) to [Jerusalem](jer).",
      "Back in Nazareth, then [Bethsaida](bet) and Jerusalem.",
    ]);
  });

  it("never links the text's own place or its records", () => {
    expect(marked(["Capernaum lay near Bethsaida."], { self: ["bet"] })).toEqual([
      "Capernaum lay near Bethsaida.",
    ]);
  });

  it("prefers the longer name: the Sea of Galilee is not Galilee", () => {
    expect(marked(["On the Sea of Galilee, in Galilee."])).toEqual([
      "On the [Sea of Galilee](sea), in [Galilee](gal).",
    ]);
  });

  it("finds a declined form (the index lists them)", () => {
    expect(marked(["Путь до Иерусалима."], { lang: "ru" })).toEqual(["Путь до [Иерусалима](jer)."]);
  });

  it("links no page that may not be linked, and does not link it later either", () => {
    expect(marked(["Nazareth, Nazareth."], { linkable: (id) => id !== "naz" })).toEqual([
      "Nazareth, Nazareth.",
    ]);
  });

  it("leaves a first name the index lists beside a capitalised word alone (Jordan Peterson)", () => {
    expect(marked(["Jordan Peterson came by the Jordan."])).toEqual([
      "Jordan Peterson came by the [Jordan](jor).",
    ]);
  });

  it("drops a pair read as wrong in one text (DENY), in its languages", () => {
    const deny = [{ text: "a", place: "jer", langs: ["ru"], why: "test" }];
    expect(marked(["Jerusalem"], { text: "a", lang: "ru", deny })).toEqual(["Jerusalem"]);
    expect(marked(["Jerusalem"], { text: "a", lang: "en", deny })).toEqual(["[Jerusalem](jer)"]);
    expect(marked(["Jerusalem"], { text: "b", lang: "ru", deny })).toEqual(["[Jerusalem](jer)"]);
  });

  it("keeps the text as it was, links or not", () => {
    const paras = ["“Jerusalem” and Galilee, the Sea of Galilee.", "Nazareth  (twice spaced)."];
    expect(
      linkParagraphs(paras, index, { linkable: all }).map((s) => s.map((x) => x.text).join("")),
    ).toEqual(paras);
  });

  it("gives every DENY entry a reason, a place id and a text that exists", () => {
    const content = join(import.meta.dirname, "../content");
    for (const d of DENY) {
      expect(d.why.length).toBeGreaterThan(10);
      expect(d.place).toMatch(/^a[0-9a-f]{6}$/);
      const file = d.text.startsWith("q:")
        ? join(content, "questions", `${d.text.slice(2)}.yaml`)
        : join(content, "articles", `${d.text}.yaml`);
      expect(existsSync(file), d.text).toBe(true);
    }
    for (const texts of Object.values(ONLY_FROM))
      for (const t of texts)
        expect(existsSync(join(content, "articles", `${t}.yaml`)), t).toBe(true);
  });
});

describe("quotations, as each language writes them", () => {
  it("links nothing inside quotation marks, and the next mention outside instead", () => {
    expect(marked(["Isaiah: “go up to Jerusalem”, he said; Jerusalem then fell."])).toEqual([
      "Isaiah: “go up to Jerusalem”, he said; [Jerusalem](jer) then fell.",
    ]);
  });

  it("reads Danish »…« the Danish way round, not as «…» backwards", () => {
    const da = ["fra Galilæa og »fra Jerusalem«, så Jerusalem igen."];
    expect(marked(da, { lang: "da" })).toEqual([
      "fra Galilæa og »fra Jerusalem«, så [Jerusalem](jer) igen.",
    ]);
    // The old reading took «, så Jerusalem igen.» for the quotation, and linked inside it.
    expect(quoteRuns(da[0] ?? "", "da").filter((r) => r.quoted)).toEqual([
      { text: "»fra Jerusalem«", quoted: true },
    ]);
  });

  it("knows each language's marks", () => {
    const cases: [string, string][] = [
      ["ru", "«Иерусалим» и Иерусалим"],
      ["de", "„Jerusalem“ und Jerusalem"],
      ["pl", "„Jerusalem” i Jerusalem"],
      ["cs", "„Jerusalem“ a Jerusalem"],
      ["hu", "„Jerusalem” és Jerusalem"],
      ["sv", "”Jerusalem” och Jerusalem"],
      ["fi", "”Jerusalem” ja Jerusalem"],
      ["fr", "« Jérusalem » et Jérusalem"],
      ["it", "«Jerusalem» e ‘Jerusalem’ e Jerusalem"],
      ["en", "‘Jerusalem’ and Jerusalem"],
    ];
    for (const [lang, text] of cases) {
      const [out = ""] = marked([text], { lang });
      expect(out, lang).toMatch(/\[(?:Jerusalem|Иерусалим|Jérusalem)\]\(jer\)$/u);
      expect((out.match(/\(jer\)/g) ?? []).length, lang).toBe(1);
    }
    expect(Object.keys(QUOTES)).toHaveLength(21);
  });

  it("takes an apostrophe for an apostrophe, not the end of a quotation", () => {
    expect(marked(["‘the Lord’s house in Jerusalem’ and Nazareth"])).toEqual([
      "‘the Lord’s house in Jerusalem’ and [Nazareth](naz)",
    ]);
    // A Swedish ” inside a word does not open a quotation.
    expect(marked(["Jerusalem”s"], { lang: "sv" })).toEqual(["[Jerusalem](jer)”s"]);
    // An apostrophe is not a quotation mark.
    expect(marked(["l’ouest de Jérusalem"], { lang: "fr" })).toEqual([
      "l’ouest de [Jérusalem](jer)",
    ]);
  });

  it("runs a quotation left open to the paragraph's end", () => {
    expect(marked(["He wrote: “to Jerusalem, and Nazareth"])).toEqual([
      "He wrote: “to Jerusalem, and Nazareth",
    ]);
  });
});

describe("longer names and the words around a name", () => {
  it("leaves a longer name that is another thing alone (BLOCK), and notes the place", () => {
    const refused = new Set<string>();
    expect(marked(["North of the Damascus Gate, on the road to Damascus."], { refused })).toEqual([
      "North of the Damascus Gate, on the road to [Damascus](dam).",
    ]);
    expect(refused.has("dam")).toBe(true);
    expect(BLOCK.en).toContain("Damascus Gate");
    // A name written alike in every language is blocked in all of them.
    expect(marked(["Flavia Neapolis"], { lang: "de", text: "philippi" })).toEqual([
      "Flavia Neapolis",
    ]);
  });

  it("refuses a person: a first name before, a numeral after (English)", () => {
    expect(marked(["Excavations by Moshe Dothan at Dothan."])).toEqual([
      "Excavations by Moshe Dothan at Dothan.",
    ]);
    expect(marked(["Under Rameses II, Rameses grew."])).toEqual([
      "Under Rameses II, Rameses grew.",
    ]);
    expect(refusal("", " III fought", "pt", false, "Rameses")).toBe("numeral");
    // At the start of a sentence, or after an adjective of a people, the place stays.
    expect(marked(["At Nazareth Jesus taught."])).toEqual(["At [Nazareth](naz) Jesus taught."]);
    expect(refusal("the Ammonite ", "", "en", false, "Rabbah")).toBeUndefined();
    expect(refusal("Ezekiel's ", "", "en", false, "Tel-abib")).toBeUndefined();
    // Not in a language whose word order is free: there the word before is often the subject.
    expect(refusal("Pompeius ", "", "hu", false, "Rómának")).toBeUndefined();
  });

  it("keeps a name that was a person's the person's for the rest of the text", () => {
    expect(marked(["Digs by Moshe Dothan.", "Dothan's work at Dothan was not published."])).toEqual(
      ["Digs by Moshe Dothan.", "Dothan's work at Dothan was not published."],
    );
  });

  it("links neither of two places a translation names alike", () => {
    expect(marked(["los canales de Susa"], { lang: "es", ambiguous: new Set(["sus"]) })).toEqual([
      "los canales de Susa",
    ]);
  });

  it("refuses a son in a genealogy", () => {
    expect(marked(["Aram, the brother of Elam, and Elam's land."])).toEqual([
      "Aram, the brother of Elam, and Elam's land.",
    ]);
  });

  it("refuses a gate or a book named after a place, not a gate of the town", () => {
    expect(refusal("El Talmud de ", "", "es", false, "Jerusalén")).toBe("named after");
    expect(refusal("la Puerta de ", "", "es", false, "Susa")).toBe("named after");
    expect(refusal("era una puerta de ", "", "es", false, "Jerusalén")).toBeUndefined();
    expect(refusal("", " Talmud says", "en", false, "Jerusalem")).toBe("named after");
  });

  it("refuses today's state for a land, not the land of the Bible", () => {
    expect(refusal("in what is now ", "", "en", true, "Syria")).toBe("modern state");
    expect(refusal("на землях нынешней ", "", "ru", true, "Сирии")).toBe("modern state");
    expect(refusal("A vidék ma ", "", "hu", true, "Szíria")).toBe("modern state");
    expect(refusal("със столица Тил Барсип, днес Тел Ахмар в ", "", "bg", true, "Сирия")).toBe(
      "modern state",
    );
    expect(refusal("Today four states meet at the gulf, ", ", Israel", "en", true, "Egypt")).toBe(
      "modern state",
    );
    expect(refusal("The Assyrians took it. Then ", "", "en", true, "Syria")).toBeUndefined();
    expect(refusal("the kings of ", "", "en", true, "Syria")).toBeUndefined();
    // A town is not a state: "modern Jerusalem" is Jerusalem.
    expect(refusal("modern ", "", "en", false, "Jerusalem")).toBeUndefined();
    // "the Jordan" is the river, "in Jordan" the kingdom.
    expect(marked(["Madaba in Jordan, near the Jordan."])).toEqual([
      "Madaba in Jordan, near the [Jordan](jor).",
    ]);
    expect(refusal("the lower ", "", "en", false, "Jordan")).toBeUndefined();
    expect(refusal("a village in southern ", "", "en", true, "Syria")).toBe("modern state");
    expect(refusal("the North Aegean region of ", "", "en", true, "Greece")).toBe("modern state");
    expect(refusal("the kings of Upper ", "", "en", true, "Egypt")).toBeUndefined();
    expect(refusal("the ", "'s Karak", "en", false, "Jordan")).toBe("modern state");
  });

  it("links a place some texts only mean from them (ONLY_FROM)", () => {
    expect(marked(["to Neapolis"], { text: "philippi" })).toEqual(["to [Neapolis](a6a7150)"]);
    expect(marked(["to Neapolis (Nablus)"], { text: "shechem" })).toEqual(["to Neapolis (Nablus)"]);
  });
});

describe("a translation", () => {
  it("links only what the English links, and nothing the English refused", () => {
    const refused = new Set<string>();
    const en = linkParagraphs(
      ["To Jerusalem; the Jerusalem Talmud; Damascus and the Damascus Gate."],
      index,
      { linkable: all, lang: "en", refused },
    );
    const allow = new Set([...linkedPlaces(en)].filter((id) => !refused.has(id)));
    expect([...allow]).toEqual([]);
    // Spanish has no BLOCK of its own: what the English refused stays plain.
    expect(
      marked(["El Talmud de Jerusalén; Jerusalén; la Puerta de Damasco; Damasco."], {
        lang: "es",
        allow,
      }),
    ).toEqual(["El Talmud de Jerusalén; Jerusalén; la Puerta de Damasco; Damasco."]);
    expect(marked(["Nazareth и Иерусалим."], { lang: "ru", allow: new Set(["jer"]) })).toEqual([
      "Nazareth и [Иерусалим](jer).",
    ]);
  });
});
