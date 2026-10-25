import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { changedSince, isOrcid, ReviewFile } from "../packages/model/src/reviews.ts";
import { itemHash } from "./content-hash.ts";
import { loadReviews, type CurrentHashes } from "./reviews.ts";
import { citation, itemReviewLd, reviewPages, statusLine } from "./review-pages.ts";
import { REVIEW_WORDS } from "./review-words.ts";
import { LOCALES } from "../packages/model/src/time.ts";

/** The one fixture: a fake review, never in content/reviews. */
const FIXTURES = join(import.meta.dirname, "fixtures/reviews");
const fake = () =>
  parse(readFileSync(join(FIXTURES, "2099-01-fake-review.yaml"), "utf8")) as Record<
    string,
    unknown
  >;

/** The items the fixture covers, with their text now. */
const current = (over: Partial<Record<string, string>> = {}): CurrentHashes => ({
  article: new Map([
    ["example-article", over["example-article"] ?? "aaaaaaaaaaaa"],
    ["example-corrected", over["example-corrected"] ?? "cccccccccccc"],
  ]),
  question: new Map([["example-question", "dddddddddddd"]]),
  tour: new Map(),
});

describe("the review schema", () => {
  it("reads the fixture", () => {
    const r = ReviewFile.parse(fake());
    expect(r.reviewer.name).toBe("Dr Example Reviewer");
    expect(r.items).toHaveLength(3);
  });

  it("reads the template a review is published from (docs/reviews)", () => {
    const template = readFileSync(
      join(import.meta.dirname, "../docs/reviews/review-template.yaml"),
      "utf8",
    );
    expect(ReviewFile.safeParse(parse(template)).error).toBeUndefined();
  });

  it("refuses an unknown field rather than dropping it", () => {
    expect(ReviewFile.safeParse({ ...fake(), rating: 5 }).success).toBe(false);
  });

  it("checks the ORCID iD's check digit", () => {
    expect(isOrcid("0000-0002-1825-0097")).toBe(true);
    expect(isOrcid("0000-0002-1825-0098")).toBe(false);
    expect(isOrcid("0000-0002-1825-009")).toBe(false);
  });

  it("refuses consent given before the review, and a version later than it", () => {
    const f = fake();
    expect(
      ReviewFile.safeParse({ ...f, consent: { ...(f.consent as object), date: "2099-01-10" } })
        .success,
    ).toBe(false);
    expect(
      ReviewFile.safeParse({ ...f, version: { date: "2099-02-01", commit: "abc1234" } }).success,
    ).toBe(false);
  });

  it("refuses a date that is not in the calendar", () => {
    expect(ReviewFile.safeParse({ ...fake(), date: "2099-02-30" }).success).toBe(false);
  });

  it("refuses an aspect both checked and not, and a scope outside the closed list", () => {
    const scope = (s: object) => ReviewFile.safeParse({ ...fake(), scope: s }).success;
    expect(scope({ checked: ["dates"], not_checked: ["dates"] })).toBe(false);
    expect(scope({ checked: ["vibes"], not_checked: [] })).toBe(false);
  });

  it("publishes a full review only under CC BY 4.0", () => {
    expect(ReviewFile.safeParse({ ...fake(), licence: "statement-only" }).success).toBe(false);
    const short = fake();
    delete short.full_review;
    expect(ReviewFile.safeParse({ ...short, licence: "statement-only" }).success).toBe(true);
  });

  it("needs a consent record with the hash of the approved text", () => {
    const none = fake();
    delete none.consent;
    expect(ReviewFile.safeParse(none).success).toBe(false);
    expect(
      ReviewFile.safeParse({
        ...fake(),
        consent: { date: "2099-01-20", how: "email", text_sha256: "abc" },
      }).success,
    ).toBe(false);
  });
});

describe("changed since the review", () => {
  it("is false for the version read and for versions the review still covers", () => {
    expect(changedSince({ hash: "aaaaaaaaaaaa" }, "aaaaaaaaaaaa")).toBe(false);
    expect(changedSince({ hash: "bbbbbbbbbbbb", accepted: ["cccccccccccc"] }, "cccccccccccc")).toBe(
      false,
    );
  });

  it("is true for any other text", () => {
    expect(changedSince({ hash: "aaaaaaaaaaaa" }, "eeeeeeeeeeee")).toBe(true);
  });

  it("hashes the English text, not the order of keys or the translations", () => {
    const art = {
      kind: "article" as const,
      title: { en: "Colossae" },
      body: { en: ["One.", "Two."] },
      scripture: ["Col.1.2"],
      sources: ["Strabo 12.8.13"],
    };
    const h = itemHash(art);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    // The same fields written in another order, with a translation beside the English.
    const reordered = {
      sources: art.sources,
      scripture: art.scripture,
      body: art.body,
      title: { ru: "Колоссы", en: "Colossae" },
      kind: art.kind,
    };
    expect(itemHash(reordered)).toBe(h);
    expect(itemHash({ ...art, body: { en: ["One.", "Two!"] } })).not.toBe(h);
    expect(itemHash({ ...art, sources: [...art.sources, "Pliny 5.145"] })).not.toBe(h);
  });

  it("marks the items whose text has moved on since the version read", () => {
    const { reviews, byItem, errors } = loadReviews(
      FIXTURES,
      current({ "example-article": "eeeeeeeeeeee" }),
    );
    expect(errors).toEqual([]);
    expect(reviews[0]?.covers).toEqual([
      { kind: "article", id: "example-article", changed: true },
      { kind: "article", id: "example-corrected", changed: false },
      { kind: "question", id: "example-question", changed: false },
    ]);
    expect(byItem.get("article:example-article")?.[0]).toMatchObject({
      id: "2099-01-fake-review",
      name: "Dr Example Reviewer",
      institution: "Example University (fictional)",
      changed: true,
    });
  });

  it("stops the build on an item that does not exist, or a file named apart from its id", () => {
    const dir = mkdtempSync(join(tmpdir(), "hg-reviews-"));
    writeFileSync(
      join(dir, "2099-01-other-name.yaml"),
      stringify({ ...fake(), items: [{ article: "no-such-article", hash: "aaaaaaaaaaaa" }] }),
    );
    const { errors } = loadReviews(dir, current());
    expect(errors.join("\n")).toMatch(/≠ file name/);
    expect(errors.join("\n")).toMatch(/there is no article "no-such-article"/);
  });
});

describe("no reviews, no page", () => {
  it("reads nothing from a folder that is not there", () => {
    const { reviews, byItem, errors } = loadReviews(join(FIXTURES, "none"), current());
    expect(reviews).toEqual([]);
    expect(byItem.size).toBe(0);
    expect(errors).toEqual([]);
  });

  it("builds no list and no review page, in any language", () => {
    for (const l of LOCALES)
      expect(
        reviewPages({
          l,
          reviews: [],
          item: () => ({ name: "", path: "" }),
          totals: { article: 746, question: 200, tour: 54 },
          site: "",
          policy: "docs/reviews.html",
        }),
      ).toEqual([]);
  });

  it("links an unread article to the methodology and to no review", () => {
    const line = statusLine({
      l: "en",
      reviews: undefined,
      checked: "Checked against its sources; not yet read by a historian.",
      up: "../../../",
      methodology: "docs/methodology.html",
    });
    expect(line).toContain('href="../../../docs/methodology.html"');
    expect(line).toContain("How we check");
    expect(line).not.toContain("reviews/");
    expect(itemReviewLd(undefined, new Map(), "", "en")).toEqual({});
  });
});

describe("a review on the pages", () => {
  const { reviews } = loadReviews(FIXTURES, current({ "example-article": "eeeeeeeeeeee" }));
  const pages = (l: (typeof LOCALES)[number]) =>
    reviewPages({
      l,
      reviews,
      item: (kind, id, lang) => ({ name: id, path: `${lang}/${kind}/${id}/` }),
      totals: { article: 746, question: 200, tour: 54 },
      site: "https://historyglobe.app",
      policy: "docs/reviews.html",
    });

  it("builds the list and the review's own page", () => {
    expect(pages("en").map((p) => p.path)).toEqual([
      "en/reviews",
      "en/reviews/2099-01-fake-review",
    ]);
  });

  it("names the reviewer under an item's title, with the date and the change", () => {
    const line = statusLine({
      l: "en",
      reviews: [
        {
          id: "2099-01-fake-review",
          name: "Dr Example Reviewer",
          institution: "Example University (fictional)",
          date: "2099-01-14",
          status: "published",
          changed: true,
        },
      ],
      checked: "",
      up: "../../../",
      methodology: "docs/methodology.html",
    });
    expect(line).toContain(
      "Reviewed by Dr Example Reviewer, Example University (fictional) · 14 January 2099 · changed since",
    );
    expect(line).toContain('href="../../../en/reviews/2099-01-fake-review/"');
  });

  it("shows the reviewer's words in the original on every language's page, ours beside them", () => {
    const ru = pages("ru")[1]?.body ?? "";
    expect(ru).toContain('<blockquote class="statement" lang="en"><p>Fixture statement');
    expect(ru).toContain("Заявление из теста, в нашем переводе.");
    expect(ru).toContain(REVIEW_WORDS.ru.translationNote);
    expect(ru).toContain(REVIEW_WORDS.ru.englishOnly);
    // German has no translation of the statement: the original only.
    expect(pages("de")[1]?.body).not.toContain(REVIEW_WORDS.de.translationNote);
  });

  it("gives the citation and structured data without a rating", () => {
    const r = reviews[0];
    if (!r) throw new Error("no fixture");
    expect(citation(r, "https://historyglobe.app")).toBe(
      "Reviewer, Example. “Review of History Globe: A fake set of articles for the tests.” In Vadym Arnaut, History Globe. https://historyglobe.app/en/reviews/2099-01-fake-review/ (published 14 January 2099). https://doi.org/10.5281/zenodo.0000000.",
    );
    const ld = JSON.stringify(pages("en")[1]?.ld);
    expect(ld).toContain('"@type":"Review"');
    expect(ld).not.toMatch(/rating/i);
  });
});
