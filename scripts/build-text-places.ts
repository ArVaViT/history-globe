/**
 * The index for places in any text (apps/web/public/hg-places.js, the place cards' verses and
 * the static pages): the forms of each place's name a reader meets in running text, in every
 * language of the site, each tied to one place, with what the place's card shows. Written to
 * public/data/text-places.<language>.json.
 *
 * Only names that point to one place are kept, since a wrong place on someone else's page
 * is worse than none:
 * - namesakes: the best-known place keeps the name only when it is named in five times as
 *   many verses as the others together (Bethlehem of Judah, not of Zebulun). A longer name
 *   counts for its shorter one: Mount Carmel against the town of Carmel, Kadesh-barnea
 *   against Kadesh on the Orontes, «Антиохия Писидийская» against Antioch of Syria;
 * - people: a name that is also a person's keeps the place only when the place is named in
 *   three times as many verses (Egypt, not Judah or Israel);
 * - ordinary words: a form the Bible's text writes in lower case at least as often as
 *   capitalised is a word, not a name («Села», "On"); so is any form two places share;
 * - the verses: of the cited verses that use a form, at least half must be the place's
 *   own. "Tiberias" in John is the lake, «Иудеи» in Acts the Jews;
 * - a short list read by eye: modern meanings (Media, Philadelphia, «Тире»). A place
 *   stopped in English or Russian is stopped in every language; each language adds its own.
 * Names that are also first names (Jordan, «Нил») are listed for the script, which leaves
 * them alone next to another capitalised word.
 *
 * Names are declined by the ending of a one-word name: Russian (Иерусалим → Иерусалима,
 * Иерусалиме…; russian-forms.ts), Ukrainian, Polish, Czech and Serbian, and the German and
 * Nordic genitive (inflected-forms.ts); names of several words are matched as written. Each
 * language is checked against its own Bible, the one its verse cards quote (bible-text.ts).
 *
 * Usage: node scripts/build-text-places.ts  (after build-content; build-verses supplies
 * the text for the lower-case check, and without it only the other checks apply)
 */
import { type Locale, LOCALES, type SiteLocale } from "../packages/model/src/time.ts";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteCertainty } from "../packages/model/src/sites.ts";
import { isUsfm, readBible, readSword, repair, SOURCES } from "./bible-text.ts";
import { inflectedForms } from "./inflected-forms.ts";
import { plain, russianForms, russianHeads } from "./russian-forms.ts";
import { placeSlugs } from "../packages/model/src/slugs.ts";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");

type Lang = SiteLocale;
// Every language of the site, English first.
const LANGS: readonly Lang[] = ["en", ...LOCALES.filter((l) => l !== "en")];
/** The languages whose stop lists were read by eye name by name; the others start from
 * theirs, by place (`stoppedIds`), and add their own below. */
type Base = "en" | "ru";
/** How much more a place must be named than its namesakes, and than a person. */
const OVER_PLACES = 5;
const OVER_PEOPLE = 3;
/**
 * A place named in fewer verses keeps only a long name (Patmos, Gethsemane): short names
 * of rarely named places are too often an ordinary word elsewhere ("Arab", «Рифма»).
 */
const MIN_VERSES = 5;
const LONG_NAME = 6;
/**
 * Names that pass the checks yet mean something else on a modern page: a tribe (Dan), a
 * Roman name («Гай» Юлий Цезарь; the Synodal Ai), a modern word ("Media", «луза»), today's
 * continent ("Asia"; «Асия» is only the Roman province), a modern city (Philadelphia,
 * Tel Aviv: Ezekiel's Tel-abib is in Babylonia) or a phrase of sermons ("The Lord will
 * provide"). Checked by reading every name by eye; a Russian entry stands for all its cases.
 */
const STOP: Record<Base, readonly string[]> = {
  en: [
    ...["Dan", "Media", "Asia", "Ar", "Ono", "Phoenix", "Mortar", "Madmen", "Harmon"],
    ...["Philadelphia", "Second Quarter", "City of Destruction"],
    ...["The Lord Is There", "The Lord Will Provide", "Valley of Decision", "Way of Holiness"],
    ...["Thebes", "Bethesda", "Syracuse", "Memphis"],
  ],
  ru: [
    ...["Дан", "Гай", "Луз", "Тамара", "Восток", "Идеала", "Кефира"],
    ...["Филадельфия", "Тел-Авив", "Неаполь", "Никополь", "Вторая часть"],
    ...["Господь там", "Город солнца", "Путь святой", "Долина суда", "Источники вод"],
    ...["Заречье", "Ар", "Сур", "Смирна", "Мемфис", "Сиракузы", "Армагеддон"],
  ],
};
/**
 * Single forms with another meaning: «Иудеи» and «Халдеи» are the peoples (the Synodal
 * text capitalises them), «Тире» a dash, «Колосс» a giant, «Ливны» a Russian town.
 */
const FORM_STOP: Partial<Record<Lang, readonly string[]>> = {
  en: [],
  ru: ["Иудеи", "Халдеи", "Тире", "Колосс", "Ливны"],
  uk: ["Раббі", "Філіпп", "Колоси", "Колосами"],
  cs: ["Lodě", "Libně", "Kolos"],
  de: ["Nils", "Zins"],
  pl: ["Mary", "Suzy", "Suzie", "Kolos", "Kusza", "Jordana", "Nila", "Szarona", "Tyra"],
  sr: ["Гат"],
};
/**
 * The other languages' own names with a modern meaning, read by eye by a reviewer of each
 * language (11.10.2026), as STOP: a common word (pl «Syn», de "Winkel"), another place
 * (fr «Sion» stays: Zion; it «Alessandria» goes: Piedmont), a generic gate or hall a town
 * has too (cs «Stará brána», nl "Westpoort"), modern Ethiopia for Cush. A modern country on
 * the same ground (Italia, Griekenland) stays linked, as in English.
 */
const STOP_IN: Partial<Record<Lang, readonly string[]>> = {
  es: ["Etiopía", "Sefarad", "Mara", "Milo", "Salamina", "Tolemaida", "Abilene", "Apolonia"],
  it: [
    "Etiopia",
    "Ramses",
    "Ieshua",
    "Mara",
    "Cusa",
    "Araba",
    "Salmone",
    "Macedonia",
    "Put",
    "Rabbit",
    "Porta Vecchia",
    "Sala del Trono",
    "Regno del Sud",
    "Regno del Nord",
    "Alessandria",
    "Reggio",
    "Susa",
    "Salamina",
  ],
  pt: ["Gerar", "Mara", "Remete", "Querube", "Estrada Real", "Rua Direita", "Três Vendas"],
  nl: [
    "Rabbit",
    "Ethiopië",
    "Magadan",
    "Rechtszaal",
    "Troonzaal",
    "Westpoort",
    "Oostpoort",
    "Zuidpoort",
    "Waterpoort",
    "Vispoort",
    "Koningsweg",
    "Oostplein",
  ],
  fr: ["Emmaüs", "Ramsès", "Icone", "Qadesh", "Salamine", "Rue Droite", "Éthiopie"],
  uk: ["Південь", "Кут", "Святилище", "Сава", "Церера", "Ефіопія"],
  cs: [
    "Havran",
    "Araba",
    "Mára",
    "Magadan",
    "Bosra",
    "Královská cesta",
    "Koňská brána",
    "Soudní síň",
    "Trůnní síň",
    "Horní nádrž",
    "Dolní nádrž",
    "Stará nádrž",
    "Nová brána",
    "Stará brána",
    "Severní brána",
    "Jižní brána",
    "Západní brána",
    "Východní brána",
    "Střední brána",
    "Vodní brána",
  ],
  de: [
    "Heiligtum",
    "Allerheiligstes",
    "Säulenhalle",
    "Gerichtshalle",
    "Thronhalle",
    "Winkel",
    "Silo",
    "Mara",
    "Ramses",
    "Elischa",
    "Put",
    "Rabbit",
    "Derbe",
    "Salamis",
    "Magadan",
    "Dimona",
    "Äthiopien",
    "Königsstraße",
    "Salzstadt",
    "Weidenbach",
    "Ostplatz",
    "Nordtor",
    "Südtor",
    "Osttor",
    "Westtor",
    "Altes Tor",
    "Neues Tor",
    "Wassertor",
    "Oberer Teich",
    "Unterer Teich",
    "Alter Teich",
  ],
  pl: [
    "Syn",
    "Araba",
    "Cherub",
    "Tygrys",
    "Narożnik",
    "Szafir",
    "Sora",
    "Magadan",
    "Rabbit",
    "Jeszua",
    "Salamina",
    "Droga Królewska",
    "Sala Kolumnowa",
    "Sala Tronowa",
    "Ulica Prosta",
    "Etiopia",
  ],
  sv: [
    "Vinkeln",
    "Vinkelns",
    "Etiopien",
    "Etiopiens",
    "Magadan",
    "Magadans",
    "Det heliga",
    "Herren är där",
    "Herren utser",
    "Stora havet",
    "Nya staden",
    "Raka gatan",
    "Breda muren",
    "Östra torget",
    "Landet på andra sidan floden",
    "Goda hamnarna",
    "Den heliga vägen",
    "Vägen mot Sävhavet",
    "vägen mot Sävhavet",
    "Nordlandets",
    "Östra porten",
    "Norra porten",
    "Södra porten",
    "Västra porten",
    "Gamla porten",
    "Nya porten",
    "Mellersta porten",
    "Gamla dammen",
    "Nedre dammen",
    "Övre dammen",
    "Pelarhallen",
    "Pelarhallens",
    "Tronsalen",
    "Tronsalens",
    "Domsalens",
    "Kungsvägen",
    "Kungsvägens",
    "Spåmännens ek",
  ],
  nb: [
    "Vinkelen",
    "Etiopia",
    "Abilene",
    "Godhavn",
    "Storhavet",
    "Det aller helligste",
    "Det hellige",
    "Den hellige veien",
    "Den rette gate",
    "Kongeveien",
    "Kongedalen",
    "Domshallen",
    "Søylehallen",
    "Tronhallen",
    "Fagerporten",
    "Østporten",
    "Nordporten",
    "Sørporten",
    "Vestporten",
    "Midtporten",
    "Dalporten",
    "Nyporten",
    "Vannporten",
    "Kildeporten",
    "Fiskeporten",
    "Hesteporten",
    "Saueporten",
    "Folkeporten",
    "Vaktporten",
    "Hjørneporten",
  ],
  da: [
    "Abilene",
    "Dalporten",
    "Den Anden Bydel",
    "Den Brede Mur",
    "Den Gamle Dam",
    "Den Gamle Port",
    "Den Hellige Vej",
    "Den Lige Gade",
    "Den Nedre Dam",
    "Den Nye Port",
    "Den Skønne Port",
    "Den Øvre Dam",
    "Det Allerhelligste",
    "Det Hellige",
    "Det Store Hav",
    "Domhallen",
    "Etiopien",
    "Gode Havne",
    "Herren er der",
    "Herren ser",
    "Hinsides Floden",
    "Hjørneporten",
    "Hjørnet",
    "Hjørnets",
    "Kildeporten",
    "Kongevejen",
    "Landets Navle",
    "Magadan",
    "Mellemporten",
    "Nordens Rige",
    "Nordporten",
    "Palmebyen",
    "Saltbyen",
    "Sydens Rige",
    "Sydlandet",
    "Sydporten",
    "Søjlehallen",
    "Tronsalen",
    "Vandporten",
    "Vaskerens Mark",
    "Vestporten",
    "den Anden Bydel",
    "den Brede Mur",
    "den Gamle Dam",
    "den Gamle Port",
    "den Hellige Vej",
    "den Lige Gade",
    "den Nedre Dam",
    "den Nye Port",
    "den Skønne Port",
    "den Øvre Dam",
    "det Allerhelligste",
    "det Hellige",
    "det Store Hav",
    "gode Havne",
    "hinsides Floden",
    "landets Navle",
    "nordens Rige",
    "sydens Rige",
    "vaskerens Mark",
    "Østporten",
  ],
  tl: [
    "Pintuang-bayan sa Silangan",
    "Pintuang-bayan sa Hilaga",
    "Pintuang-bayan sa Timog",
    "Pintuang-bayan sa Kanluran",
    "Gitnang Pintuang-bayan",
    "gitnang Pintuang-bayan",
    "Bagong Pintuang-bayan",
    "bagong Pintuang-bayan",
    "Lumang Pintuang-bayan",
    "lumang Pintuang-bayan",
    "Pintuang-bayan sa Sulok",
    "Pintuang-bayan ng Bayan",
    "Portiko ng Luklukan",
    "portiko ng Luklukan",
    "Portiko ng Kahatulan",
    "portiko ng Kahatulan",
    "Portiko ng mga Haligi",
    "portiko ng mga Haligi",
    "Malaking Dagat",
    "malaking Dagat",
    "Dakong Banal",
    "dakong Banal",
    "Kabanal-banalang Dako",
    "Ikalawang Purok",
    "ikalawang Purok",
    "Lansangang Matuwid",
    "lansangang Matuwid",
    "Daang-hari",
    "Daan ng Kabanalan",
    "daan ng Kabanalan",
    "Mababang Tangke",
    "mababang Tangke",
    "Mataas na Tangke",
    "mataas na Tangke",
    "Lumang Tangke",
    "lumang Tangke",
    "Silangang Liwasan",
    "silangang Liwasan",
    "Mabubuting Daongan",
    "mabubuting Daongan",
    "Etiopia",
    "Magadan",
    "Rabbit",
    "Cherub",
  ],
  sr: [
    "Етиопија",
    "Мисија",
    "Ливна",
    "Танах",
    "Преко реке",
    "Красна врата",
    "Угаона капија",
    "Ђубрена капија",
    "Источна капија",
    "Источни трг",
    "Стара капија",
    "Нова капија",
    "Северна капија",
    "Јужна капија",
    "Западна капија",
    "Средња капија",
    "Овчја капија",
    "Коњска капија",
    "Рибља капија",
    "Водена капија",
    "Капија тамничка",
    "Капија изворска",
    "Капија долинска",
    "Стубни трем",
    "Трем са престолом",
    "Права улица",
    "Широки зид",
    "Старо језеро",
    "Доње језеро",
    "Горње језеро",
    "Доњи изводи",
    "Горњи изводи",
    "Добра пристаништа",
    "Три гостионице",
    "Стене дивљих коза",
    "Поље перачко",
    "Царство северног цара",
    "Царство јужног цара",
  ],
};
/**
 * Names that are also first names (Jordan Peterson, Sharon Stone, «Нил Сорский»): the
 * script leaves them alone next to a capitalised word, the other half of a person's name.
 */
const FIRST_NAMES: Record<Base, readonly string[]> = {
  en: ["Jordan", "Sharon", "Bethany", "Shiloh", "Zion", "Moriah", "Eden", "Rhodes", "Ai"],
  ru: ["Нил", "Сава"],
};
/** The other languages' first names (and surnames) among place names, by their reviewers. */
const FIRST_NAMES_IN: Partial<Record<Lang, readonly string[]>> = {
  es: ["Belén", "Nazaret", "Betania", "Jordán", "Nilo", "Maceda"],
  it: ["Giordano", "Nilo", "Betania", "Apollonia", "Filippi"],
  pt: ["Nazaré", "Tarso", "Hadasa", "Nilo", "Jordão", "Betânia"],
  nl: ["Jordaan", "Tirza"],
  fr: ["Jourdain", "Rhodes", "Béthanie", "Hadassa", "Siloé"],
  uk: ["Шарон", "Ніл", "Йордан", "Арпад"],
  cs: ["Šaron", "Arpád", "Betanie"],
  de: ["Jordan", "Scharon", "Bethel", "Bethanien", "Tirza", "Zora", "Apollonia", "Saba"],
  pl: ["Jordan", "Szaron", "Ofir", "Mara", "Ramses"],
  sv: [
    "Jordan",
    "Jordans",
    "Mara",
    "Maras",
    "Sif",
    "Betania",
    "Betanias",
    "Apollonia",
    "Apollonias",
  ],
  nb: ["Mara", "Sif", "Jordan", "Tirsa", "Hadasja", "Betania", "Apollonia", "Saba"],
  da: ["Jordan", "Zora", "Arpad", "Hadasja", "Tirsa"],
  tl: [
    "Mara",
    "Maceda",
    "Nilo",
    "Jordan",
    "Shiloh",
    "Hadasa",
    "Susan",
    "Betania",
    "Nazaret",
    "Apolonia",
    "Tarso",
  ],
  sr: ["Јордан", "Нил", "Лида", "Мелита", "Хадаса", "Филипи"],
};

interface Props {
  id: string;
  name: string;
  kind: string;
  verses: number;
  where: string;
  dup?: boolean;
  disputed: boolean;
  confidence?: number;
  osis: string[];
}
const places = (
  JSON.parse(readFileSync(join(data, "places.geojson"), "utf8")) as {
    features: { geometry: { coordinates: [number, number] }; properties: Props }[];
  }
).features;
const content = JSON.parse(readFileSync(join(data, "content.json"), "utf8")) as {
  /** A place's names in the languages other than English. */
  names: Record<string, Partial<Record<Lang, string>>>;
  where_ru?: Record<string, string>;
  where_in?: Partial<Record<Lang, Record<string, string>>>;
};
const peopleFile = JSON.parse(readFileSync(join(data, "people.json"), "utf8")) as {
  people: [string, string, string | null, ...unknown[]][];
  /** A person's name in the languages beyond English and Russian, by id. */
  names?: Partial<Record<Lang, Record<string, string>>>;
};
const people = peopleFile.people;
interface Ui {
  kind: Record<string, string>;
  place: Record<string, string>;
  tours: Record<string, string>;
}
const ui = Object.fromEntries(
  LANGS.map((l) => [
    l,
    JSON.parse(readFileSync(join(root, `apps/web/src/i18n/${l}.json`), "utf8")) as Ui,
  ]),
) as Record<Lang, Ui>;

/**
 * «monte Sinai», «mar Morto», «porta das Ovelhas»: running text and the Bibles write the
 * common word of a name small, as Russian does («гора Синай»); the name stays capitalised.
 * Not in German, which capitalises every noun.
 */
const smallFirst = (form: string, l: Lang) =>
  l !== "de" && /^\p{Lu}\p{Ll}+\s.*\p{Lu}/u.test(form)
    ? [form, form.charAt(0).toLowerCase() + form.slice(1)]
    : [form];
const formsOf = (name: string, l: Lang) =>
  l === "ru"
    ? russianForms(name)
    : l === "en"
      ? [name]
      : inflectedForms(name, l).flatMap((f) => smallFirst(f, l));
/** The English counterpart of `russianHeads`: "Carmel" for Mount Carmel, "Kadesh" for
 * Kadesh-barnea, "Caesarea" for Caesarea Philippi. */
const englishHeads = (name: string): string[] => {
  const of =
    /^(?:Mount|(?:Valley|Wilderness|Desert|Sea|Brook|Waters|Plain|Pool|Spring|Land|City) of(?: the)?) (\p{Lu}[\p{L}-]*)$/u.exec(
      name,
    );
  if (of?.[1]) return [of[1]];
  const hyphen = /^(\p{Lu}\p{Ll}+)-\p{Ll}/u.exec(name);
  if (hyphen?.[1] && !name.includes(" ")) return [hyphen[1]];
  const two = /^(\p{Lu}\p{Ll}+) \p{Lu}\p{Ll}+$/u.exec(name);
  return two?.[1] ? [two[1]] : [];
};
/**
 * In the other languages, any capitalised word of a longer name, and the first part of a
 * hyphenated one: "Karmel" for «Góra Karmel». More than a reader would use, which only makes
 * a namesake give way more often.
 */
const otherHeads = (name: string): string[] => {
  const words = name.split(/\s+/);
  const hyphen = /^(\p{Lu}\p{Ll}+)-\p{L}/u.exec(name);
  return [
    ...(words.length > 1 ? words.filter((w) => /^\p{Lu}\p{Ll}/u.test(w)) : []),
    ...(words.length === 1 && hyphen?.[1] ? [hyphen[1]] : []),
  ];
};
const headsOf = (name: string, l: Lang) =>
  (l === "ru" ? russianHeads(name) : l === "en" ? englishHeads(name) : otherHeads(name)).flatMap(
    (h) => formsOf(h, l),
  );

// How often each word of the Bible is written with a small first letter and how often with
// a capital: the whole KJV and Synodal text when the pipeline has them (pipeline/.cache),
// else the verses the places cite. A form written small at least as often as capitalised
// is an ordinary word («Восток», «Села»), which a sentence may start with; one the text
// mostly capitalises stays a name (Lebanon, though the Synodal text calls incense «ливан»).
const perLang = <T>(make: () => T) =>
  Object.fromEntries(LANGS.map((l) => [l, make()])) as Record<Lang, T>;
const seen = perLang(() => new Map<string, number>());
const whole = perLang(() => "");
/** The verses the places cite, by OSIS reference: what the names are checked against. */
const cited = perLang(() => new Map<string, string>());
// The editions the verse cards quote (bible-text.ts SOURCES), mended as the cards are (REPAIRS).
const kjvZip = join(root, "pipeline/.cache", SOURCES.en.file);
const bibleOf = (l: Lang, zip: string) => {
  const bible = isUsfm(SOURCES[l]) ? readBible(zip) : readSword(zip, readBible(kjvZip));
  for (const [k, v] of bible) bible.set(k, repair(l, v));
  return bible;
};
let corpus: "bible" | "cited" | "none" = "bible";
for (const l of LANGS) {
  const dir = join(data, "verses", l);
  if (existsSync(dir))
    for (const f of readdirSync(dir).filter((x) => /^\w+\.json$/.test(x) && x !== "sources.json"))
      for (const [k, text] of Object.entries(
        JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, string>,
      ))
        cited[l].set(k, plain(text));
  const zip = join(root, "pipeline/.cache", SOURCES[l].file);
  const texts = existsSync(zip) ? [...bibleOf(l, zip).values()] : [...cited[l].values()];
  if (!existsSync(zip)) corpus = cited[l].size ? "cited" : "none";
  whole[l] = texts.map(plain).join("\n");
  // Whole words only: "Beth-ammon" is one word, not "ammon".
  for (const w of whole[l].match(/\p{L}[\p{L}'-]*/gu) ?? [])
    seen[l].set(w, (seen[l].get(w) ?? 0) + 1);
}
const occurrences = (text: string, s: string) => {
  let n = 0;
  for (let i = text.indexOf(s); i >= 0; i = text.indexOf(s, i + s.length)) n++;
  return n;
};
const aWord = (form: string, l: Lang) => {
  // A phrase is ordinary when the text writes it all small («великое море»); "mount Zion",
  // the KJV's way, still names Zion.
  if (form.includes(" ")) {
    const small = occurrences(whole[l], form.toLowerCase());
    return small > 0 && small >= occurrences(whole[l], form);
  }
  const lower = form.charAt(0).toLowerCase() + form.slice(1);
  const small = seen[l].get(lower) ?? 0;
  return lower !== form && small > 0 && small >= (seen[l].get(form) ?? 0);
};

const shown = places.filter((f) => f.properties.verses > 0 && !f.properties.dup);
const byId = new Map(shown.map((f) => [f.properties.id, f]));
const nameIn = (p: Props, l: Lang) => (l === "en" ? p.name : (content.names[p.id]?.[l] ?? ""));
/** The places stopped by hand in English or Russian: stopped in every language. */
const stoppedIds = new Set(
  shown
    .filter(
      ({ properties: p }) =>
        STOP.en.includes(p.name) || STOP.ru.includes(plain(content.names[p.id]?.ru ?? "")),
    )
    .map((f) => f.properties.id),
);
const stopped = (id: string, name: string, l: Lang) =>
  l === "en" || l === "ru"
    ? STOP[l].includes(name)
    : stoppedIds.has(id) || (STOP_IN[l] ?? []).includes(name);
// A place that is a first name in English is seldom one elsewhere (Shiloh, Bethany): each
// language lists its own.
const firstNames = (l: Lang): string[] =>
  l === "en" || l === "ru" ? [...FIRST_NAMES[l]] : [...(FIRST_NAMES_IN[l] ?? [])];
/** Two records of one site (Zion and Mount Zion, the two Rhodes) are no rivals. */
const NEAR_KM = 5;
const near = (a: string, b: string) => {
  const p = byId.get(a)?.geometry.coordinates;
  const q = byId.get(b)?.geometry.coordinates;
  if (!p || !q) return false;
  const k = Math.cos((((p[1] + q[1]) / 2) * Math.PI) / 180);
  return Math.hypot((p[0] - q[0]) * k, p[1] - q[1]) * 111.2 < NEAR_KM;
};
const osisOf = new Map(shown.map((f) => [f.properties.id, new Set(f.properties.osis)]));
/**
 * The verses that use a form, against the verses the data cites for its place (or for
 * another record of the same site). Fewer than half, and the text means something else by
 * it: "Tiberias" is the lake in John, «Иудеи» are the Jews. (The data's verse lists miss a
 * few mentions, Bethsaida's among them, so it is half, not most.)
 */
const AGREE = 0.5;
const agreement = (form: string, id: string, l: Lang) => {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}-])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}]|-\\p{L})`,
    "u",
  );
  const kin = [...osisOf.keys()].filter((o) => o === id || near(o, id));
  let hits = 0;
  let agree = 0;
  for (const [ref, text] of cited[l]) {
    if (!text.includes(form) || !re.test(text)) continue;
    hits++;
    if (kin.some((o) => osisOf.get(o)?.has(ref))) agree++;
  }
  return { hits, agree };
};

/** Who claims a form: places by their names, others by a shorter way of naming them, and
 * people (their verses together). */
interface Claim {
  places: Map<string, number>;
  heads: Map<string, number>;
  people: number;
}
const index = {} as Record<Lang, Record<string, string>>;
const dropped = {} as Record<Lang, { form: string; why: string }[]>;
for (const l of LANGS) {
  const claims = new Map<string, Claim>();
  const claim = (form: string) => {
    let c = claims.get(form);
    if (!c) claims.set(form, (c = { places: new Map(), heads: new Map(), people: 0 }));
    return c;
  };
  for (const { properties: p } of shown) {
    const name = nameIn(p, l);
    if (!name) continue;
    for (const form of formsOf(name, l)) claim(form).places.set(p.id, p.verses);
    for (const form of headsOf(name, l)) claim(form).heads.set(p.id, p.verses);
  }
  for (const row of people) {
    const name = l === "en" ? row[1] : l === "ru" ? row[2] : peopleFile.names?.[l]?.[row[0]];
    if (!name) continue;
    const verses = row[row.length - 1] as number;
    for (const form of formsOf(name, l)) if (claims.has(form)) claim(form).people += verses;
  }
  index[l] = {};
  dropped[l] = [];
  for (const [form, c] of claims) {
    // Only a place's own name is linked; a short way of naming another is a rival only.
    if (c.places.size === 0) continue;
    const ranked = [...c.places].sort((a, b) => b[1] - a[1]);
    const [best = "", verses = 0] = ranked[0] ?? [];
    const rivals = new Map([...c.heads, ...c.places]);
    let rest = 0;
    for (const [id, v] of rivals) if (id !== best && !near(id, best)) rest += v;
    const p = byId.get(best)?.properties;
    const name = p ? nameIn(p, l) : "";
    const why =
      verses < MIN_VERSES && name.length < LONG_NAME
        ? "rare"
        : stopped(best, name, l) || (FORM_STOP[l] ?? []).includes(form)
          ? "stop"
          : rest > 0 && verses < OVER_PLACES * rest
            ? "places"
            : c.people > 0 && verses < OVER_PEOPLE * c.people
              ? "person"
              : !/^\p{Lu}/u.test(form) && !/\s\p{Lu}/u.test(form)
                ? "lower-case name"
                : aWord(form, l)
                  ? "word"
                  : "";
    const check = why ? null : agreement(form, best, l);
    const verdict = check && check.hits >= 3 && check.agree < AGREE * check.hits ? "verses" : why;
    if (!verdict) index[l][form] = best;
    else {
      dropped[l].push({ form, why: verdict });
      // A longer name left out still holds its words: «Антиохию Писидийскую» must not
      // become Antioch of Syria and a word after it. An empty place is matched, not linked.
      if (/\s/.test(form)) index[l][form] = "";
    }
  }
}

// The cards, in each language: only places some form of that language points to.
const slug = placeSlugs(places.map((f) => f.properties));
const cardsIn = (l: Lang) => {
  const ids = new Set(Object.values(index[l]).filter(Boolean));
  const cards: Record<string, unknown[]> = {};
  for (const { properties: p, geometry } of shown) {
    if (!ids.has(p.id)) continue;
    const c = siteCertainty(p);
    cards[p.id] = [
      nameIn(p, l) || p.name,
      ui[l].kind[p.kind] ?? p.kind,
      (l === "en"
        ? p.where
        : l === "ru"
          ? content.where_ru?.[p.id]
          : content.where_in?.[l]?.[p.id]) ?? "",
      p.verses,
      geometry.coordinates.map((x) => Math.round(x * 100) / 100),
      slug.get(p.id) ?? p.id,
      c === "agreed" || c === "unknown" ? "" : c,
    ];
  }
  return cards;
};

// The locator: the coasts from Italy to Persia, simplified to a stroke on a small card.
const FRAME = { west: 8, east: 56, south: 22, north: 46 } as const;
const W = 192;
const H = Math.round(
  ((FRAME.north - FRAME.south) / ((FRAME.east - FRAME.west) * Math.cos((34 * Math.PI) / 180))) * W,
);
type Pt = readonly [number, number];
const xy = ([lon, lat]: Pt): Pt => [
  ((lon - FRAME.west) / (FRAME.east - FRAME.west)) * W,
  ((FRAME.north - lat) / (FRAME.north - FRAME.south)) * H,
];
/** Douglas–Peucker: the points that keep the line within `tol` of itself. */
const simplify = (pts: readonly Pt[], tol: number): Pt[] => {
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (!a || !b || pts.length < 3) return [...pts];
  let far = 0;
  let at = 0;
  pts.forEach(([x, y], i) => {
    const d =
      Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) /
      (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    if (i > 0 && i < pts.length - 1 && d > far) [far, at] = [d, i];
  });
  return far <= tol
    ? [a, b]
    : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
};
const coast = JSON.parse(readFileSync(join(data, "coast.geojson"), "utf8")) as {
  features: { geometry: { coordinates: Pt[][] } }[];
};
let path = "";
for (const line of coast.features.flatMap((f) => f.geometry.coordinates)) {
  const inside = line.filter(
    ([lon, lat]) =>
      lon >= FRAME.west - 2 &&
      lon <= FRAME.east + 2 &&
      lat >= FRAME.south - 2 &&
      lat <= FRAME.north + 2,
  );
  const pts = simplify(inside.map(xy), 0.6);
  // Specks the size of a pixel or two say nothing at card size.
  const [p, q] = pts;
  if (!p || !q || (pts.length < 3 && Math.hypot(p[0] - q[0], p[1] - q[1]) < 3)) continue;
  path += pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
}

/**
 * The card's words. "{{count}} verses" by the language's plural rules, from its dictionary
 * (place.verse_count_*): `plural` by Intl.PluralRules category, and `verses` as the first
 * script read it (one, few, many). The labels the dictionary has (place.today,
 * tours.about_place) come from it; the rest are here, a language's still waiting to join the
 * site among them.
 */
interface Labels {
  inBible: string;
  location: string;
  disputed: string;
  likely: string;
  tentative: string;
  open: string;
  /** Where the dictionary's tours.about_place does not suit a link on a card. */
  page?: string;
}
const LABELS: Record<Lang, Labels> & Partial<Record<Locale, Labels>> = {
  en: {
    inBible: "In the Bible",
    location: "Location",
    // Under the card's label "Location".
    disputed: "disputed",
    likely: "the likeliest of the candidates",
    tentative: "tentative",
    open: "Open on the globe",
  },
  ru: {
    inBible: "В Библии",
    location: "Локализация",
    disputed: "спорная",
    likely: "основная из версий",
    tentative: "предположительная",
    open: "Открыть на глобусе",
  },
  uk: {
    inBible: "У Біблії",
    location: "Локалізація",
    disputed: "спірна",
    likely: "найімовірніша з версій",
    tentative: "орієнтовна",
    open: "Відкрити на глобусі",
  },
  es: {
    inBible: "En la Biblia",
    location: "Ubicación",
    disputed: "discutida",
    likely: "la más probable de las candidatas",
    tentative: "tentativa",
    open: "Abrir en el globo",
  },
  pt: {
    inBible: "Na Bíblia",
    location: "Localização",
    disputed: "disputada",
    likely: "a mais provável das candidatas",
    tentative: "provisória",
    open: "Abrir no globo",
  },
  de: {
    inBible: "In der Bibel",
    location: "Lage",
    disputed: "umstritten",
    likely: "wahrscheinlichste Lage",
    tentative: "vermutet",
    open: "Auf dem Globus öffnen",
  },
  fr: {
    inBible: "Dans la Bible",
    location: "Localisation",
    disputed: "discutée",
    likely: "la plus probable parmi plusieurs sites",
    tentative: "hypothétique",
    open: "Ouvrir sur le globe",
  },
  it: {
    inBible: "Nella Bibbia",
    location: "Localizzazione",
    disputed: "discussa",
    likely: "la più probabile delle candidate",
    tentative: "ipotetica",
    page: "Scheda del luogo",
    open: "Apri sul globo",
  },
  nl: {
    inBible: "In de Bijbel",
    location: "Ligging",
    disputed: "omstreden",
    likely: "de waarschijnlijkste van de kandidaten",
    tentative: "voorlopig",
    open: "Openen op de globe",
    page: "Over deze plaats",
  },
  pl: {
    inBible: "W Biblii",
    location: "Lokalizacja",
    disputed: "sporna",
    likely: "najbardziej prawdopodobna z propozycji",
    tentative: "przypuszczalna",
    open: "Otwórz na globusie",
  },
  cs: {
    inBible: "V Bibli",
    location: "Lokalizace",
    disputed: "sporná",
    likely: "nejpravděpodobnější z návrhů",
    tentative: "předběžná",
    open: "Otevřít na glóbu",
  },
  sv: {
    inBible: "I Bibeln",
    location: "Läge",
    disputed: "omtvistat",
    likely: "det mest sannolika av förslagen",
    tentative: "osäkert",
    open: "Öppna på globen",
  },
  da: {
    inBible: "I Bibelen",
    location: "Placering",
    disputed: "omstridt",
    likely: "den mest sandsynlige af forslagene",
    tentative: "usikker",
    open: "Åbn på globussen",
  },
  nb: {
    inBible: "I Bibelen",
    location: "Beliggenhet",
    disputed: "omstridt",
    likely: "den mest sannsynlige av forslagene",
    tentative: "usikker",
    open: "Åpne på globusen",
  },
  sr: {
    inBible: "У Библији",
    location: "Локација",
    disputed: "спорна",
    likely: "највероватнија од претпоставки",
    tentative: "претпостављена",
    open: "Отвори на глобусу",
  },
  tl: {
    inBible: "Sa Bibliya",
    location: "Kinaroroonan",
    disputed: "pinagtatalunan",
    likely: "ang pinakamalamang sa mga mungkahi",
    tentative: "hindi tiyak",
    open: "Buksan sa globo",
  },
};
const wordsIn = (l: Lang) => {
  const p = ui[l].place;
  const plural = Object.fromEntries(
    (["zero", "one", "two", "few", "many", "other"] as const).flatMap((c) => {
      const f = p[`verse_count_${c}`];
      return f ? [[c, f]] : [];
    }),
  ) as Record<string, string>;
  // The first script's three forms: for 1, 2 and 5 verses.
  const pick = (n: number) =>
    plural[new Intl.PluralRules(l).select(n)] ?? plural.other ?? plural.one ?? "{{count}}";
  return {
    plural,
    verses: [pick(1), pick(2), pick(5)],
    today: p.today ?? "",
    page: ui[l].tours.about_place ?? "",
    ...LABELS[l],
  };
};
const locator = { w: W, h: H, frame: FRAME, path };
for (const l of LANGS)
  writeFileSync(
    join(data, `text-places.${l}.json`),
    JSON.stringify({
      v: 1,
      forms: index[l],
      names: firstNames(l)
        .flatMap((n) => formsOf(n, l))
        .filter((f) => index[l][f]),
      places: cardsIn(l),
      text: wordsIn(l),
      locator,
    }),
  );
const count = (l: Lang, why: string) => dropped[l].filter((d) => d.why === why).length;
console.log(
  `text places: forms ${LANGS.map((l) => `${l} ${String(Object.keys(index[l]).length)}`).join(", ")}; ` +
    LANGS.map(
      (l) =>
        `${l} dropped ${String(count(l, "places"))} namesakes, ${String(count(l, "person"))} people, ${String(count(l, "word"))} words, ${String(count(l, "rare"))} rare, ${String(count(l, "stop"))} by hand, ${String(count(l, "verses"))} by the verses`,
    ).join("; ") +
    (corpus === "bible"
      ? ""
      : corpus === "cited"
        ? " (no Bible text in pipeline/.cache: the cited verses only)"
        : " (no verse text: the word and verse checks were skipped)"),
);
if (process.env.TEXT_PLACES_DEBUG)
  writeFileSync(process.env.TEXT_PLACES_DEBUG, JSON.stringify(dropped, null, 1));
