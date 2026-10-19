/**
 * The beacon: a page of the site that runs from another address than the site's own tells
 * the site so (ADR 0017, addendum). The script stands inline at the end of every page, the
 * app's and the built ones alike, so that a copy of the HTML carries it. On the site itself,
 * on localhost and on the project's previews it does nothing. Elsewhere it asks the site for
 * one image whose address names the copy's host (`/origin/<host>`; there is no such file,
 * and the firewall logs the request), and writes one line onto the page: where the original
 * is. Nothing of the reader is in the request, and the site sets no cookie. A globe framed by
 * another site is not a copy: /embed/v1 is served by the site, so its hostname is the site's
 * own, and hg-places.js, which runs on other sites by design, does not carry the script.
 */

/** Where the beacon's request goes: the path, then the copy's host. */
export const BEACON_PATH = "/origin/";

/** The hosts the beacon is silent on: the site, a developer's machine, the project's previews. */
export const OWN_HOSTS =
  /^(historyglobe\.app|localhost|127\.0\.0\.1|\[::1\]|history-globe(-[a-z0-9-]*)?\.vercel\.app)$/;

/**
 * The script itself, inline and without imports: every page carries these very bytes, so
 * the Content-Security-Policy allows it by one hash (apps/web/vercel.json, scripts/check-csp.ts).
 */
export const BEACON_SCRIPT = `(function () {
  var h = location.hostname;
  if (!/^https?:$/.test(location.protocol) || /${OWN_HOSTS.source}/.test(h)) return;
  new Image().src = "https://historyglobe.app${BEACON_PATH}" + encodeURIComponent(h);
  var a = document.createElement("a");
  a.href = "https://historyglobe.app/";
  a.textContent = "Original: historyglobe.app";
  a.style.cssText =
    "position:fixed;left:12px;bottom:12px;z-index:2147483647;font:13px/1.4 system-ui,sans-serif;color:#0c1520;background:#f6efe1;border:1px solid rgba(12,21,32,0.3);border-radius:999px;padding:4px 12px;text-decoration:none";
  document.body.appendChild(a);
})();`;

/** The script as a page carries it, at the end of its body. */
export const BEACON_TAG = `<script>${BEACON_SCRIPT}</script>`;
