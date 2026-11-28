import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  containment,
  contentStems,
  DUPLICATE_SHARE,
  indexPolicy,
  type IndexOverrides,
  type PolicyArticle,
  type PolicyQuestion,
  THIN_WORDS,
  wordCount,
} from "./index-policy.ts";
import { changedUrls } from "./indexnow-core.ts";

const words = (n: number, w = "word") => Array.from({ length: n }, () => w).join(" ");
const article = (id: string, place: string, en: string[]): PolicyArticle => ({
  id,
  place,
  body: { en },
});
const question = (id: string, place: string | undefined, en: string[]): PolicyQuestion => ({
  id,
  answer: { en },
  ...(place ? { map: { place } } : {}),
});

const CAPERNAUM =
  "Capernaum lay on the northern shore of the Sea of Galilee at Tell Hum. Excavations show " +
  "the fishing village was founded in the Hasmonean period. Franciscan excavations uncovered " +
  "a limestone synagogue over basalt foundations and a house venerated as Peter's. " +
  words(190, "lakeside");

describe("index policy", () => {
  it("counts words as the build does for an article's length", () => {
    expect(wordCount(["One two  three", " four\nfive "])).toBe(5);
    expect(wordCount([])).toBe(0);
  });

  it("reads content words: no stop words, no short words, stems of six letters", () => {
    expect([...contentStems("The excavations of the excavated synagogue at Tell Hum")]).toEqual([
      "excava",
      "synago",
      "tell",
    ]);
  });

  it("measures how much of a text another holds, not the other way round", () => {
    expect(containment("synagogue basalt", "basalt synagogue harbour fishing")).toBe(1);
    expect(containment("basalt synagogue harbour fishing", "synagogue basalt")).toBe(0.5);
    expect(containment("a of the", "anything")).toBe(0);
  });

  it("leaves out an article under the threshold, and keeps one at it", () => {
    const p = indexPolicy(
      [article("short", "a1", [words(THIN_WORDS - 1)]), article("long", "a2", [words(THIN_WORDS)])],
      [],
    );
    expect([...p.thinArticles]).toEqual(["short"]);
    expect(p.errors).toEqual([]);
  });

  it("leaves out a 'where' question that repeats its place's article, and only that", () => {
    const repeat =
      "Capernaum lay on the northern shore of the Sea of Galilee, at Tell Hum; Franciscan excavations uncovered its synagogue and Peter's house.";
    const own =
      "From Nazareth the road climbed through Cana, then descended past Arbel's cliffs to Magdala, about fifty kilometres by Roman roads.";
    const p = indexPolicy(
      [article("capernaum", "c1", [CAPERNAUM])],
      [
        question("where-was-capernaum", "c1", [repeat]),
        question("how-far-nazareth-to-capernaum", "c1", [repeat]),
        question("where-did-jesus-walk-to-capernaum", "c1", [own]),
        question("where-was-nowhere", undefined, [repeat]),
      ],
    );
    expect(containment(repeat, CAPERNAUM)).toBeGreaterThanOrEqual(DUPLICATE_SHARE);
    expect(containment(own, CAPERNAUM)).toBeLessThan(DUPLICATE_SHARE);
    expect([...p.duplicateQuestions]).toEqual(["where-was-capernaum"]);
  });

  it("keeps the question in search where the article it repeats is left out as thin", () => {
    const p = indexPolicy(
      [article("capernaum", "c1", ["Capernaum lay at Tell Hum on the Sea of Galilee shore."])],
      [
        question("where-was-capernaum", "c1", [
          "Capernaum lay at Tell Hum, on the Sea of Galilee shore.",
        ]),
      ],
    );
    expect([...p.thinArticles]).toEqual(["capernaum"]);
    expect([...p.duplicateQuestions]).toEqual([]);
  });

  it("keeps a repeating question that search engines showed often, and reads merged ids", () => {
    const repeat =
      "Capernaum lay on the northern shore of the Sea of Galilee, at Tell Hum; Franciscan excavations uncovered its synagogue and Peter's house.";
    const arts = [article("capernaum", "c1", [CAPERNAUM])];
    const qs = [
      question("where-was-capernaum", "c1", [repeat]),
      // A question naming a record merged into the place (ADR 0022) is measured all the same.
      question("where-was-old-capernaum", "c0", [repeat]),
    ];
    const searched = { window: "w", min: 40, questions: { "where-was-capernaum": 40 } };
    const p = indexPolicy(arts, qs, { searched }, new Map([["c0", "c1"]]));
    expect([...p.keptSearched]).toEqual(["where-was-capernaum"]);
    expect([...p.duplicateQuestions]).toEqual(["where-was-old-capernaum"]);
    expect(p.shares.get("where-was-old-capernaum")).toBeGreaterThanOrEqual(DUPLICATE_SHARE);
    expect(
      indexPolicy(arts, qs, { searched: { ...searched, questions: { gone: 1 } } }).errors,
    ).toEqual(["index-policy: searched names gone, which is not a question"]);
  });

  it("applies the overrides both ways and refuses one that names nothing or changes nothing", () => {
    const arts = [article("short", "a1", [words(10)]), article("long", "a2", [words(300)])];
    const ok: IndexOverrides = {
      articles: {
        index: { short: "a list of stations, complete as it is" },
        noindex: { long: "under review" },
      },
    };
    const p = indexPolicy(arts, [], ok);
    expect([...p.thinArticles]).toEqual(["long"]);
    expect(p.errors).toEqual([]);
    const bad: IndexOverrides = {
      articles: { index: { long: "x", gone: "x" }, noindex: { short: " " } },
      questions: { noindex: { "where-was-x": "x" } },
    };
    expect(indexPolicy(arts, [], bad).errors).toEqual([
      "index-policy: articles.index: long is indexed by the rule already",
      "index-policy: articles.index names gone, which is not there",
      "index-policy: articles.noindex: short is left out by the rule already",
      "index-policy: articles.noindex: short gives no reason",
      "index-policy: questions.noindex names where-was-x, which is not there",
    ]);
  });

  it("decides by id, so every language of a page is decided together", () => {
    // The policy reads the English master only: a translation, longer or shorter, cannot
    // split a page from its hreflang alternates.
    const a = {
      ...article("short", "a1", [words(50)]),
      body: { en: [words(50)], fi: [words(900)] },
    };
    expect([...indexPolicy([a], []).thinArticles]).toEqual(["short"]);
  });

  it("has a well-formed overrides file", () => {
    const file = JSON.parse(
      readFileSync(join(import.meta.dirname, "../content/index-policy.json"), "utf8"),
    ) as IndexOverrides & { _about?: string };
    expect(file._about).toBeTruthy();
    for (const kind of ["articles", "questions"] as const)
      for (const way of ["index", "noindex"] as const)
        for (const reason of Object.values(file[kind]?.[way] ?? {}))
          expect(reason.trim()).not.toBe("");
  });

  it("IndexNow sends a page that leaves the sitemap once, so engines recrawl it and see noindex", () => {
    const a = "https://historyglobe.app/en/place/a/";
    const b = "https://historyglobe.app/en/q/where-was-b/";
    const first = changedUrls([a, b], {}, null);
    const after = changedUrls([a], {}, first.next);
    expect(after.gone).toEqual([b]);
    expect(changedUrls([a], {}, after.next).gone).toEqual([]);
  });
});
