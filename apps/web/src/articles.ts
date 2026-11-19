import { type ArticleFile, isLocale, type ItemReview, type WithSourcesRu } from "@hg/model";
import { cachedJson } from "./data";

/**
 * An article as data/articles/<language>.json holds it (content/articles, ADR 0007): its
 * title and body in that language, or in English where the language has none.
 */
export type Article = ArticleFile &
  WithSourcesRu & {
    /** The scholars' reviews that cover it (content/reviews), newest first; none if unread. */
    readonly reviews?: readonly ItemReview[];
  };

/**
 * The article about a place in the reader's language (English for a language the site is
 * not published in). The texts of a language load once, on the first card that has one:
 * the start of the app does not wait for them.
 */
export function loadArticle(placeId: string, locale: string): Promise<Article | undefined> {
  const l = isLocale(locale) ? locale : "en";
  return cachedJson<Readonly<Record<string, Article>>>(`articles/${l}.json`).then(
    (all) => all[placeId],
  );
}
