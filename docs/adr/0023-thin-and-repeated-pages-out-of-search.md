# 0023. Thin articles and repeated questions stay for readers, out of search

- Status: accepted
- Date: 2026-11-27

## Context

Google's core update of November 2026 (finished 24 November) took the site down everywhere at
once: from about 3,500 impressions a day to about 100, the average position from 10–15 to about
50, in all 21 languages and every kind of page. The pages stay indexed and there is no manual
action. The likeliest reading is that a seven-week-old site with 21,484 addresses in its
sitemap was judged as content made at scale, and two kinds of page invite that judgement:

- 149 place articles under 200 English words, 3,129 pages with their translations;
- "where was X" questions whose answer tells again, in other words, what X's article says:
  `/en/q/where-was-capernaum/` beside `/en/place/capernaum/`, on the same search.

## Decision

- A page search engines are not to index is still written and kept for readers, with
  `<meta name="robots" content="noindex, follow">`, and left out of the sitemap (and so of
  `page-hashes.json` and IndexNow). It keeps its canonical link to itself; nothing is
  canonicalised to another page, as a question and an article are different texts.
- The rules (`scripts/index-policy.ts`), read from the English text, the master every
  translation follows, so a page and its translations are always decided together and no
  indexed page lists a noindexed one among its hreflang alternates:
  - **thin article**: under 200 English words, counted as the build counts the 450-word cap.
    A threshold in one language is fair to all: Finnish runs to 0.7 of the English words and
    Vietnamese to 1.1, so a count per language would split a page from its translations;
  - **repeated question**: a question that asks where (`where-…`), whose place has an
    article that is itself indexed, and whose answer shares at least 60 % of its distinct
    content words (lower case, over three letters, no stop words, cut to six letters) with
    that article. On 2026-11-27 a question's answer shared a median 0.48 with its own place's
    article and 0.10 with an unrelated one (99th percentile 0.22); 0.6 is six times chance. Word
    shingles were measured too, but the answers are rewritten, not copied (five-word
    shingles: median 13 %, highest 52 %), so shingles miss what a reader sees as the same text.
    Where the article is thin and left out, the question is the page that stays. A question's
    place given by a record merged into another (ADR 0022) is read as that place.
  - **searched question kept**: a repeated question that had at least 40 Google impressions,
    all languages together, in the window `content/index-policy.json` records (`searched`, from
    Search Console by page, 1 October to 21 November 2026) stays in search.
- The two rules treat traffic differently on purpose. A thin article that earned searches was
  expanded, because its fault is that it says too little and more can be said. A repeated
  question that earned searches says enough; its fault is only that another page of ours says it
  too, and the impressions show that Google chose the question for its search, often above the
  article (Babylon, Gath, Mesopotamia, Ur, Tarsus, Galilee, Ziklag, Megiddo and others).
  Taking it out would lose that page, not consolidate it. The rule takes out only the repeated
  questions nobody was shown.
- `content/index-policy.json` overrides either way, each entry with its reason; the build
  stops on an entry that names no page or one the rule already decides its way.
- The thin articles that earned search traffic before the update (40 impressions or more,
  all languages together, 1 October to 21 November 2026: 26 of them, with 1,835 of the 3,289
  impressions of all thin articles) were expanded from their sources in every language
  instead, which takes them over the threshold. 123 articles (2,583 pages) and 8 questions
  (168 pages) are left out; 35 questions that repeat their article stay for their impressions.
  The sitemap goes from 21,484 addresses to 18,733.

## Alternatives considered

- Deleting the thin pages, or redirecting the questions to the place pages: readers and
  links lose them, and a question's page is a different text with its own view of the map.
- `rel=canonical` from a question to its place: canonical is for duplicates of one page and is
  only a hint; a question and an article are different texts, and noindex says what we mean.
- A threshold per language: splits hreflang clusters (above).
- Expanding all 149 thin articles: most name a place known from one verse, and padding is
  what the update punishes. They can come back one by one as they are written up.

## Consequences

- The sitemap lists the pages we stand behind. An article expanded past the threshold, or a
  question rewritten to say what its place's page does not, returns to search by itself at
  the next build; IndexNow sends a page that enters or leaves the sitemap once.
- The place lists and the questions list still link the left-out pages, which pass their
  links on (`follow`).
- The share is a measure of wording, and the line at 0.6 is sharp: rewording an answer or its
  article can move a question across it, and 38 questions stand between 0.50 and 0.60. The
  build names those near the line in its log, and the questions and thin articles whose
  decision changed since the last build (`apps/web/build/index-policy.json`), so a move is
  seen rather than shipped unnoticed. The impressions in `searched` are a snapshot; they are
  refreshed by hand, not by the build.
- `scripts/check-pages.ts` reads the built pages against the sitemap: no listed page says
  noindex, and every page that does not is listed.
- To watch: Search Console's "Excluded by noindex" count should match the build's
  `index policy:` line; whether the indexed pages recover is known only after the next core
  update.
