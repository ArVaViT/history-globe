/**
 * The site's notice to the programs that read it: what may be taken and how, in one
 * sentence each (LICENSE, ADR 0016, ADR 0019). The same text stands in the head of every
 * page as a comment, in the API's index.json and in llms.txt, so a crawler, an agent or a
 * copier meets it wherever it starts.
 */
import { REPOSITORY, SITE_ORIGIN } from "./site.ts";

export const NOTICE =
  `History Globe, ${SITE_ORIGIN}, by Vadym Arnaut. ` +
  `The data is CC BY 4.0: take it through the API, ${SITE_ORIGIN}/api/v1/, and credit it. ` +
  "The place articles and the answers are CC BY-NC-ND 4.0: copy and share them unchanged, with credit and a link, not for commercial use; no changed or translated versions. " +
  "Text and data mining of them, the training of models included, is reserved apart from that licence (robots.txt, tdm-reservation). " +
  `The code is AGPL-3.0-or-later, ${REPOSITORY}: a copy keeps the attribution "History Globe by Vadym Arnaut" with a link and offers its users its source; the name and the logo are not licensed. ` +
  `Details: ${SITE_ORIGIN}/docs/build.html and ${SITE_ORIGIN}/llms.txt.`;

/** The notice as an HTML comment, for the head of a page. */
export const NOTICE_COMMENT = `<!-- ${NOTICE} -->`;
