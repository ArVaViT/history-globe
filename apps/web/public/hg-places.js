/*
 * History Globe \u2014 places in any text.
 *
 * One line on any page turns the Bible places its text names into links to the globe,
 * each with a small card: what the place is, where it is today, how many verses name it,
 * and a locator map.
 *
 *   <script src="https://<globe>/hg-places.js" charset="utf-8" defer></script>
 *
 * Options, as attributes of the script tag:
 *   data-scope=".post"   where to look (a CSS selector; the whole page by default)
 *   data-locale="ru"     the text's language, ru or en (by default the page's lang)
 *   data-every           link every mention, not only the first of each place
 *   data-theme="dark"    the card's colours, light or dark (by default the reader's system)
 *
 * Text added later (a page that loads its content) is linked with
 * window.HistoryGlobePlaces.scan(element). Run it on text the page has finished rendering:
 * the script splits text nodes, which a framework that still manages them (React before
 * or during hydration) does not expect.
 *
 * No dependencies and no cookies: the script reads one file of names from the globe's own
 * address, without the page's address as referrer, and changes only the text it links.
 * Only names that point to one place are linked (scripts/build-text-places.ts says how
 * they are chosen), so a name shared by two places, or by a place and a person, stays
 * plain text. Strings outside ASCII are escaped, so a page in another encoding reads them.
 */
(() => {
  "use strict";
  if (window.HistoryGlobePlaces) return;

  const me = document.currentScript;
  const base = new URL(".", (me && me.src) || location.href);
  const attr = (k) => (me ? me.getAttribute(k) : null);
  const lang = (attr("data-locale") || document.documentElement.lang || "en")
    .toLowerCase()
    .startsWith("ru")
    ? "ru"
    : "en";
  const every = me ? me.hasAttribute("data-every") : false;

  // Text that is not prose, already a link, or a control stays as it is.
  const SKIP =
    "a,button,label,select,option,textarea,input,script,style,noscript,template,code,pre,kbd,samp,svg,math,iframe,h1,h2,h3,h4,h5,h6,summary,[role=button],[role=link],[role=tab],[role=menuitem],[contenteditable],[data-hg-skip],.hgp-skip";

  let index = null;
  let pattern = null;
  let names = null;
  let loading = null;

  const load = () =>
    (loading ||= fetch(new URL(`data/text-places.${lang}.json`, base), {
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        index = data;
        names = new Set(data.names || []);
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Longest first, so "Mount Zion" wins over "Zion". A space matches any run of
        // white space (a line break, a no-break space), a hyphen any hyphen, a Cyrillic e also yo
        // and an apostrophe either kind.
        const alts = Object.keys(data.forms)
          .sort((a, b) => b.length - a.length)
          .map((f) =>
            esc(f)
              .replace(/ /g, "[\\s\\u00a0]+")
              .replace(/-/g, "[-\\u2010\\u2011]")
              .replace(/\u0435/g, "[\\u0435\\u0451]")
              .replace(/['\u2019]/g, "['\\u2019]"),
          );
        // Whole words only, and not a part of a hyphenated name ("Kir-Moab" is not Moab).
        pattern = new RegExp(
          `(?<![\\p{L}\\p{N}\\-\\u2010\\u2011])(?:${alts.join("|")})(?![\\p{L}\\p{N}]|[-\\u2010\\u2011]\\p{L})`,
          "gu",
        );
      })
      .catch((err) => {
        // A failed fetch is tried again on the next scan.
        loading = null;
        throw err;
      }));

  const keyOf = (text) =>
    text
      .replace(/[\s\u00a0]+/g, " ")
      .replace(/[\u2010\u2011]/g, "-")
      .replace(/\u0451/g, "\u0435")
      .replace(/\u0401/g, "\u0415");
  const formOf = (text) => {
    const k = keyOf(text);
    for (const key of [k, k.replace(/'/g, "\u2019"), k.replace(/\u2019/g, "'")])
      if (index.forms[key] !== undefined) return index.forms[key];
    return undefined;
  };
  // A place's name that is also a first name, next to a capitalised word, is a person's
  // name: "Jordan Peterson", "Sharon Stone".
  const personal = (text, m) => {
    if (!names.has(keyOf(m[0]))) return false;
    if (/^[\s\u00a0]+\p{Lu}/u.test(text.slice(m.index + m[0].length))) return true;
    // A capitalised word before it, unless it is capitalised for starting the sentence.
    const before = text.slice(0, m.index);
    return (
      /\p{Lu}[\p{Ll}.]*[\s\u00a0]+$/u.test(before) &&
      !/(?:^|[.!?:\u2014][\s\u00a0]*)\p{Lu}\p{Ll}*[\s\u00a0]+$/u.test(before)
    );
  };

  const globeUrl = (id) =>
    new URL(`?${new URLSearchParams({ place: id, locale: lang })}`, base).href;
  const pageUrl = (slug) => new URL(`${lang}/place/${slug}/`, base).href;

  // Styles go in as constructed sheets, which a page's Content-Security-Policy without
  // 'unsafe-inline' still allows; a <style> element where those are not supported.
  const sheet = (css, root) => {
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(css);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, s];
    } catch {
      const s = document.createElement("style");
      s.textContent = css;
      (root === document ? document.head : root).append(s);
    }
  };

  // \u2500\u2500 Linking \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const STYLE = `a.hgp[data-hgp]{color:inherit;text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:.22em;text-decoration-color:color-mix(in srgb,currentColor 55%,transparent);cursor:pointer;border-radius:2px}
a.hgp[data-hgp]:hover,a.hgp[data-hgp][data-hgp-open]{text-decoration-style:solid;text-decoration-color:#9a3b1f}
a.hgp[data-hgp]:focus-visible{outline:2px solid #9a3b1f;outline-offset:2px}`;
  let styled = false;

  const scan = (root) => {
    if (!root || !index) return 0;
    if (!styled) {
      sheet(STYLE, document);
      styled = true;
    }
    const seen = new Set();
    if (!every) for (const a of root.querySelectorAll("a.hgp[data-hgp]")) seen.add(a.dataset.hgp);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        !n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    let linked = 0;
    for (const node of nodes) {
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      let at = 0;
      let first = -1;
      const after = [];
      for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
        const id = formOf(m[0]);
        // A longer name the index leaves out is matched and left alone (`id` empty).
        if (!id || (!every && seen.has(id)) || personal(text, m)) continue;
        seen.add(id);
        if (first < 0) first = m.index;
        else after.push(text.slice(at, m.index));
        const a = document.createElement("a");
        a.className = "hgp";
        a.dataset.hgp = id;
        a.href = globeUrl(id);
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = m[0];
        after.push(a);
        at = m.index + m[0].length;
        linked++;
      }
      if (first < 0) continue;
      after.push(text.slice(at));
      // The text node stays in place, holding the text before the first name: a page's
      // script that keeps a reference to it still finds it in the document.
      node.nodeValue = text.slice(0, first);
      node.after(...after.filter((x) => x !== ""));
    }
    return linked;
  };

  // \u2500\u2500 The card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const CARD_CSS = `:host{all:initial!important;position:fixed!important;inset:0 auto auto 0!important;width:0!important;height:0!important;z-index:2147483646!important;display:block!important}
.card{--paper:#fbf7ee;--ink:#2b2418;--soft:#6b5d48;--line:rgb(43 36 24/.13);--accent:#9a3b1f;--land:#f1e8d4;
position:fixed;width:288px;max-width:calc(100vw - 24px);box-sizing:border-box;
font:13.5px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--paper);
border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px -18px rgb(30 20 8/.45),0 2px 6px rgb(30 20 8/.08);
overflow:hidden;opacity:0;visibility:hidden;transform:translateY(4px) scale(.985);transform-origin:var(--ox,50%) var(--oy,0);
transition:opacity .16s ease,transform .16s ease,visibility 0s .16s;pointer-events:none}
.card.on{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .16s ease,transform .16s ease}
@media (prefers-reduced-motion:reduce){.card,.card.on{transition:none}}
@media (prefers-color-scheme:dark){.card:not(.light){--paper:#211c15;--ink:#efe6d4;--soft:#b3a58c;--line:rgb(239 230 212/.14);--accent:#e08a5f;--land:#2a241b}}
.card.dark{--paper:#211c15;--ink:#efe6d4;--soft:#b3a58c;--line:rgb(239 230 212/.14);--accent:#e08a5f;--land:#2a241b}
.map{display:block;width:100%;height:auto;background:var(--land);border-bottom:1px solid var(--line)}
.map path{fill:none;stroke:var(--soft);stroke-width:1;stroke-linejoin:round;opacity:.75}
.map .halo{fill:var(--accent);opacity:.18}.map .dot{fill:var(--accent);stroke:var(--paper);stroke-width:1.4}
.body{padding:11px 14px 12px}
.name{margin:0;font:600 17px/1.25 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;letter-spacing:.005em}
.kind{margin:2px 0 0;color:var(--soft);font-size:12.5px}
.facts{margin:9px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:max-content 1fr;gap:3px 12px}
.facts li{display:contents}
.facts b{color:var(--soft);font-weight:500;font-size:12px;line-height:1.6}
.note{color:var(--accent)}
.foot{display:flex;align-items:center;gap:10px;margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}
.go{display:inline-flex;white-space:nowrap;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:12.5px}
.card.dark .go{color:#1b140c}
@media (prefers-color-scheme:dark){.card:not(.light) .go{color:#1b140c}}
.go:hover{filter:brightness(1.08)}
.more{white-space:nowrap;color:var(--ink);font-size:12.5px;text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:.2em}
.more:hover{text-decoration-color:currentColor}
.brand{position:absolute;top:8px;right:10px;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--paper) 80%,transparent);color:var(--soft);font:italic 11.5px/1.3 "Iowan Old Style",Georgia,serif;text-decoration:none}`;

  let host = null;
  let card = null;
  let current = null;
  let showTimer = 0;
  let hideTimer = 0;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const svg = (tag, attrs) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  const ensureCard = () => {
    if (card) return;
    // Its own element, outside <body>: a page's rules for divs, or a transformed or
    // positioned body, do not move it.
    host = document.createElement("hg-place-card");
    host.setAttribute("data-hg-skip", "");
    // Pointer users read it; for keyboards and screen readers the link itself leads to
    // the same place on the globe.
    host.setAttribute("aria-hidden", "true");
    // Unstyled until its sheet applies (and for good, if a page forbids that).
    host.hidden = true;
    const shadow = host.attachShadow({ mode: "open" });
    sheet(CARD_CSS, shadow);
    card = el("div", "card");
    const theme = attr("data-theme");
    if (theme === "dark" || theme === "light") card.classList.add(theme);
    shadow.append(card);
    card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.addEventListener("mouseleave", () => hideSoon());
    document.documentElement.append(host);
    host.hidden = !getComputedStyle(card).position.startsWith("fixed");
  };

  const plural = (n) => {
    const f = index.text.verses;
    if (lang !== "ru") return (n === 1 ? f[0] : f[2]).replace("{{count}}", n);
    const m10 = n % 10;
    const m100 = n % 100;
    const i =
      m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
    return f[i].replace("{{count}}", n.toLocaleString(lang));
  };

  const locator = ([lon, lat]) => {
    const L = index.locator;
    const x = ((lon - L.frame.west) / (L.frame.east - L.frame.west)) * L.w;
    const y = ((L.frame.north - lat) / (L.frame.north - L.frame.south)) * L.h;
    if (x < 4 || y < 4 || x > L.w - 4 || y > L.h - 4) return null;
    // A part of the frame around the place, so the coast reads at card size.
    const w = L.w / 1.7;
    const h = w / 2.4;
    const vx = Math.min(Math.max(x - w / 2, 0), L.w - w);
    const vy = Math.min(Math.max(y - h / 2, 0), L.h - h);
    const s = svg("svg", {
      class: "map",
      viewBox: `${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`,
      width: "288",
      height: String(Math.round(288 / 2.4)),
    });
    s.append(
      svg("path", { d: L.path, "vector-effect": "non-scaling-stroke" }),
      svg("circle", { class: "halo", cx: x, cy: y, r: w / 26 }),
      svg("circle", {
        class: "dot",
        cx: x,
        cy: y,
        r: w / 70,
        "vector-effect": "non-scaling-stroke",
      }),
    );
    return s;
  };

  const fill = (id) => {
    const [name, kind, where, verses, at, slug, sure] = index.places[id];
    card.replaceChildren();
    const map = locator(at);
    if (map) card.append(map);
    const body = el("div", "body");
    body.append(el("p", "name", name), el("p", "kind", kind));
    const facts = el("ul", "facts");
    const fact = (label, value, cls) => {
      const li = el("li", cls);
      li.append(el("b", "", label), el("span", "", value));
      facts.append(li);
    };
    const ru = lang === "ru";
    if (where) fact(ru ? "\u0421\u0435\u0433\u043e\u0434\u043d\u044f" : "Today", where);
    fact(ru ? "\u0412 \u0411\u0438\u0431\u043b\u0438\u0438" : "In the Bible", plural(verses));
    if (sure)
      fact(
        ru ? "\u041b\u043e\u043a\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f" : "Location",
        sure === "disputed"
          ? index.text.disputed
          : sure === "likely"
            ? index.text.likely
            : index.text.tentative,
        "note",
      );
    body.append(facts);
    const foot = el("div", "foot");
    const go = el("a", "go", `${index.text.open} \u2197`);
    go.href = globeUrl(id);
    const more = el("a", "more", index.text.page);
    more.href = pageUrl(slug);
    const brand = el("a", "brand", "History Globe");
    brand.href = base.href;
    for (const a of [go, more, brand]) {
      a.target = "_blank";
      a.rel = "noopener";
      a.tabIndex = -1;
    }
    foot.append(go, more);
    body.append(foot);
    card.append(body, brand);
  };

  // In the window's own coordinates: the card is fixed, and a scroll takes it away.
  const place = (a) => {
    const r = a.getBoundingClientRect();
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const left = Math.min(Math.max(r.left + r.width / 2 - cw / 2, 12), vw - cw - 12);
    // Below the name, or above it when the window has no room below.
    const below = r.bottom + 8 + ch <= innerHeight || r.top - 8 - ch < 0;
    const top = below ? r.bottom + 8 : r.top - 8 - ch;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.setProperty("--ox", `${r.left + r.width / 2 - left}px`);
    card.style.setProperty("--oy", below ? "0" : "100%");
  };

  const show = (a) => {
    clearTimeout(hideTimer);
    if (host.hidden) return;
    if (current === a && card.classList.contains("on")) return;
    if (current) current.removeAttribute("data-hgp-open");
    current = a;
    fill(a.dataset.hgp);
    place(a);
    a.setAttribute("data-hgp-open", "");
    card.classList.add("on");
  };
  const hide = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (!card) return;
    card.classList.remove("on");
    if (current) current.removeAttribute("data-hgp-open");
    current = null;
  };
  const hideSoon = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 220);
  };

  const linkOf = (t) => (t instanceof Element ? t.closest("a.hgp[data-hgp]") : null);
  let touch = false;
  let listening = false;

  const listen = () => {
    if (listening) return;
    listening = true;
    // The kind of pointer is read as it moves too: a laptop with a touch screen gets its
    // hover cards back as soon as the mouse moves.
    const kind = (e) => {
      touch = e.pointerType === "touch" || e.pointerType === "pen";
    };
    document.addEventListener("pointerover", kind, true);
    document.addEventListener("pointerdown", (e) => {
      kind(e);
      if (card && current && !linkOf(e.target) && !e.composedPath().includes(host)) hide();
    });
    document.addEventListener("mouseover", (e) => {
      const a = linkOf(e.target);
      if (!a || touch) return;
      ensureCard();
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => show(a), card.classList.contains("on") ? 60 : 280);
    });
    document.addEventListener("mouseout", (e) => {
      if (linkOf(e.target) && !touch) hideSoon();
    });
    document.addEventListener("focusin", (e) => {
      const a = linkOf(e.target);
      if (!a || touch) return;
      ensureCard();
      show(a);
    });
    document.addEventListener("focusout", (e) => {
      if (linkOf(e.target)) hideSoon();
    });
    // On a touch screen the first tap shows the card, whose button opens the globe.
    document.addEventListener("click", (e) => {
      const a = linkOf(e.target);
      if (!a || !touch || current === a) return;
      ensureCard();
      if (host.hidden) return;
      e.preventDefault();
      show(a);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && current) hide();
    });
    addEventListener("resize", hide);
    // Any scroll, of the page or of a box inside it, moves the name from under the card.
    addEventListener(
      "scroll",
      (e) => {
        if (current && !(card && e.composedPath && e.composedPath().includes(card))) hide();
      },
      { capture: true, passive: true },
    );
  };

  const scopes = () => {
    const sel = attr("data-scope");
    if (!sel) return [document.body];
    try {
      return [...document.querySelectorAll(sel)];
    } catch {
      console.warn("History Globe places: data-scope is not a valid selector:", sel);
      return [];
    }
  };

  const start = () => {
    listen();
    load()
      .then(() => {
        for (const s of scopes()) scan(s);
      })
      .catch((err) => console.warn("History Globe places:", err));
  };

  window.HistoryGlobePlaces = {
    /** Links the places named in `element` (the page by default); resolves to how many. */
    scan: (element) => {
      listen();
      return load().then(() => scan(element || document.body));
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
