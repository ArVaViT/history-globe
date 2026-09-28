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

const yearLabel = z.string().transform((s, ctx) => {
  try {
    return toAstronomical(parseLabel(s));
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});

const localized = z.object({ en: z.string().min(1), ru: z.string().min(1) }).catchall(z.string());

export const PlaceNamesFile = z.object({
  places: z.array(
    z.object({ id: z.string().regex(/^a[0-9a-f]{6}$/), en: z.string(), ru: z.string().min(1) }),
  ),
});

export const PolityNamesFile = z.object({
  polities: z.record(z.string().min(1), z.string().min(1)),
});

export const TourFile = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: localized,
  year: yearLabel,
  stops: z
    .array(z.object({ place: z.string().regex(/^a[0-9a-f]{6}$/), ref: osis, note: localized }))
    .min(2),
});

export type TourFile = z.output<typeof TourFile>;

/** What the app loads: content.json in a data release. */
export interface ContentRelease {
  readonly schema_version: 1;
  readonly names: Readonly<Record<string, { readonly ru: string }>>;
  readonly tours: readonly TourFile[];
}
