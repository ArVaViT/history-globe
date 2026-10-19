/**
 * What the static pages (build-pages.ts) and the documentation (build-docs.ts) share in
 * their head: the description, the canonical address, the same page in every language
 * (hreflang, with English as the default), the preview for shared links, the structured
 * data and the visit counter. One place, so the two sets of pages cannot drift apart.
 */
import { BEACON_TAG } from "../packages/model/src/beacon.ts";
import { honeypotLink } from "../packages/model/src/honeypot.ts";
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
  /** The page's path from the site root, in each language it exists in (English always). */
  paths: Readonly<Partial<Record<SiteLocale, string>>> & { readonly en: string };
  l: SiteLocale;
  /** The preview image, from the site root; else the map in the page's language (og/<l>.jpg). */
  image?: string | undefined;
  ld?: object | undefined;
}): string {
  const desc = `\n    <meta name="description" content="${esc(o.desc)}" />`;
  if (!o.site) return desc;
  const abs = (p: string) => `${o.site}/${p}`;
  const alternates = LOCALES.flatMap((l) => {
    const p = o.paths[l];
    return p ? [`\n    <link rel="alternate" hreflang="${l}" href="${abs(p)}" />`] : [];
  }).join("");
  const ld = o.ld
    ? `\n    <script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, "\\u003c")}</script>`
    : "";
  return `${desc}
    <link rel="canonical" href="${abs(o.paths[o.l] ?? o.paths.en)}" />${alternates}
    <link rel="alternate" hreflang="x-default" href="${abs(o.paths.en)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="History Globe" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.desc)}" />
    <meta property="og:url" content="${abs(o.paths[o.l] ?? o.paths.en)}" />
    <meta property="og:image" content="${abs(o.image ?? `og/${o.l}.jpg`)}" />
    <meta name="twitter:card" content="summary_large_image" />${ld}
    <script defer src="/_vercel/insights/script.js"></script>`;
}

/**
 * What every built page ends its body with (ADR 0017, addendum): the link no reader sees to
 * the address robots.txt disallows, and the script that tells the site when the page runs
 * from another address. `root` is the path from the page up to the site's root.
 */
export const bodyEnd = (root: string): string =>
  `    ${honeypotLink(root)}
    ${BEACON_TAG}`;
