/**
 * Short content hashes: the 12 hex digits of a SHA-256. One function for the built pages
 * (build-page-hashes.ts, which IndexNow compares) and for the reviewed items (reviews.ts),
 * so a review can say whether the text it read is still the text shown.
 */
import { createHash } from "node:crypto";

export const shortHash = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex").slice(0, 12);

/**
 * The hash of what a reviewer reads of an item: its English text, its Scripture and its
 * sources (or a tour's stops). The translations are left out: a review is of the English,
 * and the pages say a translation has not been reviewed. Read from the content files as
 * parsed, before the build's canary marks (canary.ts) touch the text.
 */
export function itemHash(
  item:
    | {
        readonly kind: "article";
        readonly title: { readonly en: string };
        readonly body: { readonly en: readonly string[] };
        readonly scripture: readonly string[];
        readonly sources: readonly string[];
      }
    | {
        readonly kind: "question";
        readonly question: { readonly en: string };
        readonly answer: { readonly en: readonly string[] };
        readonly scripture: readonly string[];
        readonly sources: readonly string[];
      }
    | {
        readonly kind: "tour";
        readonly title: { readonly en: string };
        readonly year: number;
        readonly stops: readonly {
          readonly place: string;
          readonly ref: string;
          readonly note: { readonly en: string };
          readonly year?: number | undefined;
        }[];
      },
): string {
  // Built field by field, so the order of keys in a file never changes the hash.
  const text =
    item.kind === "article"
      ? [item.title.en, item.body.en, item.scripture, item.sources]
      : item.kind === "question"
        ? [item.question.en, item.answer.en, item.scripture, item.sources]
        : [
            item.title.en,
            item.year,
            item.stops.map((s) => [s.place, s.ref, s.note.en, s.year ?? null]),
          ];
  return shortHash(JSON.stringify([item.kind, ...text]));
}
