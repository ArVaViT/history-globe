/**
 * Whether this page counts as a visit: the site itself in a production build, opened in a
 * tab of its own. Not development, a preview or another host, and not inside a frame: a
 * page that embeds the globe (a host's reader) counts its own visitors, not ours.
 */
export function countsAsVisit(prod: boolean, hostname: string, framed: boolean): boolean {
  return prod && hostname === "historyglobe.app" && !framed;
}

/**
 * Anonymous visit counts: Vercel Web Analytics, no cookies, no IP kept (docs: privacy.html).
 * Only where countsAsVisit says so; the script comes from the host, so nothing is bundled.
 */
export function countVisits(): void {
  // A frame on another origin may still compare its window with the top one.
  if (!countsAsVisit(import.meta.env.PROD, location.hostname, window.self !== window.top)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  document.head.append(script);
}
