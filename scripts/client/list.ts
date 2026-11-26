// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

// The search on the static index pages (build-pages.ts), a progressive enhancement: without
// it every name is a link on the page, and the search box and the filter stay hidden. A name
// matches as the app's search matches it (packages/model/src/fold.ts: whatever the case,
// the accents, «ё», hyphens or spaces); a section with nothing left is hidden, and so is its
// jump link. Carried inline by each index page (scripts/client-script.ts).
import { foldName } from "../../packages/model/src/fold.ts";

export function run(): void {
  const m = document.querySelector("[data-list]");
  const tools = m?.querySelector<HTMLElement>("[data-tools]");
  const q = tools?.querySelector("input");
  if (!m || !tools || !q) return;
  tools.hidden = false;
  const only = tools.querySelector("[aria-pressed]");
  const items = [...m.querySelectorAll<HTMLElement>("[data-group] li")].map(
    (e) => [e, foldName(e.textContent)] as const,
  );
  const groups = [...m.querySelectorAll<HTMLElement>("[data-group]")];
  const empty = m.querySelector<HTMLElement>("[data-empty]");
  const filter = () => {
    const s = foldName(q.value.trim());
    const a = only?.getAttribute("aria-pressed") === "true";
    for (const [e, text] of items)
      e.hidden = !(text.includes(s) && (!a || e.classList.contains("art")));
    let shown = 0;
    for (const g of groups) {
      const left = g.querySelectorAll("li:not([hidden])").length;
      g.hidden = left === 0;
      shown += left ? 1 : 0;
      const j = m.querySelector('[href="#' + g.id + '"]');
      if (j) j.classList.toggle("off", !left);
      for (const c of [g.querySelector(".count"), j?.querySelector("span")])
        if (c) c.textContent = left.toLocaleString(document.documentElement.lang);
    }
    if (empty) empty.hidden = shown > 0;
  };
  q.addEventListener("input", filter);
  if (only)
    only.addEventListener("click", () => {
      only.setAttribute("aria-pressed", String(only.getAttribute("aria-pressed") !== "true"));
      filter();
    });
  if (q.value) filter();
}
