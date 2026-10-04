/**
 * What the static pages (build-pages.ts) and the documentation (build-docs.ts) share in
 * their head: the description, the canonical address, the same page in every language
 * (hreflang, with English as the default), the preview for shared links, the structured
 * data and the visit counter. One place, so the two sets of pages cannot drift apart.
 */
import { LOCALES, type SiteLocale } from "../packages/model/src/time.ts";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The tags of a page's head after its title. `site` is the production address (SITE_URL);
 * without it a build is local, and only the description is written.
 */
export function headMeta(o: {
  site: string;
  title: string;
  desc: string;
  /** The page's path from the site root, in each language. */
  paths: Readonly<Record<SiteLocale, string>>;
  l: SiteLocale;
  /** The preview image, from the site root. */
  image?: string | undefined;
  ld?: object | undefined;
}): string {
  const desc = `\n    <meta name="description" content="${esc(o.desc)}" />`;
  if (!o.site) return desc;
  const abs = (p: string) => `${o.site}/${p}`;
  const alternates = LOCALES.map(
    (l) => `\n    <link rel="alternate" hreflang="${l}" href="${abs(o.paths[l])}" />`,
  ).join("");
  const ld = o.ld
    ? `\n    <script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, "\\u003c")}</script>`
    : "";
  return `${desc}
    <link rel="canonical" href="${abs(o.paths[o.l])}" />${alternates}
    <link rel="alternate" hreflang="x-default" href="${abs(o.paths.en)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="History Globe" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.desc)}" />
    <meta property="og:url" content="${abs(o.paths[o.l])}" />
    <meta property="og:image" content="${abs(o.image ?? "og.jpg")}" />
    <meta name="twitter:card" content="summary_large_image" />${ld}
    <script defer src="/_vercel/insights/script.js"></script>`;
}
