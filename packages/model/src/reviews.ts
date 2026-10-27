import { z } from "zod";
import { LOCALES, type SiteLocale } from "./time.ts";

/**
 * Reviews by scholars (content/reviews/*.yaml, docs/reviews/README.md): one file a review,
 * written only after the reviewer has approved its exact public text. The reviewer's own
 * words (statement, scope note, conflicts, full review, the points they raised) are kept in
 * the language they wrote them in and never translated in place; our own words (the set's
 * title, our response) are English first, other languages as they are translated.
 *
 * The schema is shape and meaning; that every item exists and what has changed since the
 * review are checked by the build (scripts/reviews.ts).
 */

/** What a reviewer can say they checked, or did not: a closed list, translated (review-words.ts). */
export const REVIEW_SCOPES = [
  "identification",
  "dates",
  "archaeology",
  "ancient_sources",
  "scholarship",
  "scripture",
  "place_names",
  "map",
  "translations",
  "theology",
] as const;
export type ReviewScope = (typeof REVIEW_SCOPES)[number];

/** What a review covers: place articles, answered questions and tours, by their ids. */
export const REVIEW_KINDS = ["article", "question", "tour"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

/**
 * A calendar date of our own time, YYYY-MM-DD, that exists (not 2026-02-30). Compared as
 * text: the form sorts as the dates do. Not a historical year (ADR 0003 is about those).
 */
const day = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/, { message: "a date as YYYY-MM-DD" })
  .refine(
    (s) => {
      const [y = 0, m = 0, d = 0] = s.split("-").map(Number);
      const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
      return d >= 1 && d <= days;
    },
    { message: "not a calendar date" },
  );

/** The short hash of an item's English text (scripts/content-hash.ts): 12 hex digits. */
const itemHash = z.string().regex(/^[0-9a-f]{12}$/, { message: "a 12-digit hex hash" });
/** A language tag for the reviewer's own words: "en", "de", "pt-BR". */
const lang = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { message: "a language tag" });

/** An ORCID iD whose check digit is right (ISO 7064 11,2), as 0000-0002-1825-0097. */
export function isOrcid(s: string): boolean {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return false;
  const digits = s.replace(/-/g, "");
  let total = 0;
  for (const c of digits.slice(0, 15)) total = (total + Number(c)) * 2;
  const check = (12 - (total % 11)) % 11;
  return digits.at(-1) === (check === 10 ? "X" : String(check));
}

/** Our own words: English always, the other languages as they are translated. */
const opt = z.string().min(1).optional();
const ours = z
  .strictObject({
    en: z.string().min(1),
    ru: opt,
    uk: opt,
    es: opt,
    pt: opt,
    de: opt,
    fr: opt,
    it: opt,
    nl: opt,
    pl: opt,
    cs: opt,
    sv: opt,
    nb: opt,
    da: opt,
    tl: opt,
    sr: opt,
    hu: opt,
    fi: opt,
    vi: opt,
    ro: opt,
    bg: opt,
  })
  .transform(
    (o) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as {
        en: string;
      } & Partial<Record<SiteLocale, string>>,
  );

/** One item reviewed: its id, and the hash of its English text in the version read. */
const versions = {
  hash: itemHash,
  /**
   * Later versions the review still covers: our corrections in answer to it, a typo fixed.
   * Any other change shows "changed since" on the item's page.
   */
  accepted: z.array(itemHash).min(1).optional(),
};
const slug = z.string().regex(/^[a-z0-9-]+$/);
const item = z.union([
  z.strictObject({ article: slug, ...versions }),
  z.strictObject({ question: slug, ...versions }),
  z.strictObject({ tour: slug, ...versions }),
]);

export const ReviewFile = z
  .strictObject({
    /** Stable, in the address (/en/reviews/<id>/): the month and a short name of the set. */
    id: z.string().regex(/^\d{4}-\d{2}-[a-z0-9-]+$/, { message: "YYYY-MM-name" }),
    /** The set reviewed, in our words ("The Lycus valley and the churches of Revelation"). */
    title: ours,
    reviewer: z.strictObject({
      /** As they write it; never transliterated. */
      name: z.string().min(1),
      /** Their own form in another script, only if they gave it ("Іван Петренко"). */
      name_native: z.string().min(1).optional(),
      /** For "Cite this review": the family name and the given names, as they wish. */
      family: z.string().min(1),
      given: z.string().min(1),
      title: z.string().min(1),
      /** The official name, at the time of the review. */
      institution: z.string().min(1),
      url: z.url({ protocol: /^https$/ }).optional(),
      orcid: z.string().refine(isOrcid, { message: "not a valid ORCID iD" }).optional(),
    }),
    /** The date of the reviewer's report. */
    date: day,
    /** The version they read: its date and the commit of the repository. */
    version: z.strictObject({ date: day, commit: z.string().regex(/^[0-9a-f]{7,40}$/) }),
    items: z.array(item).min(1),
    scope: z.strictObject({
      checked: z.array(z.enum(REVIEW_SCOPES)).min(1),
      not_checked: z.array(z.enum(REVIEW_SCOPES)),
      /** The reviewer's own reservation, in their words ("I did not check the Byzantine material"). */
      note: z.string().min(1).optional(),
      /** With `translations` checked: the languages whose texts they read (default: their statement's). */
      languages: z.array(z.enum(LOCALES)).min(1).optional(),
    }),
    /** The reviewer's statement, in their words and language, as approved. */
    statement: z.strictObject({
      lang,
      text: z.string().min(1),
      /** Our translations, marked as ours on the page; the original is always shown. */
      translations: z.partialRecord(z.enum(LOCALES), z.string().min(1)).optional(),
    }),
    /** Conflicts of interest as the reviewer declared them, even "None declared.". */
    conflicts: z.string().min(1),
    /** The whole review, when the reviewer has made it public: its paragraphs, as written. */
    full_review: z.strictObject({ lang, paragraphs: z.array(z.string().min(1)).min(1) }).optional(),
    /** Our answer, point by point: their point as written, what we did, in our words. */
    response: z
      .array(
        z.strictObject({
          point: z.string().min(1),
          action: z.enum(["fixed", "partly", "declined", "open"]),
          detail: ours,
          /** The commit that made the correction. */
          commit: z
            .string()
            .regex(/^[0-9a-f]{7,40}$/)
            .optional(),
        }),
      )
      .optional(),
    /** The reviewer has read our response and confirmed it (only with their consent). */
    response_confirmed: z.boolean().optional(),
    /** CC BY 4.0, or only a short statement published, with no licence to reuse it. */
    licence: z.enum(["CC-BY-4.0", "statement-only"]),
    doi: z
      .string()
      .regex(/^10\.\d{4,9}\/\S+$/)
      .optional(),
    /**
     * The reviewer's written approval of the exact public text: the date, how, and the
     * SHA-256 of the text approved (the letter itself stays in the author's private files).
     */
    consent: z.strictObject({
      date: day,
      how: z.enum(["email", "letter"]),
      text_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    status: z.enum(["published", "corrections-in-progress"]),
  })
  .refine((r) => r.version.date <= r.date, {
    message: "the version read must not be later than the review",
  })
  .refine((r) => r.date <= r.consent.date, {
    message: "consent is given to the final text, after the review",
  })
  .refine((r) => r.scope.checked.every((s) => !r.scope.not_checked.includes(s)), {
    message: "an aspect cannot be both checked and not checked",
  })
  .refine((r) => !r.scope.languages || r.scope.checked.includes("translations"), {
    message: "scope.languages names the translations read, so translations must be checked",
  })
  .refine((r) => r.licence === "CC-BY-4.0" || !r.full_review, {
    message: "a full review is published only under CC BY 4.0",
  });
export type ReviewFile = z.output<typeof ReviewFile>;

/** The languages whose translation the reviewer read: none unless `translations` was checked. */
export function translationsRead(r: ReviewFile): readonly string[] {
  if (r.scope.checked.includes("translations"))
    return r.scope.languages ?? [r.statement.lang.split("-")[0] ?? r.statement.lang];
  return [];
}

/** The kind and id of a reviewed item, whichever key it was written with. */
export function itemOf(i: ReviewFile["items"][number]): { kind: ReviewKind; id: string } {
  if ("article" in i) return { kind: "article", id: i.article };
  if ("question" in i) return { kind: "question", id: i.question };
  return { kind: "tour", id: i.tour };
}

/**
 * Whether an item has changed since the review: its text now is neither the version read
 * nor one the review was marked as still covering.
 */
export function changedSince(
  entry: { readonly hash: string; readonly accepted?: readonly string[] | undefined },
  now: string,
): boolean {
  return now !== entry.hash && !(entry.accepted ?? []).includes(now);
}

/** A review as an item's page shows it, under the title (articles/<language>.json, pages). */
export interface ItemReview {
  readonly id: string;
  readonly name: string;
  readonly institution: string;
  /** The date of the review, YYYY-MM-DD. */
  readonly date: string;
  readonly status: "published" | "corrections-in-progress";
  /** The item's text has changed since the version read. */
  readonly changed: boolean;
  /** The languages whose translation the reviewer read (translationsRead). */
  readonly translations: readonly string[];
}

/** A review as the build writes it for the pages (apps/web/build/reviews.json). */
export type ReviewRecord = ReviewFile & {
  readonly covers: readonly { kind: ReviewKind; id: string; changed: boolean }[];
};
