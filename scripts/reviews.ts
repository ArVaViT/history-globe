/**
 * Reviews by scholars (content/reviews/*.yaml): read, checked against the content they
 * cover, and told what has changed since. build-content.ts calls it and writes the result
 * for the pages (apps/web/build/reviews.json) and beside each reviewed article for the app.
 *
 * With no review files nothing is written and no page or link appears (build-pages.ts).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  changedSince,
  type ItemReview,
  itemOf,
  ReviewFile,
  type ReviewKind,
  type ReviewRecord,
} from "../packages/model/src/reviews.ts";

/** What the reviews are checked against: the current hash of every item, by kind and id. */
export type CurrentHashes = Readonly<Record<ReviewKind, ReadonlyMap<string, string>>>;

export interface LoadedReviews {
  readonly reviews: readonly ReviewRecord[];
  /** "article:colossae" → the reviews that cover it, newest first. */
  readonly byItem: ReadonlyMap<string, readonly ItemReview[]>;
  readonly errors: readonly string[];
}

/** Reads every review in `dir` (content/reviews, or a test's fixtures) and checks it. */
export function loadReviews(dir: string, current: CurrentHashes): LoadedReviews {
  const errors: string[] = [];
  const reviews: ReviewRecord[] = [];
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".yaml"))
        .sort()
    : [];
  for (const file of files) {
    const parsed = ReviewFile.safeParse(parse(readFileSync(join(dir, file), "utf8")));
    if (!parsed.success) {
      errors.push(`reviews/${file}: ${parsed.error.message}`);
      continue;
    }
    const r = parsed.data;
    if (`${r.id}.yaml` !== file) errors.push(`reviews/${file}: id "${r.id}" ≠ file name`);
    if (!r.id.startsWith(r.date.slice(0, 7)))
      errors.push(`reviews/${file}: the id starts with the review's month, ${r.date.slice(0, 7)}`);
    const seen = new Set<string>();
    const covers: { kind: ReviewKind; id: string; changed: boolean }[] = [];
    for (const entry of r.items) {
      const { kind, id } = itemOf(entry);
      const key = `${kind}:${id}`;
      if (seen.has(key)) errors.push(`reviews/${file}: ${key} is listed twice`);
      seen.add(key);
      const now = current[kind].get(id);
      if (now === undefined) {
        errors.push(`reviews/${file}: there is no ${kind} "${id}"`);
        continue;
      }
      covers.push({ kind, id, changed: changedSince(entry, now) });
    }
    reviews.push({ ...r, covers });
  }
  // Newest first, as the pages list them; by id where two share a date.
  reviews.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const byItem = new Map<string, ItemReview[]>();
  for (const r of reviews)
    for (const c of r.covers) {
      const key = `${c.kind}:${c.id}`;
      byItem.set(key, [
        ...(byItem.get(key) ?? []),
        {
          id: r.id,
          name: r.reviewer.name,
          institution: r.reviewer.institution,
          date: r.date,
          status: r.status,
          changed: c.changed,
        },
      ]);
    }
  return { reviews, byItem, errors };
}
