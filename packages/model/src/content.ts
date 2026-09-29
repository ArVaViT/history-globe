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
}
