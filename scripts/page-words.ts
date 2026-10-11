/**
 * The words of the static pages (build-pages.ts), one block per site language. A language
 * joins the site with its block here: the types make the compiler ask for every word, and
 * the counted ones (days at sea, verses) choose their plural form by the language's rules.
 */
import type { SiteLocale } from "../packages/model/src/time.ts";
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
  translation: "Переклад П. Куліша (1871)",
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
  ctaText: "Без реєстрації, на телефоні й на комп’ютері, багатьма мовами.",
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
  ctaText: "Sin cuenta, en el móvil o en el ordenador, en varios idiomas.",
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
  ctaText: "Sem conta, no celular ou no computador, em vários idiomas.",
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
  ctaText: "Ohne Konto, auf dem Handy oder am Computer, in mehreren Sprachen.",
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
  ctaText: "Sans compte, sur téléphone ou sur ordinateur, en plusieurs langues.",
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

export const T = {
  fr: T_FR,
  de: T_DE,
  pt: T_PT,
  es: T_ES,
  uk: T_UK,
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
