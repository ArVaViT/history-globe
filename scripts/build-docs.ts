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
 * for every other page; `<p class="note">` becomes a callout; `<div class="bibles"></div>`
 * becomes the table of the Bible of every language (bible-text.ts), and a
 * `<pre><code class="cite">` is a citation to copy, plain text.
 *
 * Usage: node scripts/build-docs.ts  (after build-content; counts read public/data)
 */
import {
  type Locale,
  LOCALE_NAMES,
  LOCALES,
  type SiteLocale,
} from "../packages/model/src/locales.ts";
import { bodyEnd, esc, headMeta, sansPreload } from "./page-shell.ts";
import { clientScript } from "./client-script.ts";
import { TYPESET } from "./typeset.ts";
import { REPOSITORY } from "../packages/model/src/site.ts";
import { NOTICE_COMMENT } from "../packages/model/src/notice.ts";
import { DOC_PAGES, type DocPage } from "../packages/model/src/docs.ts";
import { SOURCES } from "./bible-text.ts";
import { attributionGaps, factMismatches, type Facts } from "./repo-facts.ts";
import { T as PAGE_WORDS } from "./page-words.ts";
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
import { gzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

const root = join(import.meta.dirname, "..");
const pub = join(root, "apps/web/public");
const data = join(pub, "data");
const src = join(root, "content/docs");
const out = join(pub, "docs");
const site = process.env.SITE_URL?.replace(/\/+$/, "") ?? "";

// The documentation is written in every language the site is published in; the words of a
// language still waiting to join (Locale) are here before it.
type Lang = SiteLocale;
type Words<T> = Readonly<Record<Lang, T>> & Readonly<Partial<Record<Locale, T>>>;
// English first: its pages sit at the root of docs/.
const LANGS: readonly Lang[] = ["en", ...LOCALES.filter((l) => l !== "en")];
/** A language's folder under docs/: English at the root. */
const prefix = (l: Lang) => (l === "en" ? "" : `${l}/`);
type Page = DocPage;

/** The menu: the pages in groups, in the order they are read (and paged through). */
const GROUPS: readonly { name: Words<string>; pages: readonly Page[] }[] = [
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
      sv: "Kom igång",
      da: "Kom i gang",
      nb: "Kom i gang",
      sr: "Почетак",
      tl: "Pagsisimula",
      hu: "Első lépések",
      fi: "Aloitus",
      vi: "Bắt đầu",
      ro: "Primii pași",
      bg: "Начало",
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
      sv: "För utvecklare",
      da: "For udviklere",
      nb: "For utviklere",
      sr: "За програмере",
      tl: "Para sa mga developer",
      hu: "Fejlesztőknek",
      fi: "Kehittäjille",
      vi: "Dành cho nhà phát triển",
      ro: "Pentru dezvoltatori",
      bg: "За разработчици",
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
      sv: "Data",
      da: "Data",
      nb: "Data",
      sr: "Подаци",
      tl: "Datos",
      hu: "Adatok",
      fi: "Tiedot",
      vi: "Dữ liệu",
      ro: "Date",
      bg: "Данни",
    },
    pages: ["methodology", "sources", "reviews"],
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
      sv: "Om projektet",
      da: "Om projektet",
      nb: "Om prosjektet",
      sr: "О пројекту",
      tl: "Tungkol sa proyekto",
      hu: "A projektről",
      fi: "Tietoa projektista",
      vi: "Về dự án",
      ro: "Despre proiect",
      bg: "За проекта",
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
    openMenu: "Menu",
    overview: "Overview",
    bibleHead: ["Language", "Edition", "Electronic text", "Licence"],
    crown: "; in the United Kingdom, Crown copyright",
    versesOnly: "verse texts only",
    none: "none yet",
  },
  ru: {
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
    openMenu: "Меню",
    overview: "Обзор",
    bibleHead: ["Язык", "Издание", "Электронный текст", "Лицензия"],
    crown: "; в Великобритании — права Короны",
    versesOnly: "только тексты стихов",
    none: "пока нет",
  },
  uk: {
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
    openMenu: "Меню",
    overview: "Огляд",
    bibleHead: ["Мова", "Видання", "Електронний текст", "Ліцензія"],
    crown: "; у Великій Британії — права Корони",
    versesOnly: "лише тексти віршів",
    none: "поки немає",
  },
  es: {
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
    openMenu: "Menú",
    overview: "Resumen",
    bibleHead: ["Idioma", "Edición", "Texto electrónico", "Licencia"],
    crown: "; en el Reino Unido, derechos de la Corona",
    versesOnly: "solo textos de versículos",
    none: "ninguna todavía",
  },
  pt: {
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
    openMenu: "Menu",
    overview: "Visão geral",
    bibleHead: ["Idioma", "Edição", "Texto eletrônico", "Licença"],
    crown: "; no Reino Unido, direitos da Coroa",
    versesOnly: "só textos de versículos",
    none: "nenhuma ainda",
  },
  de: {
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
    openMenu: "Menü",
    overview: "Überblick",
    bibleHead: ["Sprache", "Ausgabe", "Elektronischer Text", "Lizenz"],
    crown: "; im Vereinigten Königreich Crown Copyright",
    versesOnly: "nur Verstexte",
    none: "noch keine",
  },
  fr: {
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
    openMenu: "Menu",
    overview: "Vue d’ensemble",
    bibleHead: ["Langue", "Édition", "Texte électronique", "Licence"],
    crown: " ; au Royaume-Uni, droits de la Couronne",
    versesOnly: "textes des versets seulement",
    none: "aucune pour l’instant",
  },
  it: {
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
    openMenu: "Menu",
    overview: "Panoramica",
    bibleHead: ["Lingua", "Edizione", "Testo elettronico", "Licenza"],
    crown: "; nel Regno Unito, diritti della Corona",
    versesOnly: "solo testi dei versetti",
    none: "nessuna per ora",
  },
  nl: {
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
    openMenu: "Menu",
    overview: "Overzicht",
    bibleHead: ["Taal", "Uitgave", "Elektronische tekst", "Licentie"],
    crown: "; in het Verenigd Koninkrijk Crown copyright",
    versesOnly: "alleen verzen",
    none: "nog geen",
  },
  pl: {
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
    openMenu: "Menu",
    overview: "Przegląd",
    bibleHead: ["Język", "Wydanie", "Tekst elektroniczny", "Licencja"],
    crown: "; w Wielkiej Brytanii prawa Korony",
    versesOnly: "tylko teksty wersetów",
    none: "na razie brak",
  },
  cs: {
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
    openMenu: "Menu",
    overview: "Přehled",
    bibleHead: ["Jazyk", "Vydání", "Elektronický text", "Licence"],
    crown: "; ve Spojeném království práva Koruny",
    versesOnly: "jen texty veršů",
    none: "zatím žádné",
  },
  sv: {
    docs: "Dokumentation",
    menu: "Dokumentation",
    onPage: "På den här sidan",
    pages: "Alla sidor",
    copy: "Kopiera",
    copied: "Kopierat",
    updated: "Data per",
    open: "Öppna globen",
    prev: "Föregående",
    next: "Nästa",
    data: "Data under CC BY 4.0",
    search: "Sök i dokumentationen",
    noResults: "Inget hittades",
    edit: "Redigera sidan",
    report: "Rapportera ett fel",
    source: "Källkod",
    openMenu: "Meny",
    overview: "Översikt",
    bibleHead: ["Språk", "Utgåva", "Elektronisk text", "Licens"],
    crown: "; i Storbritannien Crown copyright",
    versesOnly: "bara verstexter",
    none: "inga ännu",
  },
  da: {
    docs: "Dokumentation",
    menu: "Dokumentation",
    onPage: "På denne side",
    pages: "Alle sider",
    copy: "Kopiér",
    copied: "Kopieret",
    updated: "Data pr.",
    open: "Åbn globussen",
    prev: "Forrige",
    next: "Næste",
    data: "Data under CC BY 4.0",
    search: "Søg i dokumentationen",
    noResults: "Intet fundet",
    edit: "Redigér siden",
    report: "Rapportér en fejl",
    source: "Kildekode",
    openMenu: "Menu",
    overview: "Oversigt",
    bibleHead: ["Sprog", "Udgave", "Elektronisk tekst", "Licens"],
    crown: "; i Storbritannien Crown copyright",
    versesOnly: "kun verstekster",
    none: "ingen endnu",
  },
  nb: {
    docs: "Dokumentasjon",
    menu: "Dokumentasjon",
    onPage: "På denne siden",
    pages: "Alle sider",
    copy: "Kopier",
    copied: "Kopiert",
    updated: "Data per",
    open: "Åpne globusen",
    prev: "Forrige",
    next: "Neste",
    data: "Data under CC BY 4.0",
    search: "Søk i dokumentasjonen",
    noResults: "Ingenting funnet",
    edit: "Rediger siden",
    report: "Rapporter en feil",
    source: "Kildekode",
    openMenu: "Meny",
    overview: "Oversikt",
    bibleHead: ["Språk", "Utgave", "Elektronisk tekst", "Lisens"],
    crown: "; i Storbritannia Crown copyright",
    versesOnly: "bare verstekster",
    none: "ingen ennå",
  },
  sr: {
    docs: "Документација",
    menu: "Документација",
    onPage: "На овој страници",
    pages: "Све странице",
    copy: "Копирај",
    copied: "Копирано",
    updated: "Подаци од",
    open: "Отвори глобус",
    prev: "Претходна",
    next: "Следећа",
    data: "Подаци под лиценцом CC BY 4.0",
    search: "Претражи документацију",
    noResults: "Ништа није пронађено",
    edit: "Уреди ову страницу",
    report: "Пријави грешку",
    source: "Изворни код",
    openMenu: "Мени",
    overview: "Преглед",
    bibleHead: ["Језик", "Издање", "Електронски текст", "Лиценца"],
    crown: "; у Уједињеном Краљевству права Круне",
    versesOnly: "само текстови стихова",
    none: "још нема",
  },
  tl: {
    docs: "Dokumentasyon",
    menu: "Dokumentasyon",
    onPage: "Sa pahinang ito",
    pages: "Lahat ng pahina",
    copy: "Kopyahin",
    copied: "Nakopya",
    updated: "Datos noong",
    open: "Buksan ang globo",
    prev: "Nakaraan",
    next: "Susunod",
    data: "Datos sa ilalim ng CC BY 4.0",
    search: "Hanapin sa dokumentasyon",
    noResults: "Walang nahanap",
    edit: "I-edit ang pahinang ito",
    report: "Mag-ulat ng mali",
    source: "Source code",
    openMenu: "Menu",
    overview: "Pangkalahatang-ideya",
    bibleHead: ["Wika", "Edisyon", "Elektronikong teksto", "Lisensiya"],
    crown: "; sa United Kingdom, Crown copyright",
    versesOnly: "mga teksto lamang ng talata",
    none: "wala pa",
  },
  hu: {
    docs: "Dokumentáció",
    menu: "Dokumentáció",
    onPage: "Ezen az oldalon",
    pages: "Minden oldal",
    copy: "Másolás",
    copied: "Másolva",
    updated: "Adatok állapota:",
    open: "A földgömb megnyitása",
    prev: "Előző",
    next: "Következő",
    data: "Adatok CC BY 4.0 licenc alatt",
    search: "Keresés a dokumentációban",
    noResults: "Nincs találat",
    edit: "Az oldal szerkesztése",
    report: "Hiba bejelentése",
    source: "Forráskód",
    openMenu: "Menü",
    overview: "Áttekintés",
    bibleHead: ["Nyelv", "Kiadás", "Elektronikus szöveg", "Licenc"],
    crown: "; az Egyesült Királyságban a Korona szerzői joga",
    versesOnly: "csak a versek szövege",
    none: "még nincs",
  },
  fi: {
    docs: "Dokumentaatio",
    menu: "Dokumentaatio",
    onPage: "Tällä sivulla",
    pages: "Kaikki sivut",
    copy: "Kopioi",
    copied: "Kopioitu",
    updated: "Tiedot päivitetty",
    open: "Avaa maapallo",
    prev: "Edellinen",
    next: "Seuraava",
    data: "Tiedot CC BY 4.0 -lisenssillä",
    search: "Hae dokumentaatiosta",
    noResults: "Mitään ei löytynyt",
    edit: "Muokkaa tätä sivua",
    report: "Ilmoita virheestä",
    source: "Lähdekoodi",
    openMenu: "Valikko",
    overview: "Yleiskatsaus",
    bibleHead: ["Kieli", "Laitos", "Sähköinen teksti", "Lisenssi"],
    crown: "; Yhdistyneessä kuningaskunnassa Crown copyright",
    versesOnly: "vain jakeiden tekstit",
    none: "ei vielä yhtään",
  },
  vi: {
    docs: "Tài liệu",
    menu: "Tài liệu",
    onPage: "Trên trang này",
    pages: "Tất cả các trang",
    copy: "Sao chép",
    copied: "Đã sao chép",
    updated: "Dữ liệu tính đến",
    open: "Mở quả địa cầu",
    prev: "Trang trước",
    next: "Trang sau",
    data: "Dữ liệu theo giấy phép CC BY 4.0",
    search: "Tìm trong tài liệu",
    noResults: "Không tìm thấy gì",
    edit: "Sửa trang này",
    report: "Báo lỗi",
    source: "Mã nguồn",
    openMenu: "Menu",
    overview: "Tổng quan",
    bibleHead: ["Ngôn ngữ", "Ấn bản", "Văn bản điện tử", "Giấy phép"],
    crown: "; tại Vương quốc Anh, bản quyền của Hoàng gia (Crown copyright)",
    versesOnly: "chỉ có văn bản câu Kinh Thánh",
    none: "chưa có",
  },
  ro: {
    docs: "Documentație",
    menu: "Documentație",
    onPage: "Pe această pagină",
    pages: "Toate paginile",
    copy: "Copiază",
    copied: "Copiat",
    updated: "Date la",
    open: "Deschide globul",
    prev: "Înapoi",
    next: "Înainte",
    data: "Date sub licența CC BY 4.0",
    search: "Caută în documentație",
    noResults: "Nu s-a găsit nimic",
    edit: "Editează pagina",
    report: "Raportează o eroare",
    source: "Cod sursă",
    openMenu: "Meniu",
    overview: "Prezentare",
    bibleHead: ["Limba", "Ediția", "Text electronic", "Licența"],
    crown: "; în Regatul Unit, drepturile Coroanei",
    versesOnly: "doar textele versetelor",
    none: "niciuna deocamdată",
  },
  bg: {
    docs: "Документация",
    menu: "Документация",
    onPage: "На тази страница",
    pages: "Всички страници",
    copy: "Копиране",
    copied: "Копирано",
    updated: "Данни към",
    open: "Отваряне на глобуса",
    prev: "Предишна",
    next: "Следваща",
    data: "Данни под лиценз CC BY 4.0",
    search: "Търсене в документацията",
    noResults: "Не е намерено нищо",
    edit: "Редактиране на страницата",
    report: "Съобщаване за грешка",
    source: "Изходен код",
    openMenu: "Меню",
    overview: "Преглед",
    bibleHead: ["Език", "Издание", "Електронен текст", "Лиценз"],
    crown: "; в Обединеното кралство – права на Короната",
    versesOnly: "само текстове на стиховете",
    none: "засега няма",
  },
} as const satisfies Words<Record<string, string | readonly string[]>>;

const read = (file: string): unknown =>
  existsSync(join(data, file)) ? JSON.parse(readFileSync(join(data, file), "utf8")) : undefined;

/** The counts a page may cite, from the built data; a missing file leaves its counts out. */
function counts(): Record<string, string> {
  const places = read("places.geojson") as
    { features: { properties: { verses: number } }[] } | undefined;
  const ancient = read("ancient.geojson") as { features: unknown[] } | undefined;
  const people = read("people.json") as { people: unknown[] } | undefined;
  const content = read("content.json") as Record<string, unknown> | undefined;
  const manifest = read("manifest.json") as
    | { excluded_places?: unknown[]; built_at?: string; stats?: { without_point?: number } }
    | undefined;
  const size = (k: string) => {
    const v = content?.[k];
    return v && typeof v === "object" ? Object.keys(v).length : undefined;
  };
  // The sites of the ancient world chosen one by one; the others a script chose (the waves).
  const byHand = new Set(
    (
      JSON.parse(readFileSync(join(root, "content/ancient-sites.json"), "utf8")) as {
        sites: { id: string }[];
      }
    ).sites.map((s) => s.id),
  );
  const ancientHand = ancient?.features.filter((f) =>
    byHand.has((f as { properties: { id: string } }).properties.id),
  ).length;
  const peopleApi = existsSync(join(pub, "api/v1/people.json"))
    ? (JSON.parse(readFileSync(join(pub, "api/v1/people.json"), "utf8")) as unknown[]).length
    : undefined;
  // The corrections to the borders by kind (overrides, starts, clips, …), the vassals apart.
  const corrections = Object.entries(
    parseYaml(readFileSync(join(root, "content/polity-overrides.yaml"), "utf8")) as Record<
      string,
      unknown[]
    >,
  );
  const entries = (kind: (k: string) => boolean) =>
    corrections.filter(([k]) => kind(k)).reduce((sum, [, list]) => sum + list.length, 0);
  // What a reader of the places-in-any-text script downloads, as a server compresses it: the
  // lightest and the heaviest language's file of names, and the script itself (kB).
  const gz = (file: string) => Math.round(gzipSync(readFileSync(file), { level: 9 }).length / 1000);
  const namesKb = readdirSync(data)
    .filter((f) => /^text-places\.[a-z]+\.json$/.test(f))
    .map((f) => gz(join(data, f)));
  const n: Record<string, number | undefined> = {
    places: places?.features.length,
    // Of them, the places a verse names: each has a page (build-pages.ts); the others are
    // records OpenBible keeps without a verse in the books it tags.
    named: places?.features.filter((f) => f.properties.verses > 0).length,
    unnamed: places?.features.filter((f) => !(f.properties.verses > 0)).length,
    ancient: ancient?.features.length,
    ancient_hand: ancientHand,
    ancient_script:
      ancient && ancientHand !== undefined ? ancient.features.length - ancientHand : undefined,
    // The people on the map with their families (data/people.json); the open data has every
    // person TIPNR names (api/v1/people.json).
    people: people?.people.length,
    people_api: peopleApi,
    tours: size("tours"),
    articles: size("articles"),
    events: size("events"),
    battles: size("battles"),
    life: size("life"),
    photos: size("photos"),
    names: size("names"),
    chapter_books: size("chapter_years"),
    excluded: manifest?.excluded_places?.length,
    without_point: manifest?.stats?.without_point,
    // OpenBible's places the globe does not have: left out (above) or with no point at all.
    // A host that sends one of their ids gets nothing (the embedding page).
    absent:
      manifest?.excluded_places && manifest.stats?.without_point !== undefined
        ? manifest.excluded_places.length + manifest.stats.without_point
        : undefined,
    // Corrections to the borders, and apart from them the periods drawn as vassals.
    overrides: entries((k) => k !== "vassals"),
    vassals: entries((k) => k === "vassals"),
    names_kb_min: namesKb.length ? Math.min(...namesKb) : undefined,
    names_kb_max: namesKb.length ? Math.max(...namesKb) : undefined,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(n)) if (v !== undefined) out[k] = String(v);
  out.built = manifest?.built_at?.slice(0, 10) ?? "";
  // OpenBible's records in all: those on the map and those that are not.
  if (out.places && out.absent) out.openbible = String(Number(out.places) + Number(out.absent));
  // The language codes a link may name, in the order of the alphabet.
  out.locale_codes = [...LOCALES]
    .sort()
    .map((c) => `<code>${c}</code>`)
    .join(", ");
  out.site = site || "https://&lt;globe-host&gt;";
  // The places-in-any-text script as other sites load it: its newest version's own address
  // and the hash that pins its content (scripts/hg-places-releases.json).
  const releases = JSON.parse(
    readFileSync(join(root, "scripts/hg-places-releases.json"), "utf8"),
  ) as { latest: string; versions: Record<string, string> };
  out.hgPlacesSrc = `${out.site}/hg-places-${releases.latest}.js`;
  out.hgPlacesIntegrity = releases.versions[releases.latest] ?? "";
  const script = join(pub, `hg-places-${releases.latest}.js`);
  if (existsSync(script)) out.script_kb = String(gz(script));
  return out;
}

/**
 * The Bible of every language, for the sources page (`<div class="bibles"></div>`): each
 * language by its own name, the edition by its title, the electronic text with its page and
 * the licence. Read from SOURCES (bible-text.ts), the editions the verses are built from,
 * so the page cannot leave one out. A language whose verses are built before it joins the
 * site (Chinese) is listed too, as its texts are in the data.
 */
function biblesTable(l: Lang): string {
  const t = T[l];
  const onSite = new Set<string>(LOCALES);
  const order = [...LOCALES, ...Object.keys(SOURCES).filter((k) => !onSite.has(k))] as Locale[];
  const rows = order.map((code) => {
    const b = SOURCES[code];
    const id = b.file.replace(/(_usfm)?\.zip$/, "");
    const host = b.file.endsWith("_usfm.zip") ? "eBible.org" : "CrossWire SWORD";
    const own = (LOCALE_NAMES as Partial<Record<string, string>>)[code];
    const name = own ?? new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
    const lic = `${PAGE_WORDS[l].pd}${b.license.includes("Crown") ? t.crown : ""}${own ? "" : ` (${t.versesOnly})`}`;
    // Wikisource and the Internet Archive name their texts otherwise: the edition's own label.
    const link = b.label ?? `${host} ${id}`;
    return `<tr><td lang="${code}">${esc(name)}</td><td lang="${code}">${esc(b.title)}</td><td><a href="${esc(b.page)}">${esc(link)}</a></td><td>${esc(lic)}</td></tr>`;
  });
  return `<div class="table"><table class="sources"><thead><tr>${t.bibleHead.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

/** The scholars' reviews published so far (content/reviews, via build-content.ts). */
interface Review {
  id: string;
  title: Readonly<Partial<Record<Lang, string>>> & { en: string };
  reviewer: { name: string; institution: string };
  date: string;
}
const REVIEWS: readonly Review[] = existsSync(join(root, "apps/web/build/reviews.json"))
  ? (JSON.parse(readFileSync(join(root, "apps/web/build/reviews.json"), "utf8")) as Review[])
  : [];
/** A review's own page, from a page of the documentation in that language. */
const reviewHref = (l: Lang, id: string) => `${l === "en" ? "" : "../"}../${l}/reviews/${id}/`;

/**
 * The published reviews where a page names them: `<span class="reviews"></span>` in a
 * sentence, each by its title and its reviewer; `<ul class="reviews"></ul>` as a list, with
 * the institution and the date. Built from the reviews, so a new one is linked everywhere.
 */
function reviewsIn(body: string, l: Lang): string {
  const title = (r: Review) =>
    `<a href="${reviewHref(l, r.id)}">${esc(r.title[l] ?? r.title.en)}</a>`;
  return body
    .replace('<span class="reviews"></span>', () =>
      REVIEWS.length
        ? REVIEWS.map((r) => `${title(r)} (${esc(r.reviewer.name)})`).join("; ")
        : T[l].none,
    )
    .replace(
      '<ul class="reviews"></ul>',
      () =>
        `<ul class="reviews">${(REVIEWS.length
          ? REVIEWS.map(
              (r) =>
                `<li>${title(r)}: ${esc(r.reviewer.name)}, ${esc(r.reviewer.institution)}, ${dateIn(r.date, l)}</li>`,
            )
          : [`<li>${T[l].none}</li>`]
        ).join("")}</ul>`,
    );
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

/** The languages whose pages write a number of four digits without a separator. */
const UNGROUPED_4: ReadonlySet<Lang> = new Set(["ru", "cs", "sr", "es", "pl", "fi", "vi"]);

/**
 * A count as the pages of the language write their numbers: 1,288 in English, 1.288 in
 * German and Italian, 1 288 in French, Swedish and Ukrainian, 1288 in Russian, Czech,
 * Serbian, Spanish, Polish, Finnish and Vietnamese (a number of four digits ungrouped), and
 * as the language's own rules have it elsewhere (Hungarian and Bulgarian group from five).
 */
const number = (v: number, l: Lang) =>
  new Intl.NumberFormat(l === "en" ? "en-GB" : l, {
    useGrouping: UNGROUPED_4.has(l) ? "min2" : l === "it" ? "always" : "auto",
  }).format(v);

/**
 * Fills `{{name}}`; `{{name|город|города|городов}}` with the count and the word in the form
 * the count takes, `{{~name|…}}` with the word alone; `{{n:1088}}` writes a number the page
 * gives by hand as the counts are written. An unknown name is an error, so a typo cannot
 * reach a page.
 */
function fill(body: string, n: Record<string, string>, file: string, l: Lang): string {
  return body.replace(
    /\{\{(~?)(\w+)(?::(\d+))?(?:\|([^|}]+)\|([^|}]+)\|([^|}]+))?\}\}/g,
    (_, bare: string, k: string, literal?: string, one?: string, few?: string, many?: string) => {
      const v = k === "n" && literal ? literal : literal ? undefined : n[k];
      if (v === undefined) throw new Error(`${file}: unknown or unavailable {{${k}}}`);
      const shown = /^\d+$/.test(v) ? number(Number(v), l) : v;
      if (!one || !few || !many) return shown;
      const word = plural(l, Number(v), one, few, many);
      return bare ? word : `${shown} ${word}`;
    },
  );
}

/**
 * A number in a page's text (not in code, a tag or an address) written otherwise than the
 * counts beside it: one grouped with another separator than the language's (1 088 by hand
 * where the counts write 1088), or one of five digits or more not grouped as they are. A
 * number of four digits written whole is left alone: it is most often a year (1446 BC).
 */
function misgrouped(html: string, l: Lang): string[] {
  const text = html
    .replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<script[\s\S]*?<\/script>|<[^>]+>/g, " ")
    .replace(/&nbsp;/g, "\u00a0");
  const bad: string[] = [];
  for (const [m] of text.matchAll(
    /(?<![\d.,:\-–/])\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?![\d\-–])|(?<![\d.,:\-–/])\d{5,}(?![\d\-–])/g,
  )) {
    const digits = m.replace(/\D/g, "");
    if (m !== number(Number(digits), l)) bad.push(m);
  }
  return bad;
}

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Lists every h2 and h3 for the outline. Each carries its own id, in English and the same in
 * every language (checked below), so a link to a section reaches it whatever the language.
 */
function headings(body: string, file: string): { body: string; toc: Heading[] } {
  const toc: Heading[] = [];
  const html = body.replace(
    /<h([23])(?: id="([^"]+)")?>([\s\S]*?)<\/h\1>/g,
    (_, level: string, id: string | undefined, text: string) => {
      if (!id) throw new Error(`${file}: a heading without its id: <h${level}>${text}`);
      if (toc.some((h) => h.id === id)) throw new Error(`${file}: two headings with id "${id}"`);
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
  // Vietnamese (docs.css, pages.css): Literata's own file; Onest, where Golos Text has none.
  ["literata", "literata-vietnamese-wght-normal.woff2"],
  ["onest", "onest-latin-wght-normal.woff2"],
  ["onest", "onest-latin-ext-wght-normal.woff2"],
  ["onest", "onest-vietnamese-wght-normal.woff2"],
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
  return body.replace(
    /<pre><code( class="cite")?>([\s\S]*?)<\/code><\/pre>/g,
    (_, cite: string | undefined, code: string) => {
      // A citation to copy (methodology.html#cite) is plain text: no colours, no language.
      if (cite)
        return `<div class="code"><div class="code-bar"><span></span><button type="button" class="copy" data-done="${T[l].copied}" hidden>${svg("copy")}<span>${T[l].copy}</span></button></div><pre tabindex="0"><code>${code}</code></pre></div>`;
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
    },
  );
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
  const langs = `<details class="langs"><summary class="btn lang" title="${PAGE_WORDS[l].language}" aria-label="${PAGE_WORDS[l].language}: ${LOCALE_NAMES[l]}">${svg("globe")}<span>${LOCALE_NAMES[l]}</span></summary><ul>${LANGS.map(
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
  const editUrl = `${REPOSITORY}/edit/main/content/docs/${l}/${it.name}.html`;
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
    <link rel="preload" href="${up}fonts/${sansPreload(l)}" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="${up}docs.css" />
    <script>document.documentElement.className = "js";</script>
    <script defer src="${up}docs.js"></script>
  </head>
  <body>
    <a class="skip" href="#main">${PAGE_WORDS[l].skip}</a>
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
        <a class="btn icon-btn gh" href="${REPOSITORY}" aria-label="GitHub"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg></a>
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
            ${it.name === "author" ? "<span></span>" : `<span>${TYPESET[l](`${t.updated} ${dateIn(o.built, l)}`)}</span>`}
            <a href="${editUrl}">${svg("edit")}${t.edit}</a>
          </div>
          ${pager}
          <footer class="foot">
            <span>History Globe · ${t.data}</span>
            <a href="${REPOSITORY}">${t.source}</a>
          </footer>
        </main>
        <aside class="toc" aria-label="${t.onPage}">
          ${toc}
          <p class="toc-links"><a href="${editUrl}">${svg("edit")}${t.edit}</a><a href="${REPOSITORY}/issues/new?template=report-an-error.yml">${svg("alert")}${t.report}</a></p>
        </aside>
      </div>
    </div>
${bodyEnd(`${up}../`, site)}
  </body>
</html>
`;
}

/** The pages' script (docs.js, scripts/client/docs.ts). */
const SCRIPT = clientScript("packages/model/src/fold.ts", "scripts/client/docs.ts");

const n = counts();
rmSync(out, { recursive: true, force: true });
for (const l of LANGS) mkdirSync(join(out, prefix(l)), { recursive: true });
mkdirSync(join(out, "fonts"), { recursive: true });
for (const [pkg, file] of FONT_FILES)
  copyFileSync(join(FONTS, pkg, "files", file), join(out, "fonts", file));
copyFileSync(join(src, "docs.css"), join(out, "docs.css"));
writeFileSync(join(out, "docs.js"), SCRIPT);

/** The built sources page of every language, for the check of the credits below. */
const sourcesPages: Record<string, string> = {};
// What a page must hold in every language, checked as the pages are built: the headings by
// the same ids as the English, the numbers written as the counts are, the licences by their
// own address, and a link to every review a scholar has published (content/reviews), so none
// is published out of reach.
const problems: string[] = [];
const PUBLISHED = readdirSync(join(root, "content/reviews"))
  .filter((f) => f.endsWith(".yaml"))
  .map(
    (f) => (parseYaml(readFileSync(join(root, "content/reviews", f), "utf8")) as { id: string }).id,
  );
const LINKS_REVIEWS: readonly Page[] = ["index", "methodology", "reviews"];
const englishIds = new Map<Page, string>();

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
      // A licence is linked by its own address in every language, as index.json gives it.
      if (/creativecommons\.org\/[^"]*deed\./.test(source.body))
        problems.push(`${file}: a Creative Commons link to a translated deed, not the licence`);
      const text = fill(source.body, n, file, l);
      for (const m of misgrouped(TYPESET[l](text), l))
        problems.push(`${file}: "${m}" is not written as the counts are (${number(1288, l)})`);
      const filled = reviewsIn(text, l).replace('<div class="bibles"></div>', () => biblesTable(l));
      const { body, toc } = headings(highlight(features(TYPESET[l](filled)), l), file);
      // The documentation has no open licence of its own (LICENSE, part 3): a licence it
      // links is a source's, and rel="license" would declare the page under it.
      if (/\brel="[^"]*\blicense\b/.test(body))
        throw new Error(`${file}: rel="license" on a source's licence; link it plainly`);
      const ids = toc.map((h) => h.id).join(" ");
      if (l === "en") englishIds.set(p, ids);
      else if (ids !== englishIds.get(p))
        problems.push(`${file}: headings ${ids} where the English has ${englishIds.get(p)}`);
      if (LINKS_REVIEWS.includes(p))
        for (const id of PUBLISHED)
          if (!body.includes(`href="${reviewHref(l, id)}"`))
            problems.push(`${file}: no link to the published review ${id}`);
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
  sourcesPages[l] = all.sources.body;
}
if (problems.length) throw new Error(`docs:\n${problems.join("\n")}`);
console.log(`docs: ${PAGES.length} pages × ${LANGS.length} languages → apps/web/public/docs/`);

// The repository's front pages against the build (scripts/repo-facts.ts): the numbers and
// the date in README.md and CITATION.cff, and the credits of every source in
// docs/ATTRIBUTIONS.md and on the sources pages. Only with the data built.
if (existsSync(join(data, "manifest.json")) && existsSync(join(pub, "api/v1/index.json"))) {
  const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
  const manifest = json(join(data, "manifest.json")) as { sources: object; other_sources?: object };
  const index = json(join(pub, "api/v1/index.json")) as { built_at: string };
  const ancientNotes = json(join(data, "ancient-authors.json")) as Record<string, unknown[]>;
  const facts: Facts = {
    named: Number(n.named),
    records: Number(n.places),
    articles: Number(n.articles),
    questions: (json(join(pub, "api/v1/questions.json")) as unknown[]).length,
    tours: Number(n.tours),
    events: Number(n.events),
    battles: Number(n.battles),
    people: (json(join(pub, "api/v1/people.json")) as unknown[]).length,
    peopleOnMap: Number(n.people),
    notes: Object.values(ancientNotes).flat().length,
    notedPlaces: Object.keys(ancientNotes).length,
    ancient: Number(n.ancient),
    photos: Number(n.photos),
    languages: LOCALES.length,
    built: index.built_at.slice(0, 10),
  };
  const problems = [
    ...["README.md", "CITATION.cff"].flatMap((f) =>
      factMismatches(f, readFileSync(join(root, f), "utf8"), facts, site !== ""),
    ),
    // The registry: the sources the data build reads, and those the other steps read
    // (an older data build has no other_sources: rebuild it with `pnpm data`).
    ...(manifest.other_sources
      ? []
      : ["manifest.json: no other_sources; rebuild the data (pnpm data)"]),
    ...attributionGaps(
      [...Object.keys(manifest.sources), ...Object.keys(manifest.other_sources ?? {})],
      SOURCES,
      readFileSync(join(root, "docs/ATTRIBUTIONS.md"), "utf8"),
      sourcesPages,
    ),
  ];
  if (problems.length) {
    console.error(`docs: the front pages disagree with the build:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
}
