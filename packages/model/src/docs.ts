// The site's documentation: its pages, and where each stands for a language (English at
// the root of docs/, every other language in its own folder). Shared by the docs build, the
// static pages, the sitemap and the app's settings.

import { isLocale } from "./locales.ts";

export const DOC_PAGES = [
  "index",
  "methodology",
  "build",
  "embedding",
  "api",
  "sources",
  "reviews",
  "author",
  "privacy",
] as const;
export type DocPage = (typeof DOC_PAGES)[number];

/** A documentation page's path from the site root: "docs/ru/privacy.html", "docs/". */
export function docsPath(locale: string, page: DocPage = "index"): string {
  // The documentation is in every published language; any other reads the English.
  const dir = locale !== "en" && isLocale(locale) ? `${locale}/` : "";
  return `docs/${dir}${page === "index" ? "" : `${page}.html`}`;
}
