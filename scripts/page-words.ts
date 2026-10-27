/**
 * The words of the static pages (build-pages.ts), one block per site language. A language
 * joins the site with its block here: the types make the compiler ask for every word, and
 * the counted ones (days at sea, verses) choose their plural form by the language's rules.
 */
import type { Locale, SiteLocale } from "../packages/model/src/time.ts";
const RU_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "день", few: "дня" };

// Ukrainian (drafted 2026-10-10 by machine translation; not yet read by a native speaker).
/** Ukrainian words for scripts/page-words.ts: the blocks mirror T.ru, LANDING.ru and LISTS.ru. */

const UK_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "день", few: "дні" };

/** A Ukrainian noun for a count: one, few, many («1 місце», «3 місця», «5 місць»). */
const uk = (n: number, one: string, few: string, many: string) => {
  const r = new Intl.PluralRules("uk").select(n);
  return r === "one" ? one : r === "few" ? few : many;
};

const T_UK = {
  site: "History Globe — мапа біблійної історії",
  open: "Відкрити на мапі",
  tour_open: "Пройти екскурсію на мапі",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "мапа",
  route_alt: (title: string) => `Мапа маршруту: ${title}`,
  // The sea as the stop says it: «, морем» or «, морем, 5 днів (Дії 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0км по прямій${road ? `, ≈\u00a0${road}\u00a0км по\u00a0римських\u00a0дорогах` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, морем, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${UK_DAYS[new Intl.PluralRules("uk").select(days)] ?? "днів"} (${ref ?? ""})`
      : ", морем",
  today: "Де сьогодні",
  english: "Англійською",
  ancient: "У давніх авторів",
  untold: ", шлях у тексті не простежено",
  life: "Час існування",
  ruins: "У руїнах",
  events: "Події",
  battles: "Битви й облоги",
  article: "Історія",
  scripture: "Писання",
  sources: "Джерела",
  checked: "Статтю звірено з джерелами; історик її ще не читав.",
  reviewed: "Статтю прочитав історик",
  verses: (n: number) => `Вірші (${String(n)})`,
  more: (n: number) => `ще ${String(n)} — на мапі`,
  tours: "Екскурсії через це місце",
  places: "Усі місця",
  skip: "До змісту",
  sections: "Розділи",
  tour: "Екскурсія",
  toursAll: "Усі екскурсії",
  placesTitle: "Місця біблійної історії",
  disputed: "Місце спірне",
  photoShows: (site: string) => `На знімку ${site} — одна з версій.`,
  toursTitle: "Екскурсії біблійною історією",
  questions: "Питання",
  questionsTitle: "Питання про місця й історію Біблії",
  question: "Питання",
  showMap: "Показати на мапі",
  checkedQ: "Відповідь звірено з джерелами; історик її ще не читав.",
  testament: { whole: "Уся Біблія", ot: "Старий Заповіт", nt: "Новий Заповіт" },
  stop: "Зупинка",
  translation: "Переклад П. Куліша та І. Пулюя (1905)",
  circa: "бл.",
  title: (n: string) => `${n} — де це було, історія, вірші Біблії`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) на мапі біблійної історії: де це місце сьогодні, його історія та згадки в Біблії (${String(v)}).`,
  about: "Про проєкт",
  privacy: "Конфіденційність",
  allSources: "усі джерела",
  data: "Дані",
  // The language switch is an icon: «Мова: English» names it for a pointer and a screen reader.
  language: "Мова",
  photo: "Фото",
  pd: "суспільне надбання",
  licArticle: "Текст статті: © History Globe",
  licAnswer: "Текст відповіді: © History Globe",
} as const;

const LANDING_UK = {
  title: "Історія на глобусі — атлас біблійної історії",
  h1: "Історія на глобусі",
  desc: "Безкоштовний атлас: місця Біблії на 3D-глобусі, держави довкола них рік за роком, екскурсії, статті з джерелами та інструменти для уроку.",
  kicker: "Перша колекція — біблійна історія",
  lede: "Посуньте рік — і довкола змінюються царства, міста й назви.",
  open: "Відкрити глобус",
  tours: "Екскурсії",
  docs: "Документація",
  heroAlt:
    "Глобус у 701 р. до н. е.: Новоасирійське царство від Тира до Вавилона, Єрусалим, Дамаск, шкала часу",
  heroNote: "701 р. до н. е.: Асирія від Тира до Вавилона",
  live: "Покрутити глобус",
  full: "На весь екран",
  liveClose: "Готово",
  stats: ["місць", "екскурсій", "статей", "відповідей на питання", "битв і облог"],
  rows: [
    [
      "Екскурсії",
      "Маршрути дорогами й рельєфом",
      "Авраам, Вихід, подорожі Павла — зупинка за зупинкою: вірш, фото місця, відстань і дні дороги.",
      "Друга подорож Павла",
      "Зупинка «Троада» другої подорожі Павла: мапа Егейського моря, маршрут, профіль дороги, фото руїн",
    ],
    [
      "Місця",
      "Кожне місце — з віршами та джерелами",
      "Де воно сьогодні, чиїм було у вибраний рік і всі вірші, де його названо. Спірне названо спірним.",
      "Відкрити Єрусалим",
      "Картка Єрусалима: фото, держава в 30 р. н. е., стаття; довкола — гори Юдеї з десятками біблійних місць",
    ],
    [
      "Для уроку",
      "Вікторина, свій урок і аркуш A4",
      "Вікторина «Де це було?» за будь-якою екскурсією, свій урок одним посиланням, мапи для друку на A4.",
      "Відкрити Вихід з Єгипту",
      "Вікторина про Вихід: питання з віршем і чотири варіанти відповіді, маршрут на мапі",
    ],
  ],
  cards: [
    [
      "Питання контексту",
      "Де була Ніневія? Скільки йшов Павло до Рима? Відповіді з мапою та віршами.",
      "Усі питання",
    ],
    [
      "Відкриті дані",
      "CC BY 4.0, API «вірш → місця» без ключа і глобус для вбудовування.",
      "API і вбудовування",
    ],
    [
      "Без реєстрації",
      "Ні акаунта, ні cookie, ні реклами. Мапу можна зберегти для роботи без мережі.",
      "Конфіденційність",
    ],
  ],
  trust: "На відкритих даних",
  trustText:
    "Статті написано за допомогою ШІ та перевірено за джерелами окремим проходом; учені їх поки не рецензували, і ми так і пишемо.",
  method: "Як перевіряються дані",
  sources: "Усі джерела",
  ctaTitle: "Почніть із будь-якого року",
  ctaText: "Без реєстрації, на телефоні й на комп’ютері. Мов: {n}.",
} as const;

const LISTS_UK: ListWords = {
  placesLead: (n, k, a) => `${n} ${uk(k, "місце", "місця", "місць")}, ${a} зі статтею`,
  toursLead: (n, k) =>
    `${n} ${uk(k, "екскурсія", "екскурсії", "екскурсій")}. Відстань — по прямій між зупинками.`,
  questionsLead: (n, k) =>
    `${n} ${uk(k, "питання", "питання", "питань")} з відповіддю на мапі, у порядку книг Біблії.`,
  all: "Усі",
  withArticle: "Зі статтею",
  alphabet: "За алфавітом",
  partsNav: "Частини Біблії",
  findPlace: "Знайти місце",
  findQuestion: "Знайти питання",
  nothing: "Нічого не знайшлося",
  stops: (n) => `${String(n)}\u00a0${uk(n, "зупинка", "зупинки", "зупинок")}`,
  km: (n) => `≈\u00a0${n}\u00a0км`,
  parts: {
    torah: "П’ятикнижжя",
    history: "Історичні книги",
    prophets: "Пророки й навчальні книги",
    gospels: "Євангелії",
    acts: "Дії апостолів",
    letters: "Послання й Об’явлення",
  },
  partsShort: {
    torah: "П’ятикнижжя",
    history: "Історичні",
    prophets: "Пророки",
    gospels: "Євангелії",
    acts: "Дії",
    letters: "Послання",
  },
};

// Español (drafted by machine translation; not yet read by a native speaker).
/** A Spanish noun for a count: one or other («1 lugar», «5 lugares»). */
const es = (n: number, one: string, other: string) =>
  new Intl.PluralRules("es").select(n) === "one" ? one : other;

const T_ES = {
  site: "History Globe — mapa de la historia bíblica",
  open: "Abrir en el mapa",
  tour_open: "Recorrer la ruta en el mapa",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mapa",
  route_alt: (title: string) => `Mapa del recorrido: ${title}`,
  // The sea as the stop says it: «, por mar» or «, por mar, 5 días (Hch 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km en línea recta${road ? `, ≈\u00a0${road}\u00a0km por\u00a0calzadas\u00a0romanas` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, por mar, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${es(days, "día", "días")} (${ref ?? ""})`
      : ", por mar",
  today: "Dónde está hoy",
  english: "En inglés",
  ancient: "En escritores antiguos",
  untold: ", el camino no se cuenta en el texto",
  life: "Años de existencia",
  ruins: "En ruinas",
  events: "Acontecimientos",
  battles: "Batallas y asedios",
  article: "Historia",
  scripture: "Escritura",
  sources: "Fuentes",
  checked: "Artículo contrastado con las fuentes; aún no lo ha leído un historiador.",
  reviewed: "Artículo leído por un historiador",
  verses: (n: number) => `Versículos (${String(n)})`,
  more: (n: number) => `${String(n)} más en el mapa`,
  tours: "Rutas que pasan por este lugar",
  places: "Todos los lugares",
  skip: "Saltar al contenido",
  sections: "Secciones",
  tour: "Ruta",
  toursAll: "Todas las rutas",
  placesTitle: "Lugares de la historia bíblica",
  disputed: "Lugar en disputa",
  photoShows: (site: string) => `En la imagen: ${site}, uno de los sitios propuestos.`,
  toursTitle: "Rutas por la historia bíblica",
  questions: "Preguntas",
  questionsTitle: "Preguntas sobre los lugares y la historia de la Biblia",
  question: "Pregunta",
  showMap: "Mostrar en el mapa",
  checkedQ: "Respuesta contrastada con las fuentes; aún no la ha leído un historiador.",
  testament: { whole: "Toda la Biblia", ot: "Antiguo Testamento", nt: "Nuevo Testamento" },
  stop: "Parada",
  translation: "Reina-Valera 1909",
  circa: "ca.",
  title: (n: string) => `${n} — dónde estaba, historia, versículos de la Biblia`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) en el mapa de la historia bíblica: dónde está hoy este lugar, su historia y las menciones en la Biblia (${String(v)}).`,
  about: "Acerca del proyecto",
  privacy: "Privacidad",
  allSources: "todas las fuentes",
  data: "Datos",
  // The language switch is an icon: «Idioma: English» names it for a pointer and a screen reader.
  language: "Idioma",
  photo: "Foto",
  pd: "dominio público",
  licArticle: "Texto del artículo: © History Globe",
  licAnswer: "Texto de la respuesta: © History Globe",
} as const;

const LANDING_ES = {
  title: "La historia en un globo — atlas de historia bíblica",
  h1: "La historia en un globo",
  desc: "Un atlas gratuito: los lugares de la Biblia en un globo 3D, los estados a su alrededor año tras año, rutas, artículos con fuentes y herramientas para una lección.",
  kicker: "Primera colección: historia bíblica",
  lede: "Mueve el año y verás cambiar los reinos, las ciudades y los nombres.",
  open: "Abrir el globo",
  tours: "Rutas",
  docs: "Documentación",
  heroAlt:
    "El globo en 701 a. C.: el Imperio neoasirio de Tiro a Babilonia, Jerusalén, Damasco, la cronología",
  heroNote: "701 a. C.: Asiria de Tiro a Babilonia",
  live: "Explorar el globo",
  full: "Pantalla completa",
  liveClose: "Listo",
  stats: ["lugares", "rutas", "artículos", "preguntas respondidas", "batallas y asedios"],
  rows: [
    [
      "Rutas",
      "Itinerarios por los caminos y el relieve",
      "Abraham, el Éxodo, los viajes de Pablo: parada a parada, con el versículo, una foto del lugar, la distancia y los días de camino.",
      "El segundo viaje de Pablo",
      "La parada de Troas en el segundo viaje de Pablo: el Egeo en el mapa, la ruta, el perfil del camino, una foto de las ruinas",
    ],
    [
      "Lugares",
      "Cada lugar con sus versículos y fuentes",
      "Dónde está hoy, de quién era en el año elegido y todos los versículos que lo nombran. Lo dudoso se presenta como dudoso.",
      "Abrir Jerusalén",
      "La ficha de Jerusalén: una foto, su estado en 30 d. C., el artículo; a su alrededor los montes de Judea con decenas de lugares bíblicos",
    ],
    [
      "Para la lección",
      "Un cuestionario, tu propia lección, una hoja A4",
      "Un cuestionario «¿Dónde ocurrió?» sobre cualquier ruta, tu propia lección en un solo enlace, mapas para imprimir en A4.",
      "Abrir el Éxodo",
      "Un cuestionario sobre el Éxodo: una pregunta con un versículo y cuatro respuestas, la ruta en el mapa",
    ],
  ],
  cards: [
    [
      "Preguntas de contexto",
      "¿Dónde estaba Nínive? ¿Cuánto tardó Pablo en llegar a Roma? Respuestas con el mapa y los versículos.",
      "Todas las preguntas",
    ],
    [
      "Datos abiertos",
      "CC BY 4.0, una API de versículo a lugares sin clave y un globo para incrustar.",
      "API e incrustación",
    ],
    [
      "Sin cuenta",
      "Sin registro, sin cookies, sin anuncios. El mapa se puede guardar para usarlo sin conexión.",
      "Privacidad",
    ],
  ],
  trust: "Basado en datos abiertos",
  trustText:
    "Los artículos se redactan con ayuda de IA y se contrastan con las fuentes en una pasada aparte; los especialistas aún no los han revisado, y el sitio lo dice.",
  method: "Cómo se comprueban los datos",
  sources: "Todas las fuentes",
  ctaTitle: "Empieza por cualquier año",
  ctaText: "Sin cuenta, en el móvil o en el ordenador, en {n} idiomas.",
} as const;

const LISTS_ES: ListWords = {
  placesLead: (n, k, a) => `${n} ${es(k, "lugar", "lugares")}, ${a} con artículo`,
  toursLead: (n, k) =>
    `${n} ${es(k, "ruta", "rutas")}. Las distancias son líneas rectas entre las paradas.`,
  questionsLead: (n, k) =>
    `${n} ${es(k, "pregunta respondida", "preguntas respondidas")} en el mapa, en el orden de los libros de la Biblia.`,
  all: "Todos",
  withArticle: "Con artículo",
  alphabet: "Alfabético",
  partsNav: "Partes de la Biblia",
  findPlace: "Buscar un lugar",
  findQuestion: "Buscar una pregunta",
  nothing: "No se encontró nada",
  stops: (n) => `${String(n)}\u00a0${es(n, "parada", "paradas")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "El Pentateuco",
    history: "Los libros históricos",
    prophets: "Los profetas y los libros sapienciales",
    gospels: "Los Evangelios",
    acts: "Hechos de los Apóstoles",
    letters: "Las cartas y el Apocalipsis",
  },
  partsShort: {
    torah: "Pentateuco",
    history: "Históricos",
    prophets: "Profetas",
    gospels: "Evangelios",
    acts: "Hechos",
    letters: "Cartas",
  },
};

// Português (drafted by machine translation; not yet read by a native speaker).
/** A Portuguese (Brazil) noun for a count: one or other («1 lugar», «5 lugares»). */
const pt = (n: number, one: string, other: string) =>
  new Intl.PluralRules("pt").select(n) === "one" ? one : other;

const T_PT = {
  site: "History Globe — mapa da história bíblica",
  open: "Abrir no mapa",
  tour_open: "Percorrer o roteiro no mapa",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mapa",
  route_alt: (title: string) => `Mapa do roteiro: ${title}`,
  // The sea as the stop says it: «, por mar» or «, por mar, 5 dias (At 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km em linha reta${road ? `, ≈\u00a0${road}\u00a0km por\u00a0estradas\u00a0romanas` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, por mar, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${pt(days, "dia", "dias")} (${ref ?? ""})`
      : ", por mar",
  today: "Onde fica hoje",
  english: "Em inglês",
  ancient: "Em escritores antigos",
  untold: ", o caminho não é contado no texto",
  life: "Período de existência",
  ruins: "Em ruínas",
  events: "Eventos",
  battles: "Batalhas e cercos",
  article: "História",
  scripture: "Escritura",
  sources: "Fontes",
  checked: "Artigo conferido com as fontes; ainda não lido por um historiador.",
  reviewed: "Artigo lido por um historiador",
  verses: (n: number) => `Versículos (${String(n)})`,
  more: (n: number) => `mais ${String(n)} no mapa`,
  tours: "Roteiros que passam por este lugar",
  places: "Todos os lugares",
  skip: "Ir para o conteúdo",
  sections: "Seções",
  tour: "Roteiro",
  toursAll: "Todos os roteiros",
  placesTitle: "Lugares da história bíblica",
  disputed: "Localização em disputa",
  photoShows: (site: string) => `Na imagem: ${site}, um dos locais propostos.`,
  toursTitle: "Roteiros pela história bíblica",
  questions: "Perguntas",
  questionsTitle: "Perguntas sobre os lugares e a história da Bíblia",
  question: "Pergunta",
  showMap: "Mostrar no mapa",
  checkedQ: "Resposta conferida com as fontes; ainda não lida por um historiador.",
  testament: { whole: "A Bíblia inteira", ot: "Antigo Testamento", nt: "Novo Testamento" },
  stop: "Parada",
  translation: "Bíblia Portuguesa Mundial",
  circa: "c.",
  title: (n: string) => `${n} — onde fica, história, versículos da Bíblia`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) no mapa da história bíblica: onde fica hoje este lugar, sua história e as menções na Bíblia (${String(v)}).`,
  about: "Sobre o projeto",
  privacy: "Privacidade",
  allSources: "todas as fontes",
  data: "Dados",
  // The language switch is an icon: «Idioma: English» names it for a pointer and a screen reader.
  language: "Idioma",
  photo: "Foto",
  pd: "domínio público",
  licArticle: "Texto do artigo: © History Globe",
  licAnswer: "Texto da resposta: © History Globe",
} as const;

const LANDING_PT = {
  title: "A história em um globo — atlas de história bíblica",
  h1: "A história em um globo",
  desc: "Um atlas gratuito: os lugares da Bíblia em um globo 3D, os estados ao redor deles ano a ano, roteiros, artigos com fontes e ferramentas para a aula.",
  kicker: "Primeira coleção: história bíblica",
  lede: "Mova o ano e veja mudarem os reinos, as cidades e os nomes.",
  open: "Abrir o globo",
  tours: "Roteiros",
  docs: "Documentação",
  heroAlt:
    "O globo em 701 a.C.: o Império Neoassírio de Tiro à Babilônia, Jerusalém, Damasco, a linha do tempo",
  heroNote: "701 a.C.: a Assíria de Tiro à Babilônia",
  live: "Explorar o globo",
  full: "Tela cheia",
  liveClose: "Pronto",
  stats: ["lugares", "roteiros", "artigos", "perguntas respondidas", "batalhas e cercos"],
  rows: [
    [
      "Roteiros",
      "Percursos pelas estradas e pelo relevo",
      "Abraão, o Êxodo, as viagens de Paulo: parada a parada, com o versículo, uma foto do lugar, a distância e os dias de caminho.",
      "A segunda viagem de Paulo",
      "A parada de Trôade na segunda viagem de Paulo: o mar Egeu no mapa, a rota, o perfil do caminho, uma foto das ruínas",
    ],
    [
      "Lugares",
      "Cada lugar com seus versículos e fontes",
      "Onde fica hoje, a quem pertencia no ano escolhido e todos os versículos que o citam. O que é duvidoso é chamado de duvidoso.",
      "Abrir Jerusalém",
      "A ficha de Jerusalém: uma foto, seu estado em 30 d.C., o artigo; ao redor, os montes da Judeia com dezenas de lugares bíblicos",
    ],
    [
      "Para a aula",
      "Um quiz, sua própria aula, uma folha A4",
      "Um quiz «Onde aconteceu?» sobre qualquer roteiro, sua própria aula em um único link, mapas para imprimir em A4.",
      "Abrir o Êxodo",
      "Um quiz sobre o Êxodo: uma pergunta com um versículo e quatro respostas, a rota no mapa",
    ],
  ],
  cards: [
    [
      "Perguntas de contexto",
      "Onde ficava Nínive? Quanto tempo Paulo levou para chegar a Roma? Respostas com o mapa e os versículos.",
      "Todas as perguntas",
    ],
    [
      "Dados abertos",
      "CC BY 4.0, uma API que leva do versículo aos lugares, sem chave, e um globo para incorporar.",
      "API e incorporação",
    ],
    [
      "Sem conta",
      "Sem cadastro, sem cookies, sem anúncios. O mapa pode ser salvo para uso offline.",
      "Privacidade",
    ],
  ],
  trust: "Baseado em dados abertos",
  trustText:
    "Os artigos são redigidos com ajuda de IA e conferidos com as fontes em uma etapa à parte; especialistas ainda não os revisaram, e o site diz isso.",
  method: "Como os dados são conferidos",
  sources: "Todas as fontes",
  ctaTitle: "Comece por qualquer ano",
  ctaText: "Sem conta, no celular ou no computador, em {n} idiomas.",
} as const;

const LISTS_PT: ListWords = {
  placesLead: (n, k, a) => `${n} ${pt(k, "lugar", "lugares")}, ${a} com artigo`,
  toursLead: (n, k) =>
    `${n} ${pt(k, "roteiro", "roteiros")}. As distâncias são linhas retas entre as paradas.`,
  questionsLead: (n, k) =>
    `${n} ${pt(k, "pergunta respondida", "perguntas respondidas")} no mapa, na ordem dos livros da Bíblia.`,
  all: "Todos",
  withArticle: "Com artigo",
  alphabet: "Alfabético",
  partsNav: "Partes da Bíblia",
  findPlace: "Buscar um lugar",
  findQuestion: "Buscar uma pergunta",
  nothing: "Nada encontrado",
  stops: (n) => `${String(n)}\u00a0${pt(n, "parada", "paradas")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "O Pentateuco",
    history: "Os livros históricos",
    prophets: "Os profetas e os livros sapienciais",
    gospels: "Os Evangelhos",
    acts: "Atos dos Apóstolos",
    letters: "As cartas e o Apocalipse",
  },
  partsShort: {
    torah: "Pentateuco",
    history: "Históricos",
    prophets: "Profetas",
    gospels: "Evangelhos",
    acts: "Atos",
    letters: "Cartas",
  },
};

// Deutsch (drafted by machine translation; not yet read by a native speaker).
/** A German noun for a count: one or other («1 Ort», «5 Orte»). */
const de = (n: number, one: string, other: string) =>
  new Intl.PluralRules("de").select(n) === "one" ? one : other;

const T_DE = {
  site: "History Globe — eine Karte der biblischen Geschichte",
  open: "Auf der Karte öffnen",
  tour_open: "Die Tour auf der Karte verfolgen",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "Karte",
  route_alt: (title: string) => `Karte der Route: ${title}`,
  // The sea as the stop says it: «, zur See» or «, zur See, 5 Tage (Apg 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km Luftlinie${road ? `, ≈\u00a0${road}\u00a0km auf\u00a0Römerstraßen` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, zur See, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${de(days, "Tag", "Tage")} (${ref ?? ""})`
      : ", zur See",
  today: "Heute",
  english: "Auf Englisch",
  ancient: "Bei antiken Autoren",
  untold: ", der Weg wird im Text nicht erzählt",
  life: "Bestehenszeit",
  ruins: "In Ruinen",
  events: "Ereignisse",
  battles: "Schlachten und Belagerungen",
  article: "Geschichte",
  scripture: "Schrift",
  sources: "Quellen",
  checked: "Artikel mit den Quellen abgeglichen; noch von keinem Historiker gelesen.",
  reviewed: "Artikel von einem Historiker gelesen",
  verses: (n: number) => `Verse (${String(n)})`,
  more: (n: number) => `${String(n)} weitere auf der Karte`,
  tours: "Touren durch diesen Ort",
  places: "Alle Orte",
  skip: "Zum Inhalt springen",
  sections: "Abschnitte",
  tour: "Tour",
  toursAll: "Alle Touren",
  placesTitle: "Orte der biblischen Geschichte",
  disputed: "Lage umstritten",
  photoShows: (site: string) => `Im Bild: ${site}, eine der vorgeschlagenen Stätten.`,
  toursTitle: "Touren durch die biblische Geschichte",
  questions: "Fragen",
  questionsTitle: "Fragen zu den Orten und zur Geschichte der Bibel",
  question: "Frage",
  showMap: "Auf der Karte zeigen",
  checkedQ: "Antwort mit den Quellen abgeglichen; noch von keinem Historiker gelesen.",
  testament: { whole: "Die ganze Bibel", ot: "Altes Testament", nt: "Neues Testament" },
  stop: "Halt",
  translation: "Lutherbibel 1912",
  circa: "ca.",
  title: (n: string) => `${n} — wo es liegt, Geschichte, Bibelverse`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) auf der Karte der biblischen Geschichte: wo dieser Ort heute liegt, seine Geschichte und die Erwähnungen in der Bibel (${String(v)}).`,
  about: "Über das Projekt",
  privacy: "Datenschutz",
  allSources: "alle Quellen",
  data: "Daten",
  // The language switch is an icon: «Sprache: English» names it for a pointer and a screen reader.
  language: "Sprache",
  photo: "Foto",
  pd: "gemeinfrei",
  licArticle: "Artikeltext: © History Globe",
  licAnswer: "Antworttext: © History Globe",
} as const;

const LANDING_DE = {
  title: "Geschichte auf dem Globus — ein Atlas der biblischen Geschichte",
  h1: "Geschichte auf dem Globus",
  desc: "Ein kostenloser Atlas: die Orte der Bibel auf einem 3D-Globus, die Staaten ringsum Jahr für Jahr, Touren, Artikel mit Quellen und Werkzeuge für den Unterricht.",
  kicker: "Erste Sammlung: biblische Geschichte",
  lede: "Das Jahr verschieben und zusehen, wie sich Reiche, Städte und Namen wandeln.",
  open: "Globus öffnen",
  tours: "Touren",
  docs: "Dokumentation",
  heroAlt:
    "Der Globus im Jahr 701 v. Chr.: das Neuassyrische Reich von Tyrus bis Babylon, Jerusalem, Damaskus, die Zeitleiste",
  heroNote: "701 v. Chr.: Assyrien von Tyrus bis Babylon",
  live: "Globus erkunden",
  full: "Vollbild",
  liveClose: "Fertig",
  stats: ["Orte", "Touren", "Artikel", "beantwortete Fragen", "Schlachten und Belagerungen"],
  rows: [
    [
      "Touren",
      "Routen entlang der Straßen und des Reliefs",
      "Abraham, der Auszug, die Reisen des Paulus — Halt für Halt, mit Vers, Foto des Ortes, Entfernung und Reisetagen.",
      "Die zweite Reise des Paulus",
      "Der Halt Troas auf der zweiten Reise des Paulus: die Ägäis auf der Karte, die Route, das Höhenprofil des Weges, ein Foto der Ruinen",
    ],
    [
      "Orte",
      "Jeder Ort mit seinen Versen und Quellen",
      "Wo er heute liegt, wem er im gewählten Jahr gehörte und alle Verse, die ihn nennen. Was umstritten ist, heißt umstritten.",
      "Jerusalem öffnen",
      "Die Infokarte von Jerusalem: ein Foto, sein Zustand im Jahr 30 n. Chr., der Artikel; ringsum das Bergland Judäas mit Dutzenden biblischer Orte",
    ],
    [
      "Für den Unterricht",
      "Ein Quiz, eine eigene Lektion, ein A4-Blatt",
      "Ein Quiz „Wo geschah es?“ zu jeder Tour, eine eigene Lektion als ein Link, Karten zum Ausdrucken auf A4.",
      "Den Auszug öffnen",
      "Ein Quiz zum Auszug: eine Frage mit einem Vers und vier Antworten, die Route auf der Karte",
    ],
  ],
  cards: [
    [
      "Fragen zum Zusammenhang",
      "Wo lag Ninive? Wie lange war Paulus nach Rom unterwegs? Antworten mit Karte und Versen.",
      "Alle Fragen",
    ],
    [
      "Offene Daten",
      "CC BY 4.0, eine API von Vers zu Orten ohne Schlüssel und ein Globus zum Einbetten.",
      "API und Einbettung",
    ],
    [
      "Ohne Konto",
      "Keine Anmeldung, keine Cookies, keine Werbung. Die Karte lässt sich für die Nutzung ohne Netz speichern.",
      "Datenschutz",
    ],
  ],
  trust: "Auf offenen Daten gebaut",
  trustText:
    "Die Artikel entstehen mit Hilfe von KI und werden in einem eigenen Durchgang mit den Quellen abgeglichen; Fachleute haben sie noch nicht geprüft, und die Seite sagt das offen.",
  method: "Wie die Daten geprüft werden",
  sources: "Alle Quellen",
  ctaTitle: "Mit einem beliebigen Jahr beginnen",
  ctaText: "Ohne Konto, auf dem Handy oder am Computer, in {n} Sprachen.",
} as const;

const LISTS_DE: ListWords = {
  placesLead: (n, k, a) => `${n} ${de(k, "Ort", "Orte")}, davon ${a} mit Artikel`,
  toursLead: (n, k) =>
    `${n} ${de(k, "Tour", "Touren")}. Die Entfernungen sind Luftlinien zwischen den Halten.`,
  questionsLead: (n, k) =>
    `${n} ${de(k, "beantwortete Frage", "beantwortete Fragen")} auf der Karte, in der Reihenfolge der Bücher der Bibel.`,
  all: "Alle",
  withArticle: "Mit Artikel",
  alphabet: "Alphabetisch",
  partsNav: "Teile der Bibel",
  findPlace: "Ort suchen",
  findQuestion: "Frage suchen",
  nothing: "Nichts gefunden",
  stops: (n) => `${String(n)}\u00a0${de(n, "Halt", "Halte")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Die fünf Bücher Mose",
    history: "Die Geschichtsbücher",
    prophets: "Die Propheten und Lehrbücher",
    gospels: "Die Evangelien",
    acts: "Apostelgeschichte",
    letters: "Die Briefe und die Offenbarung",
  },
  partsShort: {
    torah: "Mose",
    history: "Geschichte",
    prophets: "Propheten",
    gospels: "Evangelien",
    acts: "Apostelgeschichte",
    letters: "Briefe",
  },
};

// Français (drafted by machine translation; not yet read by a native speaker).
/** A French noun for a count: one or other («1 lieu», «5 lieux»). */
const fr = (n: number, one: string, other: string) =>
  new Intl.PluralRules("fr").select(n) === "one" ? one : other;

const T_FR = {
  site: "History Globe\u202f—\u202fcarte de l’histoire biblique",
  open: "Ouvrir sur la carte",
  tour_open: "Suivre le parcours sur la carte",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "carte",
  route_alt: (title: string) => `Carte du parcours : ${title}`,
  // The sea as the stop says it: «, par mer» or «, par mer, 5 jours (Ac 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km à vol d’oiseau${road ? `, ≈\u00a0${road}\u00a0km par\u00a0voies\u00a0romaines` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, par mer, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${fr(days, "jour", "jours")} (${ref ?? ""})`
      : ", par mer",
  today: "Aujourd’hui",
  english: "En anglais",
  ancient: "Chez les auteurs antiques",
  untold: ", le trajet n’est pas raconté dans le texte",
  life: "Période d’existence",
  ruins: "En ruines",
  events: "Événements",
  battles: "Batailles et sièges",
  article: "Histoire",
  scripture: "Écriture",
  sources: "Sources",
  checked: "Article vérifié d’après les sources\u202f; aucun historien ne l’a encore lu.",
  reviewed: "Article relu par un historien",
  verses: (n: number) => `Versets (${String(n)})`,
  more: (n: number) => `${String(n)} de plus sur la carte`,
  tours: "Parcours passant par ce lieu",
  places: "Tous les lieux",
  skip: "Aller au contenu",
  sections: "Sections",
  tour: "Parcours",
  toursAll: "Tous les parcours",
  placesTitle: "Lieux de l’histoire biblique",
  disputed: "Lieu contesté",
  photoShows: (site: string) => `Sur l’image\u202f: ${site}, l’un des sites proposés.`,
  toursTitle: "Parcours dans l’histoire biblique",
  questions: "Questions",
  questionsTitle: "Questions sur les lieux et l’histoire de la Bible",
  question: "Question",
  showMap: "Afficher sur la carte",
  checkedQ: "Réponse vérifiée d’après les sources\u202f; aucun historien ne l’a encore lue.",
  testament: { whole: "Toute la Bible", ot: "Ancien Testament", nt: "Nouveau Testament" },
  stop: "Étape",
  translation: "Louis Segond 1910",
  circa: "v.",
  title: (n: string) => `${n} — emplacement, histoire, versets de la Bible`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) sur la carte de l’histoire biblique\u202f: où se trouve aujourd’hui ce lieu, son histoire et les versets de la Bible qui le nomment (${String(v)}).`,
  about: "À propos du projet",
  privacy: "Confidentialité",
  allSources: "toutes les sources",
  data: "Données",
  // The language switch is an icon: «Langue\u202f: English» names it for a pointer and a screen reader.
  language: "Langue",
  photo: "Photo",
  pd: "domaine public",
  licArticle: "Texte de l’article : © History Globe",
  licAnswer: "Texte de la réponse : © History Globe",
} as const;

const LANDING_FR = {
  title: "L’histoire sur un globe\u202f—\u202fatlas de l’histoire biblique",
  h1: "L’histoire sur un globe",
  desc: "Un atlas gratuit\u202f: les lieux de la Bible sur un globe 3D, les États alentour année après année, des parcours, des articles sourcés et des outils pour une leçon.",
  kicker: "Première collection\u202f: l’histoire biblique",
  lede: "Faites avancer l’année et regardez changer les royaumes, les villes et les noms.",
  open: "Ouvrir le globe",
  tours: "Parcours",
  docs: "Documentation",
  heroAlt:
    "Le globe en 701 av. J.-C.\u202f: l’Empire néo-assyrien de Tyr à Babylone, Jérusalem, Damas, la frise chronologique",
  heroNote: "701 av. J.-C.\u202f: l’Assyrie de Tyr à Babylone",
  live: "Explorer le globe",
  full: "Plein écran",
  liveClose: "Terminé",
  stats: ["lieux", "parcours", "articles", "questions avec réponse", "batailles et sièges"],
  rows: [
    [
      "Parcours",
      "Itinéraires le long des routes et du relief",
      "Abraham, l’Exode, les voyages de Paul\u202f: étape par étape, avec le verset, une photo du lieu, la distance et les jours de route.",
      "Le deuxième voyage de Paul",
      "L’étape de Troas au deuxième voyage de Paul\u202f: la mer Égée sur la carte, l’itinéraire, le profil de la route, une photo des ruines",
    ],
    [
      "Lieux",
      "Chaque lieu avec ses versets et ses sources",
      "Où il se trouve aujourd’hui, à qui il appartenait l’année choisie et tous les versets qui le nomment. Ce qui est contesté est dit contesté.",
      "Ouvrir Jérusalem",
      "La fiche de Jérusalem\u202f: une photo, son état en 30 apr. J.-C., l’article\u202f; autour, les monts de Judée avec des dizaines de lieux bibliques",
    ],
    [
      "Pour la leçon",
      "Un quiz, votre propre leçon, une feuille A4",
      "Un quiz «\u202fOù cela s’est-il passé\u202f?\u202f» sur n’importe quel parcours, votre propre leçon en un seul lien, des cartes à imprimer en A4.",
      "Ouvrir l’Exode",
      "Un quiz sur l’Exode\u202f: une question avec un verset et quatre réponses, l’itinéraire sur la carte",
    ],
  ],
  cards: [
    [
      "Questions de contexte",
      "Où était Ninive\u202f? Combien de temps Paul a-t-il mis pour gagner Rome\u202f? Des réponses avec la carte et les versets.",
      "Toutes les questions",
    ],
    [
      "Données ouvertes",
      "CC BY 4.0, une API des versets vers les lieux sans clé et un globe à intégrer.",
      "API et intégration",
    ],
    [
      "Sans compte",
      "Sans inscription, sans cookies, sans publicité. La carte peut être enregistrée pour une utilisation hors ligne.",
      "Confidentialité",
    ],
  ],
  trust: "Fondé sur des données ouvertes",
  trustText:
    "Les articles sont rédigés avec l’aide de l’IA et vérifiés d’après les sources lors d’une passe distincte\u202f; les spécialistes ne les ont pas encore relus, et le site le dit.",
  method: "Comment les données sont vérifiées",
  sources: "Toutes les sources",
  ctaTitle: "Commencez à n’importe quelle année",
  ctaText: "Sans compte, sur téléphone ou sur ordinateur, en {n} langues.",
} as const;

const LISTS_FR: ListWords = {
  placesLead: (n, k, a) => `${n} ${fr(k, "lieu", "lieux")}, dont ${a} avec article`,
  toursLead: (n, k) =>
    `${n} ${fr(k, "parcours", "parcours")}. Les distances sont des lignes droites entre les étapes.`,
  questionsLead: (n, k) =>
    `${n} ${fr(k, "question avec réponse", "questions avec réponse")} sur la carte, dans l’ordre des livres de la Bible.`,
  all: "Tous",
  withArticle: "Avec article",
  alphabet: "Alphabétique",
  partsNav: "Parties de la Bible",
  findPlace: "Chercher un lieu",
  findQuestion: "Chercher une question",
  nothing: "Aucun résultat",
  stops: (n) => `${String(n)}\u00a0${fr(n, "étape", "étapes")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Le Pentateuque",
    history: "Les livres historiques",
    prophets: "Les prophètes et les livres de sagesse",
    gospels: "Les Évangiles",
    acts: "Les Actes des apôtres",
    letters: "Les épîtres et l’Apocalypse",
  },
  partsShort: {
    torah: "Pentateuque",
    history: "Historiques",
    prophets: "Prophètes",
    gospels: "Évangiles",
    acts: "Actes",
    letters: "Épîtres",
  },
};

// Italiano (drafted by machine translation; not yet read by a native speaker).
/** An Italian noun for a count: one or other («1 luogo», «5 luoghi», «1 milione di luoghi»). */
const it = (n: number, one: string, other: string, many: string = other) => {
  const r = new Intl.PluralRules("it").select(n);
  return r === "one" ? one : r === "many" ? many : other;
};

const T_IT = {
  site: "History Globe — mappa della storia biblica",
  open: "Apri sulla mappa",
  tour_open: "Percorri l’itinerario sulla mappa",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mappa",
  route_alt: (title: string) => `Mappa dell’itinerario: ${title}`,
  // The sea as the stop says it: «, per mare» or «, per mare, 5 giorni (At 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km in linea retta${road ? `, ≈\u00a0${road}\u00a0km su\u00a0strade\u00a0romane` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, per mare, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${it(days, "giorno", "giorni", "di giorni")} (${ref ?? ""})`
      : ", per mare",
  today: "Dov’è oggi",
  english: "In inglese",
  ancient: "Negli autori antichi",
  untold: ", il percorso non è raccontato nel testo",
  life: "Periodo di esistenza",
  ruins: "In rovina",
  events: "Eventi",
  battles: "Battaglie e assedi",
  article: "Storia",
  scripture: "Scrittura",
  sources: "Fonti",
  checked: "Articolo verificato sulle fonti; non ancora letto da uno storico.",
  reviewed: "Articolo letto da uno storico",
  verses: (n: number) => `Versetti (${String(n)})`,
  more: (n: number) => `altri ${String(n)} sulla mappa`,
  tours: "Itinerari che passano da questo luogo",
  places: "Tutti i luoghi",
  skip: "Vai al contenuto",
  sections: "Sezioni",
  tour: "Itinerario",
  toursAll: "Tutti gli itinerari",
  placesTitle: "Luoghi della storia biblica",
  disputed: "Luogo discusso",
  photoShows: (site: string) => `Nella foto: ${site}, uno dei siti proposti.`,
  toursTitle: "Itinerari nella storia biblica",
  questions: "Domande",
  questionsTitle: "Domande sui luoghi e sulla storia della Bibbia",
  question: "Domanda",
  showMap: "Mostra sulla mappa",
  checkedQ: "Risposta verificata sulle fonti; non ancora letta da uno storico.",
  testament: { whole: "Tutta la Bibbia", ot: "Antico Testamento", nt: "Nuovo Testamento" },
  stop: "Tappa",
  translation: "Riveduta 1927",
  circa: "ca.",
  title: (n: string) => `${n} — dov’è, storia, versetti della Bibbia`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) sulla mappa della storia biblica: dov’è oggi questo luogo, la sua storia e i versetti della Bibbia che lo nominano (${String(v)}).`,
  about: "Il progetto",
  privacy: "Privacy",
  allSources: "tutte le fonti",
  data: "Dati",
  // The language switch is an icon: «Lingua: English» names it for a pointer and a screen reader.
  language: "Lingua",
  photo: "Foto",
  pd: "pubblico dominio",
  licArticle: "Testo dell’articolo: © History Globe",
  licAnswer: "Testo della risposta: © History Globe",
} as const;

const LANDING_IT = {
  title: "La storia su un globo — atlante di storia biblica",
  h1: "La storia su un globo",
  desc: "Un atlante gratuito: i luoghi della Bibbia su un globo 3D, gli stati intorno a loro anno per anno, itinerari, articoli con fonti e strumenti per una lezione.",
  kicker: "Prima raccolta: storia biblica",
  lede: "Sposta l’anno e guarda cambiare regni, città e nomi.",
  open: "Apri il globo",
  tours: "Itinerari",
  docs: "Documentazione",
  heroAlt:
    "Il globo nel 701 a.C.: l’impero neoassiro da Tiro a Babilonia, Gerusalemme, Damasco, la linea del tempo",
  heroNote: "701 a.C.: l’Assiria da Tiro a Babilonia",
  live: "Esplora il globo",
  full: "Schermo intero",
  liveClose: "Fatto",
  stats: ["luoghi", "itinerari", "articoli", "domande con risposta", "battaglie e assedi"],
  rows: [
    [
      "Itinerari",
      "Percorsi lungo le strade e il rilievo",
      "Abramo, l’Esodo, i viaggi di Paolo: tappa per tappa, con il versetto, una foto, la distanza e i giorni di cammino.",
      "Il secondo viaggio di Paolo",
      "La tappa di Troade nel secondo viaggio di Paolo: l’Egeo sulla mappa, il percorso, il profilo della strada, una foto delle rovine",
    ],
    [
      "Luoghi",
      "Ogni luogo con i suoi versetti e le sue fonti",
      "Dov’è oggi, a chi apparteneva nell’anno scelto e tutti i versetti che lo nominano. Ciò che è discusso viene detto discusso.",
      "Apri Gerusalemme",
      "La scheda di Gerusalemme: una foto, il suo stato nel 30 d.C., l’articolo; intorno i monti della Giudea con decine di luoghi biblici",
    ],
    [
      "Per la lezione",
      "Un quiz, la tua lezione, un foglio A4",
      "Un quiz «Dove è successo?» su qualsiasi itinerario, la tua lezione in un solo link, mappe da stampare su A4.",
      "Apri l’Esodo",
      "Un quiz sull’Esodo: una domanda con un versetto e quattro risposte, il percorso sulla mappa",
    ],
  ],
  cards: [
    [
      "Domande di contesto",
      "Dov’era Ninive? Quanto impiegò Paolo ad arrivare a Roma? Risposte con la mappa e i versetti.",
      "Tutte le domande",
    ],
    [
      "Dati aperti",
      "CC BY 4.0, un’API da versetto a luoghi senza chiave e un globo da incorporare.",
      "API e incorporamento",
    ],
    [
      "Senza account",
      "Senza registrazione, senza cookie, senza pubblicità. La mappa si può salvare per usarla offline.",
      "Privacy",
    ],
  ],
  trust: "Costruito su dati aperti",
  trustText:
    "Gli articoli sono redatti con l’aiuto dell’IA e verificati sulle fonti in un passaggio a parte; gli studiosi non li hanno ancora rivisti, e il sito lo dichiara.",
  method: "Come si verificano i dati",
  sources: "Tutte le fonti",
  ctaTitle: "Parti da un anno qualsiasi",
  ctaText: "Senza account, su telefono o computer, in {n} lingue.",
} as const;

const LISTS_IT: ListWords = {
  placesLead: (n, k, a) => `${n} ${it(k, "luogo", "luoghi", "di luoghi")}, ${a} con articolo`,
  toursLead: (n, k) =>
    `${n} ${it(k, "itinerario", "itinerari", "di itinerari")}. Le distanze sono linee rette tra le tappe.`,
  questionsLead: (n, k) =>
    `${n} ${it(k, "domanda con risposta", "domande con risposta", "di domande con risposta")} sulla mappa, nell’ordine dei libri della Bibbia.`,
  all: "Tutti",
  withArticle: "Con articolo",
  alphabet: "Alfabetico",
  partsNav: "Parti della Bibbia",
  findPlace: "Cerca un luogo",
  findQuestion: "Cerca una domanda",
  nothing: "Nessun risultato",
  stops: (n) => `${String(n)}\u00a0${it(n, "tappa", "tappe", "di tappe")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Il Pentateuco",
    history: "I libri storici",
    prophets: "I profeti e i libri sapienziali",
    gospels: "I Vangeli",
    acts: "Atti degli Apostoli",
    letters: "Le lettere e l’Apocalisse",
  },
  partsShort: {
    torah: "Pentateuco",
    history: "Storici",
    prophets: "Profeti",
    gospels: "Vangeli",
    acts: "Atti",
    letters: "Lettere",
  },
};

// Nederlands (drafted by machine translation; not yet read by a native speaker).
/** A Dutch noun for a count: one or other («1 plaats», «5 plaatsen»). */
const nl = (n: number, one: string, other: string) =>
  new Intl.PluralRules("nl").select(n) === "one" ? one : other;

const T_NL = {
  site: "History Globe — een kaart van de bijbelse geschiedenis",
  open: "Openen op de kaart",
  tour_open: "De route volgen op de kaart",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "kaart",
  route_alt: (title: string) => `Kaart van de route: ${title}`,
  // The sea as the stop says it: «, over zee» or «, over zee, 5 dagen (Hand. 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km hemelsbreed${road ? `, ≈\u00a0${road}\u00a0km over\u00a0Romeinse\u00a0wegen` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, over zee, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${nl(days, "dag", "dagen")} (${ref ?? ""})`
      : ", over zee",
  today: "Waar het nu ligt",
  english: "In het Engels",
  ancient: "Bij antieke schrijvers",
  untold: ", de weg wordt niet beschreven",
  life: "Bestaansperiode",
  ruins: "Ruïne",
  events: "Gebeurtenissen",
  battles: "Veldslagen en belegeringen",
  article: "Geschiedenis",
  scripture: "Schrift",
  sources: "Bronnen",
  checked: "Getoetst aan de bronnen; nog niet gelezen door een historicus.",
  reviewed: "Gelezen door een historicus",
  verses: (n: number) => `Verzen (${String(n)})`,
  more: (n: number) => `nog ${String(n)} op de kaart`,
  tours: "Routes langs deze plaats",
  places: "Alle plaatsen",
  skip: "Naar de inhoud",
  sections: "Onderdelen",
  tour: "Route",
  toursAll: "Alle routes",
  placesTitle: "Plaatsen uit de bijbelse geschiedenis",
  disputed: "Omstreden plaats",
  photoShows: (site: string) => `Op de foto: ${site}, een van de voorgestelde locaties.`,
  toursTitle: "Routes door de bijbelse geschiedenis",
  questions: "Vragen",
  questionsTitle: "Vragen over de plaatsen en de geschiedenis van de Bijbel",
  question: "Vraag",
  showMap: "Tonen op de kaart",
  checkedQ: "Antwoord getoetst aan de bronnen; nog niet gelezen door een historicus.",
  testament: { whole: "De hele Bijbel", ot: "Oude Testament", nt: "Nieuwe Testament" },
  stop: "Halte",
  translation: "Statenvertaling, editie 1917",
  circa: "ca.",
  title: (n: string) => `${n} — waar het lag, geschiedenis, Bijbelverzen`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) op de kaart van de bijbelse geschiedenis: waar deze plaats nu ligt, haar geschiedenis en de Bijbelverzen die haar noemen (${String(v)}).`,
  about: "Over het project",
  privacy: "Privacy",
  allSources: "alle bronnen",
  data: "Gegevens",
  // The language switch is an icon: «Taal: English» names it for a pointer and a screen reader.
  language: "Taal",
  photo: "Foto",
  pd: "publiek domein",
  licArticle: "Tekst van het artikel: © History Globe",
  licAnswer: "Tekst van het antwoord: © History Globe",
} as const;

const LANDING_NL = {
  title: "Geschiedenis op een wereldbol — atlas van de bijbelse geschiedenis",
  h1: "Geschiedenis op een wereldbol",
  desc: "Een gratis atlas: de plaatsen uit de Bijbel op een 3D-wereldbol, de staten eromheen jaar na jaar, routes, artikelen met bronnen en hulpmiddelen voor een les.",
  kicker: "Eerste collectie: bijbelse geschiedenis",
  lede: "Verschuif het jaar en zie koninkrijken, steden en namen veranderen.",
  open: "De wereldbol openen",
  tours: "Routes",
  docs: "Documentatie",
  heroAlt:
    "De wereldbol in 701 v.Chr.: het Nieuw-Assyrische Rijk van Tyrus tot Babylon, Jeruzalem, Damascus, de tijdlijn",
  heroNote: "701 v.Chr.: Assyrië van Tyrus tot Babylon",
  live: "De wereldbol verkennen",
  full: "Volledig scherm",
  liveClose: "Klaar",
  stats: ["plaatsen", "routes", "artikelen", "beantwoorde vragen", "veldslagen en belegeringen"],
  rows: [
    [
      "Routes",
      "Reizen langs de wegen en het reliëf",
      "Abraham, de uittocht, de reizen van Paulus: halte voor halte, met het vers, een foto van de plek, de afstand en het aantal dagen onderweg.",
      "De tweede reis van Paulus",
      "De halte Troas op de tweede reis van Paulus: de Egeïsche Zee op de kaart, de route, het profiel van de weg, een foto van de ruïnes",
    ],
    [
      "Plaatsen",
      "Elke plaats met haar verzen en bronnen",
      "Waar ze nu ligt, van wie ze was in het gekozen jaar en alle verzen die haar noemen. Wat omstreden is, heet omstreden.",
      "Jeruzalem openen",
      "De kaart van Jeruzalem: een foto, de toestand in 30 n.Chr., het artikel; eromheen het Judese bergland met tientallen bijbelse plaatsen",
    ],
    [
      "Voor de les",
      "Een quiz, je eigen les, een A4-blad",
      "Een quiz ‘Waar gebeurde het?’ bij elke route, je eigen les als één link, kaarten om op A4 af te drukken.",
      "De uittocht openen",
      "Een quiz over de uittocht: een vraag met een vers en vier antwoorden, de route op de kaart",
    ],
  ],
  cards: [
    [
      "Vragen over de context",
      "Waar lag Nineve? Hoe lang reisde Paulus naar Rome? Antwoorden met de kaart en de verzen.",
      "Alle vragen",
    ],
    [
      "Open gegevens",
      "CC BY 4.0, een API van vers naar plaatsen zonder sleutel en een wereldbol om in te sluiten.",
      "API en insluiten",
    ],
    [
      "Geen account",
      "Geen registratie, geen cookies, geen advertenties. De kaart kan worden opgeslagen voor offline gebruik.",
      "Privacy",
    ],
  ],
  trust: "Gebouwd op open gegevens",
  trustText:
    "De artikelen worden met hulp van AI opgesteld en in een aparte ronde aan de bronnen getoetst; wetenschappers hebben ze nog niet beoordeeld, en de site zegt dat.",
  method: "Hoe de gegevens worden gecontroleerd",
  sources: "Alle bronnen",
  ctaTitle: "Begin bij elk jaar",
  ctaText: "Zonder account, op een telefoon of een computer, in {n} talen.",
} as const;

const LISTS_NL: ListWords = {
  placesLead: (n, k, a) => `${n} ${nl(k, "plaats", "plaatsen")}, ${a} met een artikel`,
  toursLead: (n, k) =>
    `${n} ${nl(k, "route", "routes")}. Afstanden zijn hemelsbreed tussen de haltes.`,
  questionsLead: (n, k) =>
    `${n} ${nl(k, "beantwoorde vraag", "beantwoorde vragen")} op de kaart, in de volgorde van de Bijbelboeken.`,
  all: "Alle",
  withArticle: "Met artikel",
  alphabet: "Alfabetisch",
  partsNav: "Delen van de Bijbel",
  findPlace: "Een plaats zoeken",
  findQuestion: "Een vraag zoeken",
  nothing: "Niets gevonden",
  stops: (n) => `${String(n)}\u00a0${nl(n, "halte", "haltes")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "De Pentateuch",
    history: "De geschiedkundige boeken",
    prophets: "De profeten en de wijsheidsboeken",
    gospels: "De evangeliën",
    acts: "Handelingen van de apostelen",
    letters: "De brieven en Openbaring",
  },
  partsShort: {
    torah: "Pentateuch",
    history: "Geschiedenis",
    prophets: "Profeten",
    gospels: "Evangeliën",
    acts: "Handelingen",
    letters: "Brieven",
  },
};

// Polski (drafted by machine translation; not yet read by a native speaker).
/** A Polish noun for a count: one, few, many («1 miejsce», «3 miejsca», «5 miejsc»). */
const pl = (n: number, one: string, few: string, many: string) => {
  const r = new Intl.PluralRules("pl").select(n);
  return r === "one" ? one : r === "few" ? few : many;
};

const T_PL = {
  site: "History Globe — mapa historii biblijnej",
  open: "Otwórz na mapie",
  tour_open: "Przejdź trasę na mapie",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mapa",
  route_alt: (title: string) => `Mapa trasy: ${title}`,
  // The sea as the stop says it: «, morzem» or «, morzem, 5 dni (Dz 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km w linii prostej${road ? `, ≈\u00a0${road}\u00a0km drogami\u00a0rzymskimi` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, morzem, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${pl(days, "dzień", "dni", "dni")} (${ref ?? ""})`
      : ", morzem",
  today: "Dziś",
  english: "Po angielsku",
  ancient: "U autorów starożytnych",
  untold: ", droga nie jest opisana w tekście",
  life: "Czas istnienia",
  ruins: "W ruinie",
  events: "Wydarzenia",
  battles: "Bitwy i oblężenia",
  article: "Historia",
  scripture: "Pismo Święte",
  sources: "Źródła",
  checked: "Artykuł sprawdzony ze źródłami; historyk jeszcze go nie czytał.",
  reviewed: "Artykuł przeczytał historyk",
  verses: (n: number) => `Wersety (${String(n)})`,
  more: (n: number) => `jeszcze ${String(n)} na mapie`,
  tours: "Trasy przez to miejsce",
  places: "Wszystkie miejsca",
  skip: "Przejdź do treści",
  sections: "Sekcje",
  tour: "Trasa",
  toursAll: "Wszystkie trasy",
  placesTitle: "Miejsca historii biblijnej",
  disputed: "Położenie sporne",
  photoShows: (site: string) => `Na zdjęciu: ${site}, jedna z proponowanych lokalizacji.`,
  toursTitle: "Trasy po historii biblijnej",
  questions: "Pytania",
  questionsTitle: "Pytania o miejsca i historię Biblii",
  question: "Pytanie",
  showMap: "Pokaż na mapie",
  checkedQ: "Odpowiedź sprawdzona ze źródłami; historyk jeszcze jej nie czytał.",
  testament: { whole: "Cała Biblia", ot: "Stary Testament", nt: "Nowy Testament" },
  stop: "Przystanek",
  translation: "Biblia Gdańska 1881",
  circa: "ok.",
  title: (n: string) => `${n} — gdzie to było, historia, wersety Biblii`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) na mapie historii biblijnej: gdzie to miejsce leży dziś, jego historia i wzmianki w Biblii (${String(v)}).`,
  about: "O projekcie",
  privacy: "Prywatność",
  allSources: "wszystkie źródła",
  data: "Dane",
  // The language switch is an icon: «Język: English» names it for a pointer and a screen reader.
  language: "Język",
  photo: "Zdjęcie",
  pd: "domena publiczna",
  licArticle: "Tekst artykułu: © History Globe",
  licAnswer: "Tekst odpowiedzi: © History Globe",
} as const;

const LANDING_PL = {
  title: "Historia na globusie — atlas historii biblijnej",
  h1: "Historia na globusie",
  desc: "Bezpłatny atlas: miejsca z Biblii na globusie 3D, państwa wokół nich rok po roku, trasy, artykuły ze źródłami i narzędzia na lekcję.",
  kicker: "Pierwsza kolekcja: historia biblijna",
  lede: "Przesuń rok, a królestwa, miasta i nazwy wokół zaczną się zmieniać.",
  open: "Otwórz globus",
  tours: "Trasy",
  docs: "Dokumentacja",
  heroAlt:
    "Globus w roku 701 p.n.e.: państwo nowoasyryjskie od Tyru po Babilon, Jerozolima, Damaszek, oś czasu",
  heroNote: "701 p.n.e.: Asyria od Tyru po Babilon",
  live: "Obracaj globus",
  full: "Pełny ekran",
  liveClose: "Gotowe",
  stats: ["miejsc", "tras", "artykułów", "odpowiedzi na pytania", "bitew i oblężeń"],
  rows: [
    [
      "Trasy",
      "Szlaki po drogach i rzeźbie terenu",
      "Abraham, Wyjście, podróże Pawła: przystanek po przystanku, z wersetem, zdjęciem miejsca, odległością i dniami drogi.",
      "Druga podróż Pawła",
      "Przystanek w Troadzie podczas drugiej podróży Pawła: Morze Egejskie na mapie, trasa, profil drogi, zdjęcie ruin",
    ],
    [
      "Miejsca",
      "Każde miejsce z wersetami i źródłami",
      "Gdzie leży dziś, do kogo należało w wybranym roku i wszystkie wersety, które je wymieniają. To, co sporne, zostaje nazwane spornym.",
      "Otwórz Jerozolimę",
      "Karta Jerozolimy: zdjęcie, państwo w roku 30 n.e., artykuł; wokół góry Judei z dziesiątkami miejsc biblijnych",
    ],
    [
      "Na lekcję",
      "Quiz, własna lekcja, arkusz A4",
      "Quiz „Gdzie to się stało?” do każdej trasy, własna lekcja w jednym linku, mapy do wydruku w A4.",
      "Otwórz Wyjście z Egiptu",
      "Quiz o Wyjściu: pytanie z wersetem i cztery odpowiedzi, trasa na mapie",
    ],
  ],
  cards: [
    [
      "Pytania o kontekst",
      "Gdzie leżała Niniwa? Jak długo Paweł wędrował do Rzymu? Odpowiedzi z mapą i wersetami.",
      "Wszystkie pytania",
    ],
    [
      "Otwarte dane",
      "CC BY 4.0, API „werset → miejsca” bez klucza i globus do osadzenia.",
      "API i osadzanie",
    ],
    [
      "Bez konta",
      "Bez rejestracji, bez plików cookie, bez reklam. Mapę można zapisać do pracy offline.",
      "Prywatność",
    ],
  ],
  trust: "Oparte na otwartych danych",
  trustText:
    "Artykuły powstają z pomocą AI i są sprawdzane ze źródłami w osobnym przebiegu; uczeni jeszcze ich nie zrecenzowali i strona mówi o tym otwarcie.",
  method: "Jak sprawdzamy dane",
  sources: "Wszystkie źródła",
  ctaTitle: "Zacznij od dowolnego roku",
  ctaText: "Bez konta, na telefonie i na komputerze, w {n} językach.",
} as const;

const LISTS_PL: ListWords = {
  placesLead: (n, k, a) => `${n} ${pl(k, "miejsce", "miejsca", "miejsc")}, w tym ${a} z artykułem`,
  toursLead: (n, k) =>
    `${n} ${pl(k, "trasa", "trasy", "tras")}. Odległości to linie proste między przystankami.`,
  questionsLead: (n, k) =>
    `${n} ${pl(k, "pytanie", "pytania", "pytań")} z odpowiedzią na mapie, w kolejności ksiąg Biblii.`,
  all: "Wszystkie",
  withArticle: "Z artykułem",
  alphabet: "Alfabetycznie",
  partsNav: "Części Biblii",
  findPlace: "Znajdź miejsce",
  findQuestion: "Znajdź pytanie",
  nothing: "Nic nie znaleziono",
  stops: (n) => `${String(n)}\u00a0${pl(n, "przystanek", "przystanki", "przystanków")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Pięcioksiąg",
    history: "Księgi historyczne",
    prophets: "Prorocy i księgi mądrościowe",
    gospels: "Ewangelie",
    acts: "Dzieje Apostolskie",
    letters: "Listy i Apokalipsa",
  },
  partsShort: {
    torah: "Pięcioksiąg",
    history: "Historyczne",
    prophets: "Prorocy",
    gospels: "Ewangelie",
    acts: "Dzieje",
    letters: "Listy",
  },
};

// Čeština (drafted by machine translation; not yet read by a native speaker).
/** A Czech noun for a count: one, few, other («1 místo», «3 místa», «5 míst»); fractions take the genitive. */
const cs = (n: number, one: string, few: string, other: string) => {
  const r = new Intl.PluralRules("cs").select(n);
  return r === "one" ? one : r === "few" ? few : other;
};

const CS_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "den", few: "dny" };

const T_CS = {
  site: "History Globe — mapa biblických dějin",
  open: "Otevřít na mapě",
  tour_open: "Projít trasu na mapě",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mapa",
  route_alt: (title: string) => `Mapa trasy: ${title}`,
  // The sea as the stop says it: «, po moři» or «, po moři, 5 dní (Sk 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km vzdušnou čarou${road ? `, ≈\u00a0${road}\u00a0km po\u00a0římských\u00a0silnicích` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, po moři, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${CS_DAYS[new Intl.PluralRules("cs").select(days)] ?? "dní"} (${ref ?? ""})`
      : ", po moři",
  today: "Kde je dnes",
  english: "Anglicky",
  ancient: "U antických autorů",
  untold: ", cesta v textu není popsána",
  life: "Doba existence",
  ruins: "V troskách",
  events: "Události",
  battles: "Bitvy a obléhání",
  article: "Dějiny",
  scripture: "Písmo",
  sources: "Prameny",
  checked: "Článek ověřen podle pramenů; historik jej ještě nečetl.",
  reviewed: "Článek přečetl historik",
  verses: (n: number) => `Verše (${String(n)})`,
  more: (n: number) => `další: ${String(n)} — na mapě`,
  tours: "Trasy přes toto místo",
  places: "Všechna místa",
  skip: "Přeskočit na obsah",
  sections: "Oddíly",
  tour: "Trasa",
  toursAll: "Všechny trasy",
  placesTitle: "Místa biblických dějin",
  disputed: "Sporné místo",
  photoShows: (site: string) => `Na snímku: ${site}, jedna z navrhovaných lokalit.`,
  toursTitle: "Trasy biblickými dějinami",
  questions: "Otázky",
  questionsTitle: "Otázky o místech a dějinách Bible",
  question: "Otázka",
  showMap: "Ukázat na mapě",
  checkedQ: "Odpověď ověřena podle pramenů; historik ji ještě nečetl.",
  testament: { whole: "Celá Bible", ot: "Starý zákon", nt: "Nový zákon" },
  stop: "Zastávka",
  translation: "Bible kralická 1613",
  circa: "asi",
  title: (n: string) => `${n} — kde to bylo, dějiny, biblické verše`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) na mapě biblických dějin: kde toto místo leží dnes, jeho dějiny a zmínky v Bibli (${String(v)}).`,
  about: "O projektu",
  privacy: "Soukromí",
  allSources: "všechny prameny",
  data: "Data",
  // The language switch is an icon: «Jazyk: English» names it for a pointer and a screen reader.
  language: "Jazyk",
  photo: "Foto",
  pd: "volné dílo",
  licArticle: "Text článku: © History Globe",
  licAnswer: "Text odpovědi: © History Globe",
} as const;

const LANDING_CS = {
  title: "Dějiny na glóbu — atlas biblických dějin",
  h1: "Dějiny na glóbu",
  desc: "Bezplatný atlas: místa Bible na 3D glóbu, okolní státy rok za rokem, trasy, články s prameny a nástroje pro výuku.",
  kicker: "První sbírka: biblické dějiny",
  lede: "Posuňte rok a uvidíte, jak se mění království, města i jména.",
  open: "Otevřít glóbus",
  tours: "Trasy",
  docs: "Dokumentace",
  heroAlt:
    "Glóbus v roce 701 př. n. l.: Novoasyrská říše od Týru po Babylon, Jeruzalém, Damašek, časová osa",
  heroNote: "701 př. n. l.: Asýrie od Týru po Babylon",
  live: "Prozkoumat glóbus",
  full: "Celá obrazovka",
  liveClose: "Hotovo",
  stats: ["míst", "tras", "článků", "zodpovězených otázek", "bitev a obléhání"],
  rows: [
    [
      "Trasy",
      "Cesty po silnicích a krajině",
      "Abraham, exodus, Pavlovy cesty: zastávku po zastávce, s veršem, fotografií místa, vzdáleností a počtem dní cesty.",
      "Pavlova druhá cesta",
      "Zastávka v Troadě na Pavlově druhé cestě: Egejské moře na mapě, trasa, profil cesty, fotografie zřícenin",
    ],
    [
      "Místa",
      "Každé místo s verši a prameny",
      "Kde leží dnes, komu patřilo ve zvoleném roce a všechny verše, které je jmenují. Co je sporné, je jako sporné označeno.",
      "Otevřít Jeruzalém",
      "Karta Jeruzaléma: fotografie, jeho stav v roce 30 n. l., článek; kolem Judských hor s desítkami biblických míst",
    ],
    [
      "Pro výuku",
      "Kvíz, vlastní lekce, list A4",
      "Kvíz „Kde se to stalo?“ k libovolné trase, vlastní lekce na jediném odkazu, mapy k vytištění na A4.",
      "Otevřít exodus",
      "Kvíz o exodu: otázka s veršem a čtyři odpovědi, trasa na mapě",
    ],
  ],
  cards: [
    [
      "Otázky k souvislostem",
      "Kde leželo Ninive? Jak dlouho cestoval Pavel do Říma? Odpovědi s mapou a verši.",
      "Všechny otázky",
    ],
    [
      "Otevřená data",
      "CC BY 4.0, API „verš → místa“ bez klíče a glóbus k vložení do stránky.",
      "API a vložení",
    ],
    [
      "Bez účtu",
      "Bez registrace, bez cookies, bez reklam. Mapu lze uložit a používat offline.",
      "Soukromí",
    ],
  ],
  trust: "Postaveno na otevřených datech",
  trustText:
    "Články vznikají s pomocí umělé inteligence a v samostatném průchodu se ověřují podle pramenů; odborníci je zatím nerecenzovali a stránka to říká otevřeně.",
  method: "Jak se data ověřují",
  sources: "Všechny prameny",
  ctaTitle: "Začněte kterýmkoli rokem",
  ctaText: "Bez účtu, v telefonu i v počítači, v {n} jazycích.",
} as const;

const LISTS_CS: ListWords = {
  placesLead: (n, k, a) => `${n} ${cs(k, "místo", "místa", "míst")}, z toho ${a} s článkem`,
  toursLead: (n, k) =>
    `${n} ${cs(k, "trasa", "trasy", "tras")}. Vzdálenosti jsou vzdušnou čarou mezi zastávkami.`,
  questionsLead: (n, k) =>
    `${n} ${cs(k, "zodpovězená otázka", "zodpovězené otázky", "zodpovězených otázek")} na mapě, v pořadí biblických knih.`,
  all: "Vše",
  withArticle: "S článkem",
  alphabet: "Abecedně",
  partsNav: "Části Bible",
  findPlace: "Najít místo",
  findQuestion: "Najít otázku",
  nothing: "Nic nenalezeno",
  stops: (n) => `${String(n)}\u00a0${cs(n, "zastávka", "zastávky", "zastávek")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Pentateuch",
    history: "Historické knihy",
    prophets: "Proroci a knihy moudrosti",
    gospels: "Evangelia",
    acts: "Skutky apoštolů",
    letters: "Listy a Zjevení",
  },
  partsShort: {
    torah: "Pentateuch",
    history: "Historické",
    prophets: "Proroci",
    gospels: "Evangelia",
    acts: "Skutky",
    letters: "Listy",
  },
};

// Wave 3, ready before the site publishes these languages: their pages are built once
// they join LOCALES (packages/model/src/time.ts).
// Svenska (drafted by machine translation; not yet read by a native speaker).
/** A Swedish noun for a count: one or other («1 plats», «5 platser»). */
const sv = (n: number, one: string, other: string) =>
  new Intl.PluralRules("sv").select(n) === "one" ? one : other;

const T_SV = {
  site: "History Globe — en karta över Bibelns historia",
  open: "Öppna på kartan",
  tour_open: "Följ rundturen på kartan",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "karta",
  route_alt: (title: string) => `Karta över rutten: ${title}`,
  // The sea as the stop says it: «, sjövägen» or «, sjövägen, 5 dagar (Apg 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km fågelvägen${road ? `, ≈\u00a0${road}\u00a0km längs\u00a0romerska\u00a0vägar` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, sjövägen, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${sv(days, "dag", "dagar")} (${ref ?? ""})`
      : ", sjövägen",
  today: "I dag",
  english: "På engelska",
  ancient: "Hos antika författare",
  untold: ", vägen nämns inte i texten",
  life: "När platsen fanns",
  ruins: "I ruiner",
  events: "Händelser",
  battles: "Strider och belägringar",
  article: "Historia",
  scripture: "Skriften",
  sources: "Källor",
  checked: "Artikeln är kontrollerad mot källorna; ingen historiker har läst den ännu.",
  reviewed: "Läst av en historiker",
  verses: (n: number) => `Verser (${String(n)})`,
  more: (n: number) => `${String(n)} till på kartan`,
  tours: "Rundturer genom den här platsen",
  places: "Alla platser",
  skip: "Hoppa till innehållet",
  sections: "Avsnitt",
  tour: "Rundtur",
  toursAll: "Alla rundturer",
  placesTitle: "Platser i Bibelns historia",
  disputed: "Omtvistat läge",
  photoShows: (site: string) => `På bilden: ${site}, en av de föreslagna platserna.`,
  toursTitle: "Rundturer genom Bibelns historia",
  questions: "Frågor",
  questionsTitle: "Frågor om Bibelns platser och historia",
  question: "Fråga",
  showMap: "Visa på kartan",
  checkedQ: "Svaret är kontrollerat mot källorna; ingen historiker har läst det ännu.",
  testament: { whole: "Hela Bibeln", ot: "Gamla testamentet", nt: "Nya testamentet" },
  stop: "Stopp",
  translation: "Bibeln 1917",
  circa: "ca",
  title: (n: string) => `${n} — var platsen låg, historia, bibelverser`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) på kartan över Bibelns historia: var platsen ligger i dag, dess historia och omnämnanden i Bibeln (${String(v)}).`,
  about: "Om projektet",
  privacy: "Integritet",
  allSources: "alla källor",
  data: "Data",
  // The language switch is an icon: «Språk: English» names it for a pointer and a screen reader.
  language: "Språk",
  photo: "Foto",
  pd: "upphovsrättsfri",
  licArticle: "Artikeltext: © History Globe",
  licAnswer: "Svarstext: © History Globe",
} as const;

const LANDING_SV = {
  title: "Historia på en glob — en atlas över Bibelns historia",
  h1: "Historia på en glob",
  desc: "En gratis atlas: Bibelns platser på en 3D-glob, staterna runt dem år för år, rundturer, artiklar med källor och verktyg för lektionen.",
  kicker: "Första samlingen: Bibelns historia",
  lede: "Flytta året och se hur riken, städer och namn förändras.",
  open: "Öppna globen",
  tours: "Rundturer",
  docs: "Dokumentation",
  heroAlt:
    "Globen år 701 f.Kr.: det nyassyriska riket från Tyros till Babylon, Jerusalem, Damaskus, tidslinjen",
  heroNote: "701 f.Kr.: Assyrien från Tyros till Babylon",
  live: "Utforska globen",
  full: "Helskärm",
  liveClose: "Klar",
  stats: ["platser", "rundturer", "artiklar", "besvarade frågor", "strider och belägringar"],
  rows: [
    [
      "Rundturer",
      "Rutter längs vägarna och terrängen",
      "Abraham, uttåget, Paulus resor: stopp för stopp, med versen, ett foto av platsen, avståndet och dagarna på vägen.",
      "Paulus andra resa",
      "Stoppet Troas på Paulus andra resa: Egeiska havet på kartan, rutten, vägens höjdprofil, ett foto av ruinerna",
    ],
    [
      "Platser",
      "Varje plats med sina verser och källor",
      "Var den ligger i dag, vem den tillhörde det valda året och alla verser som nämner den. Det omtvistade kallas omtvistat.",
      "Öppna Jerusalem",
      "Jerusalems kort: foto, dess tillstånd år 30 e.Kr., artikeln; runt omkring Judeens berg med tiotals bibliska platser",
    ],
    [
      "För lektionen",
      "Frågesport, egen lektion, A4-ark",
      "Frågesporten ”Var hände det?” på valfri rundtur, en egen lektion som en enda länk, kartor att skriva ut på A4.",
      "Öppna uttåget",
      "Frågesport om uttåget: en fråga med en vers och fyra svar, rutten på kartan",
    ],
  ],
  cards: [
    [
      "Frågor om sammanhanget",
      "Var låg Nineve? Hur länge reste Paulus till Rom? Svar med karta och verser.",
      "Alla frågor",
    ],
    [
      "Öppna data",
      "CC BY 4.0, ett API ”vers → platser” utan nyckel och en glob att bädda in på en sida.",
      "API och inbäddning",
    ],
    [
      "Inget konto",
      "Ingen registrering, inga cookies, ingen reklam. Kartan kan sparas och användas offline.",
      "Integritet",
    ],
  ],
  trust: "Byggd på öppna data",
  trustText:
    "Artiklarna skrivs med hjälp av AI och kontrolleras mot källorna i ett separat steg; forskare har inte granskat dem ännu, och sidan säger det öppet.",
  method: "Hur data kontrolleras",
  sources: "Alla källor",
  ctaTitle: "Börja med vilket år som helst",
  ctaText: "Utan konto, på telefon och dator, på {n} språk.",
} as const;

const LISTS_SV: ListWords = {
  placesLead: (n, k, a) => `${n} ${sv(k, "plats", "platser")}, varav ${a} med artikel`,
  toursLead: (n, k) =>
    `${n} ${sv(k, "rundtur", "rundturer")}. Avstånden är fågelvägen mellan stoppen.`,
  questionsLead: (n, k) =>
    `${n} ${sv(k, "besvarad fråga", "besvarade frågor")} på kartan, i Bibelns bokordning.`,
  all: "Alla",
  withArticle: "Med artikel",
  alphabet: "Alfabetiskt",
  partsNav: "Bibelns delar",
  findPlace: "Hitta en plats",
  findQuestion: "Hitta en fråga",
  nothing: "Inget hittades",
  stops: (n) => `${String(n)}\u00a0${sv(n, "stopp", "stopp")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Moseböckerna",
    history: "De historiska böckerna",
    prophets: "Profeterna och vishetsböckerna",
    gospels: "Evangelierna",
    acts: "Apostlagärningarna",
    letters: "Breven och Uppenbarelseboken",
  },
  partsShort: {
    torah: "Mose",
    history: "Historia",
    prophets: "Profeterna",
    gospels: "Evangelierna",
    acts: "Apg",
    letters: "Breven",
  },
};

// Dansk (drafted by machine translation; not yet read by a native speaker).
/** A Danish noun for a count: one, other («1 sted», «5 steder»); fractions with a zero integer take the singular. */
const da = (n: number, one: string, other: string) =>
  new Intl.PluralRules("da").select(n) === "one" ? one : other;

const DA_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "dag" };

const T_DA = {
  site: "History Globe — et kort over bibelsk historie",
  open: "Åbn på kortet",
  tour_open: "Følg turen på kortet",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "kort",
  route_alt: (title: string) => `Kort over ruten: ${title}`,
  // The sea as the stop says it: «, ad søvejen» or «, ad søvejen, 5 dage (ApG 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km i luftlinje${road ? `, ≈\u00a0${road}\u00a0km ad\u00a0romerske\u00a0veje` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, ad søvejen, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${DA_DAYS[new Intl.PluralRules("da").select(days)] ?? "dage"} (${ref ?? ""})`
      : ", ad søvejen",
  today: "Hvor det ligger i dag",
  english: "På engelsk",
  ancient: "Hos antikke forfattere",
  untold: ", vejen er ikke beskrevet",
  life: "Eksisterede",
  ruins: "I ruiner",
  events: "Begivenheder",
  battles: "Slag og belejringer",
  article: "Historie",
  scripture: "Skriften",
  sources: "Kilder",
  checked: "Artiklen er kontrolleret mod kilderne; en historiker har endnu ikke læst den.",
  reviewed: "Artiklen er læst af en historiker",
  verses: (n: number) => `Vers (${String(n)})`,
  more: (n: number) => `${String(n)} flere på kortet`,
  tours: "Ture via dette sted",
  places: "Alle steder",
  skip: "Gå til indholdet",
  sections: "Afsnit",
  tour: "Tur",
  toursAll: "Alle ture",
  placesTitle: "Steder i bibelsk historie",
  disputed: "Omstridt placering",
  photoShows: (site: string) => `På billedet: ${site}, en af de foreslåede lokaliteter.`,
  toursTitle: "Ture gennem bibelsk historie",
  questions: "Spørgsmål",
  questionsTitle: "Spørgsmål om Bibelens steder og historie",
  question: "Spørgsmål",
  showMap: "Vis på kortet",
  checkedQ: "Svaret er kontrolleret mod kilderne; en historiker har endnu ikke læst det.",
  testament: { whole: "Hele Bibelen", ot: "Det Gamle Testamente", nt: "Det Nye Testamente" },
  stop: "Stop",
  translation: "Bibelen 1871/1907",
  circa: "ca.",
  title: (n: string) => `${n} — hvor det lå, historie, bibelvers`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) på kortet over bibelsk historie: hvor stedet ligger i dag, dets historie og omtaler i Bibelen (${String(v)}).`,
  about: "Om projektet",
  privacy: "Privatliv",
  allSources: "alle kilder",
  data: "Data",
  // The language switch is an icon: «Sprog: English» names it for a pointer and a screen reader.
  language: "Sprog",
  photo: "Foto",
  pd: "public domain",
  licArticle: "Artiklens tekst: © History Globe",
  licAnswer: "Svarets tekst: © History Globe",
} as const;

const LANDING_DA = {
  title: "Historien på en globus — et atlas over bibelsk historie",
  h1: "Historien på en globus",
  desc: "Et gratis atlas: Bibelens steder på en 3D-globus, staterne omkring dem år for år, ture, artikler med kilder og værktøjer til undervisningen.",
  kicker: "Første samling: bibelsk historie",
  lede: "Flyt året, og se kongeriger, byer og navne skifte.",
  open: "Åbn globussen",
  tours: "Ture",
  docs: "Dokumentation",
  heroAlt:
    "Globussen i 701 f.Kr.: Det Nyassyriske Rige fra Tyrus til Babylon, Jerusalem, Damaskus, tidslinjen",
  heroNote: "701 f.Kr.: Assyrien fra Tyrus til Babylon",
  live: "Udforsk globussen",
  full: "Fuld skærm",
  liveClose: "Færdig",
  stats: ["steder", "ture", "artikler", "besvarede spørgsmål", "slag og belejringer"],
  rows: [
    [
      "Ture",
      "Ruter langs vejene og over terrænet",
      "Abraham, udvandringen, Paulus' rejser: stop for stop, med vers, foto, afstand og dage undervejs.",
      "Paulus' anden rejse",
      "Stoppet i Troas på Paulus' anden rejse: Det Ægæiske Hav på kortet, ruten, vejens højdeprofil, foto af ruinerne",
    ],
    [
      "Steder",
      "Hvert sted med sine vers og kilder",
      "Hvor det ligger i dag, hvem det tilhørte i det valgte år, og alle de vers, der nævner det. Det omstridte kaldes omstridt.",
      "Åbn Jerusalem",
      "Panelet for Jerusalem: foto, byens tilstand i 30 e.Kr., artiklen; rundt om det Judæas bjerge med snesevis af bibelske steder",
    ],
    [
      "Til undervisningen",
      "Quiz, egen lektion, A4-ark",
      "Quizzen »Hvor skete det?« til enhver tur, din egen lektion som ét link, kort til udskrift på A4.",
      "Åbn udvandringen",
      "Quiz om udvandringen: et spørgsmål med vers og fire svar, ruten på kortet",
    ],
  ],
  cards: [
    [
      "Spørgsmål om sammenhængen",
      "Hvor lå Nineve? Hvor længe rejste Paulus til Rom? Svar med kort og vers.",
      "Alle spørgsmål",
    ],
    [
      "Åbne data",
      "CC BY 4.0, et API »vers → steder« uden nøgle og en globus til indlejring.",
      "API og indlejring",
    ],
    [
      "Uden konto",
      "Ingen tilmelding, ingen cookies, ingen reklamer. Kortet kan gemmes til brug offline.",
      "Privatliv",
    ],
  ],
  trust: "Bygget på åbne data",
  trustText:
    "Artiklerne skrives med hjælp fra kunstig intelligens og kontrolleres mod kilderne i en særskilt gennemgang; forskere har endnu ikke gennemgået dem, og det siger siden åbent.",
  method: "Sådan kontrolleres dataene",
  sources: "Alle kilder",
  ctaTitle: "Begynd med et hvilket som helst år",
  ctaText: "Uden konto, på telefon og computer, på {n} sprog.",
} as const;

const LISTS_DA: ListWords = {
  placesLead: (n, k, a) => `${n} ${da(k, "sted", "steder")}, heraf ${a} med artikel`,
  toursLead: (n, k) =>
    `${n} ${da(k, "tur", "ture")}. Afstandene er målt i luftlinje mellem stoppene.`,
  questionsLead: (n, k) =>
    `${n} ${da(k, "besvaret spørgsmål", "besvarede spørgsmål")} på kortet, i Bibelens bogrækkefølge.`,
  all: "Alle",
  withArticle: "Med artikel",
  alphabet: "Alfabetisk",
  partsNav: "Bibelens dele",
  findPlace: "Find et sted",
  findQuestion: "Find et spørgsmål",
  nothing: "Intet fundet",
  stops: (n) => `${String(n)}\u00a0${da(n, "stop", "stop")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Mosebøgerne",
    history: "De historiske bøger",
    prophets: "Profeterne og visdomsbøgerne",
    gospels: "Evangelierne",
    acts: "Apostlenes Gerninger",
    letters: "Brevene og Åbenbaringen",
  },
  partsShort: {
    torah: "Mosebøgerne",
    history: "Historie",
    prophets: "Profeterne",
    gospels: "Evangelierne",
    acts: "ApG",
    letters: "Brevene",
  },
};

// Norsk bokmål (drafted by machine translation; not yet read by a native speaker).
/** A Norwegian Bokmål noun for a count: one, other («1 sted», «5 steder»). */
const nb = (n: number, one: string, other: string) =>
  new Intl.PluralRules("nb").select(n) === "one" ? one : other;

const NB_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "dag" };

const T_NB = {
  site: "History Globe — et kart over bibelhistorien",
  open: "Åpne på kartet",
  tour_open: "Følg ruten på kartet",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "kart",
  route_alt: (title: string) => `Kart over ruten: ${title}`,
  // The sea as the stop says it: «, sjøveien» or «, sjøveien, 5 dager (Apg 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km i luftlinje${road ? `, ≈\u00a0${road}\u00a0km langs\u00a0romerske\u00a0veier` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, sjøveien, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${NB_DAYS[new Intl.PluralRules("nb").select(days)] ?? "dager"} (${ref ?? ""})`
      : ", sjøveien",
  today: "Hvor det er i dag",
  english: "På engelsk",
  ancient: "Hos antikke forfattere",
  untold: ", veien er ikke beskrevet i teksten",
  life: "Eksisterte",
  ruins: "I ruiner",
  events: "Hendelser",
  battles: "Slag og beleiringer",
  article: "Historie",
  scripture: "Skriften",
  sources: "Kilder",
  checked: "Artikkelen er kontrollert mot kildene; en historiker har ennå ikke lest den.",
  reviewed: "Lest av en historiker",
  verses: (n: number) => `Vers (${String(n)})`,
  more: (n: number) => `${String(n)} til på kartet`,
  tours: "Ruter som går gjennom dette stedet",
  places: "Alle steder",
  skip: "Hopp til innholdet",
  sections: "Avsnitt",
  tour: "Rute",
  toursAll: "Alle ruter",
  placesTitle: "Steder i bibelhistorien",
  disputed: "Omstridt beliggenhet",
  photoShows: (site: string) => `På bildet: ${site}, et av de foreslåtte stedene.`,
  toursTitle: "Ruter gjennom bibelhistorien",
  questions: "Spørsmål",
  questionsTitle: "Spørsmål om Bibelens steder og historie",
  question: "Spørsmål",
  showMap: "Vis på kartet",
  checkedQ: "Svaret er kontrollert mot kildene; en historiker har ennå ikke lest det.",
  testament: { whole: "Hele Bibelen", ot: "Det gamle testamentet", nt: "Det nye testamentet" },
  stop: "Stopp",
  translation: "Bibelen 1930",
  circa: "ca.",
  title: (n: string) => `${n} — hvor det ligger, historien, bibelvers`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) på kartet over bibelhistorien: hvor stedet ligger i dag, dets historie og omtalene i Bibelen (${String(v)}).`,
  about: "Om prosjektet",
  privacy: "Personvern",
  allSources: "alle kilder",
  data: "Data",
  // The language switch is an icon: «Språk: English» names it for a pointer and a screen reader.
  language: "Språk",
  photo: "Foto",
  pd: "offentlig eie",
  licArticle: "Artikkeltekst: © History Globe",
  licAnswer: "Svartekst: © History Globe",
} as const;

const LANDING_NB = {
  title: "Historien på en globus — et atlas over bibelhistorien",
  h1: "Historien på en globus",
  desc: "Et gratis atlas: Bibelens steder på en 3D-globus, statene rundt dem år for år, ruter, artikler med kilder og verktøy for undervisning.",
  kicker: "Første samling: bibelhistorien",
  lede: "Flytt året, og se hvordan riker, byer og navn skifter.",
  open: "Åpne globusen",
  tours: "Ruter",
  docs: "Dokumentasjon",
  heroAlt:
    "Globusen i år 701 f.Kr.: Det nyassyriske riket fra Tyrus til Babylon, Jerusalem, Damaskus, tidslinjen",
  heroNote: "701 f.Kr.: Assyria fra Tyrus til Babylon",
  live: "Utforsk globusen",
  full: "Fullskjerm",
  liveClose: "Ferdig",
  stats: ["steder", "ruter", "artikler", "besvarte spørsmål", "slag og beleiringer"],
  rows: [
    [
      "Ruter",
      "Reiser langs veiene og terrenget",
      "Abraham, utgangen fra Egypt, Paulus' reiser: stopp for stopp, med verset, et bilde av stedet, avstanden og dagene underveis.",
      "Paulus' andre reise",
      "Stoppet i Troas på Paulus' andre reise: Egeerhavet på kartet, ruten, veiens høydeprofil, et bilde av ruinene",
    ],
    [
      "Steder",
      "Hvert sted med sine vers og kilder",
      "Hvor det ligger i dag, hvem det tilhørte i det valgte året, og alle versene som nevner det. Det som er omstridt, kalles omstridt.",
      "Åpne Jerusalem",
      "Kortet for Jerusalem: et bilde, hvem byen tilhørte i år 30 e.Kr., artikkelen; rundt byen ligger fjellene i Judea med titalls bibelske steder",
    ],
    [
      "For undervisning",
      "Quiz, egen leksjon, et A4-ark",
      "Quizen «Hvor skjedde det?» til en hvilken som helst rute, din egen leksjon som én lenke, kart som skrives ut på A4.",
      "Åpne utgangen fra Egypt",
      "Quiz om utgangen fra Egypt: et spørsmål med vers og fire svar, ruten på kartet",
    ],
  ],
  cards: [
    [
      "Spørsmål om bakgrunnen",
      "Hvor lå Ninive? Hvor lenge reiste Paulus til Roma? Svar med kart og vers.",
      "Alle spørsmål",
    ],
    [
      "Åpne data",
      "CC BY 4.0, et API «vers → steder» uten nøkkel og en globus til å bygge inn.",
      "API og innbygging",
    ],
    [
      "Uten konto",
      "Ingen registrering, ingen cookies, ingen reklame. Kartet kan lagres og brukes frakoblet.",
      "Personvern",
    ],
  ],
  trust: "Bygd på åpne data",
  trustText:
    "Artiklene skrives ved hjelp av kunstig intelligens og kontrolleres mot kildene i en egen gjennomgang; fagfolk har ennå ikke vurdert dem, og nettstedet sier det åpent.",
  method: "Hvordan dataene kontrolleres",
  sources: "Alle kilder",
  ctaTitle: "Begynn med et hvilket som helst år",
  ctaText: "Uten konto, på telefon og datamaskin, på {n} språk.",
} as const;

const LISTS_NB: ListWords = {
  placesLead: (n, k, a) => `${n} ${nb(k, "sted", "steder")}, ${a} av dem med artikkel`,
  toursLead: (n, k) => `${n} ${nb(k, "rute", "ruter")}. Avstandene er i luftlinje mellom stoppene.`,
  questionsLead: (n, k) =>
    `${n} ${nb(k, "besvart spørsmål", "besvarte spørsmål")} på kartet, i bibelbøkenes rekkefølge.`,
  all: "Alle",
  withArticle: "Med artikkel",
  alphabet: "Alfabetisk",
  partsNav: "Bibelens deler",
  findPlace: "Finn et sted",
  findQuestion: "Finn et spørsmål",
  nothing: "Ingenting funnet",
  stops: (n) => `${String(n)}\u00a0${nb(n, "stopp", "stopp")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Mosebøkene",
    history: "De historiske bøkene",
    prophets: "Profetene og visdomsbøkene",
    gospels: "Evangeliene",
    acts: "Apostlenes gjerninger",
    letters: "Brevene og Åpenbaringen",
  },
  partsShort: {
    torah: "Mosebøkene",
    history: "Historiske",
    prophets: "Profetene",
    gospels: "Evangeliene",
    acts: "Gjerningene",
    letters: "Brevene",
  },
};

// Српски (drafted by machine translation; not yet read by a native speaker).
/** A Serbian noun for a count: one, few, other («1 место», «3 места», «5 места»). */
const sr = (n: number, one: string, few: string, other: string) => {
  const r = new Intl.PluralRules("sr").select(n);
  return r === "one" ? one : r === "few" ? few : other;
};

const SR_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "дан", few: "дана" };

const T_SR = {
  site: "History Globe — мапа библијске историје",
  open: "Отвори на мапи",
  tour_open: "Прођи туру на мапи",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "мапа",
  route_alt: (title: string) => `Мапа маршруте: ${title}`,
  // The sea as the stop says it: «, морем» or «, морем, 5 дана (Дап 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0км ваздушном линијом${road ? `, ≈\u00a0${road}\u00a0км римским\u00a0путевима` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, морем, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${SR_DAYS[new Intl.PluralRules("sr").select(days)] ?? "дана"} (${ref ?? ""})`
      : ", морем",
  today: "Где је данас",
  english: "На енглеском",
  ancient: "Код античких писаца",
  untold: ", пут није описан",
  life: "Време постојања",
  ruins: "У рушевинама",
  events: "Догађаји",
  battles: "Битке и опсаде",
  article: "Историја",
  scripture: "Свето писмо",
  sources: "Извори",
  checked: "Чланак је проверен према изворима; историчар га још није прочитао.",
  reviewed: "Чланак је прочитао историчар",
  verses: (n: number) => `Стихови (${String(n)})`,
  more: (n: number) => `још ${String(n)} на мапи`,
  tours: "Туре кроз ово место",
  places: "Сва места",
  skip: "Пређи на садржај",
  sections: "Одељци",
  tour: "Тура",
  toursAll: "Све туре",
  placesTitle: "Места библијске историје",
  disputed: "Спорна локација",
  photoShows: (site: string) => `На слици: ${site}, једна од предложених локација.`,
  toursTitle: "Туре кроз библијску историју",
  questions: "Питања",
  questionsTitle: "Питања о местима и историји Библије",
  question: "Питање",
  showMap: "Прикажи на мапи",
  checkedQ: "Одговор је проверен према изворима; историчар га још није прочитао.",
  testament: { whole: "Цела Библија", ot: "Стари завет", nt: "Нови завет" },
  stop: "Станица",
  translation: "Превод Даничић–Караџић (1865/1868)",
  circa: "око",
  title: (n: string) => `${n} — где се налази, историја, стихови Библије`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) на мапи библијске историје: где је то место данас, његова историја и стихови Библије који га помињу (${String(v)}).`,
  about: "О пројекту",
  privacy: "Приватност",
  allSources: "сви извори",
  data: "Подаци",
  // The language switch is an icon: «Језик: English» names it for a pointer and a screen reader.
  language: "Језик",
  photo: "Фотографија",
  pd: "јавно власништво",
  licArticle: "Текст чланка: © History Globe",
  licAnswer: "Текст одговора: © History Globe",
} as const;

const LANDING_SR = {
  title: "Историја на глобусу — атлас библијске историје",
  h1: "Историја на глобусу",
  desc: "Бесплатан атлас: библијска места на 3D глобусу, околне државе из године у годину, туре, чланци са изворима и алатке за наставу.",
  kicker: "Прва збирка: библијска историја",
  lede: "Померите годину и гледајте како се мењају царства, градови и имена.",
  open: "Отвори глобус",
  tours: "Туре",
  docs: "Документација",
  heroAlt:
    "Глобус 701. године п. н. е.: Новоасирско царство од Тира до Вавилона, Јерусалим, Дамаск, временска линија",
  heroNote: "701. п. н. е.: Асирија од Тира до Вавилона",
  live: "Истражи глобус",
  full: "Цео екран",
  liveClose: "Готово",
  stats: ["места", "тура", "чланака", "одговорених питања", "битака и опсада"],
  rows: [
    [
      "Туре",
      "Путовања путевима и рељефом",
      "Авраам, Излазак, Павлова путовања: станицу по станици, са стихом, фотографијом места, растојањем и бројем дана пута.",
      "Друго Павлово путовање",
      "Станица Троада на другом Павловом путовању: Егејско море на мапи, маршрута, профил пута, фотографија рушевина",
    ],
    [
      "Места",
      "Свако место са стиховима и изворима",
      "Где је данас, чије је било у изабраној години и сви стихови који га помињу. Што је спорно, означено је као спорно.",
      "Отвори Јерусалим",
      "Картица Јерусалима: фотографија, стање 30. године н. е., чланак; око њега Јудејске горе са десетинама библијских места",
    ],
    [
      "За наставу",
      "Квиз, сопствени час, лист А4",
      "Квиз „Где се то догодило?“ за било коју туру, сопствени час у једној вези, мапе за штампу на А4.",
      "Отвори Излазак",
      "Квиз о Изласку: питање са стихом и четири одговора, маршрута на мапи",
    ],
  ],
  cards: [
    [
      "Питања о контексту",
      "Где је била Ниневија? Колико је Павле путовао до Рима? Одговори са мапом и стиховима.",
      "Сва питања",
    ],
    [
      "Отворени подаци",
      "CC BY 4.0, API „стих → места“ без кључа и глобус за уградњу у страницу.",
      "API и уградња",
    ],
    [
      "Без налога",
      "Без регистрације, без колачића, без реклама. Мапа се може сачувати и користити без интернета.",
      "Приватност",
    ],
  ],
  trust: "Засновано на отвореним подацима",
  trustText:
    "Чланци настају уз помоћ вештачке интелигенције и у засебном пролазу проверавају се према изворима; стручњаци их још нису рецензирали и сајт то отворено каже.",
  method: "Како се подаци проверавају",
  sources: "Сви извори",
  ctaTitle: "Почните од било које године",
  ctaText: "Без налога, на телефону и на рачунару. Језика: {n}.",
} as const;

const LISTS_SR: ListWords = {
  placesLead: (n, k, a) => `${n} ${sr(k, "место", "места", "места")}, од тога ${a} са чланком`,
  toursLead: (n, k) =>
    `${n} ${sr(k, "тура", "туре", "тура")}. Растојања су ваздушном линијом између станица.`,
  questionsLead: (n, k) =>
    `${n} ${sr(k, "одговорено питање", "одговорена питања", "одговорених питања")} на мапи, по редоследу библијских књига.`,
  all: "Све",
  withArticle: "Са чланком",
  alphabet: "По азбуци",
  partsNav: "Делови Библије",
  findPlace: "Нађи место",
  findQuestion: "Нађи питање",
  nothing: "Ништа није пронађено",
  stops: (n) => `${String(n)}\u00a0${sr(n, "станица", "станице", "станица")}`,
  km: (n) => `≈\u00a0${n}\u00a0км`,
  parts: {
    torah: "Петокњижје",
    history: "Историјске књиге",
    prophets: "Пророци и књиге мудрости",
    gospels: "Јеванђеља",
    acts: "Дела апостолска",
    letters: "Посланице и Откривење",
  },
  partsShort: {
    torah: "Петокњижје",
    history: "Историјске",
    prophets: "Пророци",
    gospels: "Јеванђеља",
    acts: "Дела",
    letters: "Посланице",
  },
};

// Tagalog (drafted by machine translation; not yet read by a native speaker).
/**
 * A Tagalog noun for a count: one, other («1 lugar», «5 lugar»). Tagalog nouns do not change
 * after a numeral, so both forms are usually the same word; the rule is kept for the shape.
 */
const tl = (n: number, one: string, other: string) =>
  new Intl.PluralRules("tl").select(n) === "one" ? one : other;

const TL_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "araw", other: "araw" };

const T_TL = {
  site: "History Globe — mapa ng kasaysayan ng Biblia",
  open: "Buksan sa mapa",
  tour_open: "Tahakin ang paglalakbay sa mapa",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "mapa",
  route_alt: (title: string) => `Mapa ng ruta: ${title}`,
  // The sea as the stop says it: «, sa dagat» or «, sa dagat, 5 araw (Gawa 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km sa tuwid na linya${road ? `, ≈\u00a0${road}\u00a0km sa\u00a0mga\u00a0daang\u00a0Romano` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, sa dagat, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${TL_DAYS[new Intl.PluralRules("tl").select(days)] ?? "araw"} (${ref ?? ""})`
      : ", sa dagat",
  today: "Saan ito ngayon",
  english: "Sa Ingles",
  ancient: "Sa mga sinaunang manunulat",
  untold: ", hindi binanggit ang daan",
  life: "Panahong nakatayo",
  ruins: "Guho",
  events: "Mga pangyayari",
  battles: "Mga labanan at pagkubkob",
  article: "Kasaysayan",
  scripture: "Kasulatan",
  sources: "Mga sanggunian",
  checked: "Sinuri ayon sa mga sanggunian; hindi pa nababasa ng isang istoryador.",
  reviewed: "Binasa ng isang istoryador",
  verses: (n: number) => `Mga talata (${String(n)})`,
  more: (n: number) => `${String(n)} pa sa mapa`,
  tours: "Mga paglalakbay na dumaraan sa lugar na ito",
  places: "Mga lugar",
  skip: "Lumaktaw sa nilalaman",
  sections: "Mga bahagi",
  tour: "Paglalakbay",
  toursAll: "Mga paglalakbay",
  placesTitle: "Mga lugar ng kasaysayan ng Biblia",
  disputed: "Pinagtatalunan ang kinaroroonan",
  photoShows: (site: string) => `Sa larawan: ${site}, isa sa mga iminumungkahing pook.`,
  toursTitle: "Mga paglalakbay sa kasaysayan ng Biblia",
  questions: "Mga tanong",
  questionsTitle: "Mga tanong tungkol sa mga lugar at kasaysayan ng Biblia",
  question: "Tanong",
  showMap: "Ipakita sa mapa",
  checkedQ: "Sinuri ang sagot ayon sa mga sanggunian; hindi pa nababasa ng isang istoryador.",
  testament: { whole: "Ang buong Biblia", ot: "Lumang Tipan", nt: "Bagong Tipan" },
  stop: "Hintuan",
  translation: "Ang Biblia 1905",
  circa: "mga",
  title: (n: string) => `${n} — saan ito matatagpuan, kasaysayan, mga talata ng Biblia`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) sa mapa ng kasaysayan ng Biblia: saan ito ngayon, ang kasaysayan nito at ang mga talata ng Biblia na bumabanggit dito (${String(v)}).`,
  about: "Tungkol sa proyekto",
  privacy: "Pagkapribado",
  allSources: "lahat ng sanggunian",
  data: "Datos",
  // The language switch is an icon: «Wika: English» names it for a pointer and a screen reader.
  language: "Wika",
  photo: "Larawan",
  pd: "pampublikong dominyo",
  licArticle: "Teksto ng artikulo: © History Globe",
  licAnswer: "Teksto ng sagot: © History Globe",
} as const;

const LANDING_TL = {
  title: "Kasaysayan sa globo — atlas ng kasaysayan ng Biblia",
  h1: "Kasaysayan sa globo",
  desc: "Libreng atlas: ang mga lugar ng Biblia sa 3D na globo, ang mga estado sa paligid nila taon-taon, mga paglalakbay, mga artikulong may sanggunian at mga kasangkapan para sa aralin.",
  kicker: "Unang koleksiyon: kasaysayan ng Biblia",
  lede: "Ilipat ang taon at panoorin kung paano nagbabago ang mga kaharian, bayan at pangalan.",
  open: "Buksan ang globo",
  tours: "Mga paglalakbay",
  docs: "Dokumentasyon",
  heroAlt:
    "Ang globo sa 701 BK: ang Imperyong Neo-Asiryano mula Tiro hanggang Babilonia, Jerusalem, Damasco, ang linya ng panahon",
  heroNote: "701 BK: Asiria mula Tiro hanggang Babilonia",
  live: "Galugarin ang globo",
  full: "Buong screen",
  liveClose: "Tapos",
  stats: ["lugar", "paglalakbay", "artikulo", "nasagot na tanong", "labanan at pagkubkob"],
  rows: [
    [
      "Mga paglalakbay",
      "Mga ruta sa mga daan at anyo ng lupa",
      "Abraham, ang Exodo, ang mga paglalakbay ni Pablo: hintuan sa hintuan, may talata, larawan ng lugar, layo at bilang ng araw sa daan.",
      "Ikalawang paglalakbay ni Pablo",
      "Ang hintuan sa Troas sa ikalawang paglalakbay ni Pablo: ang Dagat Aegeo sa mapa, ang ruta, ang taas ng daan, larawan ng mga guho",
    ],
    [
      "Mga lugar",
      "Bawat lugar na may mga talata at sanggunian",
      "Saan ito ngayon, kaninong lupain ito sa piniling taon, at lahat ng talatang bumabanggit dito. Ang pinagtatalunan ay tinatawag na pinagtatalunan.",
      "Buksan ang Jerusalem",
      "Ang card ng Jerusalem: larawan, ang estado nito noong 30 AD, ang artikulo; sa paligid ang mga burol ng Judea na may dose-dosenang lugar sa Biblia",
    ],
    [
      "Para sa aralin",
      "Pagsusulit, sariling aralin, pahinang A4",
      "Pagsusulit na “Saan ito nangyari?” sa alinmang paglalakbay, sariling aralin sa iisang link, mga mapang maaaring i-print sa A4.",
      "Buksan ang Exodo",
      "Pagsusulit tungkol sa Exodo: tanong na may talata at apat na sagot, ang ruta sa mapa",
    ],
  ],
  cards: [
    [
      "Mga tanong tungkol sa konteksto",
      "Saan ang Nineve? Gaano katagal naglakbay si Pablo patungong Roma? Mga sagot na may mapa at talata.",
      "Lahat ng tanong",
    ],
    [
      "Bukas na datos",
      "CC BY 4.0, API na “talata → mga lugar” nang walang key, at globong maaaring ilagay sa pahina.",
      "API at pag-embed",
    ],
    [
      "Walang account",
      "Walang pagrerehistro, walang cookies, walang patalastas. Maaaring i-save ang mapa at gamitin offline.",
      "Pagkapribado",
    ],
  ],
  trust: "Nakabatay sa bukas na datos",
  trustText:
    "Isinusulat ang mga artikulo sa tulong ng AI at sinusuri ayon sa mga sanggunian sa hiwalay na hakbang; hindi pa nasusuri ng mga iskolar, at hayagang sinasabi iyon ng site.",
  method: "Paano sinusuri ang datos",
  sources: "Lahat ng sanggunian",
  ctaTitle: "Magsimula sa alinmang taon",
  ctaText: "Walang account, sa telepono o sa computer, sa {n} na wika.",
} as const;

const LISTS_TL: ListWords = {
  placesLead: (n, k, a) => `${n} ${tl(k, "lugar", "lugar")}, ${a} ang may artikulo`,
  toursLead: (n, k) =>
    `${n} ${tl(k, "paglalakbay", "paglalakbay")}. Ang mga layo ay tuwid na linya sa pagitan ng mga hintuan.`,
  questionsLead: (n, k) =>
    `${n} ${tl(k, "tanong", "tanong")} na nasagot sa mapa, sa pagkakasunod ng mga aklat ng Biblia.`,
  all: "Lahat",
  withArticle: "May artikulo",
  alphabet: "Alpabetiko",
  partsNav: "Mga bahagi ng Bibliya",
  findPlace: "Hanapin ang lugar",
  findQuestion: "Hanapin ang tanong",
  nothing: "Walang nahanap",
  stops: (n) => `${String(n)}\u00a0${tl(n, "hintuan", "hintuan")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Pentateuko",
    history: "Mga aklat ng kasaysayan",
    prophets: "Mga propeta at aklat ng karunungan",
    gospels: "Mga Ebanghelyo",
    acts: "Mga Gawa ng mga Apostol",
    letters: "Mga sulat at Pahayag",
  },
  partsShort: {
    torah: "Pentateuko",
    history: "Kasaysayan",
    prophets: "Mga propeta",
    gospels: "Mga Ebanghelyo",
    acts: "Mga Gawa",
    letters: "Mga sulat",
  },
};

// Magyar (drafted by machine translation; not yet read by a native speaker).
// Magyar (drafted by machine translation; not yet read by a native speaker).
/** A Hungarian noun for a count: one or other; after a numeral the noun stays singular («1 hely», «5 hely»). */
const hu = (n: number, one: string, other: string) =>
  new Intl.PluralRules("hu").select(n) === "one" ? one : other;

const T_HU = {
  site: "History Globe — a bibliai történelem térképe",
  open: "Megnyitás a térképen",
  tour_open: "A túra követése a térképen",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "térkép",
  route_alt: (title: string) => `Az útvonal térképe: ${title}`,
  // The sea as the stop says it: «, tengeren» or «, tengeren, 5 nap (ApCsel 20,6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km légvonalban${road ? `, ≈\u00a0${road}\u00a0km római\u00a0utakon` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, tengeren, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${hu(days, "nap", "nap")} (${ref ?? ""})`
      : ", tengeren",
  today: "Ma",
  english: "Angolul",
  ancient: "Ókori szerzőknél",
  untold: ", az útról nem szól a szöveg",
  life: "Fennállás ideje",
  ruins: "Romokban",
  events: "Események",
  battles: "Csaták és ostromok",
  article: "Történet",
  scripture: "Szentírás",
  sources: "Források",
  checked: "A cikk forrásokkal egyeztetve; történész még nem olvasta.",
  reviewed: "Történész olvasta",
  verses: (n: number) => `Versek (${String(n)})`,
  more: (n: number) => `még ${String(n)} a térképen`,
  tours: "Ezt a helyet érintő túrák",
  places: "Minden hely",
  skip: "Ugrás a tartalomra",
  sections: "Szakaszok",
  tour: "Túra",
  toursAll: "Minden túra",
  placesTitle: "A bibliai történelem helyei",
  disputed: "Vitatott helyszín",
  photoShows: (site: string) => `A képen: ${site}, a javasolt helyszínek egyike.`,
  toursTitle: "A bibliai történelem túrái",
  questions: "Kérdések",
  questionsTitle: "Kérdések a Biblia helyeiről és történetéről",
  question: "Kérdés",
  showMap: "Megjelenítés a térképen",
  checkedQ: "A válasz forrásokkal egyeztetve; történész még nem olvasta.",
  testament: { whole: "Az egész Biblia", ot: "Ószövetség", nt: "Újszövetség" },
  stop: "Megálló",
  translation: "Károli Biblia (revideált, 1908)",
  circa: "kb.",
  title: (n: string) => `${n} — hol található, története, bibliai versek`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) a bibliai történelem térképén: hol található ma, története és bibliai említései (${String(v)}).`,
  about: "A projektről",
  privacy: "Adatvédelem",
  allSources: "minden forrás",
  data: "Adatok",
  // The language switch is an icon: «Nyelv: English» names it for a pointer and a screen reader.
  language: "Nyelv",
  photo: "Fénykép",
  pd: "közkincs",
  licArticle: "A cikk szövege: © History Globe",
  licAnswer: "A válasz szövege: © History Globe",
} as const;

const LANDING_HU = {
  title: "Történelem egy földgömbön — a bibliai történelem atlasza",
  h1: "Történelem egy földgömbön",
  desc: "Ingyenes atlasz: a Biblia helyei egy 3D-s földgömbön, a körülöttük lévő államok évről évre, túrák, forrásokkal ellátott cikkek és eszközök a tanórához.",
  kicker: "Az első gyűjtemény: a bibliai történelem",
  lede: "Állítsa át az évet, és nézze, hogyan változnak a királyságok, a városok és a nevek.",
  open: "A földgömb megnyitása",
  tours: "Túrák",
  docs: "Dokumentáció",
  heroAlt:
    "A földgömb Kr. e. 701-ben: az Újasszír Birodalom Tírusztól Babilonig, Jeruzsálem, Damaszkusz, az idővonal",
  heroNote: "Kr. e. 701: Asszíria Tírusztól Babilonig",
  live: "A földgömb felfedezése",
  full: "Teljes képernyő",
  liveClose: "Kész",
  stats: ["hely", "túra", "cikk", "megválaszolt kérdés", "csata és ostrom"],
  rows: [
    [
      "Túrák",
      "Útvonalak az utak és a domborzat mentén",
      "Ábrahám, a kivonulás, Pál útjai: megállóról megállóra, verssel, a hely fényképével, a távolsággal és az út napjaival.",
      "Pál második útja",
      "A troászi megálló Pál második útján: az Égei-tenger a térképen, az útvonal, az út magassági profilja, fénykép a romokról",
    ],
    [
      "Helyek",
      "Minden hely a maga verseivel és forrásaival",
      "Hol van ma, kié volt a kiválasztott évben, és mely versek említik. Ami vitatott, azt vitatottnak nevezzük.",
      "Jeruzsálem megnyitása",
      "Jeruzsálem kártyája: fénykép, állapota Kr. u. 30-ban, a cikk; körülötte a júdeai hegyek több tucat bibliai hellyel",
    ],
    [
      "Tanórához",
      "Kvíz, saját tanóra, A4-es lap",
      "„Hol történt?” kvíz bármelyik túrához, saját tanóra egyetlen hivatkozásként, A4-re nyomtatható térképek.",
      "A kivonulás megnyitása",
      "Kvíz a kivonulásról: egy kérdés verssel és négy válasszal, az útvonal a térképen",
    ],
  ],
  cards: [
    [
      "Kérdések a háttérről",
      "Hol volt Ninive? Mennyi ideig utazott Pál Rómába? Válaszok térképpel és versekkel.",
      "Minden kérdés",
    ],
    [
      "Nyílt adatok",
      "CC BY 4.0, kulcs nélküli „vers → helyek” API és beágyazható földgömb.",
      "API és beágyazás",
    ],
    [
      "Fiók nélkül",
      "Nincs regisztráció, nincsenek sütik, nincs reklám. A térkép elmenthető és offline is használható.",
      "Adatvédelem",
    ],
  ],
  trust: "Nyílt adatokra építve",
  trustText:
    "A cikkek MI segítségével készülnek, és külön lépésben ellenőrizzük őket a források alapján; kutatók még nem lektorálták őket, és az oldal ezt nyíltan kimondja.",
  method: "Hogyan ellenőrizzük az adatokat",
  sources: "Minden forrás",
  ctaTitle: "Kezdje bármelyik évvel",
  ctaText: "Fiók nélkül, telefonon és számítógépen, {n} nyelven.",
} as const;

const LISTS_HU: ListWords = {
  placesLead: (n, k, a) => `${n} ${hu(k, "hely", "hely")}, ebből ${a} cikkel`,
  toursLead: (n, k) =>
    `${n} ${hu(k, "túra", "túra")}. A távolságokat a megállók között légvonalban mérjük.`,
  questionsLead: (n, k) =>
    `${n} ${hu(k, "megválaszolt kérdés", "megválaszolt kérdés")} a térképen, a Biblia könyveinek sorrendjében.`,
  all: "Mind",
  withArticle: "Cikkel",
  alphabet: "Betűrendben",
  partsNav: "A Biblia részei",
  findPlace: "Hely keresése",
  findQuestion: "Kérdés keresése",
  nothing: "Nincs találat",
  stops: (n) => `${String(n)}\u00a0${hu(n, "megálló", "megálló")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Mózes könyvei",
    history: "A történeti könyvek",
    prophets: "A próféták és a bölcsességi könyvek",
    gospels: "Az evangéliumok",
    acts: "Az apostolok cselekedetei",
    letters: "A levelek és a Jelenések könyve",
  },
  partsShort: {
    torah: "Mózes",
    history: "Történeti",
    prophets: "Próféták",
    gospels: "Evangéliumok",
    acts: "ApCsel",
    letters: "Levelek",
  },
};

// Suomi (drafted by machine translation; not yet read by a native speaker).
// Suomi (drafted by machine translation; not yet read by a native speaker).
/** A Finnish noun for a count: one or other («1 paikka», «5 paikkaa»; the other form is the partitive). */
const fi = (n: number, one: string, other: string) =>
  new Intl.PluralRules("fi").select(n) === "one" ? one : other;

const T_FI = {
  site: "History Globe — kartta Raamatun historiasta",
  open: "Avaa kartalla",
  tour_open: "Seuraa kierrosta kartalla",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "kartta",
  route_alt: (title: string) => `Reitin kartta: ${title}`,
  // The sea as the stop says it: «, meritse» or «, meritse, 5 päivää (Apt. 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km linnuntietä${road ? `, ≈\u00a0${road}\u00a0km Rooman\u00a0teitä\u00a0pitkin` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, meritse, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${fi(days, "päivä", "päivää")} (${ref ?? ""})`
      : ", meritse",
  today: "Nykyään",
  english: "Englanniksi",
  ancient: "Antiikin kirjoittajilla",
  untold: ", reittiä ei kuvata tekstissä",
  life: "Milloin paikka oli olemassa",
  ruins: "Raunioina",
  events: "Tapahtumat",
  battles: "Taistelut ja piiritykset",
  article: "Historia",
  scripture: "Raamattu",
  sources: "Lähteet",
  checked: "Artikkeli on tarkistettu lähteistä; historiantutkija ei ole vielä lukenut sitä.",
  reviewed: "Historiantutkijan lukema",
  verses: (n: number) => `Jakeet (${String(n)})`,
  more: (n: number) => `${String(n)} lisää kartalla`,
  tours: "Tämän paikan kautta kulkevat kierrokset",
  places: "Kaikki paikat",
  skip: "Siirry sisältöön",
  sections: "Osiot",
  tour: "Kierros",
  toursAll: "Kaikki kierrokset",
  placesTitle: "Raamatun historian paikat",
  disputed: "Kiistanalainen sijainti",
  photoShows: (site: string) => `Kuvassa: ${site}, yksi ehdotetuista sijaintipaikoista.`,
  toursTitle: "Kierrokset Raamatun historian halki",
  questions: "Kysymykset",
  questionsTitle: "Kysymyksiä Raamatun paikoista ja historiasta",
  question: "Kysymys",
  showMap: "Näytä kartalla",
  checkedQ: "Vastaus on tarkistettu lähteistä; historiantutkija ei ole vielä lukenut sitä.",
  testament: { whole: "Koko Raamattu", ot: "Vanha testamentti", nt: "Uusi testamentti" },
  stop: "Pysäkki",
  translation: "Raamattu 1933/1938",
  circa: "n.",
  title: (n: string) => `${n} — missä paikka sijaitsi, historia, Raamatun jakeet`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) Raamatun historian kartalla: missä paikka sijaitsee nykyään, sen historia ja maininnat Raamatussa (${String(v)}).`,
  about: "Hankkeesta",
  privacy: "Tietosuoja",
  allSources: "kaikki lähteet",
  data: "Data",
  // The language switch is an icon: «Kieli: English» names it for a pointer and a screen reader.
  language: "Kieli",
  photo: "Valokuva",
  pd: "tekijänoikeudeton",
  licArticle: "Artikkelin teksti: © History Globe",
  licAnswer: "Vastauksen teksti: © History Globe",
} as const;

const LANDING_FI = {
  title: "Historia maapallolla — Raamatun historian atlas",
  h1: "Historia maapallolla",
  desc: "Ilmainen atlas: Raamatun paikat 3D-maapallolla, niitä ympäröivät valtiot vuosi vuodelta, kierrokset, lähteillä varustetut artikkelit ja työkalut oppituntia varten.",
  kicker: "Ensimmäinen kokoelma: Raamatun historia",
  lede: "Siirrä vuotta ja katso, miten valtakunnat, kaupungit ja nimet muuttuvat.",
  open: "Avaa maapallo",
  tours: "Kierrokset",
  docs: "Dokumentaatio",
  heroAlt:
    "Maapallo vuonna 701 eaa.: Uusassyrian valtakunta Tyroksesta Babyloniin, Jerusalem, Damaskos, aikajana",
  heroNote: "701 eaa.: Assyria Tyroksesta Babyloniin",
  live: "Tutki maapalloa",
  full: "Koko näyttö",
  liveClose: "Valmis",
  stats: [
    "paikkaa",
    "kierrosta",
    "artikkelia",
    "kysymystä vastauksineen",
    "taistelua ja piiritystä",
  ],
  rows: [
    [
      "Kierrokset",
      "Reittejä teitä ja maastoa pitkin",
      "Abraham, Egyptistä lähtö, Paavalin matkat: pysäkki pysäkiltä jae, valokuva paikasta, etäisyys ja matkaan kuluneet päivät.",
      "Paavalin toinen matka",
      "Troaksen pysäkki Paavalin toisella matkalla: Egeanmeri kartalla, reitti, tien korkeusprofiili, valokuva raunioista",
    ],
    [
      "Paikat",
      "Jokainen paikka jakeineen ja lähteineen",
      "Missä se sijaitsee nykyään, kenelle se kuului valittuna vuonna ja kaikki sen mainitsevat jakeet. Kiistanalainen merkitään kiistanalaiseksi.",
      "Avaa Jerusalem",
      "Jerusalemin kortti: valokuva, valtio, johon se kuului vuonna 30 jaa., artikkeli; ympärillä Juudean vuoristo ja kymmeniä Raamatun paikkoja",
    ],
    [
      "Oppituntia varten",
      "Tietovisa, oma oppitunti, A4-arkit",
      "Tietovisa ”Missä se tapahtui?” miltä tahansa kierrokselta, oma oppitunti yhtenä linkkinä, tulostettavia karttoja A4-arkille.",
      "Avaa Egyptistä lähtö",
      "Tietovisa Egyptistä lähdöstä: kysymys jakeineen ja neljä vastausvaihtoehtoa, reitti kartalla",
    ],
  ],
  cards: [
    [
      "Kysymyksiä asiayhteydestä",
      "Missä Ninive sijaitsi? Kuinka kauan Paavalin matka Roomaan kesti? Vastaukset kartan ja jakeiden kera.",
      "Kaikki kysymykset",
    ],
    [
      "Avoin data",
      "CC BY 4.0, avaimeton ”jae → paikat” -rajapinta ja maapallo, jonka voi upottaa sivulle.",
      "Rajapinta ja upotus",
    ],
    [
      "Ei tiliä",
      "Ei rekisteröitymistä, ei evästeitä, ei mainoksia. Kartan voi tallentaa ja käyttää offline-tilassa.",
      "Tietosuoja",
    ],
  ],
  trust: "Rakennettu avoimen datan varaan",
  trustText:
    "Artikkelit kirjoitetaan tekoälyn avulla ja tarkistetaan lähteistä erillisessä vaiheessa; tutkijat eivät ole vielä tarkastaneet niitä, ja sivusto sanoo sen avoimesti.",
  method: "Miten data tarkistetaan",
  sources: "Kaikki lähteet",
  ctaTitle: "Aloita mistä vuodesta tahansa",
  ctaText: "Ilman tiliä, puhelimella ja tietokoneella, {n} kielellä.",
} as const;

const LISTS_FI: ListWords = {
  placesLead: (n, k, a) => `${n} ${fi(k, "paikka", "paikkaa")}, artikkeli ${a} paikasta`,
  toursLead: (n, k) =>
    `${n} ${fi(k, "kierros", "kierrosta")}. Etäisyydet on mitattu linnuntietä pysäkkien välillä.`,
  questionsLead: (n, k) =>
    `${n} ${fi(k, "kysymys", "kysymystä")} vastauksineen kartalla, Raamatun kirjojen järjestyksessä.`,
  all: "Kaikki",
  withArticle: "Joilla on artikkeli",
  alphabet: "Aakkosjärjestyksessä",
  partsNav: "Raamatun osat",
  findPlace: "Etsi paikka",
  findQuestion: "Etsi kysymys",
  nothing: "Mitään ei löytynyt",
  stops: (n) => `${String(n)}\u00a0${fi(n, "pysäkki", "pysäkkiä")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Mooseksen kirjat",
    history: "Historiakirjat",
    prophets: "Profeetat ja viisauskirjat",
    gospels: "Evankeliumit",
    acts: "Apostolien teot",
    letters: "Kirjeet ja Ilmestyskirja",
  },
  partsShort: {
    torah: "Moos",
    history: "Historia",
    prophets: "Profeetat",
    gospels: "Evankeliumit",
    acts: "Apt",
    letters: "Kirjeet",
  },
};

// Tiếng Việt (drafted by machine translation; not yet read by a native speaker).
// Tiếng Việt (drafted by machine translation; not yet read by a native speaker).
// Vietnamese has one plural category ("other"), so no count helper is needed.

const T_VI = {
  site: "History Globe — bản đồ lịch sử Kinh Thánh",
  open: "Mở trên bản đồ",
  tour_open: "Đi theo hành trình trên bản đồ",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "bản đồ",
  route_alt: (title: string) => `Bản đồ lộ trình: ${title}`,
  // The sea as the stop says it: «, bằng đường biển» or «, bằng đường biển, 5 ngày (Công 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km theo đường chim bay${road ? `, ≈\u00a0${road}\u00a0km theo\u00a0đường\u00a0La\u00a0Mã` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, bằng đường biển, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0ngày (${ref ?? ""})`
      : ", bằng đường biển",
  today: "Ngày nay",
  english: "Bằng tiếng Anh",
  ancient: "Theo các tác giả cổ đại",
  untold: ", văn bản không nói rõ đường đi",
  life: "Khi địa điểm còn tồn tại",
  ruins: "Đổ nát",
  events: "Sự kiện",
  battles: "Các trận đánh và cuộc vây hãm",
  article: "Lịch sử",
  scripture: "Kinh Thánh",
  sources: "Nguồn",
  checked: "Bài viết đã được đối chiếu với các nguồn; chưa có nhà sử học nào đọc.",
  reviewed: "Đã được một nhà sử học duyệt",
  verses: (n: number) => `Các câu Kinh Thánh (${String(n)})`,
  more: (n: number) => `thêm ${String(n)} địa điểm trên bản đồ`,
  tours: "Các hành trình đi qua địa điểm này",
  places: "Tất cả địa điểm",
  skip: "Chuyển đến nội dung",
  sections: "Các phần",
  tour: "Hành trình",
  toursAll: "Tất cả hành trình",
  placesTitle: "Các địa điểm trong lịch sử Kinh Thánh",
  disputed: "Vị trí còn tranh cãi",
  photoShows: (site: string) => `Trong ảnh: ${site}, một trong những vị trí được đề xuất.`,
  toursTitle: "Các hành trình qua lịch sử Kinh Thánh",
  questions: "Câu hỏi",
  questionsTitle: "Câu hỏi về các địa điểm và lịch sử Kinh Thánh",
  question: "Câu hỏi",
  showMap: "Hiện trên bản đồ",
  checkedQ: "Câu trả lời đã được đối chiếu với các nguồn; chưa có nhà sử học nào đọc.",
  testament: { whole: "Toàn bộ Kinh Thánh", ot: "Cựu Ước", nt: "Tân Ước" },
  stop: "Chặng",
  translation: "Kinh Thánh, bản dịch Cadman (1925)",
  circa: "khoảng",
  title: (n: string) => `${n} — vị trí, lịch sử, các câu Kinh Thánh`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) trên bản đồ lịch sử Kinh Thánh: vị trí ngày nay, lịch sử và những lần được nhắc đến trong Kinh Thánh (${String(v)}).`,
  about: "Về dự án",
  privacy: "Quyền riêng tư",
  allSources: "tất cả nguồn",
  data: "Dữ liệu",
  // The language switch is an icon: «Ngôn ngữ: English» names it for a pointer and a screen reader.
  language: "Ngôn ngữ",
  photo: "Ảnh",
  pd: "phạm vi công cộng",
  licArticle: "Nội dung bài viết: © History Globe",
  licAnswer: "Nội dung câu trả lời: © History Globe",
} as const;

const LANDING_VI = {
  title: "Lịch sử trên quả địa cầu — tập bản đồ lịch sử Kinh Thánh",
  h1: "Lịch sử trên quả địa cầu",
  desc: "Tập bản đồ miễn phí: các địa điểm Kinh Thánh trên quả địa cầu 3D, các nước xung quanh theo từng năm, hành trình, bài viết có nguồn và công cụ cho tiết học.",
  kicker: "Bộ sưu tập đầu tiên: lịch sử Kinh Thánh",
  lede: "Kéo thanh thời gian và xem các vương quốc, thành phố và tên gọi thay đổi ra sao.",
  open: "Mở quả địa cầu",
  tours: "Hành trình",
  docs: "Tài liệu",
  heroAlt:
    "Quả địa cầu năm 701 TCN: Đế quốc Tân A-si-ri từ Ty-rơ đến Ba-by-lôn, Giê-ru-sa-lem, Đa-mách, dòng thời gian",
  heroNote: "Năm 701 TCN: A-si-ri từ Ty-rơ đến Ba-by-lôn",
  live: "Khám phá quả địa cầu",
  full: "Toàn màn hình",
  liveClose: "Xong",
  stats: ["địa điểm", "hành trình", "bài viết", "câu hỏi có đáp án", "trận đánh và cuộc vây hãm"],
  rows: [
    [
      "Hành trình",
      "Lộ trình theo đường sá và địa hình",
      "Áp-ra-ham, cuộc Xuất hành, các chuyến đi của Phao-lô: từng chặng, kèm câu Kinh Thánh, ảnh địa điểm, khoảng cách và số ngày đi đường.",
      "Chuyến đi thứ hai của Phao-lô",
      "Chặng Trô-ách trong chuyến đi thứ hai của Phao-lô: biển Aegea trên bản đồ, lộ trình, mặt cắt độ cao của đường, ảnh tàn tích",
    ],
    [
      "Địa điểm",
      "Mỗi địa điểm với các câu Kinh Thánh và nguồn",
      "Nơi đó nằm ở đâu ngày nay, thuộc về ai vào năm đã chọn và mọi câu Kinh Thánh nhắc đến. Điều còn tranh cãi được ghi rõ là còn tranh cãi.",
      "Mở Giê-ru-sa-lem",
      "Thẻ Giê-ru-sa-lem: ảnh, tình trạng năm 30, bài viết; xung quanh là vùng núi Giu-đê với hàng chục địa điểm Kinh Thánh",
    ],
    [
      "Cho tiết học",
      "Trắc nghiệm, bài học riêng, tờ A4",
      "Trắc nghiệm “Việc này xảy ra ở đâu?” trên mọi hành trình, bài học riêng chỉ bằng một liên kết, bản đồ để in trên giấy A4.",
      "Mở cuộc Xuất hành",
      "Trắc nghiệm về cuộc Xuất hành: một câu hỏi với một câu Kinh Thánh và bốn đáp án, lộ trình trên bản đồ",
    ],
  ],
  cards: [
    [
      "Câu hỏi về bối cảnh",
      "Ni-ni-ve nằm ở đâu? Phao-lô đi đến Rô-ma mất bao lâu? Đáp án kèm bản đồ và các câu Kinh Thánh.",
      "Tất cả câu hỏi",
    ],
    [
      "Dữ liệu mở",
      "CC BY 4.0, API “câu Kinh Thánh → địa điểm” không cần khóa và quả địa cầu để nhúng vào trang web.",
      "API và nhúng",
    ],
    [
      "Không cần tài khoản",
      "Không đăng ký, không cookie, không quảng cáo. Bản đồ có thể lưu lại và dùng ngoại tuyến.",
      "Quyền riêng tư",
    ],
  ],
  trust: "Xây dựng trên dữ liệu mở",
  trustText:
    "Các bài viết được soạn với sự hỗ trợ của AI và đối chiếu với nguồn ở một bước riêng; các nhà nghiên cứu chưa duyệt chúng, và trang web nói rõ điều này.",
  method: "Dữ liệu được kiểm tra thế nào",
  sources: "Tất cả nguồn",
  ctaTitle: "Hãy bắt đầu từ bất kỳ năm nào",
  ctaText: "Không cần tài khoản, trên điện thoại và máy tính, bằng {n} ngôn ngữ.",
} as const;

const LISTS_VI: ListWords = {
  placesLead: (n, _k, a) => `${n} địa điểm, trong đó ${a} có bài viết`,
  toursLead: (n) => `${n} hành trình. Khoảng cách tính theo đường chim bay giữa các chặng.`,
  questionsLead: (n) =>
    `${n} câu hỏi có đáp án trên bản đồ, theo thứ tự các sách trong Kinh Thánh.`,
  all: "Tất cả",
  withArticle: "Có bài viết",
  alphabet: "Theo bảng chữ cái",
  partsNav: "Các phần của Kinh Thánh",
  findPlace: "Tìm một địa điểm",
  findQuestion: "Tìm một câu hỏi",
  nothing: "Không tìm thấy gì",
  stops: (n) => `${String(n)}\u00a0chặng`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Ngũ Kinh",
    history: "Các sách lịch sử",
    prophets: "Các sách tiên tri và sách khôn ngoan",
    gospels: "Các sách Phúc Âm",
    acts: "Công vụ các Sứ đồ",
    letters: "Các thư tín và Khải huyền",
  },
  partsShort: {
    torah: "Ngũ Kinh",
    history: "Lịch sử",
    prophets: "Tiên tri",
    gospels: "Phúc Âm",
    acts: "Công vụ",
    letters: "Thư tín",
  },
};

// Română (drafted by machine translation; not yet read by a native speaker).
// Română (drafted by machine translation; not yet read by a native speaker).
/** A Romanian noun for a count: one, few, other («1 loc», «5 locuri», «20 de locuri»). */
const ro = (n: number, one: string, few: string, other: string) => {
  const c = new Intl.PluralRules("ro").select(n);
  return c === "one" ? one : c === "few" ? few : other;
};

const T_RO = {
  site: "History Globe — o hartă a istoriei biblice",
  open: "Deschide pe hartă",
  tour_open: "Urmărește traseul pe hartă",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "hartă",
  route_alt: (title: string) => `Harta traseului: ${title}`,
  // The sea as the stop says it: «, pe mare» or «, pe mare, 5 zile (Fapte 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0km în\u00a0linie\u00a0dreaptă${road ? `, ≈\u00a0${road}\u00a0km pe\u00a0drumuri\u00a0romane` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, pe mare, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${ro(days, "zi", "zile", "de\u00a0zile")} (${ref ?? ""})`
      : ", pe mare",
  today: "Astăzi",
  english: "În engleză",
  ancient: "La autorii antici",
  untold: ", drumul nu este descris în text",
  life: "Când exista locul",
  ruins: "În ruine",
  events: "Evenimente",
  battles: "Bătălii și asedii",
  article: "Istorie",
  scripture: "Scriptura",
  sources: "Surse",
  checked: "Articolul a fost verificat cu sursele; încă nu l-a citit un istoric.",
  reviewed: "Citit de un istoric",
  verses: (n: number) => `Versete (${String(n)})`,
  more: (n: number) => `încă ${String(n)} pe hartă`,
  tours: "Trasee prin acest loc",
  places: "Toate locurile",
  skip: "Sari la conținut",
  sections: "Secțiuni",
  tour: "Traseu",
  toursAll: "Toate traseele",
  placesTitle: "Locuri din istoria biblică",
  disputed: "Amplasare disputată",
  photoShows: (site: string) => `În imagine: ${site}, una dintre amplasările propuse.`,
  toursTitle: "Trasee prin istoria biblică",
  questions: "Întrebări",
  questionsTitle: "Întrebări despre locurile și istoria Bibliei",
  question: "Întrebare",
  showMap: "Arată pe hartă",
  checkedQ: "Răspunsul a fost verificat cu sursele; încă nu l-a citit un istoric.",
  testament: { whole: "Toată Biblia", ot: "Vechiul Testament", nt: "Noul Testament" },
  stop: "Oprire",
  translation: "Biblia 1914 (ediția Sfântului Sinod)",
  circa: "cca",
  title: (n: string) => `${n} — unde se afla, istorie, versete biblice`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) pe harta istoriei biblice: unde se află astăzi, istoria sa și mențiunile din Biblie (${String(v)}).`,
  about: "Despre proiect",
  privacy: "Confidențialitate",
  allSources: "toate sursele",
  data: "Date",
  // The language switch is an icon: «Limba: English» names it for a pointer and a screen reader.
  language: "Limba",
  photo: "Fotografie",
  pd: "domeniu public",
  licArticle: "Textul articolului: © History Globe",
  licAnswer: "Textul răspunsului: © History Globe",
} as const;

const LANDING_RO = {
  title: "Istoria pe un glob — un atlas al istoriei biblice",
  h1: "Istoria pe un glob",
  desc: "Un atlas gratuit: locurile Bibliei pe un glob 3D, statele din jurul lor an de an, trasee, articole cu surse și instrumente pentru lecție.",
  kicker: "Prima colecție: istoria biblică",
  lede: "Mută anul și vezi cum se schimbă regatele, orașele și numele.",
  open: "Deschide globul",
  tours: "Trasee",
  docs: "Documentație",
  heroAlt:
    "Globul în anul 701 î.Hr.: Imperiul neoasirian de la Tir la Babilon, Ierusalim, Damasc, cronologia",
  heroNote: "701 î.Hr.: Asiria de la Tir la Babilon",
  live: "Explorează globul",
  full: "Ecran complet",
  liveClose: "Gata",
  stats: ["locuri", "trasee", "articole", "întrebări cu răspuns", "bătălii și asedii"],
  rows: [
    [
      "Trasee",
      "Itinerare pe drumuri și pe relief",
      "Avraam, Exodul, călătoriile lui Pavel: oprire cu oprire, cu versetul, o fotografie a locului, distanța și zilele de drum.",
      "A doua călătorie a lui Pavel",
      "Oprirea Troa din a doua călătorie a lui Pavel: Marea Egee pe hartă, traseul, profilul altitudinii drumului, o fotografie a ruinelor",
    ],
    [
      "Locuri",
      "Fiecare loc cu versetele și sursele sale",
      "Unde se află astăzi, cui aparținea în anul ales și toate versetele care îl pomenesc. Ce este disputat se numește disputat.",
      "Deschide Ierusalimul",
      "Fișa Ierusalimului: fotografie, starea lui în anul 30 d.Hr., articolul; împrejur, munții Iudeii cu zeci de locuri biblice",
    ],
    [
      "Pentru lecție",
      "Test, lecție proprie, fișe A4",
      "Testul „Unde s-a întâmplat?” pe orice traseu, o lecție proprie sub forma unui singur link, hărți de tipărit pe A4.",
      "Deschide Exodul",
      "Test despre Exod: o întrebare cu un verset și patru răspunsuri, traseul pe hartă",
    ],
  ],
  cards: [
    [
      "Întrebări despre context",
      "Unde se afla Ninive? Cât a durat drumul lui Pavel spre Roma? Răspunsuri cu hartă și versete.",
      "Toate întrebările",
    ],
    [
      "Date deschise",
      "CC BY 4.0, un API „verset → locuri” fără cheie și un glob de inclus într-o pagină.",
      "API și încorporare",
    ],
    [
      "Fără cont",
      "Fără înregistrare, fără cookie-uri, fără reclame. Harta poate fi salvată și folosită fără internet.",
      "Confidențialitate",
    ],
  ],
  trust: "Construit pe date deschise",
  trustText:
    "Articolele sunt scrise cu ajutorul IA și verificate cu sursele într-un pas separat; cercetătorii nu le-au recenzat încă, iar pagina spune acest lucru deschis.",
  method: "Cum se verifică datele",
  sources: "Toate sursele",
  ctaTitle: "Începe cu orice an",
  ctaText: "Fără cont, pe telefon și pe computer, în {n} de limbi.",
} as const;

const LISTS_RO: ListWords = {
  placesLead: (n, k, a) =>
    `${n} ${ro(k, "loc", "locuri", "de locuri")}, dintre care ${a} cu articol`,
  toursLead: (n, k) =>
    `${n} ${ro(k, "traseu", "trasee", "de trasee")}. Distanțele sunt în linie dreaptă între opriri.`,
  questionsLead: (n, k) =>
    `${n} ${ro(k, "întrebare cu răspuns", "întrebări cu răspuns", "de întrebări cu răspuns")} pe hartă, în ordinea cărților Bibliei.`,
  all: "Toate",
  withArticle: "Cu articol",
  alphabet: "Alfabetic",
  partsNav: "Părțile Bibliei",
  findPlace: "Caută un loc",
  findQuestion: "Caută o întrebare",
  nothing: "Nu s-a găsit nimic",
  stops: (n) => `${String(n)}\u00a0${ro(n, "oprire", "opriri", "de\u00a0opriri")}`,
  km: (n) => `≈\u00a0${n}\u00a0km`,
  parts: {
    torah: "Cărțile lui Moise",
    history: "Cărțile istorice",
    prophets: "Profeții și cărțile de înțelepciune",
    gospels: "Evangheliile",
    acts: "Faptele Apostolilor",
    letters: "Epistolele și Apocalipsa",
  },
  partsShort: {
    torah: "Moise",
    history: "Istorie",
    prophets: "Profeții",
    gospels: "Evangheliile",
    acts: "Fapte",
    letters: "Epistolele",
  },
};

// Български (drafted by machine translation; not yet read by a native speaker).
/** A Bulgarian noun for a count: one, other («1 място», «5 места»). */
const bg = (n: number, one: string, other: string) =>
  new Intl.PluralRules("bg").select(n) === "one" ? one : other;

const BG_DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "ден" };

const T_BG = {
  site: "History Globe — карта на библейската история",
  open: "Отваряне на картата",
  tour_open: "Следване на маршрута на картата",
  // A tour page's title in search results: "Paul's first journey — map".
  tour_map: "карта",
  route_alt: (title: string) => `Карта на маршрута: ${title}`,
  // The sea as the stop says it: «, по море» or «, по море, 5 дни (Деян. 20:6)».
  leg: (km: string, road: string | null, sea: string) =>
    `≈\u00a0${km}\u00a0км по права линия${road ? `, ≈\u00a0${road}\u00a0км по\u00a0римски\u00a0пътища` : ""}${sea}`,
  sea: (days?: number, ref?: string, about?: boolean) =>
    days
      ? `, по море, ${about ? "≈\u00a0" : ""}${String(days)}\u00a0${BG_DAYS[new Intl.PluralRules("bg").select(days)] ?? "дни"} (${ref ?? ""})`
      : ", по море",
  today: "Днес",
  english: "На английски",
  ancient: "При древните автори",
  untold: ", пътят не е описан",
  life: "Докога е съществувало",
  ruins: "В развалини",
  events: "Събития",
  battles: "Битки и обсади",
  article: "История",
  scripture: "Писание",
  sources: "Източници",
  checked: "Статията е сверена с източниците; още не е прочетена от историк.",
  reviewed: "Прочетена от историк",
  verses: (n: number) => `Стихове (${String(n)})`,
  more: (n: number) => `още ${String(n)} на картата`,
  tours: "Маршрути през това място",
  places: "Всички места",
  skip: "Към съдържанието",
  sections: "Раздели",
  tour: "Маршрут",
  toursAll: "Всички маршрути",
  placesTitle: "Места в библейската история",
  disputed: "Спорно местоположение",
  photoShows: (site: string) => `На снимката: ${site}, едно от предлаганите места.`,
  toursTitle: "Маршрути през библейската история",
  questions: "Въпроси",
  questionsTitle: "Въпроси за местата и историята на Библията",
  question: "Въпрос",
  showMap: "Показване на картата",
  checkedQ: "Отговорът е сверен с източниците; още не е прочетен от историк.",
  testament: { whole: "Цялата Библия", ot: "Стар завет", nt: "Нов завет" },
  stop: "Спирка",
  translation: "Цариградска Библия (1871)",
  circa: "ок.",
  title: (n: string) => `${n} — къде се е намирало, история, библейски стихове`,
  desc: (n: string, k: string, v: number) =>
    `${n} (${k}) на картата на библейската история: къде се намира мястото днес, неговата история и споменаванията му в Библията (${String(v)}).`,
  about: "За проекта",
  privacy: "Поверителност",
  allSources: "всички източници",
  data: "Данни",
  // The language switch is an icon: «Език: English» names it for a pointer and a screen reader.
  language: "Език",
  photo: "Снимка",
  pd: "обществено достояние",
  licArticle: "Текст на статията: © History Globe",
  licAnswer: "Текст на отговора: © History Globe",
} as const;

const LANDING_BG = {
  title: "История на един глобус — атлас на библейската история",
  h1: "История на един глобус",
  desc: "Безплатен атлас: библейските места на 3D глобус, държавите около тях година след година, маршрути, статии с източници и инструменти за урока.",
  kicker: "Първата колекция: библейската история",
  lede: "Променяйте годината и гледайте как царства, градове и имена се менят.",
  open: "Отваряне на глобуса",
  tours: "Маршрути",
  docs: "Документация",
  heroAlt:
    "Глобусът през 701 г. пр.н.е.: Новоасирийското царство от Тир до Вавилон, Йерусалим, Дамаск, времевата скала",
  heroNote: "701 г. пр.н.е.: Асирия от Тир до Вавилон",
  live: "Разгледайте глобуса",
  full: "Цял екран",
  liveClose: "Готово",
  stats: ["места", "маршрута", "статии", "отговорени въпроса", "битки и обсади"],
  rows: [
    [
      "Маршрути",
      "Маршрути по пътищата и терена",
      "Авраам, Изходът, пътуванията на Павел: спирка по спирка, със стиха, снимка на мястото, разстоянието и дните в пътя.",
      "Второто пътуване на Павел",
      "Спирката Троада от второто пътуване на Павел: Егейско море на картата, маршрутът, височинният профил на пътя, снимка на развалините",
    ],
    [
      "Места",
      "Всяко място със своите стихове и източници",
      "Къде се намира днес, на кого е принадлежало през избраната година и всички стихове, които го споменават. Спорното е наречено спорно.",
      "Отваряне на Йерусалим",
      "Картата на Йерусалим: снимка, състоянието му през 30 г. н.е., статията; наоколо Юдейските планини с десетки библейски места",
    ],
    [
      "За урока",
      "Викторина, собствен урок, листове A4",
      "Викторината „Къде се е случило?“ към всеки маршрут, собствен урок като една връзка, карти за печат на A4.",
      "Отваряне на Изхода",
      "Викторина за Изхода: въпрос със стих и четири отговора, маршрутът на картата",
    ],
  ],
  cards: [
    [
      "Въпроси за контекста",
      "Къде се е намирала Ниневия? Колко време е пътувал Павел до Рим? Отговори с карта и стихове.",
      "Всички въпроси",
    ],
    [
      "Отворени данни",
      "CC BY 4.0, API „стих → места“ без ключ и глобус за вграждане в страница.",
      "API и вграждане",
    ],
    [
      "Без профил",
      "Без регистрация, без бисквитки, без реклами. Картата може да се запази и да се ползва без връзка.",
      "Поверителност",
    ],
  ],
  trust: "Изградено върху отворени данни",
  trustText:
    "Статиите се пишат с помощта на изкуствен интелект и се сверяват с източниците на отделна стъпка; учени още не са ги рецензирали и сайтът го казва открито.",
  method: "Как се проверяват данните",
  sources: "Всички източници",
  ctaTitle: "Започнете с коя да е година",
  ctaText: "Без профил, на телефон и компютър, на {n} езика.",
} as const;

const LISTS_BG: ListWords = {
  placesLead: (n, k, a) => `${n} ${bg(k, "място", "места")}, от тях ${a} със статия`,
  toursLead: (n, k) =>
    `${n} ${bg(k, "маршрут", "маршрута")}. Разстоянията са по права линия между спирките.`,
  questionsLead: (n, k) =>
    `${n} ${bg(k, "отговорен въпрос", "отговорени въпроса")} на картата, по реда на книгите в Библията.`,
  all: "Всички",
  withArticle: "Със статия",
  alphabet: "По азбучен ред",
  partsNav: "Части на Библията",
  findPlace: "Намерете място",
  findQuestion: "Намерете въпрос",
  nothing: "Не е намерено нищо",
  stops: (n) => `${String(n)}\u00a0${bg(n, "спирка", "спирки")}`,
  km: (n) => `≈\u00a0${n}\u00a0км`,
  parts: {
    torah: "Петокнижието",
    history: "Историческите книги",
    prophets: "Пророците и книгите на мъдростта",
    gospels: "Евангелията",
    acts: "Деяния на апостолите",
    letters: "Посланията и Откровение",
  },
  partsShort: {
    torah: "Мойсей",
    history: "История",
    prophets: "Пророци",
    gospels: "Евангелия",
    acts: "Деяния",
    letters: "Послания",
  },
};

export const T = {
  bg: T_BG,
  ro: T_RO,
  vi: T_VI,
  fi: T_FI,
  hu: T_HU,
  sv: T_SV,
  da: T_DA,
  nb: T_NB,
  sr: T_SR,
  tl: T_TL,
  cs: T_CS,
  pl: T_PL,
  nl: T_NL,
  it: T_IT,
  fr: T_FR,
  de: T_DE,
  pt: T_PT,
  es: T_ES,
  uk: T_UK,
  ru: {
    site: "History Globe — карта библейской истории",
    open: "Открыть на карте",
    tour_open: "Пройти экскурсию на карте",
    // A tour page's title in search results: "Paul's first journey — map".
    tour_map: "карта",
    route_alt: (title: string) => `Карта маршрута: ${title}`,
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
    licArticle: "Текст статьи: © History Globe",
    licAnswer: "Текст ответа: © History Globe",
  },
  en: {
    site: "History Globe — a map of biblical history",
    open: "Open on the map",
    tour_open: "Take the tour on the map",
    // A tour page's title in search results: "Paul's first journey — map".
    tour_map: "map",
    route_alt: (title: string) => `Map of the route: ${title}`,
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
    life: "Existed",
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
    // The site's own texts (ADR 0016); the footer adds the licence, linked.
    licArticle: "Article text: © History Globe",
    licAnswer: "Answer text: © History Globe",
  },
} as const;

// The front page of each language (/ru/, /en/): what the globe is, for a reader who comes
// from a search or a link, with the way into the map. The map itself stays at the root.
// Short on purpose: the pictures show what the words would only describe.
export const LANDING = {
  bg: LANDING_BG,
  ro: LANDING_RO,
  vi: LANDING_VI,
  fi: LANDING_FI,
  hu: LANDING_HU,
  sv: LANDING_SV,
  da: LANDING_DA,
  nb: LANDING_NB,
  sr: LANDING_SR,
  tl: LANDING_TL,
  cs: LANDING_CS,
  pl: LANDING_PL,
  nl: LANDING_NL,
  it: LANDING_IT,
  fr: LANDING_FR,
  de: LANDING_DE,
  pt: LANDING_PT,
  es: LANDING_ES,
  uk: LANDING_UK,
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
    ctaText: "Без регистрации, на телефоне и на компьютере. Языков: {n}.",
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
    ctaText: "No account, on a phone or a computer, in {n} languages.",
  },
} as const;

/**
 * Compiled, never run: every site language has a block, and each block (a language's still
 * waiting to join among them) names every word the English one does and no other. A missing
 * or extra word fails the typecheck.
 */
type SameWords<D extends Record<string, object>> = {
  [L in SiteLocale | (keyof D & Locale)]: L extends keyof D
    ? keyof D["en"] extends keyof D[L]
      ? keyof D[L] extends keyof D["en"]
        ? true
        : never
      : never
    : never;
};
export const WORDS_COMPLETE: SameWords<typeof T> & SameWords<typeof LANDING> = {
  bg: true,
  ro: true,
  vi: true,
  fi: true,
  hu: true,
  sv: true,
  da: true,
  nb: true,
  sr: true,
  tl: true,
  cs: true,
  pl: true,
  nl: true,
  it: true,
  fr: true,
  de: true,
  pt: true,
  es: true,
  uk: true,
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
  /** The name of the bar that jumps to a part of the Bible (the header nav is "Sections"). */
  partsNav: string;
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
export const LISTS: Record<SiteLocale, ListWords> & Partial<Record<Locale, ListWords>> = {
  bg: LISTS_BG,
  ro: LISTS_RO,
  vi: LISTS_VI,
  fi: LISTS_FI,
  hu: LISTS_HU,
  sv: LISTS_SV,
  da: LISTS_DA,
  nb: LISTS_NB,
  sr: LISTS_SR,
  tl: LISTS_TL,
  cs: LISTS_CS,
  pl: LISTS_PL,
  nl: LISTS_NL,
  it: LISTS_IT,
  fr: LISTS_FR,
  de: LISTS_DE,
  pt: LISTS_PT,
  es: LISTS_ES,
  uk: LISTS_UK,
  ru: {
    placesLead: (n, k, a) => `${n} ${ru(k, "место", "места", "мест")}, ${a} со статьёй`,
    toursLead: (n, k) =>
      `${n} ${ru(k, "экскурсия", "экскурсии", "экскурсий")}. Расстояние — по прямой между остановками.`,
    questionsLead: (n, k) =>
      `${n} ${ru(k, "вопрос", "вопроса", "вопросов")} с ответом на карте, в порядке книг Библии.`,
    all: "Все",
    withArticle: "Со статьёй",
    alphabet: "По алфавиту",
    partsNav: "Части Библии",
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
    partsNav: "Parts of the Bible",
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
