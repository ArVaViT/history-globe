/**
 * The index for places in any text (apps/web/public/hg-places.js): the forms of each
 * place's name a reader meets in running text, in Russian and English, each tied to one
 * place, with what the place's card shows. Written to public/data/text-places.json.
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
 * - a short list read by eye: modern meanings (Media, Philadelphia, «Тире»).
 * Names that are also first names (Jordan, «Нил») are listed for the script, which leaves
 * them alone next to another capitalised word.
 *
 * Russian names are declined (Иерусалим → Иерусалима, Иерусалиме…) by the ending of a
 * one-word name; names of several words are matched as written.
 *
 * Usage: node scripts/build-text-places.ts  (after build-content; build-verses supplies
 * the text for the lower-case check, and without it only the other checks apply)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteCertainty } from "../packages/model/src/sites.ts";
import { readBible } from "./bible-text.ts";
import { plain, russianForms, russianHeads } from "./russian-forms.ts";
import { placeSlugs } from "./slugs.ts";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");

type Lang = "ru" | "en";
const LANGS: readonly Lang[] = ["en", "ru"];
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
const STOP: Record<Lang, readonly string[]> = {
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
const FORM_STOP: Record<Lang, readonly string[]> = {
  en: [],
  ru: ["Иудеи", "Халдеи", "Тире", "Колосс", "Ливны"],
};
/**
 * Names that are also first names (Jordan Peterson, Sharon Stone, «Нил Сорский»): the
 * script leaves them alone next to a capitalised word, the other half of a person's name.
 */
const FIRST_NAMES: Record<Lang, readonly string[]> = {
  en: ["Jordan", "Sharon", "Bethany", "Shiloh", "Zion", "Moriah", "Eden", "Rhodes", "Ai"],
  ru: ["Нил", "Сава"],
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
  names: Record<string, { ru?: string }>;
  where_ru?: Record<string, string>;
};
const people = (
  JSON.parse(readFileSync(join(data, "people.json"), "utf8")) as {
    people: [string, string, string | null, ...unknown[]][];
  }
).people;
const ui = Object.fromEntries(
  LANGS.map((l) => [
    l,
    JSON.parse(readFileSync(join(root, `apps/web/src/i18n/${l}.json`), "utf8")) as {
      kind: Record<string, string>;
      place: Record<string, string>;
    },
  ]),
) as Record<Lang, { kind: Record<string, string>; place: Record<string, string> }>;

const formsOf = (name: string, l: Lang) => (l === "ru" ? russianForms(name) : [name]);
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
const headsOf = (name: string, l: Lang) =>
  (l === "ru" ? russianHeads(name) : englishHeads(name)).flatMap((h) => formsOf(h, l));

// How often each word of the Bible is written with a small first letter and how often with
// a capital: the whole KJV and Synodal text when the pipeline has them (pipeline/.cache),
// else the verses the places cite. A form written small at least as often as capitalised
// is an ordinary word («Восток», «Села»), which a sentence may start with; one the text
// mostly capitalises stays a name (Lebanon, though the Synodal text calls incense «ливан»).
const BIBLES: Record<Lang, string> = { en: "eng-kjv2006_usfm.zip", ru: "russyn_usfm.zip" };
const seen: Record<Lang, Map<string, number>> = { en: new Map(), ru: new Map() };
const whole: Record<Lang, string> = { en: "", ru: "" };
/** The verses the places cite, by OSIS reference: what the names are checked against. */
const cited: Record<Lang, Map<string, string>> = { en: new Map(), ru: new Map() };
let corpus: "bible" | "cited" | "none" = "bible";
for (const l of LANGS) {
  const dir = join(data, "verses", l);
  if (existsSync(dir))
    for (const f of readdirSync(dir).filter((x) => /^\w+\.json$/.test(x) && x !== "sources.json"))
      for (const [k, text] of Object.entries(
        JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, string>,
      ))
        cited[l].set(k, plain(text));
  const zip = join(root, "pipeline/.cache", BIBLES[l]);
  const texts = existsSync(zip) ? [...readBible(zip).values()] : [...cited[l].values()];
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
const nameIn = (p: Props, l: Lang) => (l === "ru" ? (content.names[p.id]?.ru ?? "") : p.name);
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
    const name = row[l === "ru" ? 2 : 1];
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
        : STOP[l].includes(name) || FORM_STOP[l].includes(form)
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
      (l === "ru" ? content.where_ru?.[p.id] : p.where) ?? "",
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

const words = {
  ru: {
    verses: ["{{count}} стих", "{{count}} стиха", "{{count}} стихов"],
    // Under the card's label «Локализация».
    disputed: "спорная",
    likely: "основная из версий",
    tentative: "предположительная",
    open: "Открыть на глобусе",
    page: "О месте",
  },
  en: {
    verses: ["{{count}} verse", "{{count}} verses", "{{count}} verses"],
    // Under the card's label "Location".
    disputed: "disputed",
    likely: "the likeliest of the candidates",
    tentative: "tentative",
    open: "Open on the globe",
    page: "About the place",
  },
};
const locator = { w: W, h: H, frame: FRAME, path };
for (const l of LANGS)
  writeFileSync(
    join(data, `text-places.${l}.json`),
    JSON.stringify({
      v: 1,
      forms: index[l],
      names: FIRST_NAMES[l].flatMap((n) => formsOf(n, l)).filter((f) => index[l][f]),
      places: cardsIn(l),
      text: words[l],
      locator,
    }),
  );
const count = (l: Lang, why: string) => dropped[l].filter((d) => d.why === why).length;
console.log(
  `text places: forms en ${String(Object.keys(index.en).length)}, ru ${String(Object.keys(index.ru).length)}; ` +
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
