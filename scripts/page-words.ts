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
    articlesTitle: "Статьи о городах",
    disputed: "Место спорное",
    photoShows: (site: string) => `На снимке ${site} — одна из версий.`,
    allPlaces: "Все места",
    toursTitle: "Экскурсии по библейской истории",
    questions: "Вопросы",
    questionsTitle: "Вопросы о местах и истории Библии",
    question: "Вопрос",
    showMap: "Показать на карте",
    checkedQ: "Ответ сверен с источниками; историк его ещё не читал.",
    testament: { whole: "Вся Библия", ot: "Ветхий Завет", nt: "Новый Завет" },
    asks: { where: "Где", when: "Когда", how: "Как далеко и как долго", who: "Кто" },
    stop: "Остановка",
    translation: "Синодальный перевод",
    circa: "ок.",
    title: (n: string) => `${n} — где это было, история, стихи Библии`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) на карте библейской истории: где это место сегодня, его история и упоминания в Библии (${String(v)}).`,
    about: "О проекте",
    privacy: "Конфиденциальность",
    allSources: "все источники",
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
    articlesTitle: "City articles",
    disputed: "Location disputed",
    photoShows: (site: string) => `Shown: ${site}, one of the proposed sites.`,
    allPlaces: "All places",
    toursTitle: "Tours of biblical history",
    questions: "Questions",
    questionsTitle: "Questions about the places and history of the Bible",
    question: "Question",
    showMap: "Show on the map",
    checkedQ: "Checked against its sources; not yet read by a historian.",
    testament: { whole: "The whole Bible", ot: "Old Testament", nt: "New Testament" },
    asks: { where: "Where", when: "When", how: "How far and how long", who: "Who" },
    stop: "Stop",
    translation: "King James Version",
    circa: "c.",
    title: (n: string) => `${n} — where it is, its history, Bible verses`,
    desc: (n: string, k: string, v: number) =>
      `${n} (${k}) on the map of biblical history: where it is today, its history and the Bible verses that name it (${String(v)}).`,
    about: "About",
    privacy: "Privacy",
    allSources: "all sources",
    photo: "Photo",
    pd: "public domain",
  },
} as const;

// The front page of each language (/ru/, /en/): what the globe is, for a reader who comes
// from a search or a link, with the way into the map. The map itself stays at the root.
export const LANDING = {
  ru: {
    title: "Библейская история на глобусе",
    desc: "Бесплатный атлас: места Библии на 3D-глобусе, государства вокруг них год за годом, экскурсии, статьи с источниками и листы для урока.",
    kicker: "Бесплатный атлас библейской истории",
    lede: "Места, о которых говорит Библия, на глобусе с рельефом; государства вокруг них — год за годом, от 3500 г. до н. э. до 1300 г. н. э.; у каждого места — стихи и источники.",
    open: "Открыть глобус",
    tours: "Экскурсии",
    stats: ["мест", "экскурсий", "статей", "ответов на вопросы", "битв и осад"],
    features: [
      [
        "Время на одной шкале",
        "Ветхий и Новый Завет, Египет, Ассирия, Рим: передвиньте год — меняются границы, города и названия.",
      ],
      [
        "Экскурсии с днями пути",
        "Путешествия Авраама, Исход, походы Павла — по дорогам и рельефу, с числом дней, которое называет текст.",
      ],
      [
        "Статьи с источниками",
        "У каждого факта есть «на чём основано»: Флавий, Евсевий, надписи, раскопки. Спорное названо спорным.",
      ],
      [
        "Для урока",
        "Лист урока на A4, контурная карта для учеников, викторина на экране и на бумаге, урок по одной ссылке.",
      ],
      [
        "Вопросы контекста",
        "Где была Ниневия? Сколько шёл Павел до Рима? Короткие ответы с картой и стихами.",
      ],
      [
        "Для разработчиков",
        "Открытые данные под CC BY 4.0, API «стих → места» и глобус для встраивания на свой сайт.",
      ],
    ],
    trust: "Как сделано",
    trustText:
      "Данные — OpenBible.info, Cliopatria, Pleiades, Itiner-e и другие открытые наборы. Статьи написаны с помощью ИИ и проверены по источникам отдельным проходом; учёные их пока не рецензировали, и мы так и пишем.",
    method: "Методология",
    privacy: "Без регистрации и cookie.",
  },
  en: {
    title: "Biblical history on a globe",
    desc: "A free atlas: the places of the Bible on a 3D globe, the states around them year by year, tours, articles with sources and sheets for a lesson.",
    kicker: "A free atlas of biblical history",
    lede: "The places the Bible names, on a globe with its relief; the states around them year by year, from 3500 BC to AD 1300; for every place, its verses and its sources.",
    open: "Open the globe",
    tours: "Tours",
    stats: ["places", "tours", "articles", "questions answered", "battles and sieges"],
    features: [
      [
        "One timeline",
        "The Old and New Testaments, Egypt, Assyria, Rome: move the year and the borders, towns and names change.",
      ],
      [
        "Tours with days on the road",
        "Abraham's journeys, the Exodus, Paul's voyages — along the roads and the relief, with the days the text gives.",
      ],
      [
        "Articles with sources",
        "Every fact says what it rests on: Josephus, Eusebius, inscriptions, excavations. What is disputed is called disputed.",
      ],
      [
        "For a lesson",
        "A lesson sheet on A4, an outline map for pupils, a quiz on screen and on paper, a lesson in one link.",
      ],
      [
        "Questions of context",
        "Where was Nineveh? How long did Paul travel to Rome? Short answers with the map and the verses.",
      ],
      [
        "For developers",
        "Open data under CC BY 4.0, a verse-to-places API and a globe to embed on your own site.",
      ],
    ],
    trust: "How it is made",
    trustText:
      "The data comes from OpenBible.info, Cliopatria, Pleiades, Itiner-e and other open sets. Articles are drafted with AI help and checked against their sources in a separate pass; scholars have not reviewed them yet, and the site says so.",
    method: "Methodology",
    privacy: "No account, no cookies.",
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
