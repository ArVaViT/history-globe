/**
 * Which pages search engines are asked to index (ADR 0023). A page left out is still written
 * and kept for readers, with `<meta name="robots" content="noindex, follow">`, and the sitemap
 * leaves it out. Two kinds are left out, both decided from the English text, the master every
 * translation follows, so a page and its 20 translations are always decided together and no
 * indexed page lists a noindexed one among its hreflang alternates:
 *
 * - a thin article's place page: an article of fewer than THIN_WORDS English words;
 * - a "where" question whose answer mostly says again what its place's article says: at
 *   least DUPLICATE_SHARE of the answer's distinct content words stand in the article too.
 *   The place's page answers the same question, with the map and the verses besides. A
 *   question that search engines already showed often (at least `searched.min` impressions
 *   in the window `content/index-policy.json` records) stays in search: it is the page they
 *   chose for that search, and taking it out would lose it rather than consolidate it.
 *
 * `content/index-policy.json` overrides either way, each entry with its reason. Pure
 * functions; scripts/build-pages.ts applies them.
 */

/** An article under this many English words is thin (the build's own word count). */
export const THIN_WORDS = 200;
/**
 * A "where" answer that shares this much of its content words with its place's article
 * repeats the article. Measured on 2026-11-27: against its own place's article a median
 * answer shares 0.48; against an unrelated article 0.10 (99th percentile 0.22).
 */
export const DUPLICATE_SHARE = 0.6;

/** A "where" answer from this share up to DUPLICATE_SHARE is listed in the build's log. */
export const NEAR_SHARE = 0.5;

/** Words too common to say anything of a text's content. */
const STOP: ReadonlySet<string> = new Set(
  (
    "the a an and or of in on at to from by for with as is was were be been it its this that " +
    "these those which who whom whose he she they his her their them there here not no but also " +
    "than then into over under about after before between near north south east west northern " +
    "southern eastern western century centuries today modern called later site place town city"
  ).split(" "),
);

/** Words as the build counts them for an article's length (build-content.ts: at most 450). */
export const wordCount = (paragraphs: readonly string[]): number =>
  paragraphs
    .join(" ")
    .split(/\s+/u)
    .filter((w) => w !== "").length;

/**
 * The distinct content words of an English text, each cut to its first six letters so that
 * "excavated" and "excavations" meet: lower case, longer than three letters, no stop words.
 */
export function contentStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z]+/gu) ?? [])
    if (w.length > 3 && !STOP.has(w)) out.add(w.slice(0, 6));
  return out;
}

/** The share of `text`'s content words that `other` holds too (0 for a text with none). */
export function containment(text: string, other: string): number {
  const a = contentStems(text);
  if (a.size === 0) return 0;
  const b = contentStems(other);
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / a.size;
}

/** content/index-policy.json: overrides by id, each with its reason. */
export interface IndexOverrides {
  readonly articles?: {
    readonly index?: Readonly<Record<string, string>>;
    readonly noindex?: Readonly<Record<string, string>>;
  };
  readonly questions?: {
    readonly index?: Readonly<Record<string, string>>;
    readonly noindex?: Readonly<Record<string, string>>;
  };
  /** Search impressions of each question, all languages together, over one window. */
  readonly searched?: {
    readonly window: string;
    readonly min: number;
    readonly questions: Readonly<Record<string, number>>;
  };
}

export interface PolicyArticle {
  readonly id: string;
  readonly place: string;
  readonly body: { readonly en: readonly string[] };
}
export interface PolicyQuestion {
  readonly id: string;
  readonly answer: { readonly en: readonly string[] };
  readonly map?: { readonly place?: string | undefined } | undefined;
}

export interface IndexPolicy {
  /** Article ids whose place page is kept out of search. */
  readonly thinArticles: ReadonlySet<string>;
  /** Question ids kept out of search. */
  readonly duplicateQuestions: ReadonlySet<string>;
  /** Questions that repeat their article but stay in search for their impressions. */
  readonly keptSearched: ReadonlySet<string>;
  /** Every "where" question measured against its place's article, with its share. */
  readonly shares: ReadonlyMap<string, number>;
  /** What an override names that is not there, or that the rule already decides its way. */
  readonly errors: readonly string[];
}

/** The pages to keep out of search, by the rules above and the overrides. */
export function indexPolicy(
  articles: readonly PolicyArticle[],
  questions: readonly PolicyQuestion[],
  overrides: IndexOverrides = {},
  /** A retired record's id → the place it was merged into (ADR 0022). */
  aliases: ReadonlyMap<string, string> = new Map(),
): IndexPolicy {
  const errors: string[] = [];
  const thinByRule = new Set(
    articles.filter((a) => wordCount(a.body.en) < THIN_WORDS).map((a) => a.id),
  );
  const thin = applyOverrides(
    overrides,
    errors,
    "articles",
    thinByRule,
    new Set(articles.map((a) => a.id)),
  );
  // The article a question would repeat: only one search engines index. Where the article is
  // left out, the question is the page that stays.
  const articleAt = new Map(articles.filter((a) => !thin.has(a.id)).map((a) => [a.place, a]));
  const shares = new Map<string, number>();
  for (const q of questions) {
    if (!q.id.startsWith("where-") || !q.map?.place) continue;
    const art = articleAt.get(aliases.get(q.map.place) ?? q.map.place);
    if (art) shares.set(q.id, containment(q.answer.en.join(" "), art.body.en.join(" ")));
  }
  const searched = overrides.searched;
  const repeats = [...shares].filter(([, share]) => share >= DUPLICATE_SHARE).map(([id]) => id);
  const keptSearched = new Set(
    repeats.filter((id) => searched && (searched.questions[id] ?? 0) >= searched.min),
  );
  const dupByRule = new Set(repeats.filter((id) => !keptSearched.has(id)));
  const dup = applyOverrides(
    overrides,
    errors,
    "questions",
    dupByRule,
    new Set(questions.map((q) => q.id)),
  );
  if (searched)
    for (const id of Object.keys(searched.questions))
      if (!questions.some((q) => q.id === id))
        errors.push(`index-policy: searched names ${id}, which is not a question`);
  return { thinArticles: thin, duplicateQuestions: dup, keptSearched, shares, errors };
}

/** The rule's set with the overrides of one kind applied; what is wrong with them into `errors`. */
function applyOverrides(
  overrides: IndexOverrides,
  errors: string[],
  kind: "articles" | "questions",
  byRule: ReadonlySet<string>,
  known: ReadonlySet<string>,
): Set<string> {
  const out = new Set(byRule);
  const o = overrides[kind] ?? {};
  for (const [id, reason] of Object.entries(o.index ?? {})) {
    if (!known.has(id)) errors.push(`index-policy: ${kind}.index names ${id}, which is not there`);
    else if (!byRule.has(id))
      errors.push(`index-policy: ${kind}.index: ${id} is indexed by the rule already`);
    if (!reason.trim()) errors.push(`index-policy: ${kind}.index: ${id} gives no reason`);
    out.delete(id);
  }
  for (const [id, reason] of Object.entries(o.noindex ?? {})) {
    if (!known.has(id))
      errors.push(`index-policy: ${kind}.noindex names ${id}, which is not there`);
    else if (byRule.has(id))
      errors.push(`index-policy: ${kind}.noindex: ${id} is left out by the rule already`);
    if (!reason.trim()) errors.push(`index-policy: ${kind}.noindex: ${id} gives no reason`);
    out.add(id);
  }
  return out;
}
