import { z } from "zod";
import { checkRef } from "./verses.ts";
import type { ChapterYears } from "./chapter-years.ts";
import { parseLabel, toAstronomical } from "./time.ts";

/** The single content schema (ADR 0007). Validation here is shape + meaning. */

const osis = z.string().refine(
  (s) => {
    try {
      checkRef(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: "not a valid OSIS reference" },
);

/** An exact year: where the slider goes. "c. 47 AD" is refused, not rounded silently. */
const yearLabel = z.string().transform((s, ctx) => {
  try {
    const label = parseLabel(s);
    if (label.approximate) {
      ctx.addIssue({ code: "custom", message: `"${s}": give the exact year the map should show` });
      return z.NEVER;
    }
    return toAstronomical(label);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});

/** A year that may be approximate ("c. AD 20"): the flag is kept, never dropped. */
const approxYear = z.string().transform((s, ctx) => {
  try {
    const label = parseLabel(s);
    return { year: toAstronomical(label), approximate: label.approximate === true };
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});

/**
 * A text in the languages the code knows: English and Russian always, others as they are
 * translated. Any other key (a typo like `ua:`) is refused rather than dropped.
 */
function inLanguages<T extends z.ZodType>(t: T) {
  return z.strictObject({ en: t, ru: t, uk: t.optional(), de: t.optional() }).transform(
    (o) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as {
        en: z.output<T>;
        ru: z.output<T>;
      } & Record<string, z.output<T>>,
  );
}
/** Every language of a text has as many paragraphs as the English. */
const sameParagraphs = (b: Readonly<Record<string, readonly unknown[] | undefined>>) =>
  Object.values(b).every((p) => p === undefined || p.length === b.en?.length);

const localized = inLanguages(z.string().min(1));

export const PlaceNamesFile = z.strictObject({
  places: z.array(
    z.strictObject({
      id: z.string().regex(/^a[0-9a-f]{6}$/),
      en: z.string(),
      ru: z.string().min(1),
      /** Where the Synodal form was read: a verse and a verbatim excerpt (≤ 10 words). */
      evidence: z.strictObject({ osis, excerpt: z.string().min(1).max(160) }).optional(),
    }),
  ),
});

const RussianLabel = z
  .string()
  .min(1)
  .refine((s) => !/[A-Za-z"]/.test(s) && !s.includes("  "), {
    message: "Cyrillic only, no straight quotes or double spaces",
  });

/** Russian forms of modern place names (OpenBible's m… ids): «Телль-эс-Султан». */
export const ModernNamesFile = z.strictObject({
  names: z.record(z.string().regex(/^m[0-9a-f]{6}$/), RussianLabel),
  /** Candidate-site labels OpenBible writes as free text, by their English wording. */
  labels: z.record(z.string().min(1), RussianLabel).optional(),
  /**
   * English for a modern id whose OpenBible name only repeats the ancient one ("Antioch in
   * Pisidia"): the town the ruins are by.
   */
  names_en: z.record(z.string().regex(/^m[0-9a-f]{6}$/), z.string().min(1)).optional(),
});

export const PolityNamesFile = z.strictObject({
  polities: z.record(z.string().min(1), z.string().min(1)),
});

/** Our corrections on top of Cliopatria: keep a polity on the map for more years. */
export const PolityOverridesFile = z.strictObject({
  overrides: z.array(
    z.strictObject({
      polity: z.string().min(1),
      /** Last year the polity is drawn, inclusive: later than Cliopatria's, or sooner. */
      last_year: yearLabel,
      reason: z.string().min(1),
      sources: z.array(z.string().min(1)).min(1),
    }),
  ),
  /**
   * Polities Cliopatria starts too late or too early: drawn from `first_year`, earlier
   * with their first shape (Israel under David, before Cliopatria's 1000 BC) or later
   * with the earlier shapes cut (the Hyksos from 1650 BC, not 1800).
   */
  starts: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: yearLabel,
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * Shapes Cliopatria draws too far: every shape of the polity is cut to the area given,
   * a convex polygon of [lon, lat] points (Philistia on the coastal plain, not the hills).
   */
  clips: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        within: z.array(z.tuple([z.number(), z.number()])).min(3),
        /** Only in these years (inclusive), the shapes split around them; all years if not given. */
        first_year: yearLabel.optional(),
        last_year: yearLabel.optional(),
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * A polity the data names by one era for longer than it lasted (the New Kingdom of Egypt
   * drawn to 801 BC): from `first_year` on, its shapes and labels take the new name.
   */
  renamed: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: approxYear,
        name: z.string().min(1),
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * Years a polity is drawn but did not exist (Commagene as part of Roman Syria, AD 17-37):
   * its shapes and labels are cut out of them.
   */
  absent: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: yearLabel,
        /** Inclusive. */
        last_year: yearLabel,
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * Years a polity existed but the data leaves it off the map (the Nabataeans in 26-20 BC):
   * its shape and labels from just before are drawn on through them.
   */
  bridges: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: yearLabel,
        /** Inclusive. */
        last_year: yearLabel,
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * Lands an empire took over when a polity ended (Israel as the Assyrian province of
   * Samerina): the polity's last shape is drawn as the empire's for these years, where the
   * empire's own shape does not yet reach.
   */
  annexed: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        by: z.string().min(1),
        first_year: yearLabel,
        /** Inclusive. */
        last_year: yearLabel,
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  /**
   * Years a polity was a vassal or client of another (Judah under Assyria): drawn in the
   * overlord's colour, a little lighter, with `label` as a second line of its name.
   */
  vassals: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        /** The overlord, as named in the data. */
        of: z.string().min(1),
        /** May be approximate ("c. 640 BC"): a vassal's years are often known to a decade. */
        first_year: approxYear,
        /** Inclusive. */
        last_year: approxYear,
        label: localized,
        reason: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
});

/** Dated events of the history the map tells (content/events.yaml), marked on the slider. */
export const EventsFile = z.strictObject({
  events: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      year: approxYear,
      title: localized,
      /** Where it happened, when the event belongs to one place. */
      place: z
        .string()
        .regex(/^a[0-9a-f]{6}$/)
        .optional(),
      /** Or a site of the ancient world (content/ancient-sites.json) the Bible does not name. */
      site: z.string().min(1).optional(),
      /** The passage that tells it, when Scripture itself narrates the event. */
      ref: osis.optional(),
      sources: z.array(z.string().min(1)).min(1),
    }),
  ),
});

/**
 * Battles and sieges (content/battles.yaml): the Bible's, dated as the tours date the same
 * story, and a few outside it that decided Israel's fate (no `ref`). Each at a place and
 * with its sources; drawn on the map in its years.
 */
export const BattlesFile = z.strictObject({
  battles: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      year: approxYear,
      title: localized,
      place: z.string().regex(/^a[0-9a-f]{6}$/),
      /** The passage that tells it; none for a battle the Bible does not tell. */
      ref: osis.optional(),
      sides: localized,
      outcome: localized,
      sources: z.array(z.string().min(1)).min(1),
    }),
  ),
});

/** A battle as the app reads it (content.json). */
export interface HistoryBattle {
  readonly id: string;
  readonly year: number;
  readonly approximate: boolean;
  readonly title: Readonly<Record<string, string>>;
  readonly place: string;
  readonly ref?: string;
  readonly sides: Readonly<Record<string, string>>;
  readonly outcome: Readonly<Record<string, string>>;
  readonly sources: readonly string[];
}

/**
 * When a place existed as a town (content/place-life.yaml): founded, destroyed or
 * abandoned. Outside these years the map shows it faded. Each entry names its sources.
 */
export const PlaceLifeFile = z.strictObject({
  places: z.array(
    z
      .strictObject({
        id: z.string().regex(/^a[0-9a-f]{6}$/),
        en: z.string().min(1),
        /** First year it stood (founded, built, first settled). */
        from: approxYear.optional(),
        /** Last year it stood (destroyed, abandoned), inclusive. */
        until: approxYear.optional(),
        /** Years it lay in ruins between two lives: first and last year of the gap. */
        gap: z.strictObject({ from: approxYear, until: approxYear }).optional(),
        note: localized,
        sources: z.array(z.string().min(1)).min(1),
      })
      .refine((p) => p.from !== undefined || p.until !== undefined || p.gap !== undefined, {
        message: "give from, until, gap or a combination",
      })
      .refine((p) => !p.gap || p.gap.from.year <= p.gap.until.year, {
        message: "the gap must not end before it starts",
      })
      .refine(
        (p) =>
          !p.gap ||
          ((!p.from || p.from.year < p.gap.from.year) &&
            (!p.until || p.gap.until.year < p.until.year)),
        { message: "the gap must lie inside the years the place stood" },
      )
      .refine((p) => !p.from || !p.until || p.from.year <= p.until.year, {
        message: "from must not be after until",
      }),
  ),
});

export const TourFile = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: localized,
  year: yearLabel,
  /** The year is a conventional point for the map (the chronology is debated): "ок.". */
  approximate: z.boolean().optional(),
  /** False when the stops are not a way travelled (the letters' readers): no time on foot. */
  walked: z.boolean().optional(),
  /** Whose way it is: TIPNR person ids ("Paul@Act.7.58-2Pe"), so their card offers it. */
  people: z.array(z.string().regex(/^[^@\s]+@[\w.-]+$/)).optional(),
  stops: z
    .array(
      z.strictObject({
        place: z.string().regex(/^a[0-9a-f]{6}$/),
        ref: osis,
        note: localized,
        /** The map's year at this stop, where the text dates it apart from the tour's. */
        year: yearLabel.optional(),
        /**
         * How the leg to this stop went: sailed (Acts 13:4 «отплыли»), or untold — the text
         * crosses regions without the way (Acts 20:1–3, Ephesus through Macedonia and Greece
         * to Philippi). Either way no time on foot or by road is given.
         */
        by: z.enum(["sea", "untold"]).optional(),
        /**
         * How long the voyage took, where the text says (Acts 20:6 «дней в пять»): the days
         * and the verse that gives them. No speed is guessed for the others.
         */
        sailed: z
          .strictObject({
            days: z.number().int().positive(),
            /** The text gives the days roughly (Acts 20:6 «дней в пять»). */
            about: z.literal(true).optional(),
            ref: osis,
          })
          .optional(),
      }),
    )
    .min(2),
});

export type TourFile = z.output<typeof TourFile>;

/** Paragraphs of an article in one language: two to six, each a real paragraph. */
const paragraphs = z.array(z.string().min(60).max(900)).min(2).max(6);

/**
 * A short article about a place (ADR 0007): an overview across the period, English first,
 * Russian beside it, every claim backed by the Scripture or the sources listed. Status
 * "checked": written and fact-checked in our pipeline; "reviewed": also by a scholar.
 */
/** A photo of a place from Wikimedia Commons: only licences that need no share-alike. */
export const PhotosFile = z.strictObject({
  photos: z.array(
    z.strictObject({
      place: z.string().regex(/^a[0-9a-f]{6}$/),
      /** The Commons file name, without "File:". */
      file: z.string().min(1),
      author: z.string().optional(),
      license: z.string().regex(/^(Public domain|CC0( 1\.0)?|CC BY \d\.\d)$/, {
        message: "only public domain, CC0 or CC BY (no share-alike, ADR 0008)",
      }),
      license_url: z.url().optional(),
      /**
       * The candidate site the photo was taken at (its OpenBible id, m… or a…): required
       * for a disputed place, so the caption names what the picture shows.
       */
      site: z
        .string()
        .regex(/^[am][0-9a-f]{6}$/)
        .optional(),
    }),
  ),
});

export interface PlacePhoto {
  readonly file: string;
  readonly author?: string | undefined;
  readonly license: string;
  readonly license_url?: string | undefined;
  /** For a disputed place: the candidate the photo shows, by language (en always). */
  readonly shows?: { readonly en: string; readonly ru?: string | undefined } | undefined;
}

export const ArticleFile = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  place: z.string().regex(/^a[0-9a-f]{6}$/),
  title: localized,
  body: inLanguages(paragraphs).refine(sameParagraphs, {
    message: "every language has as many paragraphs as the English",
  }),
  scripture: z.array(osis).min(1),
  sources: z.array(z.string().min(3)).min(1),
  status: z.enum(["checked", "reviewed"]),
  /** Who reviewed it, when status is "reviewed". */
  reviewer: z.string().optional(),
});

export type ArticleFile = z.output<typeof ArticleFile>;

/**
 * A question people ask (content/questions): "Where was Nineveh?", answered in two to four
 * paragraphs from our data and its sources, with the view of the map that shows it. Pages
 * for search (scripts/build-pages.ts); "checked" as articles are.
 */
export const QuestionFile = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  question: localized,
  answer: inLanguages(z.array(z.string().min(40).max(900)).min(1).max(4)).refine(sameParagraphs, {
    message: "every language has as many paragraphs as the English",
  }),
  /** The view the page's button opens: a place, a year, a chapter's places. */
  map: z
    .strictObject({
      place: z
        .string()
        .regex(/^a[0-9a-f]{6}$/)
        .optional(),
      year: approxYear.optional(),
      ref: osis.optional(),
    })
    .optional(),
  scripture: z.array(osis).min(1),
  sources: z.array(z.string().min(3)).min(1),
  status: z.enum(["checked", "reviewed"]),
  reviewer: z.string().optional(),
});

export type QuestionFile = z.output<typeof QuestionFile>;

/**
 * Source lines in Russian (content/sources-ru.yaml): each line of an article's, a question's
 * or a place's years' sources, as written, to the line a Russian reader reads — ancient works
 * by their Russian titles, notes in Russian, modern scholarship as it was published.
 */
export const SourcesRuFile = z.record(z.string().min(1), z.string().min(1));

/** An article or a question as the build writes it: its sources in Russian beside them. */
export interface WithSourcesRu {
  readonly sources_ru?: readonly string[];
}

/**
 * What ancient authors outside the Bible say of a place (content/ancient-authors.yaml), in
 * the manner of ToposText: the passage, a free text of it, and our own summary in both
 * languages, never their words in a modern translation.
 */
export const AncientAuthorsFile = z.strictObject({
  mentions: z
    .array(
      z.strictObject({
        place: z.string().regex(/^a[0-9a-f]{6}$/),
        author: localized,
        work: localized,
        /** As the standard edition numbers it: book.section (Josephus by Niese: "5.136-247"). */
        passage: z.string().regex(/^[0-9][0-9a-z.,:;–\- ]*$/),
        url: z.url({ protocol: /^https$/ }),
        // Russian and Ukrainian run longer than English for the same summary.
        note: z.strictObject({
          en: z.string().min(20).max(320),
          ru: z.string().min(20).max(360),
          uk: z.string().min(20).max(360).optional(),
          de: z.string().min(20).max(360).optional(),
        }),
      }),
    )
    .min(1),
});

export type AncientAuthorsFile = z.output<typeof AncientAuthorsFile>;
/** One ancient author's mention of a place, as the card lists it. */
export type AncientMention = AncientAuthorsFile["mentions"][number];

/** What the app loads: content.json in a data release. */
export interface ContentRelease {
  readonly schema_version: 1;
  /** Russian names; `osis` is the verse where the Synodal form was read, if recorded. */
  readonly names: Readonly<Record<string, { readonly ru: string; readonly osis?: string }>>;
  readonly tours: readonly TourFile[];
  /** Russian "where it is today" for places whose English one names another place. */
  readonly where_ru?: Readonly<Record<string, string>>;
  /** English "where it is today" where content/modern-names.yaml words it anew. */
  readonly where_en?: Readonly<Record<string, string>>;
  /** When places existed (content/place-life.yaml); `until` is the last year, inclusive. */
  readonly life?: Readonly<Record<string, PlaceLife>>;
  readonly events?: readonly HistoryEvent[];
  /** Battles and sieges (content/battles.yaml), in order of year. */
  readonly battles?: readonly HistoryBattle[];
  /** Places with an article: place id → article id; the texts load from articles.json. */
  readonly articles?: Readonly<Record<string, string>>;
  /** Photos by place id; the image itself is data/photos/<place id>.jpg. */
  readonly photos?: Readonly<Record<string, PlacePhoto>>;
  /** The place's Pleiades record and the years its periods span (content/pleiades.json). */
  readonly pleiades?: Readonly<Record<string, PleiadesLink>>;
  /** When the chapters happen (content/chapter-years.yaml): book → [from, to, year]. */
  readonly chapter_years?: ChapterYears;
  /** Questions answered with a place on the map (content/questions): place id → id, question. */
  readonly questions?: Readonly<
    Record<string, readonly { readonly id: string; readonly en: string; readonly ru: string }[]>
  >;
}

/** A Pleiades place (CC BY): its id and, when given, the span of the periods it is attested in. */
export interface PleiadesLink {
  readonly id: string;
  readonly from?: number;
  readonly to?: number;
}

export interface HistoryEvent {
  readonly id: string;
  readonly year: number;
  readonly approximate: boolean;
  readonly title: Readonly<Record<string, string>>;
  readonly place?: string;
  /** An ancient site instead of a place: its id and where it is, for the map to fly to. */
  readonly site?: {
    readonly id: string;
    readonly lon: number;
    readonly lat: number;
    readonly rank: number;
  };
  /** The passage that tells it: the event is told in the Bible. */
  readonly ref?: string;
  readonly sources: readonly string[];
}

export interface PlaceLife {
  readonly from?: { readonly year: number; readonly approximate: boolean };
  readonly until?: { readonly year: number; readonly approximate: boolean };
  readonly gap?: {
    readonly from: { readonly year: number; readonly approximate: boolean };
    readonly until: { readonly year: number; readonly approximate: boolean };
  };
  readonly note: Readonly<Record<string, string>>;
  readonly sources: readonly string[];
  /** The sources as a Russian reader reads them (content/sources-ru.yaml). */
  readonly sources_ru?: readonly string[];
  /** Taken over from the city it lies in: says nothing of when the place itself began. */
  readonly inherited?: true;
}

/**
 * When the chapters of the Bible happen (content/chapter-years.yaml): per OSIS book, runs
 * of chapters with the year the map shows them at. Used to take the map to a person's or
 * a chapter's time; undatable books (Gen 1–11, Psalms, Job) are not listed.
 */
export const ChapterYearsFile = z.strictObject({
  books: z.record(
    z.string(),
    z.array(
      z.strictObject({
        chapters: z.string().regex(/^\d+(-\d+)?$/),
        year: z.number().int(),
        approx: z.boolean(),
        note: z.string().min(1),
      }),
    ),
  ),
});

/**
 * The ancient world around the Bible (content/ancient-sites.json): cities, capitals and
 * sanctuaries it does not name, with the years they stood and where the record comes from.
 */
export const AncientSitesFile = z.strictObject({
  sites: z.array(
    z.strictObject({
      id: z.string().regex(/^(\d+|Q\d+)$/),
      en: z.string().min(1),
      ru: z.string().min(1),
      lon: z.number().min(-180).max(180),
      lat: z.number().min(-90).max(90),
      from: z.number().int(),
      to: z.number().int(),
      approx: z.boolean().optional(),
      kind: z.enum(["city", "capital", "sanctuary", "site", "port"]),
      rank: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      sources: z.array(z.string().min(1)).min(1),
    }),
  ),
});
