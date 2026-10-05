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
    desc: "Бесплатный атлас: места Библии на 3D-глобусе, государства вокруг них год за годом, экскурсии, статьи с источниками и инструменты для урока.",
    kicker: "Бесплатный атлас библейской истории",
    lede: "Места, о которых говорит Библия, на глобусе с рельефом. Передвиньте год — и вокруг них меняются царства, города и названия, от 3500 г. до н. э. до 1300 г. н. э.",
    open: "Открыть глобус",
    tours: "Смотреть экскурсии",
    heroAlt:
      "Глобус в 701 г. до н. э.: Новоассирийское царство от Тира до Вавилона, Иерусалим, Дамаск, шкала времени",
    heroNote: "701 г. до н. э.: Ассирия от Тира до Вавилона, Сеннахирим идёт на Иудею",
    stats: ["мест", "экскурсий", "статей", "ответов на вопросы", "битв и осад"],
    rows: [
      [
        "Экскурсии",
        "Маршруты по дорогам и рельефу",
        "Путешествия Авраама, Исход, походы Павла. На каждой остановке — стих, фотография места, расстояние, профиль дороги и столько дней пути, сколько называет текст.",
        "Пройти второе путешествие Павла",
        "Остановка «Троада» второго путешествия Павла: карта Эгейского моря, маршрут, профиль дороги, фото руин",
      ],
      [
        "Места",
        "У каждого места — стихи, история и источники",
        "Где это место сегодня и чьим оно было в выбранный год; все стихи, где оно названо; статья, в которой каждый факт опирается на Флавия, Евсевия, надписи или раскопки. Спорное названо спорным.",
        "Открыть Иерусалим",
        "Карточка Иерусалима: фото, государство в 30 г. н. э., статья; вокруг — горы Иудеи с десятками библейских мест",
      ],
      [
        "Для урока",
        "Викторина, свой урок и лист A4",
        "В «Инструментах» — викторина «Где это было?» по любой экскурсии, свой урок из выбранных мест одной ссылкой и расстояние между двумя городами. Лист урока и контурная карта печатаются на A4.",
        "Открыть Исход из Египта",
        "Викторина по Исходу: вопрос со стихом из Книги Чисел и четыре варианта ответа, маршрут на карте",
      ],
    ],
    cards: [
      [
        "Вопросы контекста",
        "Где была Ниневия? Сколько шёл Павел до Рима? Короткие ответы с картой и стихами.",
        "Все вопросы",
      ],
      [
        "Открытые данные",
        "Данные под CC BY 4.0, API «стих → места» без ключа и глобус для встраивания на свой сайт.",
        "API и встраивание",
      ],
      [
        "Без регистрации",
        "Ни аккаунта, ни cookie, ни рекламы. Открывается в браузере; карту можно сохранить для работы без сети.",
        "Конфиденциальность",
      ],
    ],
    trust: "Как сделано",
    trustText:
      "Места — OpenBible.info, границы — Cliopatria, древние названия — Pleiades, дороги — Itiner-e, и другие открытые наборы. Статьи написаны с помощью ИИ и проверены по источникам отдельным проходом; учёные их пока не рецензировали, и мы так и пишем.",
    method: "Как проверяются данные",
    ctaTitle: "Начните с любого года",
    ctaText: "Без регистрации, на телефоне и на компьютере, по-русски и по-английски.",
  },
  en: {
    title: "Biblical history on a globe",
    desc: "A free atlas: the places of the Bible on a 3D globe, the states around them year by year, tours, articles with sources and tools for a lesson.",
    kicker: "A free atlas of biblical history",
    lede: "The places the Bible names, on a globe with its relief. Move the year and the kingdoms, towns and names around them change, from 3500 BC to AD 1300.",
    open: "Open the globe",
    tours: "See the tours",
    heroAlt:
      "The globe in 701 BC: the Neo-Assyrian Empire from Tyre to Babylon, Jerusalem, Damascus, the timeline",
    heroNote: "701 BC: Assyria from Tyre to Babylon, Sennacherib marches on Judah",
    stats: ["places", "tours", "articles", "questions answered", "battles and sieges"],
    rows: [
      [
        "Tours",
        "Routes along the roads and the relief",
        "Abraham's journeys, the Exodus, Paul's voyages. At every stop: the verse, a photo of the place, the distance, the profile of the road and as many days on the way as the text gives.",
        "Follow Paul's second journey",
        "The Troas stop of Paul's second journey: the Aegean on the map, the route, the road's profile, a photo of the ruins",
      ],
      [
        "Places",
        "Every place with its verses, history and sources",
        "Where the place is today and whose it was in the year shown; every verse that names it; an article where each fact rests on Josephus, Eusebius, inscriptions or excavations. What is disputed is called disputed.",
        "Open Jerusalem",
        "The card of Jerusalem: a photo, its state in AD 30, the article; around it the hills of Judea with dozens of biblical places",
      ],
      [
        "For a lesson",
        "A quiz, your own lesson and an A4 sheet",
        "The Tools hold a “Where did it happen?” quiz on any tour, your own lesson from the places you pick, shared as one link, and the distance between two towns. A lesson sheet and an outline map print on A4.",
        "Open the Exodus",
        "A quiz on the Exodus: a question with a verse from Numbers and four answers, the route on the map",
      ],
    ],
    cards: [
      [
        "Questions of context",
        "Where was Nineveh? How long did Paul travel to Rome? Short answers with the map and the verses.",
        "All questions",
      ],
      [
        "Open data",
        "Data under CC BY 4.0, a verse-to-places API with no key, and a globe to embed on your own site.",
        "API and embedding",
      ],
      [
        "No account",
        "No sign-up, no cookies, no ads. Opens in the browser; the map can be saved for use offline.",
        "Privacy",
      ],
    ],
    trust: "How it is made",
    trustText:
      "Places from OpenBible.info, borders from Cliopatria, ancient names from Pleiades, roads from Itiner-e, and other open sets. Articles are drafted with AI help and checked against their sources in a separate pass; scholars have not reviewed them yet, and the site says so.",
    method: "How the data is checked",
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
