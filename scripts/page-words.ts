/**
 * The words of the static pages (build-pages.ts), one block per site language. A language
 * joins the site with its block here: the types make the compiler ask for every word, and
 * the counted ones (days at sea, verses) choose their plural form by the language's rules.
 */
import type { SiteLocale } from "../packages/model/src/time.ts";
const RU_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "день", few: "дня" };

export const T = {
  ru: {
    site: "History Globe — карта библейской истории",
    open: "Открыть на карте",
    tour_open: "Пройти экскурсию на карте",
    // The sea as the stop says it: «, по морю» or «, по морю, 5 дней (Деян 20:6)».
    leg: (km: string, road: string | null, sea: string) =>
      `≈\u00a0${km}\u00a0км по прямой${road ? `, ≈\u00a0${road}\u00a0км по\u00a0римским\u00a0дорогам` : ""}${sea}`,
    sea: (days?: number, ref?: string, about?: boolean) =>
      days
        ? `, по морю, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${RU_DAYS[new Intl.PluralRules("ru").select(days)] ?? "дней"} (${ref ?? ""})`
        : ", по морю",
    today: "Где сегодня",
    english: "По-английски",
    ancient: "У древних авторов",
    untold: ", путь в тексте не прослежен",
    life: "Время существования",
    ruins: "В руинах",
    events: "События",
    battles: "Битвы и осады",
    article: "История",
    scripture: "Писание",
    sources: "Источники",
    checked: "Статья сверена с источниками; историк её ещё не читал.",
    reviewed: "Статью прочитал историк",
    verses: (n: number) => `Стихи (${String(n)})`,
    more: (n: number) => `ещё ${String(n)} — на карте`,
    tours: "Экскурсии через это место",
    places: "Все места",
    skip: "К содержанию",
    sections: "Разделы",
    tour: "Экскурсия",
    toursAll: "Все экскурсии",
    placesTitle: "Места библейской истории",
    disputed: "Место спорное",
    photoShows: (site: string) => `На снимке ${site} — одна из версий.`,
    toursTitle: "Экскурсии по библейской истории",
    questions: "Вопросы",
    questionsTitle: "Вопросы о местах и истории Библии",
    question: "Вопрос",
    showMap: "Показать на карте",
    checkedQ: "Ответ сверен с источниками; историк его ещё не читал.",
    testament: { whole: "Вся Библия", ot: "Ветхий Завет", nt: "Новый Завет" },
    stop: "Остановка",
    translation: "Синодальный перевод",
    circa: "ок.",
    title: (n: string) => `${n} — где это было, история, стихи Библии`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) на карте библейской истории: где это место сегодня, его история и упоминания в Библии (${String(v)}).`,
    about: "О проекте",
    privacy: "Конфиденциальность",
    allSources: "все источники",
    data: "Данные",
    // The other language's switch is an icon: «Язык: English» names it.
    language: "Язык",
    photo: "Фото",
    pd: "общественное достояние",
  },
  en: {
    site: "History Globe — a map of biblical history",
    open: "Open on the map",
    tour_open: "Take the tour on the map",
    leg: (km: string, road: string | null, sea: string) =>
      `≈\u00a0${km}\u00a0km in a straight line${road ? `, ≈\u00a0${road}\u00a0km by\u00a0Roman\u00a0roads` : ""}${sea}`,
    sea: (days?: number, ref?: string, about?: boolean) =>
      days
        ? `, by sea, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0day${days === 1 ? "" : "s"} (${ref ?? ""})`
        : ", by sea",
    today: "Today",
    english: "In English",
    ancient: "In ancient writers",
    untold: ", the way is not told",
    life: "Lifetime",
    ruins: "In ruins",
    events: "Events",
    battles: "Battles and sieges",
    article: "History",
    scripture: "Scripture",
    sources: "Sources",
    checked: "Checked against its sources; not yet read by a historian.",
    reviewed: "Read by a historian",
    verses: (n: number) => `Verses (${String(n)})`,
    more: (n: number) => `${String(n)} more on the map`,
    tours: "Tours through this place",
    places: "All places",
    skip: "Skip to content",
    sections: "Sections",
    tour: "Tour",
    toursAll: "All tours",
    placesTitle: "Places of biblical history",
    disputed: "Location disputed",
    photoShows: (site: string) => `Shown: ${site}, one of the proposed sites.`,
    toursTitle: "Tours of biblical history",
    questions: "Questions",
    questionsTitle: "Questions about the places and history of the Bible",
    question: "Question",
    showMap: "Show on the map",
    checkedQ: "Checked against its sources; not yet read by a historian.",
    testament: { whole: "The whole Bible", ot: "Old Testament", nt: "New Testament" },
    stop: "Stop",
    translation: "King James Version",
    circa: "c.",
    title: (n: string) => `${n} — where it is, its history, Bible verses`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) on the map of biblical history: where it is today, its history and the Bible verses that name it (${String(v)}).`,
    about: "About",
    privacy: "Privacy",
    allSources: "all sources",
    data: "Data",
    // The other language's switch is an icon; this names it for a pointer and a screen reader.
    language: "Language",
    photo: "Photo",
    pd: "public domain",
  },
} as const;

// The front page of each language (/ru/, /en/): what the globe is, for a reader who comes
// from a search or a link, with the way into the map. The map itself stays at the root.
// Short on purpose: the pictures show what the words would only describe.
export const LANDING = {
  ru: {
    // The search title keeps the words people search for; the page itself leads with the
    // globe, the Bible being its first collection, not its limit.
    title: "История на глобусе — атлас библейской истории",
    h1: "История на глобусе",
    desc: "Бесплатный атлас: места Библии на 3D-глобусе, государства вокруг них год за годом, экскурсии, статьи с источниками и инструменты для урока.",
    kicker: "Первая коллекция — библейская история",
    lede: "Передвиньте год — и вокруг меняются царства, города и названия.",
    open: "Открыть глобус",
    tours: "Экскурсии",
    docs: "Документация",
    heroAlt:
      "Глобус в 701 г. до н. э.: Новоассирийское царство от Тира до Вавилона, Иерусалим, Дамаск, шкала времени",
    heroNote: "701 г. до н. э.: Ассирия от Тира до Вавилона",
    live: "Покрутить глобус",
    full: "Во весь экран",
    liveClose: "Готово",
    stats: ["мест", "экскурсий", "статей", "ответов на вопросы", "битв и осад"],
    rows: [
      [
        "Экскурсии",
        "Маршруты по дорогам и рельефу",
        "Авраам, Исход, путешествия Павла — остановка за остановкой: стих, фото места, расстояние и дни пути.",
        "Второе путешествие Павла",
        "Остановка «Троада» второго путешествия Павла: карта Эгейского моря, маршрут, профиль дороги, фото руин",
      ],
      [
        "Места",
        "У каждого места — стихи и источники",
        "Где оно сегодня, чьим было в выбранный год и все стихи, где оно названо. Спорное названо спорным.",
        "Открыть Иерусалим",
        "Карточка Иерусалима: фото, государство в 30 г. н. э., статья; вокруг — горы Иудеи с десятками библейских мест",
      ],
      [
        "Для урока",
        "Викторина, свой урок и лист A4",
        "Викторина «Где это было?» по любой экскурсии, свой урок одной ссылкой, карты для печати на A4.",
        "Открыть Исход из Египта",
        "Викторина по Исходу: вопрос со стихом и четыре варианта ответа, маршрут на карте",
      ],
    ],
    cards: [
      [
        "Вопросы контекста",
        "Где была Ниневия? Сколько шёл Павел до Рима? Ответы с картой и стихами.",
        "Все вопросы",
      ],
      [
        "Открытые данные",
        "CC BY 4.0, API «стих → места» без ключа и глобус для встраивания.",
        "API и встраивание",
      ],
      [
        "Без регистрации",
        "Ни аккаунта, ни cookie, ни рекламы. Карту можно сохранить для работы без сети.",
        "Конфиденциальность",
      ],
    ],
    trust: "На открытых данных",
    trustText:
      "Статьи написаны с помощью ИИ и проверены по источникам отдельным проходом; учёные их пока не рецензировали, и мы так и пишем.",
    method: "Как проверяются данные",
    sources: "Все источники",
    ctaTitle: "Начните с любого года",
    ctaText: "Без регистрации, на телефоне и на компьютере, по-русски и по-английски.",
  },
  en: {
    title: "History on a globe — an atlas of biblical history",
    h1: "History on a globe",
    desc: "A free atlas: the places of the Bible on a 3D globe, the states around them year by year, tours, articles with sources and tools for a lesson.",
    kicker: "First collection: biblical history",
    lede: "Move the year and watch kingdoms, towns and names change.",
    open: "Open the globe",
    tours: "Tours",
    docs: "Docs",
    heroAlt:
      "The globe in 701 BC: the Neo-Assyrian Empire from Tyre to Babylon, Jerusalem, Damascus, the timeline",
    heroNote: "701 BC: Assyria from Tyre to Babylon",
    live: "Explore the globe",
    full: "Full screen",
    liveClose: "Done",
    stats: ["places", "tours", "articles", "questions answered", "battles and sieges"],
    rows: [
      [
        "Tours",
        "Routes along the roads and the relief",
        "Abraham, the Exodus, Paul's journeys — stop by stop, with the verse, a photo, the distance and the days on the way.",
        "Paul's second journey",
        "The Troas stop of Paul's second journey: the Aegean on the map, the route, the road's profile, a photo of the ruins",
      ],
      [
        "Places",
        "Every place with its verses and sources",
        "Where it is today, whose it was in the year shown, and every verse that names it. What is disputed is called disputed.",
        "Open Jerusalem",
        "The card of Jerusalem: a photo, its state in AD 30, the article; around it the hills of Judea with dozens of biblical places",
      ],
      [
        "For a lesson",
        "A quiz, your own lesson, an A4 sheet",
        "A “Where did it happen?” quiz on any tour, your own lesson as one link, maps that print on A4.",
        "Open the Exodus",
        "A quiz on the Exodus: a question with a verse and four answers, the route on the map",
      ],
    ],
    cards: [
      [
        "Questions of context",
        "Where was Nineveh? How long did Paul travel to Rome? Answers with the map and the verses.",
        "All questions",
      ],
      [
        "Open data",
        "CC BY 4.0, a verse-to-places API with no key, and a globe to embed.",
        "API and embedding",
      ],
      [
        "No account",
        "No sign-up, no cookies, no ads. The map can be saved for use offline.",
        "Privacy",
      ],
    ],
    trust: "Built on open data",
    trustText:
      "Articles are drafted with AI help and checked against their sources in a separate pass; scholars have not reviewed them yet, and the site says so.",
    method: "How the data is checked",
    sources: "All sources",
    ctaTitle: "Start from any year",
    ctaText: "No account, on a phone or a computer, in English and in Russian.",
  },
} as const;

/**
 * Compiled, never run: every site language has a block, and each block names every word the
 * English one does and no other. A missing or extra word fails the typecheck.
 */
type SameWords<D extends Record<string, object>> = {
  [L in SiteLocale]: keyof D["en"] extends keyof D[L]
    ? keyof D[L] extends keyof D["en"]
      ? true
      : never
    : never;
};
export const WORDS_COMPLETE: SameWords<typeof T> & SameWords<typeof LANDING> = {
  ru: true,
  en: true,
};

/** A Russian noun for a count: one, few, many («1 место», «3 места», «5 мест»). */
const ru = (n: number, one: string, few: string, many: string) => {
  const rule = new Intl.PluralRules("ru").select(n);
  return rule === "one" ? one : rule === "few" ? few : many;
};
const en = (n: number, one: string) => (n === 1 ? one : `${one}s`);

/** The words of the three index pages: all places, all tours, all questions. */
interface ListWords {
  /** Under the title: how many there are; `n` is the number as written, `k` the count. */
  placesLead: (n: string, k: number, articles: string) => string;
  toursLead: (n: string, k: number) => string;
  questionsLead: (n: string, k: number) => string;
  all: string;
  withArticle: string;
  alphabet: string;
  findPlace: string;
  findQuestion: string;
  nothing: string;
  stops: (n: number) => string;
  km: (n: string) => string;
  /** The parts of the Bible the questions are grouped by, in its order. */
  parts: Record<Part, string>;
  /** The same, short, for the bar to jump by. */
  partsShort: Record<Part, string>;
}
type Part = "torah" | "history" | "prophets" | "gospels" | "acts" | "letters";
export const LISTS: Record<SiteLocale, ListWords> = {
  ru: {
    placesLead: (n, k, a) => `${n} ${ru(k, "место", "места", "мест")}, ${a} со статьёй`,
    toursLead: (n, k) =>
      `${n} ${ru(k, "экскурсия", "экскурсии", "экскурсий")}. Расстояние — по прямой между остановками.`,
    questionsLead: (n, k) =>
      `${n} ${ru(k, "вопрос", "вопроса", "вопросов")} с ответом на карте, в порядке книг Библии.`,
    all: "Все",
    withArticle: "Со статьёй",
    alphabet: "По алфавиту",
    findPlace: "Найти место",
    findQuestion: "Найти вопрос",
    nothing: "Ничего не нашлось",
    stops: (n) => `${String(n)}\u00a0${ru(n, "остановка", "остановки", "остановок")}`,
    km: (n) => `≈\u00a0${n}\u00a0км`,
    parts: {
      torah: "Пятикнижие",
      history: "Исторические книги",
      prophets: "Пророки и учительные книги",
      gospels: "Евангелия",
      acts: "Деяния апостолов",
      letters: "Послания и Откровение",
    },
    partsShort: {
      torah: "Пятикнижие",
      history: "Исторические",
      prophets: "Пророки",
      gospels: "Евангелия",
      acts: "Деяния",
      letters: "Послания",
    },
  },
  en: {
    placesLead: (n, k, a) => `${n} ${en(k, "place")}, ${a} with an article`,
    toursLead: (n, k) => `${n} ${en(k, "tour")}. Distances are straight lines between the stops.`,
    questionsLead: (n, k) =>
      `${n} ${en(k, "question")} answered on the map, in the order of the Bible's books.`,
    all: "All",
    withArticle: "With an article",
    alphabet: "Alphabet",
    findPlace: "Find a place",
    findQuestion: "Find a question",
    nothing: "Nothing found",
    stops: (n) => `${String(n)}\u00a0${en(n, "stop")}`,
    km: (n) => `≈\u00a0${n}\u00a0km`,
    parts: {
      torah: "The Pentateuch",
      history: "The historical books",
      prophets: "The prophets and wisdom books",
      gospels: "The Gospels",
      acts: "Acts of the Apostles",
      letters: "The letters and Revelation",
    },
    partsShort: {
      torah: "Pentateuch",
      history: "History",
      prophets: "Prophets",
      gospels: "Gospels",
      acts: "Acts",
      letters: "Letters",
    },
  },
};
