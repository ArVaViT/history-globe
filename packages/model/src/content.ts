// The single content schema (ADR 0007). Validation here is shape + meaning.

import { z } from "zod";
import { checkRef } from "./verses.ts";
import type { ChapterYears } from "./chapter-years.ts";
import { ALL_LOCALES, type Locale } from "./locales.ts";
import { parseLabel, toAstronomical } from "./time.ts";

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** A verse, chapter or range that exists; checkRef's own message says what is wrong. */
const osis = z.string().superRefine((s, ctx) => {
  try {
    checkRef(s);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: messageOf(e) });
  }
});

/** A year that may be approximate ("c. AD 20"): the flag is kept, never dropped. */
const approxYear = z.string().transform((s, ctx) => {
  try {
    const label = parseLabel(s);
    return { year: toAstronomical(label), approximate: label.approximate === true };
  } catch (e) {
    ctx.addIssue({ code: "custom", message: messageOf(e) });
    return z.NEVER;
  }
});
export type ApproxYear = z.output<typeof approxYear>;

/** An exact year: where the slider goes. "c. 47 AD" is refused, not rounded silently. */
const yearLabel = approxYear.transform(({ year, approximate }, ctx) => {
  if (!approximate) return year;
  ctx.addIssue({
    code: "custom",
    message: "an approximate year: give the exact year the map should show",
  });
  return z.NEVER;
});

/** One of our places (OpenBible's ancient ids). */
const placeId = z.string().regex(/^a[0-9a-f]{6}$/);
/** One of our places, or an ancient site by its Pleiades number or Wikidata id. */
const placeOrSite = z.string().regex(/^(a[0-9a-f]{6}|\d{1,12}|Q\d{1,12})$/);
/** The sources a correction or an entry rests on: at least one. */
const sources = z.array(z.string().min(1)).min(1);
/** A polygon of [lon, lat] points, open or closed. */
const ring = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(3);

/**
 * A text in the languages the code knows: English and Russian always, others as they are
 * translated. Any other key (a typo like `ua:`) is refused rather than dropped. `t` may
 * give each language its own schema.
 */
function inLanguages<T extends z.ZodType>(t: T | ((locale: Locale) => T)) {
  const of = (l: Locale) => (typeof t === "function" ? t(l) : t);
  const shape = Object.fromEntries(
    ALL_LOCALES.map((l) => [l, l === "en" || l === "ru" ? of(l) : of(l).optional()]),
  );
  return z.strictObject(shape).transform(
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
      id: placeId,
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

/**
 * The names in one more language (content/names-<code>.yaml): biblical places by id, the
 * states by their English name, modern names by OpenBible id, people by TIPNR id.
 */
export const LocaleNamesFile = z.strictObject({
  places: z.record(z.string(), z.string().min(1)),
  polities: z.record(z.string(), z.string().min(1)),
  modern: z.record(z.string(), z.string().min(1)),
  people: z.record(z.string(), z.string().min(1)),
  /** The ancient world's sites (content/ancient-sites.json) by their id. */
  ancient: z.record(z.string(), z.string().min(1)).optional(),
  /** OpenBible's free-text today lines ("in the region east of Gibeon"), translated whole. */
  labels: z.record(z.string(), z.string().min(1)).optional(),
});
export type LocaleNamesFile = z.output<typeof LocaleNamesFile>;
/** The languages whose names come from content/names-<code>.yaml (Russian has its own files). */
export const NAME_LOCALES = ALL_LOCALES.filter(
  (l): l is Exclude<Locale, "en" | "ru"> => l !== "en" && l !== "ru",
);

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

/**
 * Places whose state the map must show (content/polity-anchors.yaml): a capital or a key
 * town lies inside the polity named for each period, inside some polity in the years
 * between, or the years are a gap left blank on purpose, with the reason.
 */
export const PolityAnchorsFile = z.strictObject({
  anchors: z.array(
    z.strictObject({
      name: z.string().min(1),
      /** A place (places.geojson) or an ancient site (content/ancient-sites*.json) by id. */
      place: z.string().min(1).optional(),
      /** Or a point, for a site in neither list. */
      at: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
      periods: z
        .array(
          z.strictObject({
            first_year: yearLabel,
            /** Inclusive. */
            last_year: yearLabel,
            /** The polity as named on the map, or "any". */
            polity: z.string().min(1),
          }),
        )
        .min(1),
      blank: z
        .array(
          z.strictObject({
            first_year: yearLabel,
            /** Inclusive. */
            last_year: yearLabel,
            reason: z.string().min(1),
          }),
        )
        .optional(),
      sources,
    }),
  ),
});

/** Our corrections on top of Cliopatria: keep a polity on the map for more years. */
export const PolityOverridesFile = z.strictObject({
  overrides: z.array(
    z.strictObject({
      polity: z.string().min(1),
      /** Last year the polity is drawn, inclusive: later than Cliopatria's, or sooner. */
      last_year: yearLabel,
      reason: z.string().min(1),
      sources,
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
        sources,
      }),
    )
    .optional(),
  /**
   * Shapes Cliopatria draws too far: every shape of the polity is cut to the area given,
   * a convex polygon of [lon, lat] points (Philistia on the coastal plain, not the hills),
   * or the area given is cut out of it (`without`, any simple polygon, years required).
   * The land cut away goes to the polity named in `to` in the same years; land it leaves
   * without any state must be declared with `leaves_blank` (the build checks).
   */
  clips: z
    .array(
      z
        .strictObject({
          polity: z.string().min(1),
          within: ring.optional(),
          without: ring.optional(),
          /** Only in these years (inclusive), the shapes split around them; all years if not given. */
          first_year: yearLabel.optional(),
          last_year: yearLabel.optional(),
          /** The polity that took the land cut away: it is added to its shapes of these years. */
          to: z.string().min(1).optional(),
          /** The land cut away is left without a state on purpose; the reason says why. */
          leaves_blank: z.literal(true).optional(),
          reason: z.string().min(1),
          sources,
        })
        .refine((c) => (c.within === undefined) !== (c.without === undefined), {
          message: "a clip has either `within` or `without`",
        })
        .refine(
          (c) =>
            (c.without === undefined && c.to === undefined) ||
            (c.first_year !== undefined && c.last_year !== undefined),
          { message: "`without` and `to` need first_year and last_year" },
        )
        .refine((c) => c.to === undefined || c.leaves_blank === undefined, {
          message: "land given `to` a polity is not left blank",
        }),
    )
    .optional(),
  /**
   * Land a polity held that its shape leaves out (Judah's Negev, Urartu's capital on Lake
   * Van): the outline, a simple polygon, is added to every shape of it standing in these
   * years. Approximate: an outline is drawn to the precision of the sources, no finer.
   */
  extends: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: yearLabel,
        /** Inclusive. */
        last_year: yearLabel,
        outline: ring,
        reason: z.string().min(1),
        sources,
      }),
    )
    .optional(),
  /**
   * States Cliopatria does not draw at all (Aram-Damascus, Moab, Edom, Ammon): our own
   * approximate outline for these years, less the land of the polities in `minus` standing
   * in the same years, so that it never covers a neighbour. Named at `label`; its names in
   * every language come from the polity-name files like any other.
   */
  drawn: z
    .array(
      z.strictObject({
        polity: z.string().min(1),
        first_year: yearLabel,
        /** Inclusive. */
        last_year: yearLabel,
        outline: ring,
        label: z.tuple([z.number(), z.number()]),
        minus: z.array(z.string().min(1)).optional(),
        reason: z.string().min(1),
        sources,
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
        sources,
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
        sources,
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
        sources,
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
        sources,
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
        sources,
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
      place: placeId.optional(),
      /** Or a site of the ancient world (content/ancient-sites.json) the Bible does not name. */
      site: z.string().min(1).optional(),
      /**
       * Or the field of a battle that no gazetteer here holds as a place (Gaugamela, Issus):
       * a point from Pleiades or Wikidata and the page it comes from. Drawn with the battles.
       */
      battlefield: z
        .strictObject({
          lon: z.number().min(-180).max(180),
          lat: z.number().min(-90).max(90),
          source: z.url(),
        })
        .optional(),
      /** The passage that tells it, when Scripture itself narrates the event. */
      ref: osis.optional(),
      sources,
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
      /** A place of the data build, or an ancient site by its Pleiades number (Gamla). */
      place: placeOrSite,
      /**
       * The event of events.yaml that tells the same story (Samaria falls, 722 BC), at the
       * same place within a year: the lists show the story once.
       */
      event: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      /** The passage that tells it; none for a battle the Bible does not tell. */
      ref: osis.optional(),
      sides: localized,
      outcome: localized,
      sources,
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
  /** The event (HistoryEvent) that tells the same story: listed once. */
  readonly event?: string;
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
        id: placeId,
        en: z.string().min(1),
        /** First year it stood (founded, built, first settled). */
        from: approxYear.optional(),
        /** Last year it stood (destroyed, abandoned), inclusive. */
        until: approxYear.optional(),
        /** Years it lay in ruins between two lives: first and last year of the gap. */
        gap: z.strictObject({ from: approxYear, until: approxYear }).optional(),
        /**
         * An older town of the same name stood nearby before `from` (Ephesus by the
         * Artemision, Old Smyrna across the bay): the point is the later city's, and the
         * card says so instead of "not yet built".
         */
        older: z.literal(true).optional(),
        note: localized,
        sources,
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
        /** One of our places, or an ancient site (its Pleiades number) the Bible does not name. */
        place: placeOrSite,
        /** The verse that tells it; a stop told outside the Bible has a `source` instead. */
        ref: osis.optional(),
        /**
         * The ancient author who tells it, where the Bible does not (Josephus, Jewish War
         * 3.7): the passage and a free translation of it to read.
         */
        source: z
          .strictObject({
            cite: localized,
            url: z.url(),
          })
          .optional(),
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
    .min(2)
    .refine((stops) => stops.every((s) => (s.ref === undefined) !== (s.source === undefined)), {
      message: "every stop has a verse (ref) or a source, not both",
    }),
});

export type TourFile = z.output<typeof TourFile>;

/** Paragraphs of an article in one language: two to six, each a real paragraph. */
const paragraphs = z.array(z.string().min(60).max(900)).min(2).max(6);

/** Fact-checked in our pipeline; a scholar's review is a file of its own (content/reviews). */
const checked = z.literal("checked", {
  message: '"checked": a review goes into content/reviews, not into the text',
});

/**
 * The licence text a photo's credit must link to, in one form: CC BY X.Y and CC0 at their
 * canonical address (https, the version, a closing slash, no "deed"); none for the public
 * domain, which has no licence text.
 */
export function photoLicenceUrl(license: string): string | undefined {
  const by = /^CC BY (\d\.\d)$/.exec(license);
  if (by) return `https://creativecommons.org/licenses/by/${by[1] ?? ""}/`;
  if (license.startsWith("CC0")) return "https://creativecommons.org/publicdomain/zero/1.0/";
  return undefined;
}

/** A photo of a place from Wikimedia Commons: only licences that need no share-alike. */
export const PhotosFile = z.strictObject({
  photos: z.array(
    z
      .strictObject({
        place: placeId,
        /** The Commons file name, without "File:". */
        file: z.string().min(1),
        author: z.string().optional(),
        /**
         * The credit line the author asks for, word for word as the file's Commons page gives
         * it ("Uzi Paz Pikiwiki Israel"), when it is more than the author's name: shown in
         * the author's place (scripts/check-photo-credits.ts compares it with Commons).
         */
        credit: z.string().min(1).optional(),
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
      })
      // CC BY asks for a link to the licence: it is required, and it must be the licence
      // and version named, in its canonical form.
      .refine((p) => p.license_url === photoLicenceUrl(p.license), {
        message: "license_url must be the named licence's canonical URL (none for public domain)",
        path: ["license_url"],
      }),
  ),
});

export interface PlacePhoto {
  readonly file: string;
  readonly author?: string | undefined;
  /** The credit line the author asks for, shown in the author's place (photos.yaml). */
  readonly credit?: string | undefined;
  readonly license: string;
  readonly license_url?: string | undefined;
  /** For a disputed place: the candidate the photo shows, by language (en always). */
  readonly shows?:
    ({ readonly en: string } & Readonly<Partial<Record<string, string | undefined>>>) | undefined;
}

/**
 * A short article about a place (ADR 0007): an overview across the period, English first,
 * Russian beside it, every claim backed by the Scripture or the sources listed.
 */
export const ArticleFile = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  place: placeId,
  title: localized,
  body: inLanguages(paragraphs).refine(sameParagraphs, {
    message: "every language has as many paragraphs as the English",
  }),
  scripture: z.array(osis).min(1),
  sources: z.array(z.string().min(3)).min(1),
  status: checked,
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
  /**
   * The view the page's button opens: a place, a year, a chapter's places, and for a "how
   * far" question the two places the distance tool opens between (from, to; the place
   * opened, if any, is one of them: build-content.ts).
   */
  map: z
    .strictObject({
      place: placeId.optional(),
      year: approxYear.optional(),
      ref: osis.optional(),
      measure: z
        .tuple([placeId, placeId])
        .refine(([from, to]) => from !== to, { message: "a distance needs two different places" })
        .optional(),
    })
    .optional(),
  scripture: z.array(osis).min(1),
  sources: z.array(z.string().min(3)).min(1),
  status: checked,
});

export type QuestionFile = z.output<typeof QuestionFile>;

/**
 * Source lines in Russian (content/sources-ru.yaml): each line of an article's, a question's
 * or a place's years' sources, as written, to the line a Russian reader reads — ancient works
 * by their Russian titles, notes in Russian, modern scholarship as it was published.
 */
export const SourcesRuFile = z.record(z.string().min(1), z.string().min(1));

/**
 * The site's own lines among the sources ("History Globe tour …", "Straight-line distance
 * between the places' points …", content/sources-own.yaml), in the languages other than
 * English and Russian: each line to its translation in every one of them.
 */
export const SourcesOwnFile = z.record(z.string().min(1), z.record(z.string(), z.string().min(1)));
/**
 * A source line the site wrote itself, or that names its own pages or data (sources-own.yaml):
 * its own measurements too, straight-line and along the Roman roads of Itiner-e.
 */
export const OWN_SOURCE =
  /History Globe|^Straight-line|^Length along the Roman roads|^Road lengths along|^Land legs summed/;

/** An article or a question as the build writes it: its sources in Russian beside them. */
export interface WithSourcesRu {
  readonly sources_ru?: readonly string[];
  /** In the other languages, where the list has a line of the site's own (sources-own.yaml). */
  readonly sources_in?: Readonly<Partial<Record<Locale, readonly string[]>>>;
}

// The other languages run longer than English for the same summary; Chinese far shorter.
const NOTE_LENGTH: Readonly<Partial<Record<Locale, readonly [min: number, max: number]>>> = {
  en: [20, 320],
  zh: [6, 320],
};
const summaryNote = inLanguages((l) => {
  const [min, max] = NOTE_LENGTH[l] ?? [20, 360];
  return z.string().min(min).max(max);
});

/**
 * What ancient authors outside the Bible say of a place (content/ancient-authors.yaml), in
 * the manner of ToposText: the passage, a free text of it, and our own summary in both
 * languages, never their words in a modern translation.
 */
export const AncientAuthorsFile = z.strictObject({
  mentions: z
    .array(
      z.strictObject({
        place: placeId,
        author: localized,
        work: localized,
        /** As the standard edition numbers it: book.section (Josephus by Niese: "5.136-247"). */
        passage: z.string().regex(/^[0-9][0-9a-z.,:;–\- ]*$/),
        url: z.url({ protocol: /^https$/ }),
        note: summaryNote,
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
  /**
   * Names by language: `ru` always, others (`uk`, `es`, …) as they are translated; `osis` is
   * the verse where the Synodal form was read, if recorded.
   */
  readonly names: Readonly<
    Record<
      string,
      { readonly ru: string; readonly osis?: string } & Readonly<Partial<Record<Locale, string>>>
    >
  >;
  readonly tours: readonly TourFile[];
  /** Russian "where it is today" for places whose English one names another place. */
  readonly where_ru?: Readonly<Record<string, string>>;
  /** English "where it is today" where content/modern-names.yaml words it anew. */
  readonly where_en?: Readonly<Record<string, string>>;
  /** "Where it is today" in the other languages: language → place id → text. */
  readonly where_in?: Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;
  /** When places existed (content/place-life.yaml); `until` is the last year, inclusive. */
  readonly life?: Readonly<Record<string, PlaceLife>>;
  readonly events?: readonly HistoryEvent[];
  /** Battles and sieges (content/battles.yaml), in order of year. */
  readonly battles?: readonly HistoryBattle[];
  /** Places with an article: place id → article id; the texts load from articles/<language>.json. */
  readonly articles?: Readonly<Record<string, string>>;
  /** Photos by place id; the image itself is data/photos/<place id>.jpg. */
  readonly photos?: Readonly<Record<string, PlacePhoto>>;
  /** The place's Pleiades record and the years its periods span (content/pleiades.json). */
  readonly pleiades?: Readonly<Record<string, PleiadesLink>>;
  /** When the chapters happen (content/chapter-years.yaml): book → [from, to, year]. */
  readonly chapter_years?: ChapterYears;
}

/**
 * The questions answered with a place on the map (content/questions), in one language:
 * data/articles/questions/<language>.json. They are the site's own texts, under the licence
 * of the articles (CC BY-NC-ND 4.0, ADR 0016), so they live beside them and not in
 * content.json, which is CC BY. Each question is in that language, or in English where the
 * language has none.
 */
export interface QuestionTitles {
  readonly license: string;
  readonly license_url: string;
  /** Place id → its questions: the id (the page /{locale}/q/{id}/) and the wording. */
  readonly questions: Readonly<
    Record<string, readonly ({ readonly id: string } & Readonly<Partial<Record<Locale, string>>>)[]>
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
  /** Or where a battle was fought, at no place or site (EventsFile). */
  readonly battlefield?: { readonly lon: number; readonly lat: number };
  /** The passage that tells it: the event is told in the Bible. */
  readonly ref?: string;
  readonly sources: readonly string[];
}

export interface PlaceLife {
  readonly from?: Readonly<ApproxYear>;
  readonly until?: Readonly<ApproxYear>;
  readonly gap?: { readonly from: Readonly<ApproxYear>; readonly until: Readonly<ApproxYear> };
  readonly note: Readonly<Record<string, string>>;
  readonly sources: readonly string[];
  /** The sources as a Russian reader reads them (content/sources-ru.yaml). */
  readonly sources_ru?: readonly string[];
  /** The sources in the other languages, where they have a line of the site's own. */
  readonly sources_in?: Readonly<Partial<Record<Locale, readonly string[]>>>;
  /** Taken over from the city it lies in: says nothing of when the place itself began. */
  readonly inherited?: true;
  /** An older town of the same name stood nearby before `from` (PlaceLifeFile). */
  readonly older?: true;
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
 * More of the ancient world, chosen by a script rather than one by one (content/
 * ancient-sites-wave1.json, ADR 0018): the same fields, with every name from Wikidata's labels,
 * so a language may have none (the site keeps its dot there, unnamed).
 */
export const AncientWaveFile = z.strictObject({
  _source: z.string().min(1),
  sites: z.array(
    z.strictObject({
      id: z.string().regex(/^\d+$/),
      en: z.string().min(1),
      names: z.record(z.string().regex(/^[a-z]{2}$/), z.string().min(1)).optional(),
      lon: z.number().min(-180).max(180),
      lat: z.number().min(-90).max(90),
      from: z.number().int(),
      to: z.number().int(),
      approx: z.literal(true),
      kind: z.enum(["city", "sanctuary", "site", "port"]),
      rank: z.union([z.literal(1), z.literal(2)]),
      sources: z.array(z.string().min(1)).min(3),
    }),
  ),
});

/**
 * Corrections by hand to the waves of ancient sites (content/ancient-wave-corrections.json),
 * which pipeline/ancient/assemble.py applies and the content build checks against the waves.
 */
export const AncientWaveCorrectionsFile = z.strictObject({
  _: z.string().min(1),
  /** Labels (patterns) of items left out: moved away, or not the ancient place they name. */
  left_out: z.array(z.string().min(1)),
  /** Years the periods cannot give, astronomical, with why. */
  years: z.array(
    z.strictObject({
      site: z.string().min(1),
      from: z.number().int().optional(),
      to: z.number().int(),
      why: z.string().min(1),
    }),
  ),
  /** Wikidata's English label → the site's name. */
  renamed: z.record(z.string().min(1), z.string().min(1)),
  names: z.array(
    z.strictObject({
      site: z.string().min(1),
      lang: z.string().regex(/^[a-z]{2}$/),
      name: z.string().min(1),
    }),
  ),
  /** Languages whose Wikidata label is not the site's name. */
  no_names: z.record(z.string().min(1), z.array(z.string().regex(/^[a-z]{2}$/)).min(1)),
  kinds: z.record(z.string().min(1), z.enum(["city", "sanctuary", "site", "port"])),
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
      /**
       * The place of ours within 3 km that is nevertheless another site (Herodium, 2 km
       * from a candidate of Netophah): the build otherwise takes the two for one place.
       */
      apart_from: placeId.optional(),
      sources,
    }),
  ),
});
