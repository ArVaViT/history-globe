/**
 * Writes the documentation site, apps/web/public/docs/ (English) and docs/ru/ (Russian),
 * from the page sources in content/docs/{en,ru}/*.html: what the globe is, how its data
 * is made and checked, how to embed it, its sources and its author. Plain pages with the
 * globe's fonts and colours, no app bundle; one small script copies code samples.
 *
 * A page source is a front matter (`title`, `description`) and an HTML body. In the body,
 * `{{places}}` and the other counts below are filled in from the built data, so the
 * numbers never go stale, and `{{site}}` is the address the globe is served at (SITE_URL,
 * or a placeholder when it is not set).
 *
 * Usage: node scripts/build-docs.ts  (after build-content; counts read public/data)
 */
import { LOCALE_NAMES, LOCALES, type SiteLocale } from "../packages/model/src/time.ts";
import { esc, headMeta } from "./page-shell.ts";
import { DOC_PAGES, type DocPage } from "../packages/model/src/site.ts";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pub = join(root, "apps/web/public");
const data = join(pub, "data");
const src = join(root, "content/docs");
const out = join(pub, "docs");
const site = process.env.SITE_URL?.replace(/\/+$/, "") ?? "";

type Lang = SiteLocale;
// English first: its pages sit at the root of docs/.
const LANGS: readonly Lang[] = ["en", ...LOCALES.filter((l) => l !== "en")];
/** A language's folder under docs/: English at the root. */
const prefix = (l: Lang) => (l === "en" ? "" : `${l}/`);

/** The pages in the order of the menu. */
const PAGES = DOC_PAGES;
type Page = DocPage;

const T = {
  en: {
    docs: "Documentation",
    menu: "Contents",
    onPage: "On this page",
    copy: "Copy",
    copied: "Copied",
    updated: "Data as of",
  },
  ru: {
    docs: "Документация",
    menu: "Разделы",
    onPage: "На странице",
    copy: "Копировать",
    copied: "Скопировано",
    updated: "Данные на",
  },
} as const;

const read = (file: string): unknown =>
  existsSync(join(data, file)) ? JSON.parse(readFileSync(join(data, file), "utf8")) : undefined;

/** The counts a page may cite, from the built data; a missing file leaves its counts out. */
function counts(): Record<string, string> {
  const places = read("places.geojson") as { features: unknown[] } | undefined;
  const ancient = read("ancient.geojson") as { features: unknown[] } | undefined;
  const people = read("people.json") as { people: unknown[] } | undefined;
  const content = read("content.json") as Record<string, unknown> | undefined;
  const manifest = read("manifest.json") as
    { excluded_places?: unknown[]; built_at?: string } | undefined;
  const size = (k: string) => {
    const v = content?.[k];
    return v && typeof v === "object" ? Object.keys(v).length : undefined;
  };
  const overridesText = readFileSync(join(root, "content/polity-overrides.yaml"), "utf8");
  const n: Record<string, number | undefined> = {
    places: places?.features.length,
    ancient: ancient?.features.length,
    people: people?.people.length,
    tours: size("tours"),
    articles: size("articles"),
    events: size("events"),
    battles: size("battles"),
    life: size("life"),
    photos: size("photos"),
    names: size("names"),
    chapter_books: size("chapter_years"),
    excluded: manifest?.excluded_places?.length,
    // Corrections to the borders, and apart from them the periods drawn as vassals.
    overrides: (overridesText.split(/^vassals:/m)[0]?.match(/^ {2}- polity:/gm) ?? []).length,
    vassals: (overridesText.split(/^vassals:/m)[1]?.match(/^ {2}- polity:/gm) ?? []).length,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(n)) if (v !== undefined) out[k] = String(v);
  out.built = manifest?.built_at?.slice(0, 10) ?? "";
  out.site = site || "https://&lt;globe-host&gt;";
  return out;
}

interface Source {
  title: string;
  description: string;
  body: string;
}

function parse(file: string): Source {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m?.[1] || m[2] === undefined) throw new Error(`${file}: no front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv?.[1] && kv[2] !== undefined) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1");
  }
  if (!meta.title || !meta.description)
    throw new Error(`${file}: title and description are required`);
  return { title: meta.title, description: meta.description, body: m[2] };
}

/** "2 October 2026", «2 октября 2026 г.»: the build date as people write it. */
function dateIn(iso: string, l: Lang): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(l === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** The Russian form for a count by the language's own rules: 1 город, 2 города, 5 городов. */
const RU_COUNT = new Intl.PluralRules("ru");
function plural(n: number, one: string, few: string, many: string): string {
  const form = RU_COUNT.select(n);
  return form === "one" ? one : form === "few" ? few : many;
}

/**
 * Fills `{{name}}`; `{{name|город|города|городов}}` with the count and the word in the form
 * the count takes, `{{~name|…}}` with the word alone. An unknown name is an error, so a typo
 * cannot reach a page.
 */
function fill(body: string, n: Record<string, string>, file: string): string {
  return body.replace(
    /\{\{(~?)(\w+)(?:\|([^|}]+)\|([^|}]+)\|([^|}]+))?\}\}/g,
    (_, bare: string, k: string, one?: string, few?: string, many?: string) => {
      const v = n[k];
      if (v === undefined) throw new Error(`${file}: unknown or unavailable {{${k}}}`);
      if (!one || !few || !many) return v;
      const word = plural(Number(v), one, few, many);
      return bare ? word : `${v} ${word}`;
    },
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

/** Gives every h2 an id (its own, or one from its text) and lists them for the page menu. */
function headings(body: string): { body: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  const html = body.replace(
    /<h2( id="([^"]+)")?>([\s\S]*?)<\/h2>/g,
    (_, __, own: string | undefined, text: string) => {
      let id = own ?? slug(text);
      while (seen.has(id)) id += "-2";
      seen.add(id);
      toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
      return `<h2 id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${text}</h2>`;
    },
  );
  return { body: html, toc };
}

const FONTS = join(root, "apps/web/node_modules/@fontsource-variable");
const FONT_FILES = [
  ["literata", "literata-latin-wght-normal.woff2"],
  ["literata", "literata-latin-ext-wght-normal.woff2"],
  ["literata", "literata-cyrillic-wght-normal.woff2"],
  ["literata", "literata-latin-wght-italic.woff2"],
  ["literata", "literata-cyrillic-wght-italic.woff2"],
  ["golos-text", "golos-text-latin-wght-normal.woff2"],
  ["golos-text", "golos-text-latin-ext-wght-normal.woff2"],
  ["golos-text", "golos-text-cyrillic-wght-normal.woff2"],
] as const;

/** Line icons (Lucide, ISC) for the feature cards: `<li data-icon="route">`. */
const ICONS: Record<string, string> = {
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  chapter:
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  time: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  route:
    '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  verse:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  teach:
    '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  embed: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
};
const icon = (name: string) =>
  ICONS[name]
    ? `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg></span>`
    : "";

/** Feature cards: the icon a list item names goes into its card. */
function features(body: string): string {
  return body.replace(
    /<li data-icon="(\w+)">([\s\S]*?)<\/li>/g,
    (_, name: string, text: string) => {
      if (!ICONS[name]) throw new Error(`docs: unknown icon "${name}"`);
      // A card's title stands alone: no full stop after it.
      return `<li>${icon(name)}${text.replace(/^(\s*<b>[^<]*?)\.<\/b>/, "$1</b>")}</li>`;
    },
  );
}

/**
 * A light syntax colouring of the code samples, done at build time (no library): HTML
 * tags, attributes and strings, JavaScript comments, strings and keywords. Works on the
 * escaped source, so it never touches what the reader copies.
 */
/**
 * Russian typography in the text (not in tags, code or <pre>): a number keeps its unit
 * («586 г.», «35 КБ», «VIII в.»), «до н. э.» stays whole, and a dash its word before it.
 */
export function typeset(html: string): string {
  const NB = "\u00a0";
  return html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/(\d|[IVXLC]) (г\.|гг\.|в\.|вв\.|км|м(?![а-яё])|КБ|МБ)/g, `$1${NB}$2`)
            .replace(/до н\. э\./g, `до${NB}н.${NB}э.`)
            .replace(/н\. э\./g, `н.${NB}э.`)
            .replace(/([^\s>]) — /g, `$1${NB}— `),
    )
    .join("");
}

/** English: a number keeps its BC, AD, km or KB. */
export function typesetEnglish(html: string): string {
  const NB = "\u00a0";
  return html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/(\d) (BC|km|KB|MB)\b/g, `$1${NB}$2`).replace(/\bAD (\d)/g, `AD${NB}$1`),
    )
    .join("");
}

function highlight(body: string): string {
  return body.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, code: string) => {
    // One pass, so that no rule colours inside another's mark-up. An address is left
    // whole: its // is no comment, and <globe-host> is no tag (filled in on the page).
    const out = code.replace(
      /https?:\/\/\S*|(\/\/[^\n]*)|("[^"\n]*")|(&lt;\/?)([a-z]+)|\b([a-z-]+)(?==")|\b(const|function|if|return)\b/g,
      (
        m: string,
        c?: string,
        str?: string,
        lt?: string,
        tag?: string,
        attr?: string,
        kw?: string,
      ) =>
        c
          ? `<span class="c">${c}</span>`
          : str
            ? `<span class="s">${str}</span>`
            : lt && tag
              ? `${lt}<span class="t">${tag}</span>`
              : attr
                ? `<span class="a">${attr}</span>`
                : kw
                  ? `<span class="k">${kw}</span>`
                  : m,
    );
    return `<pre><code>${out}</code></pre>`;
  });
}

function page(o: {
  l: Lang;
  name: Page;
  src: Source;
  body: string;
  toc: { id: string; text: string }[];
  titles: Record<Page, string>;
  built: string;
}): string {
  // English at the root of docs/, every other language in its own folder.
  const up = o.l === "en" ? "" : "../";
  const file = (p: Page) => (p === "index" ? "" : `${p}.html`);
  const here = (l: Lang, p: Page) =>
    l === o.l ? file(p) || "./" : `${up}${prefix(l)}${file(p) || "./"}`;
  const paths = Object.fromEntries(
    LANGS.map((l) => [l, `docs/${prefix(l)}${file(o.name)}`]),
  ) as Record<Lang, string>;
  const meta = headMeta({ site, title: o.src.title, desc: o.src.description, paths, l: o.l });
  const langs = LANGS.filter((l) => l !== o.l)
    .map(
      (l) =>
        `<a class="lang" href="${here(l, o.name)}" hreflang="${l}" lang="${l}">${LOCALE_NAMES[l]}</a>`,
    )
    .join("");
  const nav = PAGES.map(
    (p) =>
      `<li><a href="${here(o.l, p)}"${p === o.name ? ' aria-current="page"' : ""}>${esc(o.titles[p])}</a></li>`,
  ).join("");
  const toc =
    o.toc.length > 1
      ? `<nav class="toc" aria-label="${T[o.l].onPage}"><p>${T[o.l].onPage}</p><ul>${o.toc
          // The heading's text is HTML already (entities and all): not escaped again.
          .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
          .join("")}</ul></nav>`
      : "";
  return `<!doctype html>
<html lang="${o.l}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6efe1" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#121a24" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${up}../favicon.svg" type="image/svg+xml" />
    <title>${o.name === "index" ? `History Globe ${T[o.l].docs}` : `${esc(o.src.title)} | History Globe`}</title>${meta}
    <link rel="stylesheet" href="${up}docs.css" />
  </head>
  <body>
    <a class="skip" href="#main">${o.l === "en" ? "Skip to content" : "К содержанию"}</a>
    <header class="bar">
      <a class="brand" href="${here(o.l, "index")}"><img src="${up}../favicon.svg" alt="" width="22" height="22" />History Globe <span>${T[o.l].docs}</span></a>
      ${langs}
    </header>
    <div class="layout">
      <nav class="side" aria-label="${T[o.l].menu}"><ul>${nav}</ul></nav>
      <main id="main">
        <h1>${esc(o.src.title)}</h1>
${o.body.trim()}
        ${o.name === "author" ? "" : `<p class="stamp">${T[o.l].updated} ${dateIn(o.built, o.l)}</p>`}
      </main>
      ${toc}
    </div>
    <script>
      // On a phone the menu is a row that scrolls: bring the current page into it.
      const current = document.querySelector(".side [aria-current]");
      const side = document.querySelector(".side");
      if (current && side && side.scrollWidth > side.clientWidth)
        side.scrollLeft = current.offsetLeft - (side.clientWidth - current.offsetWidth) / 2;
      // Without a known address at build time, the samples name the one they are read on,
      // so a copied snippet works.
      for (const code of document.querySelectorAll("pre code"))
        if (code.innerHTML.includes("https://&lt;globe-host&gt;"))
          code.innerHTML = code.innerHTML.replaceAll("https://&lt;globe-host&gt;", location.origin);
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      // The figures count up to their number once seen.
      const count = (el) => {
        const to = Number(el.textContent.replace(/[^0-9]/g, ""));
        if (!to || still) return;
        const t0 = performance.now();
        const fmt = new Intl.NumberFormat(document.documentElement.lang);
        const step = (t) => {
          const k = Math.min(1, (t - t0) / 1100);
          el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      // The live globe leans a little after the pointer.
      const hero = document.querySelector(".hero");
      if (hero && !still && matchMedia("(pointer: fine)").matches)
        hero.addEventListener("pointermove", (e) => {
          const r = hero.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          const f = hero.querySelector("iframe");
          f.style.setProperty("--ty", (x * 4).toFixed(2) + "deg");
          f.style.setProperty("--tx", (-y * 3).toFixed(2) + "deg");
        });
      // The page menu follows the section in view.
      const marks = [...document.querySelectorAll(".toc a")];
      if (marks.length && "IntersectionObserver" in window) {
        const byId = new Map(marks.map((a) => [a.getAttribute("href").slice(1), a]));
        const io = new IntersectionObserver(
          (seen) => {
            for (const e of seen)
              if (e.isIntersecting) {
                for (const a of marks) a.classList.remove("on");
                byId.get(e.target.id)?.classList.add("on");
              }
          },
          { rootMargin: "-20% 0px -70% 0px" },
        );
        for (const h of document.querySelectorAll("main h2[id]")) io.observe(h);
      }
      // Motion: the hero frame settles and the sections rise into view as they are reached.
      if ("IntersectionObserver" in window) {
        const watch = new IntersectionObserver(
          (seen) => {
            for (const e of seen)
              if (e.isIntersecting) {
                e.target.classList.add("in");
                if (e.target.classList.contains("figures"))
                  for (const b of e.target.querySelectorAll("b")) count(b);
                watch.unobserve(e.target);
              }
          },
          { threshold: 0.12 },
        );
        for (const el of document.querySelectorAll("main > h2, main > ul, main > p:not(.lede), main > .table, main > pre, .figures, .hero")) {
          if (!el.classList.contains("hero")) el.classList.add("reveal");
          watch.observe(el);
        }
      }
      // Copy buttons on code samples.
      for (const pre of document.querySelectorAll("pre")) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "copy";
        b.textContent = ${JSON.stringify(T[o.l].copy)};
        b.addEventListener("click", () => {
          navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText).then(() => {
            b.textContent = ${JSON.stringify(T[o.l].copied)};
            setTimeout(() => (b.textContent = ${JSON.stringify(T[o.l].copy)}), 1500);
          }, () => {});
        });
        pre.append(b);
      }
    </script>
  </body>
</html>
`;
}

const n = counts();
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "ru"), { recursive: true });
mkdirSync(join(out, "fonts"), { recursive: true });
for (const [pkg, file] of FONT_FILES)
  copyFileSync(join(FONTS, pkg, "files", file), join(out, "fonts", file));
copyFileSync(join(src, "docs.css"), join(out, "docs.css"));

for (const l of LANGS) {
  const dir = join(src, l);
  const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
  const extra = files.filter(
    (f) => !(PAGES as readonly string[]).includes(f.replace(/\.html$/, "")),
  );
  if (extra.length) throw new Error(`content/docs/${l}: not in the menu: ${extra.join(", ")}`);
  const sources = Object.fromEntries(
    PAGES.map((p) => [p, parse(join(dir, `${p}.html`))]),
  ) as Record<Page, Source>;
  const titles = Object.fromEntries(
    PAGES.map((p) => [p, p === "index" ? (l === "en" ? "Overview" : "Обзор") : sources[p].title]),
  ) as Record<Page, string>;
  for (const p of PAGES) {
    const file = `content/docs/${l}/${p}.html`;
    const filled = fill(sources[p].body, n, file);
    const { body, toc } = headings(
      highlight(features(l === "ru" ? typeset(filled) : typesetEnglish(filled))),
    );
    writeFileSync(
      join(out, prefix(l), p === "index" ? "index.html" : `${p}.html`),
      page({ l, name: p, src: sources[p], body, toc, titles, built: n.built ?? "" }),
    );
  }
}
console.log(`docs: ${PAGES.length} pages × ${LANGS.length} languages → apps/web/public/docs/`);
