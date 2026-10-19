/**
 * The honeypot: one address set apart for the programs that ignore robots.txt (ADR 0017,
 * addendum). robots.txt disallows it for every crawler, and every page links to it with a
 * link no reader sees: hidden, out of the tab order, out of the accessibility tree, and
 * marked nofollow. A search engine reads robots.txt and never asks for it; a reader never
 * finds it. Whoever asks for it has read the page's HTML and ignored both, and the firewall
 * logs the request (the rules are the owner's, outside the repository). The page that is
 * there says so and nothing else, and asks not to be indexed should it ever be read.
 */

export const HONEYPOT_PATH = "/export/";

/**
 * The link as a page carries it, before the beacon's script. `root` is the path from the
 * page up to the site's root ("", "../", "../../"), as the pages write every link.
 */
export const honeypotLink = (root: string): string =>
  `<a href="${root}${HONEYPOT_PATH.slice(1)}" rel="nofollow" aria-hidden="true" tabindex="-1" hidden>Export</a>`;
