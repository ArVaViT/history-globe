/**
 * A tour's texts name its people and places as the site does elsewhere: where the English of
 * the tour (title, intro, notes, stories) names a person or one of its stops' places, each
 * language's texts carry that language's form from names-<code>.yaml (people-ru.json and
 * place-names.yaml for Russian). Inflection is allowed for: a form is found when its stem
 * (all but the last letter) is. A person counts only when first named in a book the tour's
 * stops are told from (King Saul is not Saul of Tarsus) and not called like a stop or a state
 * (Egypt the son of Ham); a name the language's file gives two forms for is left to the reader.
 */
import type { TourFile } from "../packages/model/src/content.ts";
import type { Locale } from "../packages/model/src/locales.ts";

/** One language's forms: people by TIPNR id, places by id. */
export interface LocaleForms {
  readonly people: Readonly<Record<string, string>>;
  readonly places: Readonly<Record<string, string>>;
}

type Texts = Readonly<Partial<Record<string, string | readonly string[]>>>;

/** A tour's texts in one language, piece by piece: the title, each intro paragraph, notes, stories. */
export function tourUnits(t: TourFile, l: Locale): { where: string; text: string }[] {
  const at = (x: Texts | undefined): string | readonly string[] | undefined => x?.[l];
  const units: { where: string; text: string }[] = [];
  const add = (where: string, v: unknown) => {
    if (typeof v === "string") units.push({ where, text: v });
  };
  add("title", at(t.title));
  const intro = at(t.intro);
  if (Array.isArray(intro))
    intro.forEach((p, i) => {
      add(`intro ${String(i + 1)}`, p);
    });
  t.stops.forEach((s, i) => {
    add(`stop ${String(i + 1)} note`, at(s.note));
    add(`stop ${String(i + 1)} story`, at(s.story));
  });
  return units;
}

/**
 * What is searched for, in lower case: the name as it may begin when inflected (Lystra in
 * Lystry, Tesalonika in Tesalonice), or with the vowel that drops (Павел in Павла, Paweł in
 * Pawła). Short names are kept nearly whole, so Elias is not taken for Elija.
 */
export function stemsOf(form: string, l: string): string[] {
  // Of a name in several words (Гора Кармель, Потік Хораф) the longest, else the last, is
  // looked for.
  const w = form
    .toLocaleLowerCase(l)
    .split(/[\s-]+/)
    .reduce((a, b) => (b.length >= a.length ? b : a), "");
  if (w.length < 4) return [w];
  // Сила in Силу, Róma in Rómába; Ahab stays whole.
  // Assos in Assu, Festus in Festa.
  if (/(us|os|es)$/.test(w)) return [w.slice(0, -2), w.slice(0, -1)];
  if (w.length === 4) return [/[aeiouyáéíóúüöåäæøаеиоуыэюяіїєѣ]$/.test(w) ? w.slice(0, 3) : w];
  return [
    w.slice(0, Math.max(4, w.length - (w.length >= 8 ? 3 : 2))),
    w.slice(0, -2) + w.slice(-1),
  ];
}

/** TIPNR's book abbreviations, where they are not the OSIS book's first three letters. */
const TIPNR_BOOK: Readonly<Record<string, string>> = {
  "1Kgs": "1Ki",
  "2Kgs": "2Ki",
  Judg: "Jdg",
  Song: "Sng",
  Ezek: "Ezk",
  Joel: "Jol",
  Nah: "Nam",
  Phil: "Php",
  Phlm: "Phm",
  "1John": "1Jn",
  "2John": "2Jn",
  "3John": "3Jn",
  Mark: "Mrk",
  John: "Jhn",
  "1Sam": "1Sa",
  "2Sam": "2Sa",
  "1Chr": "1Ch",
  "2Chr": "2Ch",
  Ps: "Psa",
  "1Thess": "1Th",
  "2Thess": "2Th",
  "1Tim": "1Ti",
  "2Tim": "2Ti",
  "1Pet": "1Pe",
  "2Pet": "2Pe",
  "1Cor": "1Co",
  "2Cor": "2Co",
};
/** The TIPNR book of an OSIS reference ("1Kgs.19.8" → "1Ki"). */
export function tipnrBook(osis: string): string {
  const book = osis.split(".")[0] ?? osis;
  return TIPNR_BOOK[book] ?? book.slice(0, 3);
}

/**
 * The English name as a person's or place's name: not as part of a longer one (Julius
 * Caesar is not Julius the centurion).
 */
const nameRe = (name: string) =>
  new RegExp(`(?<!\\p{Lu}\\p{Ll}+ )\\b${escape(name)}\\b(?! \\p{Lu})`, "u");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The English name of a TIPNR id ("Elijah@1Ki.17.1-Jas") or a place ("Galilee 1"). */
const englishOf = (id: string) => (id.split("@")[0] ?? id).replace(/\s+\d+$/, "");

/**
 * The names a tour's language leaves out: each a person or stop place the English names,
 * whose form in the language is not found in that language's texts.
 */
export function tourNameErrors(
  t: TourFile,
  l: Locale,
  forms: LocaleForms,
  /** English names of the places, by id. */
  placesEn: Readonly<Record<string, string>>,
  /** English names of the states, which people may share (Egypt, Judah). */
  polities: readonly string[] = [],
): string[] {
  const enUnits = tourUnits(t, "en");
  const units = new Map(tourUnits(t, l).map((u) => [u.where, u.text]));
  if (units.size === 0) return [];
  const en = enUnits.map((u) => u.text).join("\n");
  const wanted = new Map<string, string>();
  const ambiguous = new Set<string>();
  const want = (name: string, form: string) => {
    if (name.length < 4 || !nameRe(name).test(en)) return;
    const had = wanted.get(name);
    if (had !== undefined && had !== form) ambiguous.add(name);
    else wanted.set(name, form);
  };
  // The tour's own people first: their forms win over namesakes.
  const own = new Set(t.people ?? []);
  const books = new Set(t.stops.flatMap((s) => (s.ref ? [tipnrBook(s.ref)] : [])));
  // A person called like one of the tour's places or a state (Egypt, Judah) is most likely
  // the place.
  const places = [
    ...t.stops.flatMap((s) => {
      const en = placesEn[s.place];
      return en ? [englishOf(en)] : [];
    }),
    ...polities,
  ].join("\n");
  const isPlace = (name: string) => new RegExp(`\\b${escape(name)}\\b`).test(places);
  for (const id of own) if (forms.people[id]) wanted.set(englishOf(id), forms.people[id]);
  for (const [id, form] of Object.entries(forms.people)) {
    const name = englishOf(id);
    const book = id.split("@")[1]?.split(".")[0] ?? "";
    if (own.has(id) || [...own].some((o) => englishOf(o) === name)) continue;
    if (books.has(book) && !isPlace(name)) want(name, form);
  }
  for (const s of t.stops) {
    const form = forms.places[s.place];
    const name = placesEn[s.place];
    if (form && name) want(englishOf(name), form);
  }
  const errors: string[] = [];
  for (const [name, form] of wanted) {
    if (ambiguous.has(name)) continue;
    const named = nameRe(name);
    const stems = stemsOf(form, l);
    // Each piece whose English names the person or place names them in the language's form.
    for (const u of enUnits) {
      const text = units.get(u.where);
      if (!named.test(u.text) || text === undefined) continue;
      const lower = text.toLocaleLowerCase(l);
      if (!stems.some((w) => lower.includes(w)))
        errors.push(`tours/${t.id}.yaml: ${l} ${u.where} names ${name}, not as ${form}`);
    }
  }
  return errors;
}
