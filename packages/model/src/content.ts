import { z } from "zod";
import { formatRef } from "./scripture.ts";
import { parseLabel, toAstronomical } from "./time.ts";

/** The single content schema (ADR 0007). Validation here is shape + meaning. */

const osis = z.string().refine(
  (s) => {
    try {
      formatRef(s, "en");
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

const localized = z.object({ en: z.string().min(1), ru: z.string().min(1) }).catchall(z.string());

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

export const PolityNamesFile = z.strictObject({
  polities: z.record(z.string().min(1), z.string().min(1)),
});

/** Our corrections on top of Cliopatria: keep a polity on the map for more years. */
export const PolityOverridesFile = z.strictObject({
  overrides: z.array(
    z.strictObject({
      polity: z.string().min(1),
      /** Last year the polity is drawn, inclusive. */
      last_year: yearLabel,
      reason: z.string().min(1),
      sources: z.array(z.string().min(1)).min(1),
    }),
  ),
});

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
  stops: z
    .array(
      z.strictObject({ place: z.string().regex(/^a[0-9a-f]{6}$/), ref: osis, note: localized }),
    )
    .min(2),
});

export type TourFile = z.output<typeof TourFile>;

/** What the app loads: content.json in a data release. */
export interface ContentRelease {
  readonly schema_version: 1;
  /** Russian names; `osis` is the verse where the Synodal form was read, if recorded. */
  readonly names: Readonly<Record<string, { readonly ru: string; readonly osis?: string }>>;
  readonly tours: readonly TourFile[];
  /** Russian "where it is today" for places whose English one names another place. */
  readonly where_ru?: Readonly<Record<string, string>>;
  /** When places existed (content/place-life.yaml); `until` is the last year, inclusive. */
  readonly life?: Readonly<Record<string, PlaceLife>>;
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
  /** Taken over from the city it lies in: says nothing of when the place itself began. */
  readonly inherited?: true;
}
