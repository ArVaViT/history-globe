/**
 * Anonymous visit counts: Vercel Web Analytics, no cookies, no IP kept (docs: privacy.html).
 * Only on the site itself in a production build — not in development, a preview or a page
 * that embeds the globe — and the script comes from the host, so nothing is bundled.
 */
export function countVisits(): void {
  if (!import.meta.env.PROD || location.hostname !== "historyglobe.app") return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  document.head.append(script);
}
