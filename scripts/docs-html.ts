/**
 * The documentation's page sources (content/docs/<lang>/*.html) go into the built pages as
 * HTML, unescaped (scripts/build-docs.ts), and the pages run on the site's own origin. So a
 * source may hold markup only, never anything that runs or sends: this lists what would.
 *
 * - `<script>`: only the places-in-any-text demo, `<script src="../hg-places.js" …>`, empty;
 * - an event handler attribute (`onclick=` and the like) or `srcdoc=`;
 * - an address that runs or carries a document: `javascript:`, `vbscript:`, `data:`;
 * - `<object>`, `<embed>`, `<form>` and the tags that belong to a page's head
 *   (`<base>`, `<meta>`, `<link>`, `<style>`), and the old `<frame>`, `<frameset>`, `<applet>`;
 * - `<iframe>` other than the site's own globe (`../embed/v1…` or the site's address).
 *
 * A code sample shows tags escaped (`&lt;iframe …`), so it is text here and never matched.
 * scripts/docs-html.test.ts runs this on every source in CI; build-docs.ts refuses to build
 * a page that fails it.
 */
import { SITE_ORIGIN } from "../packages/model/src/site.ts";

const FORBIDDEN_TAGS = new Set([
  "object",
  "embed",
  "form",
  "base",
  "meta",
  "link",
  "style",
  "frame",
  "frameset",
  "applet",
]);
/** The one script a page may carry: the demo of hg-places.js, loaded from the site. */
const DEMO_SCRIPT =
  /^\s+src="(?:\.\.\/)+hg-places\.js"(?:\s+data-[a-z-]+="[^"<>]*")*(?:\s+defer)?\s*$/;
/** The site's own globe, by a path from the page or by the site's address. */
const OWN_EMBED = new RegExp(
  `^(?:(?:\\.\\./)+|${SITE_ORIGIN.replace(/\./g, "\\.")}/)embed/v1(?:[?#]|$)`,
);
const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** An attribute's value as the browser reads it: entities decoded, controls and spaces out. */
function decoded(value: string): string {
  const text = value
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "");
  let out = "";
  for (let k = 0; k < text.length; k++) if (text.charCodeAt(k) > 0x20) out += text.charAt(k);
  return out.toLowerCase();
}

/** What in a page source could run or send; empty when it is markup only. */
export function unsafeHtml(html: string): string[] {
  const problems: string[] = [];
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
    const tag = (m[1] as string).toLowerCase();
    const attrs = m[2] ?? "";
    const at = `<${tag}${attrs.length > 40 ? `${attrs.slice(0, 40)}…` : attrs}>`;
    if (FORBIDDEN_TAGS.has(tag)) problems.push(`${at}: no <${tag}> in a page source`);
    if (tag === "script") {
      const after = html.slice(m.index + m[0].length);
      if (!DEMO_SCRIPT.test(attrs) || !after.startsWith("</script>"))
        problems.push(`${at}: the only script allowed is the hg-places.js demo, empty`);
    }
    let src: string | undefined;
    for (const a of attrs.matchAll(ATTR)) {
      const name = (a[1] as string).toLowerCase();
      const value = a[2] ?? a[3] ?? a[4] ?? "";
      if (/^on/.test(name)) problems.push(`${at}: an event handler (${name}=)`);
      if (name === "srcdoc") problems.push(`${at}: srcdoc=`);
      if (/^(?:javascript|vbscript|data):/.test(decoded(value)))
        problems.push(`${at}: a ${decoded(value).split(":")[0]}: address in ${name}=`);
      if (name === "src") src = value.replace(/&amp;/g, "&");
    }
    if (tag === "iframe" && !(src !== undefined && OWN_EMBED.test(src)))
      problems.push(`${at}: an <iframe> of anything but the site's own globe (embed/v1)`);
  }
  return problems;
}
