import type { ArticleFile, WithSourcesRu } from "@hg/model";
import { DATA_URL } from "./data";

/** An article as articles.json holds it (content/articles, ADR 0007). */
export type Article = ArticleFile & WithSourcesRu;

let all: Promise<Readonly<Record<string, Article>>> | null = null;

/**
 * The article about a place. The texts load once, on the first card that has one: the
 * start of the app does not wait for them.
 */
export function loadArticle(placeId: string): Promise<Article | undefined> {
  all ??= fetch(`${DATA_URL}/articles.json`).then((r) => {
    if (!r.ok) throw new Error(`articles.json: ${String(r.status)}`);
    return r.json() as Promise<Readonly<Record<string, Article>>>;
  });
  // A failed load is tried again on the next card, not remembered.
  all.catch(() => {
    all = null;
  });
  return all.then((a) => a[placeId]);
}
