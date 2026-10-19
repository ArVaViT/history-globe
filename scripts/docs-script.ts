/**
 * One hit of the documentation's search as a list item (build-docs.ts, docs.js). Plain
 * JavaScript with its types stripped: its source is written into docs.js as it stands, so it
 * must use nothing but its arguments. Every field is escaped, the address too: the index is
 * built from the site's own pages today, but an address in an attribute is escaped like a
 * name in text, whoever wrote it.
 */
export function hitHtml(
  h: { t: string; p: string; u: string; c?: number },
  i: number,
  selected: boolean,
  esc: (s: string) => string,
): string {
  return (
    '<li role="option" id="hit-' +
    String(i) +
    '"' +
    (selected ? ' aria-selected="true"' : "") +
    '><a href="' +
    esc(h.u) +
    '"><b' +
    (h.c ? ' class="mono"' : "") +
    ">" +
    esc(h.t) +
    "</b>" +
    (h.p ? "<span>" + esc(h.p) + "</span>" : "") +
    "</a></li>"
  );
}
