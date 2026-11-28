/**
 * The words of the blocks place-related.ts adds to the static pages, in every language of
 * the site (ADR 0015): the nearby places, the map's alt text and the breadcrumb's label.
 * The map's caption reuses the app's own words (place.rulers, layers.borders).
 */
import type { SiteLocale } from "../packages/model/src/locales.ts";

export interface RelatedWords {
  /** The heading over the nearby places. */
  readonly nearby: string;
  /** The line under them: how the distances are measured. */
  readonly nearbyNote: string;
  /** "Map", before the credits of its data. */
  readonly map: string;
  /** The map's alt text. */
  readonly mapAlt: (name: string) => string;
  /** The label of the breadcrumb's list, for a screen reader. */
  readonly crumbs: string;
  /** A colon and a semicolon with the spaces the language writes around them. */
  readonly colon: string;
  readonly semicolon: string;
}

/** French puts a narrow no-break space before : and ; (as typeset.ts sets the text). */
const PUNCT = { colon: ": ", semicolon: "; " } as const;
const PUNCT_FR = { colon: "\u202f: ", semicolon: "\u202f; " } as const;
/** Ukrainian "and": «й» after a vowel, «і» after a consonant (милозвучність). */
const ukAnd = (name: string) => (/[аеєиіїоуюя]$/iu.test(name) ? "й" : "і");

export const RELATED: Record<SiteLocale, RelatedWords> = {
  en: {
    nearby: "Nearby places",
    nearbyNote: "Straight-line distances between the points on our map.",
    map: "Map",
    mapAlt: (n) => `Map: ${n} and its surroundings`,
    crumbs: "Breadcrumb",
    ...PUNCT,
  },
  ru: {
    nearby: "Места поблизости",
    nearbyNote: "Расстояния по прямой между точками на нашей карте.",
    map: "Карта",
    mapAlt: (n) => `Карта: ${n} и окрестности`,
    crumbs: "Путь по сайту",
    ...PUNCT,
  },
  uk: {
    nearby: "Місця поблизу",
    nearbyNote: "Відстані по прямій між точками на нашій мапі.",
    map: "Мапа",
    mapAlt: (n) => `Мапа: ${n} ${ukAnd(n)} околиці`,
    crumbs: "Шлях сайтом",
    ...PUNCT,
  },
  es: {
    nearby: "Lugares cercanos",
    nearbyNote: "Distancias en línea recta entre los puntos de nuestro mapa.",
    map: "Mapa",
    mapAlt: (n) => `Mapa: ${n} y sus alrededores`,
    crumbs: "Ruta de navegación",
    ...PUNCT,
  },
  pt: {
    nearby: "Lugares próximos",
    nearbyNote: "Distâncias em linha reta entre os pontos do nosso mapa.",
    map: "Mapa",
    mapAlt: (n) => `Mapa: ${n} e arredores`,
    crumbs: "Trilha de navegação",
    ...PUNCT,
  },
  de: {
    nearby: "Orte in der Nähe",
    nearbyNote: "Entfernungen in Luftlinie zwischen den Punkten unserer Karte.",
    map: "Karte",
    mapAlt: (n) => `Karte: ${n} und Umgebung`,
    crumbs: "Navigationspfad",
    ...PUNCT,
  },
  fr: {
    nearby: "Lieux à proximité",
    nearbyNote: "Distances à vol d’oiseau entre les points de notre carte.",
    map: "Carte",
    mapAlt: (n) => `Carte\u202f: ${n} et ses environs`,
    crumbs: "Fil d’Ariane",
    ...PUNCT_FR,
  },
  it: {
    nearby: "Luoghi vicini",
    nearbyNote: "Distanze in linea d’aria tra i punti della nostra mappa.",
    map: "Mappa",
    mapAlt: (n) => `Mappa: ${n} e dintorni`,
    crumbs: "Percorso di navigazione",
    ...PUNCT,
  },
  pl: {
    nearby: "Miejsca w pobliżu",
    nearbyNote: "Odległości w linii prostej między punktami na naszej mapie.",
    map: "Mapa",
    mapAlt: (n) => `Mapa: ${n} i okolice`,
    crumbs: "Ścieżka nawigacji",
    ...PUNCT,
  },
  nl: {
    nearby: "Plaatsen in de buurt",
    nearbyNote: "Afstanden hemelsbreed tussen de punten op onze kaart.",
    map: "Kaart",
    mapAlt: (n) => `Kaart: ${n} en omgeving`,
    crumbs: "Kruimelpad",
    ...PUNCT,
  },
  cs: {
    nearby: "Místa v okolí",
    nearbyNote: "Vzdušné vzdálenosti mezi body na naší mapě.",
    map: "Mapa",
    mapAlt: (n) => `Mapa: ${n} a okolí`,
    crumbs: "Drobečková navigace",
    ...PUNCT,
  },
  sv: {
    nearby: "Platser i närheten",
    nearbyNote: "Avstånd fågelvägen mellan punkterna på vår karta.",
    map: "Karta",
    mapAlt: (n) => `Karta: ${n} med omgivningar`,
    crumbs: "Brödsmulor",
    ...PUNCT,
  },
  nb: {
    nearby: "Steder i nærheten",
    nearbyNote: "Avstander i luftlinje mellom punktene på kartet vårt.",
    map: "Kart",
    mapAlt: (n) => `Kart: ${n} og omegn`,
    crumbs: "Brødsmulesti",
    ...PUNCT,
  },
  tl: {
    nearby: "Mga kalapit na lugar",
    nearbyNote: "Tuwirang layo sa pagitan ng mga punto sa aming mapa.",
    map: "Mapa",
    mapAlt: (n) => `Mapa: ${n} at ang paligid nito`,
    crumbs: "Daanan ng nabigasyon",
    ...PUNCT,
  },
  da: {
    nearby: "Steder i nærheden",
    nearbyNote: "Afstande i luftlinje mellem punkterne på vores kort.",
    map: "Kort",
    mapAlt: (n) => `Kort: ${n} og omegn`,
    crumbs: "Brødkrummesti",
    ...PUNCT,
  },
  sr: {
    nearby: "Места у близини",
    nearbyNote: "Удаљености ваздушном линијом између тачака на нашој мапи.",
    map: "Мапа",
    mapAlt: (n) => `Мапа: ${n} и околина`,
    crumbs: "Путања",
    ...PUNCT,
  },
  hu: {
    nearby: "Közeli helyek",
    nearbyNote: "Légvonalbeli távolságok a térképünk pontjai között.",
    map: "Térkép",
    mapAlt: (n) => `Térkép: ${n} és környéke`,
    crumbs: "Morzsamenü",
    ...PUNCT,
  },
  fi: {
    nearby: "Lähellä olevat paikat",
    nearbyNote: "Linnuntie-etäisyydet karttamme pisteiden välillä.",
    map: "Kartta",
    mapAlt: (n) => `Kartta: ${n} ja sen ympäristö`,
    crumbs: "Murupolku",
    ...PUNCT,
  },
  vi: {
    nearby: "Địa điểm lân cận",
    nearbyNote: "Khoảng cách đường chim bay giữa các điểm trên bản đồ của chúng tôi.",
    map: "Bản đồ",
    mapAlt: (n) => `Bản đồ: ${n} và vùng lân cận`,
    crumbs: "Đường dẫn",
    ...PUNCT,
  },
  ro: {
    nearby: "Locuri din apropiere",
    nearbyNote: "Distanțe în linie dreaptă între punctele de pe harta noastră.",
    map: "Hartă",
    mapAlt: (n) => `Hartă: ${n} și împrejurimile`,
    crumbs: "Fir de navigare",
    ...PUNCT,
  },
  bg: {
    nearby: "Места наблизо",
    nearbyNote: "Разстояния по права линия между точките на нашата карта.",
    map: "Карта",
    mapAlt: (n) => `Карта: ${n} и околностите`,
    crumbs: "Навигационен път",
    ...PUNCT,
  },
};
