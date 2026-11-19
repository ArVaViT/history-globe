import {
  type ArticleFile,
  isLocale,
  type ItemReview,
  type QuestionTitles,
  type WithSourcesRu,
} from "@hg/model";
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

/** A question answered with a place on the map, in the reader's language or in English. */
export type PlaceQuestion = QuestionTitles["questions"][string][number];

/**
 * The questions answered with a place on the map, from data/articles/questions/<language>.json
 * (under the articles' licence, ADR 0016); none when the file cannot be read: the card
 * stands without them.
 */
export function loadQuestions(placeId: string, locale: string): Promise<readonly PlaceQuestion[]> {
  const l = isLocale(locale) ? locale : "en";
  return cachedJson<QuestionTitles>(`articles/questions/${l}.json`).then(
    (all) => all.questions[placeId] ?? [],
    (): readonly PlaceQuestion[] => [],
  );
}
