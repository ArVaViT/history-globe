// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Where the reservation of text and data mining stands (LICENSING.md, part 2; ADR 0016): on
 * the site's own texts under CC BY-NC-ND 4.0 and nowhere else. They are served at
 *
 * - the place pages that carry an article, `/{language}/place/{slug}/` (a place with no
 *   article yet has a page of data only, and that page is not reserved);
 * - the question pages and their list, `/{language}/q/{slug}/` and `/{language}/questions/`;
 * - the articles as the map loads them, `/data/articles/{language}.json`;
 * - the answers in the API, `/api/v1/questions.json`.
 *
 * The data, the rest of the API, the other place pages, the map, the downloads and the dataset
 * carry no reservation: CC BY 4.0 governs them. The paths are written once, in the pattern
 * syntax robots.txt (RFC 9309) and TDMRep's tdmrep.json share: `*` for any run of
 * characters, a match from the start of the path. The language is a `*`, since every language
 * has the same paths.
 *
 * scripts/build-pages.ts writes robots.txt and /.well-known/tdmrep.json from these, and puts
 * `<meta name="tdm-reservation" content="1">` in the head of the pages they name;
 * apps/web/vercel.json sends the `tdm-reservation: 1` header on the fixed paths
 * (scripts/vercel-config.test.ts holds the two in step).
 */
import { HONEYPOT_PATH } from "./honeypot.ts";
import { SITE_ORIGIN } from "./site.ts";

/** The reserved paths that are not one place's page. */
export const RESERVED_FIXED: readonly string[] = [
  "/*/q/",
  "/*/questions/",
  "/data/articles/",
  "/api/v1/questions.json",
];

/** The page of a place that carries an article, in every language. */
export const articlePagePattern = (slug: string): string => `/*/place/${slug}/`;

/** Every reserved path: the fixed ones, then the place pages with an article, by slug. */
export function reservedPaths(articleSlugs: Iterable<string>): string[] {
  return [...RESERVED_FIXED, ...[...new Set(articleSlugs)].sort().map(articlePagePattern)];
}

/** Whether a robots.txt or tdmrep.json pattern matches a path (`*` any run, `$` the end). */
export function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`).test(path);
}

/** Whether a path is reserved, given the slugs of the places with an article. */
export const isReserved = (path: string, articleSlugs: Iterable<string>): boolean =>
  reservedPaths(articleSlugs).some((p) => patternMatches(p, path));

/** The crawlers that gather text to train models: kept off the reserved paths. */
export const TRAINING_CRAWLERS: readonly string[] = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "Bytespider",
  "Diffbot",
  "AI2Bot",
  "omgili",
  "omgilibot",
  "Webzio-Extended",
  "PanguBot",
  "Timpibot",
  "ImagesiftBot",
  "Kangaroo Bot",
  "ICC-Crawler",
  "Reflectionbot",
];

/** The search and answer engines that cite their sources. */
export const ANSWER_ENGINES: readonly string[] = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
  "Meta-ExternalFetcher",
];

/** What every crawler is kept out of: the map's own files, but the photos and the place lists. */
const EVERYONE = [
  "Allow: /",
  "Disallow: /data/",
  `Disallow: ${HONEYPOT_PATH}`,
  "Allow: /data/photos/",
  "Allow: /data/text-places.",
];

/** robots.txt, with the place pages that carry an article named by their slugs. */
export function robotsTxt(articleSlugs: Iterable<string>): string {
  const reserved = reservedPaths(articleSlugs).map((p) => `Disallow: ${p}`);
  return `# History Globe: a free educational site. Search engines and the AI assistants that answer
# with a citation are welcome. The crawlers that gather text to train models are welcome to
# the open data, under CC BY 4.0, but not to the site's own texts: the place articles and the
# answered questions (CC BY-NC-ND 4.0, LICENSING.md, ADR 0016), whose text and data mining is
# reserved (Article 4(3) of EU Directive 2019/790). The reserved paths are the place pages
# that carry an article, the question pages, /data/articles/ and /api/v1/questions.json; the
# same paths are in /.well-known/tdmrep.json, and those pages carry the tdm-reservation
# header or meta tag. Nothing else on the site is reserved.
#
# The Content-Signal line is Cloudflare's content signals (contentsignals.org): search and
# answer engines yes. It applies to a whole group, not to a path, so it says nothing of
# training: the Disallow lines below say it, path by path.
#
# /data/ is what the map loads (the articles one language a file among it); the pages that
# search engines index read none of it but the photos, which stay open, as do the place
# lists that hg-places.js reads on the sites that use it. The open data is /api/v1/,
# documented, under CC BY 4.0 and open to every crawler, the training crawlers too.
#
# ${HONEYPOT_PATH} holds nothing and is linked from no place a reader sees: it is set apart for the
# programs that ignore this file, and a request for it is noted (ADR 0017).
#
# Written by scripts/build-pages.ts from packages/model/src/reservation.ts.

# Search and answer engines that cite their sources.
${ANSWER_ENGINES.map((a) => `User-agent: ${a}`).join("\n")}
Content-Signal: search=yes, ai-input=yes
${EVERYONE.join("\n")}

# Crawlers that gather text for training models: the open data, not the articles or the
# answers.
${TRAINING_CRAWLERS.map((a) => `User-agent: ${a}`).join("\n")}
${EVERYONE.join("\n")}
${reserved.join("\n")}

# Everyone else.
User-agent: *
Content-Signal: search=yes, ai-input=yes
${EVERYONE.join("\n")}

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

/** One rule of /.well-known/tdmrep.json (W3C TDMRep, 2024): the first that matches applies. */
export interface TdmRule {
  location: string;
  "tdm-reservation": 0 | 1;
  "tdm-policy"?: string;
}

/** /.well-known/tdmrep.json: the reserved paths, then everything else, not reserved. */
export function tdmrep(articleSlugs: Iterable<string>): TdmRule[] {
  return [
    ...reservedPaths(articleSlugs).map((location) => ({
      location,
      "tdm-reservation": 1 as const,
    })),
    { location: "/", "tdm-reservation": 0 },
  ];
}

/** The meta tag a reserved page carries in its head (TDMRep, HTML). */
export const TDM_META = '<meta name="tdm-reservation" content="1" />';
