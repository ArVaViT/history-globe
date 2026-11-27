// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

// The documentation's script (docs.js), one file for every page and language: the phone
// menu, the search, the outline that follows the reader, and the copy buttons. Without it
// the pages read and link as they are. Served as JavaScript by scripts/client-script.ts.
import { foldText } from "../../packages/model/src/fold.ts";

/** An entry of the search index (build-docs.ts): title, page, address, a code name. */
export interface Hit {
  readonly t: string;
  readonly p: string;
  readonly u: string;
  readonly c?: number;
}

/**
 * One hit as a list item. Every field is escaped, the address too: the index is built from
 * the site's own pages today, but an address in an attribute is escaped like a name in
 * text, whoever wrote it.
 */
export function hitHtml(h: Hit, i: number, selected: boolean, esc: (s: string) => string): string {
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

/** An element the page always has. */
function the(selector: string, within: ParentNode = document): HTMLElement {
  const e = within.querySelector<HTMLElement>(selector);
  if (!e) throw new Error(`docs.js: no ${selector}`);
  return e;
}
const all = (selector: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(selector),
];

export function run(): void {
  const root = document.documentElement;

  // Without a known address at build time, the samples name the one they are read on,
  // so a copied snippet works.
  for (const code of all("pre code"))
    if (code.innerHTML.includes("https://&lt;globe-host&gt;"))
      code.innerHTML = code.innerHTML.replaceAll("https://&lt;globe-host&gt;", location.origin);

  // Copy buttons.
  for (const b of all(".copy")) {
    b.hidden = false;
    const label = the("span", b);
    const text = label.textContent;
    b.addEventListener("click", () => {
      const code = the("code", b.closest(".code") ?? b);
      navigator.clipboard.writeText(code.innerText).then(
        () => {
          label.textContent = b.dataset["done"] ?? "";
          b.classList.add("done");
          setTimeout(() => {
            label.textContent = text;
            b.classList.remove("done");
          }, 1600);
        },
        () => {},
      );
    });
  }

  // The menu: a drawer on narrow screens.
  const menuBtn = the(".menu-btn");
  const scrim = the(".scrim");
  const setMenu = (open: boolean) => {
    root.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    scrim.hidden = !open;
  };
  menuBtn.addEventListener("click", () => {
    setMenu(!root.classList.contains("nav-open"));
  });
  scrim.addEventListener("click", () => {
    setMenu(false);
  });
  for (const a of all(".side a"))
    a.addEventListener("click", () => {
      setMenu(false);
    });
  document.querySelector(".side [aria-current]")?.scrollIntoView({ block: "center" });

  // The outline follows the section in view.
  const marks = all(".toc a[href^='#']");
  if (marks.length && "IntersectionObserver" in window) {
    const byId = new Map(marks.map((a) => [a.getAttribute("href")?.slice(1), a]));
    const io = new IntersectionObserver(
      (seen) => {
        for (const e of seen)
          if (e.isIntersecting) {
            for (const a of marks) a.classList.remove("on");
            byId.get(e.target.id)?.classList.add("on");
          }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const h of all("main h2[id], main h3[id]")) io.observe(h);
  }

  // Search: the sections of every page and the names the reference tables define.
  const form = the(".search");
  const input = the("input", form) as HTMLInputElement;
  const list = the(".results", form);
  const searchBtn = the(".search-btn");
  form.hidden = false;
  searchBtn.hidden = false;
  let index: Promise<Hit[]> | undefined;
  let hits: Hit[] = [];
  let at = 0;
  const load = () =>
    (index ??= fetch(input.dataset["index"] ?? "")
      .then((r) => r.json() as Promise<Hit[]>)
      .catch(() => []));
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => "&#" + String(c.charCodeAt(0)) + ";");
  const show = (open: boolean) => {
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  };
  const paint = () => {
    list.innerHTML = hits.length
      ? hits.map((h, i) => hitHtml(h, i, i === at, esc)).join("")
      : '<li class="none">' + esc(input.dataset["none"] ?? "") + "</li>";
    input.setAttribute("aria-activedescendant", hits.length ? "hit-" + String(at) : "");
  };
  const search = async () => {
    const q = foldText(input.value.trim());
    if (!q) {
      show(false);
      return;
    }
    const words = q.split(/\s+/);
    const entries = await load();
    hits = entries
      .map((e) => {
        const t = foldText(e.t);
        const hay = t + " " + foldText(e.p);
        if (!words.every((w) => hay.includes(w))) return null;
        const score = (t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2) + (e.p ? 0 : -0.5);
        return { e, score };
      })
      .filter((x) => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((x) => x.e);
    at = 0;
    paint();
    show(true);
  };
  input.addEventListener("focus", () => {
    void load();
  });
  input.addEventListener("input", () => {
    void search();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!hits.length) return;
      at = (at + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
      paint();
    } else if (e.key === "Escape") {
      input.value = "";
      show(false);
      root.classList.remove("search-open");
      input.blur();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const h = hits[at];
    if (h) location.href = h.u;
  });
  document.addEventListener("click", (e) => {
    const target = e.target as Node | null;
    if (!form.contains(target) && target !== searchBtn && !searchBtn.contains(target)) {
      show(false);
      root.classList.remove("search-open");
    }
  });
  const openSearch = () => {
    setMenu(false);
    root.classList.add("search-open");
    input.focus();
  };
  searchBtn.addEventListener("click", openSearch);
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      openSearch();
    } else if (e.key === "Escape") setMenu(false);
  });
}
