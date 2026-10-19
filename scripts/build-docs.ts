/**
 * Writes the documentation site, apps/web/public/docs/ (English) and docs/<lang>/ (every
 * other language), from the page sources in content/docs/<lang>/*.html: what the globe is, how its data
 * is made and checked, how to embed it, its sources and its author. Static pages with the
 * globe's font and colours and no app bundle: a menu in groups, a page outline, code
 * samples with their language and a copy button, and a search over the pages' sections
 * and the names the reference tables define. One small script (docs.js) does the copying,
 * the search and the phone menu; without it every page still reads and links.
 *
 * A page source is a front matter (`title`, `description`) and an HTML body. In the body,
 * `{{places}}` and the other counts below are filled in from the built data, so the
 * numbers never go stale, and `{{site}}` is the address the globe is served at (SITE_URL,
 * or a placeholder when it is not set). `<nav class="cards"></nav>` is filled with a card
 * for every other page; `<p class="note">` becomes a callout.
 *
 * Usage: node scripts/build-docs.ts  (after build-content; counts read public/data)
 */
import { LOCALE_NAMES, LOCALES, type SiteLocale } from "../packages/model/src/time.ts";
import { bodyEnd, esc, headMeta } from "./page-shell.ts";
import { hitHtml } from "./docs-script.ts";
import { NOTICE_COMMENT } from "../packages/model/src/notice.ts";
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
const REPO = "https://github.com/ArVaViT/history-globe";

// The documentation is written in every language the site is published in.
type Lang = SiteLocale;
// English first: its pages sit at the root of docs/.
const LANGS: readonly Lang[] = ["en", ...LOCALES.filter((l) => l !== "en")];
/** A language's folder under docs/: English at the root. */
const prefix = (l: Lang) => (l === "en" ? "" : `${l}/`);
type Page = DocPage;

/** The menu: the pages in groups, in the order they are read (and paged through). */
const GROUPS: readonly { name: Readonly<Record<Lang, string>>; pages: readonly Page[] }[] = [
  {
    name: {
      en: "Get started",
      ru: "Начало",
      uk: "Початок",
      es: "Primeros pasos",
      pt: "Primeiros passos",
      de: "Erste Schritte",
      fr: "Premiers pas",
      it: "Per iniziare",
      nl: "Aan de slag",
      pl: "Pierwsze kroki",
      cs: "Začínáme",
    },
    pages: ["index"],
  },
  {
    name: {
      en: "Developers",
      ru: "Разработчикам",
      uk: "Розробникам",
      es: "Desarrolladores",
      pt: "Desenvolvedores",
      de: "Für Entwickler",
      fr: "Développeurs",
      it: "Sviluppatori",
      nl: "Voor ontwikkelaars",
      pl: "Dla programistów",
      cs: "Pro vývojáře",
    },
    pages: ["build", "embedding", "api"],
  },
  {
    name: {
      en: "Data",
      ru: "Данные",
      uk: "Дані",
      es: "Datos",
      pt: "Dados",
      de: "Daten",
      fr: "Données",
      it: "Dati",
      nl: "Gegevens",
      pl: "Dane",
      cs: "Data",
    },
    pages: ["methodology", "sources"],
  },
  {
    name: {
      en: "About",
      ru: "О проекте",
      uk: "Про проєкт",
      es: "Acerca de",
      pt: "Sobre",
      de: "Über das Projekt",
      fr: "À propos",
      it: "Il progetto",
      nl: "Over het project",
      pl: "O projekcie",
      cs: "O projektu",
    },
    pages: ["author", "privacy"],
  },
];
const PAGES: readonly Page[] = GROUPS.flatMap((g) => g.pages);
if (PAGES.length !== DOC_PAGES.length || DOC_PAGES.some((p) => !PAGES.includes(p)))
  throw new Error("docs: the menu's groups must hold every page of DOC_PAGES once");
const GROUP_OF = new Map(GROUPS.flatMap((g) => g.pages.map((p) => [p, g.name] as const)));

const T = {
  en: {
    language: "Language",
    docs: "Docs",
    menu: "Documentation",
    onPage: "On this page",
    pages: "All pages",
    copy: "Copy",
    copied: "Copied",
    updated: "Data as of",
    open: "Open the globe",
    prev: "Previous",
    next: "Next",
    data: "Data under CC BY 4.0",
    search: "Search the docs",
    noResults: "Nothing found",
    edit: "Edit this page",
    report: "Report an issue",
    source: "Source code",
    skip: "Skip to content",
    openMenu: "Menu",
    overview: "Overview",
  },
  ru: {
    language: "Язык",
    docs: "Документация",
    menu: "Документация",
    onPage: "На странице",
    pages: "Все страницы",
    copy: "Копировать",
    copied: "Скопировано",
    updated: "Данные на",
    open: "Открыть глобус",
    prev: "Назад",
    next: "Далее",
    data: "Данные под CC BY 4.0",
    search: "Поиск по документации",
    noResults: "Ничего не найдено",
    edit: "Править страницу",
    report: "Сообщить об ошибке",
    source: "Исходный код",
    skip: "К содержанию",
    openMenu: "Меню",
    overview: "Обзор",
  },
  uk: {
    language: "Мова",
    docs: "Документація",
    menu: "Документація",
    onPage: "На сторінці",
    pages: "Усі сторінки",
    copy: "Копіювати",
    copied: "Скопійовано",
    updated: "Дані на",
    open: "Відкрити глобус",
    prev: "Назад",
    next: "Далі",
    data: "Дані під CC BY 4.0",
    search: "Пошук у документації",
    noResults: "Нічого не знайдено",
    edit: "Редагувати сторінку",
    report: "Повідомити про помилку",
    source: "Вихідний код",
    skip: "До змісту",
    openMenu: "Меню",
    overview: "Огляд",
  },
  es: {
    language: "Idioma",
    docs: "Documentación",
    menu: "Documentación",
    onPage: "En esta página",
    pages: "Todas las páginas",
    copy: "Copiar",
    copied: "Copiado",
    updated: "Datos a",
    open: "Abrir el globo",
    prev: "Anterior",
    next: "Siguiente",
    data: "Datos bajo CC BY 4.0",
    search: "Buscar en la documentación",
    noResults: "No se encontró nada",
    edit: "Editar esta página",
    report: "Informar de un error",
    source: "Código fuente",
    skip: "Ir al contenido",
    openMenu: "Menú",
    overview: "Resumen",
  },
  pt: {
    language: "Idioma",
    docs: "Documentação",
    menu: "Documentação",
    onPage: "Nesta página",
    pages: "Todas as páginas",
    copy: "Copiar",
    copied: "Copiado",
    updated: "Dados de",
    open: "Abrir o globo",
    prev: "Anterior",
    next: "Próxima",
    data: "Dados sob CC BY 4.0",
    search: "Pesquisar na documentação",
    noResults: "Nada encontrado",
    edit: "Editar esta página",
    report: "Relatar um erro",
    source: "Código-fonte",
    skip: "Ir para o conteúdo",
    openMenu: "Menu",
    overview: "Visão geral",
  },
  de: {
    language: "Sprache",
    docs: "Dokumentation",
    menu: "Dokumentation",
    onPage: "Auf dieser Seite",
    pages: "Alle Seiten",
    copy: "Kopieren",
    copied: "Kopiert",
    updated: "Datenstand",
    open: "Globus öffnen",
    prev: "Zurück",
    next: "Weiter",
    data: "Daten unter CC BY 4.0",
    search: "Dokumentation durchsuchen",
    noResults: "Nichts gefunden",
    edit: "Seite bearbeiten",
    report: "Fehler melden",
    source: "Quellcode",
    skip: "Zum Inhalt",
    openMenu: "Menü",
    overview: "Überblick",
  },
  fr: {
    language: "Langue",
    docs: "Documentation",
    menu: "Documentation",
    onPage: "Sur cette page",
    pages: "Toutes les pages",
    copy: "Copier",
    copied: "Copié",
    updated: "Données au",
    open: "Ouvrir le globe",
    prev: "Précédent",
    next: "Suivant",
    data: "Données sous CC BY 4.0",
    search: "Rechercher dans la documentation",
    noResults: "Aucun résultat",
    edit: "Modifier cette page",
    report: "Signaler une erreur",
    source: "Code source",
    skip: "Aller au contenu",
    openMenu: "Menu",
    overview: "Vue d’ensemble",
  },
  it: {
    language: "Lingua",
    docs: "Documentazione",
    menu: "Documentazione",
    onPage: "In questa pagina",
    pages: "Tutte le pagine",
    copy: "Copia",
    copied: "Copiato",
    updated: "Dati al",
    open: "Apri il globo",
    prev: "Precedente",
    next: "Successiva",
    data: "Dati con licenza CC BY 4.0",
    search: "Cerca nella documentazione",
    noResults: "Nessun risultato",
    edit: "Modifica questa pagina",
    report: "Segnala un errore",
    source: "Codice sorgente",
    skip: "Vai al contenuto",
    openMenu: "Menu",
    overview: "Panoramica",
  },
  nl: {
    language: "Taal",
    docs: "Documentatie",
    menu: "Documentatie",
    onPage: "Op deze pagina",
    pages: "Alle pagina's",
    copy: "Kopiëren",
    copied: "Gekopieerd",
    updated: "Gegevens van",
    open: "Open de globe",
    prev: "Vorige",
    next: "Volgende",
    data: "Gegevens onder CC BY 4.0",
    search: "Zoeken in de documentatie",
    noResults: "Geen resultaten",
    edit: "Deze pagina bewerken",
    report: "Een fout melden",
    source: "Broncode",
    skip: "Naar de inhoud",
    openMenu: "Menu",
    overview: "Overzicht",
  },
  pl: {
    language: "Język",
    docs: "Dokumentacja",
    menu: "Dokumentacja",
    onPage: "Na tej stronie",
    pages: "Wszystkie strony",
    copy: "Kopiuj",
    copied: "Skopiowano",
    updated: "Dane z dnia",
    open: "Otwórz globus",
    prev: "Poprzednia",
    next: "Następna",
    data: "Dane na licencji CC BY 4.0",
    search: "Szukaj w dokumentacji",
    noResults: "Brak wyników",
    edit: "Edytuj tę stronę",
    report: "Zgłoś błąd",
    source: "Kod źródłowy",
    skip: "Przejdź do treści",
    openMenu: "Menu",
    overview: "Przegląd",
  },
  cs: {
    language: "Jazyk",
    docs: "Dokumentace",
    menu: "Dokumentace",
    onPage: "Na této stránce",
    pages: "Všechny stránky",
    copy: "Kopírovat",
    copied: "Zkopírováno",
    updated: "Data ke dni",
    open: "Otevřít glóbus",
    prev: "Předchozí",
    next: "Další",
    data: "Data pod licencí CC BY 4.0",
    search: "Hledat v dokumentaci",
    noResults: "Žádné výsledky",
    edit: "Upravit tuto stránku",
    report: "Nahlásit chybu",
    source: "Zdrojový kód",
    skip: "Přejít na obsah",
    openMenu: "Menu",
    overview: "Přehled",
  },
} as const satisfies Record<Lang, Record<string, string>>;

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
  // The places-in-any-text script as other sites load it: its newest version's own address
  // and the hash that pins its content (scripts/hg-places-releases.json).
  const releases = JSON.parse(
    readFileSync(join(root, "scripts/hg-places-releases.json"), "utf8"),
  ) as { latest: string; versions: Record<string, string> };
  out.hgPlacesSrc = `${out.site}/hg-places-${releases.latest}.js`;
  out.hgPlacesIntegrity = releases.versions[releases.latest] ?? "";
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
  return new Intl.DateTimeFormat(l === "en" ? "en-GB" : l, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** A word's form for a count by the language's own rules: 1 город, 2 города, 5 городов. */
function plural(l: Lang, n: number, one: string, few: string, many: string): string {
  const form = new Intl.PluralRules(l).select(n);
  return form === "one" ? one : form === "few" ? few : many;
}

/**
 * Fills `{{name}}`; `{{name|город|города|городов}}` with the count and the word in the form
 * the count takes, `{{~name|…}}` with the word alone. An unknown name is an error, so a typo
 * cannot reach a page.
 */
function fill(body: string, n: Record<string, string>, file: string, l: Lang): string {
  return body.replace(
    /\{\{(~?)(\w+)(?:\|([^|}]+)\|([^|}]+)\|([^|}]+))?\}\}/g,
    (_, bare: string, k: string, one?: string, few?: string, many?: string) => {
      const v = n[k];
      if (v === undefined) throw new Error(`${file}: unknown or unavailable {{${k}}}`);
      if (!one || !few || !many) return v;
      const word = plural(l, Number(v), one, few, many);
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

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Gives every h2 and h3 an id (its own, or one from its text) and lists them for the outline. */
function headings(body: string): { body: string; toc: Heading[] } {
  const toc: Heading[] = [];
  const seen = new Set<string>();
  const html = body.replace(
    /<h([23])( id="([^"]+)")?>([\s\S]*?)<\/h\1>/g,
    (_, level: string, __, own: string | undefined, text: string) => {
      let id = own ?? slug(text);
      while (seen.has(id)) id += "-2";
      seen.add(id);
      toc.push({ id, text: text.replace(/<[^>]+>/g, ""), level: level === "3" ? 3 : 2 });
      return `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a></h${level}>`;
    },
  );
  return { body: html, toc };
}

const FONTS = join(root, "apps/web/node_modules/@fontsource-variable");
const FONT_FILES = [
  ["literata", "literata-latin-wght-normal.woff2"],
  ["literata", "literata-latin-ext-wght-normal.woff2"],
  ["literata", "literata-cyrillic-wght-normal.woff2"],
  ["golos-text", "golos-text-latin-wght-normal.woff2"],
  ["golos-text", "golos-text-latin-ext-wght-normal.woff2"],
  ["golos-text", "golos-text-cyrillic-wght-normal.woff2"],
] as const;

/**
 * Line icons (Lucide, ISC): the feature cards' (`<li data-icon="route">`) and the page's own
 * (the menu, search, copy, callouts, links).
 */
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
  offline:
    '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  embed: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  code: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
};
/** An icon as inline SVG; decorative, so hidden from screen readers. */
const svg = (name: string) => {
  const paths = ICONS[name];
  if (!paths) throw new Error(`docs: unknown icon "${name}"`);
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
};

/** Feature cards get their icons; notes become callouts; wide tables take the keyboard. */
function features(body: string): string {
  return (
    body
      // A table wider than a phone scrolls in its frame: the frame takes the keyboard too.
      .replaceAll('<div class="table">', '<div class="table" tabindex="0">')
      .replace(/<li data-icon="(\w+)">([\s\S]*?)<\/li>/g, (_, name: string, text: string) => {
        // A card's title stands alone: no full stop after it.
        return `<li><span class="icon">${svg(name)}</span>${text.replace(/^(\s*<b>[^<]*?)\.<\/b>/, "$1</b>")}</li>`;
      })
      .replace(
        /<p class="note"( lang="[\w-]+")?>([\s\S]*?)<\/p>/g,
        (_, lang: string | undefined, text: string) =>
          `<div class="callout"${lang ?? ""}>${svg("info")}<p>${text.trim()}</p></div>`,
      )
  );
}

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

/** The text of a page (not its tags, code or <pre>) run through `fix`. */
const inText = (html: string, fix: (text: string) => string) =>
  html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/)
    .map((part, i) => (i % 2 === 1 ? part : fix(part)))
    .join("");

/** Ukrainian, as the Russian: «586 р.», «до н. е.» whole, a dash keeps its word before it. */
export function typesetUkrainian(html: string): string {
  const NB = "\u00a0";
  return inText(html, (t) =>
    t
      .replace(/(\d|[IVXLC]) (р\.|рр\.|ст\.|км|м(?![а-яіїєґ])|КБ|МБ)/g, `$1${NB}$2`)
      .replace(/до н\. е\./g, `до${NB}н.${NB}е.`)
      .replace(/н\. е\./g, `н.${NB}е.`)
      .replace(/([^\s>]) — /g, `$1${NB}— `),
  );
}

/**
 * Spanish, Portuguese, German, French, Italian, Dutch, Polish and Czech: a number keeps its unit and its era (586 a. C.,
 * 586 v. Chr., 586 av. J.-C.); French also keeps « », : ; ! ? on their word with a thin
 * no-break space.
 */
function typesetLatin(l: Lang): (html: string) => string {
  const NB = "\u00a0";
  const NNB = "\u202f";
  return (html) =>
    inText(html, (t) => {
      let x = t
        .replace(/(\d) (km|KB|MB|kB)\b/g, `$1${NB}$2`)
        .replace(
          /(\d) (a\. ?C\.|d\. ?C\.|v\. ?Chr\.|n\. ?Chr\.|av\. J\.-C\.|apr\. J\.-C\.|p\.n\.e\.|n\.e\.|př\. n\. l\.|n\. l\.)/g,
          `$1${NB}$2`,
        )
        .replace(/\b(a|d|v|n|av|apr)\. (C\.|Chr\.|J\.-C\.)/g, `$1.${NB}$2`)
        .replace(/př\. n\. l\./g, `př.${NB}n.${NB}l.`)
        .replace(/\bn\. l\./g, `n.${NB}l.`);
      // Polish and Czech keep a one-letter word on the next line's word: "w Egipcie", "v Egyptě".
      if (l === "pl" || l === "cs")
        x = x.replace(/(^|[\s(„])([aiouwzkvsAIOUWZKVS]) /g, `$1$2${NB}`);
      if (l === "fr")
        x = x
          .replace(/ ([:;!?»])/g, `${NNB}$1`)
          .replace(/« /g, `«${NNB}`)
          .replace(/(\S)([;!?])(?=\s|$)/g, `$1${NNB}$2`);
      return x;
    });
}

/** Each language's typography. */
const TYPESET: Readonly<Record<Lang, (html: string) => string>> = {
  en: typesetEnglish,
  ru: typeset,
  uk: typesetUkrainian,
  es: typesetLatin("es"),
  pt: typesetLatin("pt"),
  de: typesetLatin("de"),
  fr: typesetLatin("fr"),
  it: typesetLatin("it"),
  nl: typesetLatin("nl"),
  pl: typesetLatin("pl"),
  cs: typesetLatin("cs"),
};
/** The languages that preload the Cyrillic font. */
const CYRILLIC: ReadonlySet<Lang> = new Set(["ru", "uk"]);

/** A code sample's language, from its first line: markup, an HTTP request or JavaScript. */
const langOf = (code: string) =>
  /^\s*&lt;/.test(code) ? "HTML" : /^GET /.test(code) ? "HTTP" : "JavaScript";

/**
 * A light syntax colouring of the code samples, done at build time (no library): HTML
 * tags, attributes and strings, JavaScript comments, strings and keywords. Works on the
 * escaped source, so it never touches what the reader copies. Each sample gets a bar with
 * its language and a copy button (shown by docs.js, which does the copying).
 */
function highlight(body: string, l: Lang): string {
  return body.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, code: string) => {
    // One pass, so that no rule colours inside another's mark-up. An address is left
    // whole: its // is no comment, and <globe-host> is no tag (filled in on the page).
    const out = code.replace(
      /https?:\/\/\S*|(\/\/[^\n]*)|("[^"\n]*")|(&lt;\/?)([a-z]+)|\b([a-z-]+)(?==")|\b(const|function|if|return|GET)\b/g,
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
    // A wide sample scrolls sideways: the keyboard reaches it through the tabindex.
    return `<div class="code"><div class="code-bar"><span>${langOf(code)}</span><button type="button" class="copy" data-done="${T[l].copied}" hidden>${svg("copy")}<span>${T[l].copy}</span></button></div><pre tabindex="0"><code>${out}</code></pre></div>`;
  });
}

/** What the search finds: a page, a section of it, or a name a reference table defines. */
interface Entry {
  /** The section or the name. */
  t: string;
  /** The page it is on. */
  p: string;
  /** The address, relative to the language's folder. */
  u: string;
  /** 1 for a name in code (a parameter, a message, a file). */
  c?: 1;
}

/** The page's entries for the search: its title, its sections and its tables' names. */
function entries(body: string, title: string, url: string): Entry[] {
  const list: Entry[] = [{ t: title, p: "", u: url }];
  const seen = new Set<string>();
  // Plain text: the results are written into the page as text, not as HTML.
  const text = (html: string) =>
    html
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
  let at = url;
  let section = title;
  for (const m of body.matchAll(
    /<h[23] id="([^"]+)">([\s\S]*?)<a class="anchor"|<tr>\s*<td><code>([^<]+)<\/code>/g,
  )) {
    if (m[1] && m[2]) {
      at = `${url}#${m[1]}`;
      section = `${title} › ${text(m[2])}`;
      list.push({ t: text(m[2]), p: title, u: at });
    } else if (m[3] && !seen.has(m[3])) {
      seen.add(m[3]);
      list.push({ t: text(m[3]), p: section, u: at, c: 1 });
    }
  }
  return list;
}

interface Built {
  name: Page;
  src: Source;
  body: string;
  toc: Heading[];
}

function page(o: {
  l: Lang;
  it: Built;
  all: Record<Page, Built>;
  titles: Record<Page, string>;
  built: string;
}): string {
  const { l, it } = o;
  const t = T[l];
  // English at the root of docs/, every other language in its own folder.
  const up = l === "en" ? "" : "../";
  const file = (p: Page) => (p === "index" ? "" : `${p}.html`);
  const here = (to: Lang, p: Page) =>
    to === l ? file(p) || "./" : `${up}${prefix(to)}${file(p) || "./"}`;
  const paths = Object.fromEntries(
    LANGS.map((x) => [x, `docs/${prefix(x)}${file(it.name)}`]),
  ) as Record<Lang, string>;
  const meta = headMeta({ site, title: it.src.title, desc: it.src.description, paths, l });
  // The languages behind one button (seven no longer fit the bar): a list that opens
  // without script, each language under its own name, the page's own marked.
  const langs = `<details class="langs"><summary class="btn lang" title="${t.language}" aria-label="${t.language}: ${LOCALE_NAMES[l]}">${svg("globe")}<span>${LOCALE_NAMES[l]}</span></summary><ul>${LANGS.map(
    (x) =>
      `<li><a href="${here(x, it.name)}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="page"' : ""}>${LOCALE_NAMES[x]}</a></li>`,
  ).join("")}</ul></details>`;
  // The outline: the page's h2 under its entry in the menu, for screens without the right column.
  const outline = (p: Page) =>
    p === it.name && it.toc.some((h) => h.level === 2)
      ? `<ul class="sub">${it.toc
          .filter((h) => h.level === 2)
          .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
          .join("")}</ul>`
      : "";
  const nav = GROUPS.map(
    (g) =>
      `<li><p>${g.name[l]}</p><ul>${g.pages
        .map(
          (p) =>
            `<li><a href="${here(l, p)}"${p === it.name ? ' aria-current="page"' : ""}>${esc(o.titles[p])}</a>${outline(p)}</li>`,
        )
        .join("")}</ul></li>`,
  ).join("");
  const group = GROUP_OF.get(it.name)?.[l] ?? "";
  const crumbs =
    it.name === "index"
      ? ""
      : `<nav class="crumbs" aria-label="Breadcrumb"><a href="./">${t.docs}</a>${svg("chevron")}<span>${group}</span></nav>`;
  // The pages before and after this one, to read the documentation through.
  const at = PAGES.indexOf(it.name);
  const prev = PAGES[at - 1];
  const next = PAGES[at + 1];
  const pager = `<nav class="pager" aria-label="${t.prev} / ${t.next}">${
    prev
      ? `<a class="prev" href="${here(l, prev)}"><span>${svg("left")}${t.prev}</span>${esc(o.titles[prev])}</a>`
      : "<span></span>"
  }${
    next
      ? `<a class="next" href="${here(l, next)}"><span>${t.next}${svg("right")}</span>${esc(o.titles[next])}</a>`
      : ""
  }</nav>`;
  const editUrl = `${REPO}/edit/main/content/docs/${l}/${it.name}.html`;
  const toc =
    it.toc.length > 1
      ? `<p class="toc-title">${t.onPage}</p><ul>${it.toc
          // The heading's text is HTML already (entities and all): not escaped again.
          .map((h) => `<li class="l${h.level}"><a href="#${h.id}">${h.text}</a></li>`)
          .join("")}</ul>`
      : "";
  // The overview's cards: every other page, with its description.
  const body = it.body.replace(
    '<nav class="cards"></nav>',
    `<nav class="cards" aria-label="${t.pages}">${PAGES.filter((p) => p !== "index")
      .map(
        (p) =>
          `<a href="${here(l, p)}"><span class="kicker">${GROUP_OF.get(p)?.[l] ?? ""}</span><b>${esc(o.titles[p])}</b><span>${esc(o.all[p].src.description)}</span></a>`,
      )
      .join("")}</nav>`,
  );
  return `<!doctype html>
<html lang="${l}" class="no-js">
  <head>
    ${NOTICE_COMMENT}
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#fcfbf8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0c1218" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${up}../favicon.svg" type="image/svg+xml" />
    <title>${it.name === "index" ? `History Globe ${t.menu}` : `${esc(it.src.title)} | History Globe ${t.docs}`}</title>${meta}
    <link rel="preload" href="${up}fonts/golos-text-${CYRILLIC.has(l) ? "cyrillic" : "latin"}-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="${up}docs.css" />
    <script>document.documentElement.className = "js";</script>
    <script defer src="${up}docs.js"></script>
  </head>
  <body>
    <a class="skip" href="#main">${t.skip}</a>
    <header class="bar">
      <button type="button" class="btn icon-btn menu-btn" aria-controls="side" aria-expanded="false" aria-label="${t.openMenu}">${svg("menu")}</button>
      <a class="brand" href="${here(l, "index")}"><img src="${up}../favicon.svg" alt="" width="24" height="24" /><span>History Globe</span><span class="tag">${t.docs}</span></a>
      <form class="search" role="search" hidden>
        <label>${svg("search")}<span class="sr">${t.search}</span><input type="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" placeholder="${t.search}" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-expanded="false" data-index="${up}${prefix(l)}search.json" data-none="${t.noResults}" /><kbd>/</kbd></label>
        <ul id="search-results" class="results" role="listbox" hidden></ul>
      </form>
      <span class="bar-end">
        <button type="button" class="btn icon-btn search-btn" aria-label="${t.search}" hidden>${svg("search")}</button>
        ${langs}
        <a class="btn icon-btn gh" href="${REPO}" aria-label="GitHub"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg></a>
        <a class="btn open" href="${up}../?locale=${l}">${t.open}${svg("out")}</a>
      </span>
    </header>
    <div class="layout">
      <nav class="side" id="side" aria-label="${t.menu}"><ul>${nav}</ul><a class="btn open side-open" href="${up}../?locale=${l}">${t.open}${svg("out")}</a></nav>
      <div class="scrim" hidden></div>
      <div class="page">
        <main id="main">
          ${crumbs}
          <h1>${esc(it.src.title)}</h1>
${body.trim()}
          <div class="page-meta">
            ${it.name === "author" ? "<span></span>" : `<span>${t.updated} ${dateIn(o.built, l)}</span>`}
            <a href="${editUrl}">${svg("edit")}${t.edit}</a>
          </div>
          ${pager}
          <footer class="foot">
            <span>History Globe · ${t.data}</span>
            <a href="${REPO}">${t.source}</a>
          </footer>
        </main>
        <aside class="toc" aria-label="${t.onPage}">
          ${toc}
          <p class="toc-links"><a href="${editUrl}">${svg("edit")}${t.edit}</a><a href="${REPO}/issues/new">${svg("alert")}${t.report}</a></p>
        </aside>
      </div>
    </div>
${bodyEnd(`${up}../`)}
  </body>
</html>
`;
}

/**
 * The page's script (docs.js), one file for every page and language: the phone menu, the
 * search, the outline that follows the reader, and the copy buttons. Without it the pages
 * read and link as they are.
 */
const SCRIPT = `// History Globe docs: menu, search, outline, copy buttons. Built by scripts/build-docs.ts.
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Without a known address at build time, the samples name the one they are read on,
  // so a copied snippet works.
  for (const code of $$("pre code"))
    if (code.innerHTML.includes("https://&lt;globe-host&gt;"))
      code.innerHTML = code.innerHTML.replaceAll("https://&lt;globe-host&gt;", location.origin);

  // Copy buttons.
  for (const b of $$(".copy")) {
    b.hidden = false;
    const label = b.querySelector("span");
    const text = label.textContent;
    b.addEventListener("click", () => {
      const code = b.closest(".code").querySelector("code");
      navigator.clipboard.writeText(code.innerText).then(() => {
        label.textContent = b.dataset.done;
        b.classList.add("done");
        setTimeout(() => {
          label.textContent = text;
          b.classList.remove("done");
        }, 1600);
      }, () => {});
    });
  }

  // The menu: a drawer on narrow screens.
  const menuBtn = $(".menu-btn");
  const scrim = $(".scrim");
  const setMenu = (open) => {
    root.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    scrim.hidden = !open;
  };
  menuBtn.addEventListener("click", () => setMenu(!root.classList.contains("nav-open")));
  scrim.addEventListener("click", () => setMenu(false));
  for (const a of $$(".side a")) a.addEventListener("click", () => setMenu(false));
  $(".side [aria-current]")?.scrollIntoView({ block: "center" });

  // The outline follows the section in view.
  const marks = $$(".toc a[href^='#']");
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
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const h of $$("main h2[id], main h3[id]")) io.observe(h);
  }

  // Search: the sections of every page and the names the reference tables define.
  const form = $(".search");
  const input = $("input", form);
  const list = $(".results", form);
  const searchBtn = $(".search-btn");
  form.hidden = false;
  searchBtn.hidden = false;
  let index;
  let hits = [];
  let at = 0;
  const load = () =>
    (index ??= fetch(input.dataset.index).then((r) => r.json()).catch(() => []));
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/ё/g, "е");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
  const hitHtml = ${hitHtml.toString().replace(/ {2,}/g, " ").replace(/ +\n/g, "\n")};
  const show = (open) => {
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  };
  const paint = () => {
    list.innerHTML = hits.length
      ? hits.map((h, i) => hitHtml(h, i, i === at, esc)).join("")
      : '<li class="none">' + esc(input.dataset.none) + "</li>";
    input.setAttribute("aria-activedescendant", hits.length ? "hit-" + at : "");
  };
  const run = async () => {
    const q = norm(input.value.trim());
    if (!q) return show(false);
    const words = q.split(/\\s+/);
    const all = await load();
    hits = all
      .map((e) => {
        const t = norm(e.t);
        const hay = t + " " + norm(e.p);
        if (!words.every((w) => hay.includes(w))) return null;
        const score = (t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2) + (e.p ? 0 : -0.5);
        return { e, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((x) => x.e);
    at = 0;
    paint();
    show(true);
  };
  input.addEventListener("focus", load);
  input.addEventListener("input", run);
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
    if (!form.contains(e.target) && e.target !== searchBtn && !searchBtn.contains(e.target)) {
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
})();
`;

const n = counts();
rmSync(out, { recursive: true, force: true });
for (const l of LANGS) mkdirSync(join(out, prefix(l)), { recursive: true });
mkdirSync(join(out, "fonts"), { recursive: true });
for (const [pkg, file] of FONT_FILES)
  copyFileSync(join(FONTS, pkg, "files", file), join(out, "fonts", file));
copyFileSync(join(src, "docs.css"), join(out, "docs.css"));
writeFileSync(join(out, "docs.js"), SCRIPT);

for (const l of LANGS) {
  const dir = join(src, l);
  const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
  const extra = files.filter(
    (f) => !(PAGES as readonly string[]).includes(f.replace(/\.html$/, "")),
  );
  if (extra.length) throw new Error(`content/docs/${l}: not in the menu: ${extra.join(", ")}`);
  const all = Object.fromEntries(
    PAGES.map((p) => {
      const file = `content/docs/${l}/${p}.html`;
      const source = parse(join(root, file));
      const filled = fill(source.body, n, file, l);
      const { body, toc } = headings(highlight(features(TYPESET[l](filled)), l));
      return [p, { name: p, src: source, body, toc }];
    }),
  ) as Record<Page, Built>;
  const titles = Object.fromEntries(
    PAGES.map((p) => [p, p === "index" ? T[l].overview : all[p].src.title]),
  ) as Record<Page, string>;
  const search: Entry[] = [];
  for (const p of PAGES) {
    search.push(...entries(all[p].body, titles[p], p === "index" ? "./" : `${p}.html`));
    writeFileSync(
      join(out, prefix(l), p === "index" ? "index.html" : `${p}.html`),
      page({ l, it: all[p], all, titles, built: n.built ?? "" }),
    );
  }
  writeFileSync(join(out, prefix(l), "search.json"), JSON.stringify(search));
}
console.log(`docs: ${PAGES.length} pages × ${LANGS.length} languages → apps/web/public/docs/`);
