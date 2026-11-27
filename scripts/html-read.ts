// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Reads HTML as the HTML standard's tokenizer reads it, for the build and check scripts: a
 * tag and its attributes, the text between the tags, and a page's script elements.
 *
 * A pattern such as `/<[^>]*>/g` or `/<script>…<\/script>/` reads tags otherwise than a browser
 * does: it misses `<SCRIPT>` and `</script >`, takes a `>` inside a quoted value for the tag's
 * end, and reads a script's own text as tags. The readers here follow the standard instead.
 * One part of it is left out: a script's text that opens `<!--` and then `<script` (the
 * "double-escaped" state, kept for pages of the 1990s), which no page of the site has.
 */

export interface Tag {
  /** The tag's name, in lower case. */
  name: string;
  /** The attributes, their names in lower case, their values as written. */
  attrs: Map<string, string>;
  problems: string[];
  /** The index just after the tag's `>`. */
  end: number;
}

const space = (c: string | undefined) =>
  c === " " || c === "\t" || c === "\n" || c === "\f" || c === "\r";

const letter = (c: string | undefined) => c !== undefined && /^[a-zA-Z]$/.test(c);

/** The tag that starts at `at` (a `<` before a letter), read as the HTML standard reads it. */
export function readTag(html: string, at: number): Tag {
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

/** Elements whose text is not read as tags: it runs to the element's own end tag. */
const RAW_TEXT = new Set(["script", "style"]);

/** A piece of markup: a comment, a start or end tag, or a bogus comment (`<!x>`, `<?x>`). */
interface Markup {
  start: number;
  end: number;
  /** For a tag: its name and whether it is an end tag. */
  tag?: Tag;
  closing?: boolean;
}

/** The markup that starts at `at` (a `<`), or undefined when that `<` is text. */
function readMarkup(html: string, at: number): Markup | undefined {
  const next = html[at + 1];
  if (html.startsWith("<!--", at)) {
    // "<!-->" and "<!--->" end at once; any other comment runs to "-->".
    const close = html.indexOf("-->", at + 2);
    return { start: at, end: close < 0 ? html.length : close + 3 };
  }
  if (letter(next)) {
    const t = readTag(html, at);
    return { start: at, end: t.end, tag: t };
  }
  if (next === "/" && letter(html[at + 2])) {
    const t = readTag(html, at + 1);
    return { start: at, end: t.end, tag: t, closing: true };
  }
  if (next === "!" || next === "?" || (next === "/" && at + 2 < html.length)) {
    // A bogus comment runs to the next ">"; "</>" is nothing at all.
    const close = html.indexOf(">", at + 2);
    return { start: at, end: close < 0 ? html.length : close + 1 };
  }
  return undefined;
}

const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** Where the raw text of a `name` element opened before `from` ends: its end tag's `<`. */
function rawTextEnd(html: string, from: number, name: string): number {
  // The name is matched in ASCII case only, as the standard does; each "</" on its own, as
  // lowering the whole page could change its length ("İ" becomes two characters).
  const close = `</${name}`;
  for (let k = html.indexOf("</", from); k >= 0; k = html.indexOf("</", k + 1)) {
    if (asciiLower(html.slice(k, k + close.length)) !== close) continue;
    const after = html[k + close.length];
    // "</scripts>" is text; "</script", then a space, "/", ">" or the end, closes it.
    if (after === undefined || after === "/" || after === ">" || space(after)) return k;
  }
  return html.length;
}

/** Each piece of markup of a page in order, script and style text passed over. */
function* markups(html: string): Generator<Markup & { rawEnd?: number }> {
  let k = 0;
  while ((k = html.indexOf("<", k)) >= 0) {
    const m = readMarkup(html, k);
    if (!m) {
      k++;
      continue;
    }
    if (m.tag && !m.closing && RAW_TEXT.has(m.tag.name)) {
      const rawEnd = rawTextEnd(html, m.end, m.tag.name);
      yield { ...m, rawEnd };
      k = rawEnd;
      continue;
    }
    yield m;
    k = m.end;
  }
}

/**
 * The text of a piece of HTML, as a reader sees it: tags, comments and the text of scripts
 * and styles dropped, character references left as they are. `between` takes the place of
 * each tag (a space keeps "a<br>b" two words). `drop` names elements dropped with all they
 * hold (OSIS `note` and `title`); one written `<note/>` holds nothing.
 *
 * What is left can hold a `<` only where the HTML standard reads it as text (`a < b`), never
 * one that opens a tag or a comment.
 */
export function htmlText(
  html: string,
  o: { between?: string; drop?: readonly string[] } = {},
): string {
  const between = o.between ?? "";
  const drop = new Set(o.drop ?? []);
  let out = "";
  let last = 0;
  // The element being dropped and how many of it are open.
  let dropping: string | undefined;
  let depth = 0;
  for (const m of markups(html)) {
    if (!dropping) out += html.slice(last, m.start);
    last = m.rawEnd ?? m.end;
    const name = m.tag?.name;
    if (dropping) {
      if (name === dropping && m.closing) depth--;
      else if (name === dropping && !html.slice(m.start, m.end).endsWith("/>")) depth++;
      if (depth === 0) dropping = undefined;
      continue;
    }
    if (name && !m.closing && drop.has(name) && !html.slice(m.start, m.end).endsWith("/>")) {
      dropping = name;
      depth = 1;
      continue;
    }
    if (m.tag) out += between;
  }
  if (!dropping) out += html.slice(last);
  return out;
}

export interface Script {
  attrs: Map<string, string>;
  /** The script's own text, between its tags. */
  text: string;
  /** Where its text starts and ends in the page. */
  textStart: number;
  textEnd: number;
}

/** The page's script elements, in order, read as a browser reads them. */
export function scripts(html: string): Script[] {
  const list: Script[] = [];
  for (const m of markups(html))
    if (m.tag?.name === "script" && !m.closing && m.rawEnd !== undefined)
      list.push({
        attrs: m.tag.attrs,
        text: html.slice(m.end, m.rawEnd),
        textStart: m.end,
        textEnd: m.rawEnd,
      });
  return list;
}

/** The script types a browser runs as JavaScript (the HTML standard's JavaScript MIME types). */
const JAVASCRIPT = new Set([
  "module",
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]);

/** The text of each script the page runs from its own text: no src, and JavaScript. */
export function inlineScripts(html: string): string[] {
  return scripts(html)
    .filter((s) => {
      if (s.attrs.has("src")) return false;
      const type = s.attrs.get("type")?.trim().toLowerCase();
      return !type || JAVASCRIPT.has(type);
    })
    .map((s) => s.text);
}

/** The page with each script's text taken out, its tags kept. */
export function withoutScriptText(html: string): string {
  let out = "";
  let last = 0;
  for (const s of scripts(html)) {
    out += html.slice(last, s.textStart);
    last = s.textEnd;
  }
  return out + html.slice(last);
}
