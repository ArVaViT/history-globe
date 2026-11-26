// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Anonymous visit counts: Vercel Web Analytics, no cookies, no IP kept (the privacy page,
 * content/docs/<lang>/privacy.html). The app's page and every built page carry this one
 * inline script, in their head, so that they count alike:
 *
 * - only on the site itself: not on a preview, another host or a developer's machine;
 * - only in a tab of its own: a page that frames the globe counts its own visitors, not ours;
 * - only the address's path: the query and the fragment are cut before the count is sent.
 *   A query can hold what a reader wrote (a lesson's title, `title=`), and the privacy page
 *   says that never reaches the counts.
 *
 * The counter's script (served by the host under /_vercel/insights/) reads the commands queued
 * in `window.vaq` before it starts; `beforeSend` changes each count before it leaves. It sends
 * the referrer only when it is another site's. The script has no imports, so that every page
 * carries these very bytes and the Content-Security-Policy allows them by one hash (scripts/check-csp.ts).
 */
import { SITE_HOST } from "./site.ts";

/** Where the counter's script is served from (the host's, so nothing is bundled). */
export const ANALYTICS_SRC = "/_vercel/insights/script.js";

export const ANALYTICS_SCRIPT = `(function () {
  if (location.hostname !== "${SITE_HOST}" || window.self !== window.top) return;
  (window.vaq = window.vaq || []).push([
    "beforeSend",
    function (event) {
      var url = new URL(event.url, location.href);
      url.search = "";
      url.hash = "";
      event.url = url.href;
      return event;
    },
  ]);
  var s = document.createElement("script");
  s.defer = true;
  s.src = "${ANALYTICS_SRC}";
  document.head.appendChild(s);
})();`;

/** The script as a page carries it, in its head. */
export const ANALYTICS_TAG = `<script>${ANALYTICS_SCRIPT}</script>`;
