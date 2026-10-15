/**
 * IndexNow (indexnow.org): telling Bing, Yandex, Seznam, Naver and the other engines that
 * share it which pages changed, so they recrawl those instead of waiting. The pure part of
 * scripts/indexnow.ts, kept apart so the tests import it without running anything.
 *
 * What changed is read from page-hashes.json (scripts/build-page-hashes.ts): a short hash of
 * every page in the sitemap, published with the site. The workflow keeps the hashes it last
 * sent; a page whose hash moved, a new page and a page gone from the sitemap are sent, and
 * nothing else. The sitemap has no <lastmod> to go by.
 */

/** The key, also served as /<key>.txt (apps/web/public), which proves the site is ours. */
export const INDEXNOW_KEY = "6d9683e9d67acb95f32d95c1adc7c3dd";
/** The shared endpoint: one call reaches every engine in the protocol. */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** The protocol's limit on one request. */
export const INDEXNOW_BATCH = 10_000;

/** The addresses a sitemap lists (<loc>), with its XML entities read. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
    (m[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );
}

/** Whether the sitemap is an index of other sitemaps rather than a list of pages. */
export const isSitemapIndex = (xml: string): boolean => /<sitemapindex[\s>]/.test(xml);

/** What was last sent: page address → its hash then. */
export type SentState = Readonly<Record<string, string>>;

/**
 * The pages to send: new ones, ones whose hash moved, and ones gone from the sitemap (an
 * engine recrawls those and drops them). With no record of a previous run, every page.
 * A page the hash file does not list (the app's own page) counts as unchanged once sent.
 */
export function changedUrls(
  urls: readonly string[],
  hashes: Readonly<Record<string, string>>,
  sent: SentState | null,
): { send: string[]; gone: string[]; next: Record<string, string> } {
  const next: Record<string, string> = {};
  for (const u of urls) next[u] = hashes[u] ?? "-";
  if (!sent) return { send: [...urls], gone: [], next };
  const send = urls.filter((u) => sent[u] !== next[u]);
  const listed = new Set(urls);
  const gone = Object.keys(sent).filter((u) => !listed.has(u));
  return { send, gone, next };
}

/** The list in requests of at most `size` addresses. */
export function batches<T>(list: readonly T[], size = INDEXNOW_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** One request's body (indexnow.org/documentation: "Submitting set of URLs"). */
export function requestBody(site: string, urls: readonly string[]): string {
  const { host } = new URL(site);
  return JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${site.replace(/\/+$/, "")}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });
}

/**
 * page-hashes.json lists paths from the site root ("de/place/jerusalem/"); the sitemap,
 * whole addresses. The hashes keyed by address.
 */
export function hashesByUrl(
  site: string,
  byPath: Readonly<Record<string, string>>,
): Record<string, string> {
  const base = site.replace(/\/+$/, "");
  return Object.fromEntries(Object.entries(byPath).map(([p, h]) => [`${base}/${p}`, h]));
}
