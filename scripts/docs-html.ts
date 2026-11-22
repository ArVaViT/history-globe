/**
 * The documentation's page sources (content/docs/<lang>/*.html) go into the built pages as
 * HTML, unescaped (scripts/build-docs.ts), and the pages run on the site's own origin. So a
 * source may hold markup only, never anything that runs or sends: this lists what would.
 *
 * - `<script>`: only the places-in-any-text demo, `<script src="../hg-places.js" …>`, empty;
 * - an event handler attribute (`onclick=` and the like) or `srcdoc=`;
 * - an address that runs or carries a document, `javascript:`, `vbscript:` or `data:`, at the
 *   start of any attribute's value or after a space, `;` or `,` in it (an SVG `values` list);
 * - `<object>`, `<embed>`, `<form>` and the tags that belong to a page's head
 *   (`<base>`, `<meta>`, `<link>`, `<style>`), and the old `<frame>`, `<frameset>`, `<applet>`;
 * - `<iframe>` other than the site's own globe (`../embed/v1…` or the site's address);
 * - what a browser reads otherwise than a reader of the source would: an attribute given
 *   twice (the browser keeps the first), a character reference no character has, and a tag
 *   left open at the end.
 *
 * Tags are read as the HTML standard reads them: an unquoted value runs to a space or `>`,
 * quotes and all. A code sample shows tags escaped (`&lt;iframe …`), so it is text here.
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
const DEMO_SRC = /^(?:\.\.\/)+hg-places\.js$/;
const DEMO_ATTRS = /^(?:src|defer|data-[a-z-]+)$/;
/** The site's own globe, by a path from the page or by the site's address. */
const OWN_EMBED = new RegExp(
  `^(?:(?:\\.\\./)+|${SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/)embed/v1(?:[?#]|$)`,
);
const RUNS = /(?:^|[\s;,])(?:javascript|vbscript|data):/;

interface Tag {
  name: string;
  attrs: Map<string, string>;
  problems: string[];
  end: number;
}

const space = (c: string | undefined) =>
  c === " " || c === "\t" || c === "\n" || c === "\f" || c === "\r";

/** The tag that starts at `at` (a `<` before a letter), read as the HTML standard reads it. */
function readTag(html: string, at: number): Tag {
  let k = at + 1;
  let name = "";
  while (k < html.length && !space(html[k]) && html[k] !== "/" && html[k] !== ">")
    name += html.charAt(k++);
  const attrs = new Map<string, string>();
  const problems: string[] = [];
  for (;;) {
    while (space(html[k]) || html[k] === "/") k++;
    if (k >= html.length) {
      problems.push("a tag left open at the end");
      return { name: name.toLowerCase(), attrs, problems, end: k };
    }
    if (html[k] === ">") return { name: name.toLowerCase(), attrs, problems, end: k + 1 };
    let attr = html[k++] ?? "";
    while (k < html.length && !space(html[k]) && !"/>=".includes(html[k] ?? ""))
      attr += html.charAt(k++);
    let j = k;
    while (space(html[j])) j++;
    let value = "";
    if (html[j] === "=") {
      j++;
      while (space(html[j])) j++;
      const q = html[j];
      if (q === '"' || q === "'") {
        const close = html.indexOf(q, j + 1);
        if (close < 0) {
          problems.push(`${attr}=: a quote left open`);
          return { name: name.toLowerCase(), attrs, problems, end: html.length };
        }
        value = html.slice(j + 1, close);
        j = close + 1;
      } else {
        while (j < html.length && !space(html[j]) && html[j] !== ">") value += html.charAt(j++);
      }
      k = j;
    }
    attr = attr.toLowerCase();
    if (attrs.has(attr)) problems.push(`${attr}= twice (the browser keeps the first)`);
    else attrs.set(attr, value);
  }
}

/** An attribute's value as the browser reads it: character references decoded. */
function decoded(value: string): string {
  const char = (n: number) => {
    if (!Number.isInteger(n) || n < 0 || n > 0x10ffff)
      throw new Error(`&#${String(n)}; is no character`);
    return String.fromCodePoint(n);
  };
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => char(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => char(Number(d)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Whether a value names an address that runs, wherever a browser may read one in it. */
function runs(value: string): string | undefined {
  // Inside a scheme a browser drops tabs and line breaks; around it, any space separates.
  const lower = value.toLowerCase();
  let joined = "";
  for (let k = 0; k < lower.length; k++) {
    const c = lower.charCodeAt(k);
    if (c !== 0x09 && c !== 0x0a && c !== 0x0d) joined += lower.charAt(k);
  }
  let bare = "";
  for (let k = 0; k < lower.length; k++) if (lower.charCodeAt(k) > 0x20) bare += lower.charAt(k);
  return (RUNS.exec(joined) ?? RUNS.exec(bare))?.[0].replace(/^[\s;,]/, "");
}

/** What in a page source could run or send; empty when it is markup only. */
export function unsafeHtml(html: string): string[] {
  const problems: string[] = [];
  let k = 0;
  while ((k = html.indexOf("<", k)) >= 0) {
    if (!/[a-zA-Z]/.test(html[k + 1] ?? "")) {
      k++;
      continue;
    }
    const tag = readTag(html, k);
    const source = html.slice(k, tag.end);
    const at = source.length > 60 ? `${source.slice(0, 60)}…` : source;
    const say = (m: string) => problems.push(`${at}: ${m}`);
    for (const p of tag.problems) say(p);
    if (FORBIDDEN_TAGS.has(tag.name)) say(`no <${tag.name}> in a page source`);
    if (tag.name === "script") {
      const demo =
        DEMO_SRC.test(tag.attrs.get("src") ?? "") &&
        [...tag.attrs.keys()].every((a) => DEMO_ATTRS.test(a)) &&
        html.startsWith("</script>", tag.end);
      if (!demo) say("the only script allowed is the hg-places.js demo, empty");
    }
    for (const [name, raw] of tag.attrs) {
      if (/^on/.test(name)) say(`an event handler (${name}=)`);
      if (name === "srcdoc") say("srcdoc=");
      let value: string;
      try {
        value = decoded(raw);
      } catch (e) {
        say(`${name}=: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const scheme = runs(value);
      if (scheme) say(`a ${scheme} address in ${name}=`);
    }
    if (tag.name === "iframe") {
      let src = tag.attrs.get("src");
      try {
        src = src === undefined ? undefined : decoded(src);
      } catch {
        src = undefined;
      }
      if (src === undefined || !OWN_EMBED.test(src))
        say("an <iframe> of anything but the site's own globe (embed/v1)");
    }
    k = tag.end;
  }
  return problems;
}
