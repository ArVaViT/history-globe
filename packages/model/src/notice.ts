/**
 * The site's notice to the programs that read it: what may be taken and how, in one
 * sentence each (LICENSE, ADR 0016). The same text stands in the head of every page as a
 * comment, in the API's index.json and in llms.txt, so a crawler, an agent or a copier
 * meets it wherever it starts.
 */
export const SITE = "https://historyglobe.app";

export const NOTICE =
  `History Globe, ${SITE}, by Vadym Arnaut. ` +
  `The data is CC BY 4.0: take it through the API, ${SITE}/api/v1/, and credit it. ` +
  "The place articles and the answers are CC BY-NC-ND 4.0: quote them with a link; no commercial use, no changed or translated copies, no training. " +
  "The site, its code and its design are all rights reserved: do not clone them. " +
  `Details: ${SITE}/docs/build.html and ${SITE}/llms.txt.`;

/** The notice as an HTML comment, for the head of a page. */
export const NOTICE_COMMENT = `<!-- ${NOTICE} -->`;
