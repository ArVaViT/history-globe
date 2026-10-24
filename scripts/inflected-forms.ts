/**
 * The forms of a place name in running text in the languages beyond Russian
 * (scripts/build-text-places.ts; Russian is scripts/russian-forms.ts): the cases of a
 * one-word Ukrainian, Polish, Czech or Serbian name («Єрусалима», "w Jerozolimie",
 * "v Jeruzalémě", «у Јерусалиму») and the German and Nordic genitive ("Jerusalems"). Rules by
 * ending only, no dictionary: a form never met in a text costs nothing, a missed one leaves a
 * name unlinked, and a form that is also an ordinary word is dropped by the index's checks.
 * Names of several words are matched as written; so are names in a vowel these rules do not
 * know (Мегіддо, Hebrón).
 */
import type { Locale } from "../packages/model/src/time.ts";

const ends = (stem: string, e: readonly string[]): string[] => e.map((x) => stem + x);
const uniq = (xs: readonly string[]) => [...new Set(xs)];
/** Names of two letters are left alone (Ai, Ur); so is a vowel before a final -a (Гаваа, Noa). */
const tooShort = (w: string) => w.length < 3;
const vowelA = (w: string) => /[aeiouyáéíóúýěąęоаеиіїуєюя]а$|[aeiouyáéíóúýěąę]a$/i.test(w);

// Ukrainian.
const UK_SPECIAL: Record<string, readonly string[]> = {
  // A vowel that drops out: «в Єгипті», «з Єгипту».
  Єгипет: ["Єгипет", "Єгипту", "Єгиптові", "Єгиптом", "Єгипті"],
};
function ukrainian(w: string): string[] {
  const special = UK_SPECIAL[w];
  if (special) return [...special];
  if (tooShort(w)) return [w];
  const s = (k: number) => w.slice(0, -k);
  if (w.endsWith("ія")) return ends(s(2), ["ія", "ії", "ію", "ією"]);
  if (/[аеєиіїоуюя]я$/.test(w)) return ends(s(1), ["я", "ї", "ю", "єю"]);
  if (w.endsWith("я")) return ends(s(1), ["я", "і", "ю", "ею"]);
  if (w.endsWith("а")) {
    if (vowelA(w)) return [w];
    const stem = s(1);
    // «Рама» → «у Рамі»; г, к, х become з, ц, с before і.
    const loc = stem.replace(/г$/, "з").replace(/к$/, "ц").replace(/х$/, "с");
    // After ж, ч, ш, щ the genitive and the instrumental are soft: «Мареші», «Мареша» → «Марешею».
    const hush = /[жчшщ]$/.test(stem);
    return uniq([
      w,
      `${stem}${hush ? "і" : "и"}`,
      `${loc}і`,
      `${stem}у`,
      `${stem}${hush ? "ею" : "ою"}`,
    ]);
  }
  // Plural names: Афіни, Філіппи.
  if (w.endsWith("и")) return ends(s(1), ["и", "", "ам", "ами", "ах"]);
  if (w.endsWith("й")) return ends(s(1), ["й", "я", "ю", "єм", "ї"]);
  if (w.endsWith("ь")) return ends(s(1), ["ь", "я", "ю", "ем", "і"]);
  if (/[бвгґдзклмнпрстфхцжчшщ]$/.test(w)) {
    const o = /[жчшщц]$/.test(w) ? "ем" : "ом";
    // After г, к, х the locative takes -у («у Дамаску»), not -і.
    return ends(w, ["", "а", "у", "ові", o, ...(/[гкх]$/.test(w) ? [] : ["і"])]);
  }
  return [w];
}

// Polish and Czech: the locative's consonant changes before -e/-ě.
const PL_LOC: readonly (readonly [RegExp, string])[] = [
  [/ch$/, "sze"],
  [/st$/, "ście"],
  [/t$/, "cie"],
  [/d$/, "dzie"],
  [/r$/, "rze"],
  [/ł$/, "le"],
  [/k$/, "ce"],
  [/g$/, "dze"],
  [/([bfmnpswz])$/, "$1ie"],
];
const plLocative = (stem: string): string | undefined => {
  for (const [re, to] of PL_LOC) if (re.test(stem)) return stem.replace(re, to);
  return undefined;
};
const PL_SPECIAL: Record<string, readonly string[]> = {
  Damaszek: ["Damaszek", "Damaszku", "Damaszkowi", "Damaszkiem"],
};
function polish(w: string): string[] {
  const special = PL_SPECIAL[w];
  if (special) return [...special];
  if (tooShort(w)) return [w];
  const s = (k: number) => w.slice(0, -k);
  // Latin neuters and Greek cities do not decline: Ikonium, Hierapolis.
  if (/(um|polis)$/.test(w)) return [w];
  if (w.endsWith("ia")) return ends(s(2), ["ia", "ii", "ię", "ią"]);
  // Grecja → z Grecji; Achaja → w Achai.
  if (/[aeiouy]ja$/.test(w)) return ends(s(2), ["ja", "i", "ję", "ją"]);
  if (w.endsWith("ja")) return ends(s(2), ["ja", "ji", "ję", "ją"]);
  // Galilea, Judea: Galilei, Galileę, Galileą.
  if (w.endsWith("ea")) return ends(s(1), ["a", "i", "ę", "ą"]);
  if (w.endsWith("a")) {
    if (vowelA(w)) return [w];
    const stem = s(1);
    const soft = /(sz|cz|rz|ż|c|dz|dż|j|l)$/.test(stem);
    const gen = /[kg]$/.test(stem) ? `${stem}i` : `${stem}y`;
    const loc = soft ? `${stem}y` : plLocative(stem);
    return uniq([w, gen, ...(loc ? [loc] : []), `${stem}ę`, `${stem}ą`]);
  }
  // Plural names: Ateny, Ateny → Aten, Atenach.
  if (w.endsWith("y")) return ends(s(1), ["y", "", "om", "ami", "ach"]);
  if (w.endsWith("j")) return ends(w, ["", "u", "owi", "em"]);
  if (/[bcćdfghklłmnńprsśtwzźż]$/.test(w)) {
    const em = /[kg]$/.test(w) ? "iem" : "em";
    const loc = /(k|g|ch|sz|cz|rz|ż|c)$/.test(w) ? `${w}u` : plLocative(w);
    // A place's genitive is -u (z Egiptu, do Rzymu); -a would be a person's (Jordana, Tyra).
    return uniq([w, `${w}u`, `${w}owi`, `${w}${em}`, ...(loc ? [loc] : [])]);
  }
  return [w];
}

const CS_LOC: readonly (readonly [RegExp, string])[] = [
  [/ch$/, "še"],
  [/k$/, "ce"],
  [/h$/, "ze"],
  [/g$/, "ze"],
  [/r$/, "ře"],
  [/([bfmpv])$/, "$1ě"],
  [/([dnt])$/, "$1ě"],
  [/([lsz])$/, "$1e"],
];
const csLocative = (stem: string): string | undefined => {
  for (const [re, to] of CS_LOC) if (re.test(stem)) return stem.replace(re, to);
  return undefined;
};
const CS_SPECIAL: Record<string, readonly string[]> = {
  Damašek: ["Damašek", "Damašku", "Damaškem"],
};
function czech(w: string): string[] {
  const special = CS_SPECIAL[w];
  if (special) return [...special];
  if (tooShort(w)) return [w];
  const s = (k: number) => w.slice(0, -k);
  if (w.endsWith("ie")) return ends(s(2), ["ie", "ii", "ií"]);
  // Galilea, Judea: Galileje, Galileji, Galileu, Galileou.
  if (w.endsWith("ea")) return ends(s(1), ["a", "je", "ji", "u", "ou"]);
  if (w.endsWith("a")) {
    if (vowelA(w)) return [w];
    const stem = s(1);
    const soft = /[cčřšžj]$/.test(stem);
    const loc = soft ? `${stem}i` : csLocative(stem);
    return uniq([
      w,
      soft ? `${stem}e` : `${stem}y`,
      ...(loc ? [loc] : []),
      `${stem}u`,
      `${stem}ou`,
    ]);
  }
  // Plural names: Athény → Athén, Athénách.
  if (w.endsWith("y")) return ends(s(1), ["y", "", "ám", "ách", "ami"]);
  if (/[bcčdďfghjklmnňprřsštťvzž]$/.test(w)) {
    const loc = csLocative(w);
    return uniq([w, `${w}u`, `${w}a`, `${w}em`, ...(loc ? [loc] : [])]);
  }
  return [w];
}

/**
 * Portuguese spellings in use beside the 1990 one: the Brazilian "-éia" of older Bibles and
 * sermons (Galiléia, Judéia) and the European ó and é for ô and ê (Babilónia, Getsémani).
 */
const portuguese = (w: string): string[] =>
  uniq([
    w,
    w.replace(/eia$/, "éia"),
    w.replace(/éia$/, "eia"),
    w.replace(/ô/g, "ó").replace(/ê/g, "é"),
  ]);

/**
 * "Jerusalems Mauern", "Ägyptens Götter": the genitive of a name not ending in a hiss, and
 * not of a feminine one (Säulenhalle, Salzstadt, Königsstraße), which takes no -s.
 */
const german = (w: string): string[] =>
  /(s|ß|x|z|ce|e|stadt|burg|furt|heit|keit|ung|schaft)$/i.test(w) ? [w] : [w, `${w}s`];

/**
 * "Jerusalems murar", "Egyptens konung": the Nordic genitive, which a name in -s does without
 * (Damaskus, Efesos).
 */
const nordic = (w: string): string[] => (/[sxz]$/i.test(w) ? [w] : [w, `${w}s`]);

// Serbian (Cyrillic): the cases of a one-word name, as in Ukrainian.
const SR_SPECIAL: Record<string, readonly string[]> = {
  // A vowel that drops out: «у Египту», «из Египта».
  Египат: ["Египат", "Египта", "Египту", "Египтом"],
};
function serbian(w: string): string[] {
  const special = SR_SPECIAL[w];
  if (special) return [...special];
  if (tooShort(w)) return [w];
  const s = (k: number) => w.slice(0, -k);
  // Самарија, Галилеја, Јудеја: Самарије, Самарији, Самарију, Самаријом.
  if (w.endsWith("ја")) return ends(s(1), ["а", "е", "и", "у", "ом"]);
  if (w.endsWith("а")) {
    if (vowelA(w)) return [w];
    const stem = s(1);
    // «Рама» → «у Рами»; к, г, х become ц, з, с before и.
    const dat = stem.replace(/к$/, "ц").replace(/г$/, "з").replace(/х$/, "с");
    return uniq([w, `${stem}е`, `${dat}и`, `${stem}у`, `${stem}ом`]);
  }
  // Plural names: Филипи → Филипа, Филипима.
  if (w.endsWith("и")) return ends(s(1), ["и", "а", "има"]);
  if (/[бвгдђжзјклљмнњпрстћфхцчшџ]$/.test(w)) {
    // After a soft consonant the instrumental is -ем: «Коринтом», but «Сионом», «Сихемом»; «Нојем».
    const ins = /[јљњћђчџшжц]$/.test(w) ? "ем" : "ом";
    return ends(w, ["", "а", "у", ins]);
  }
  return [w];
}

const BY_LANGUAGE: Partial<Record<Locale, (w: string) => string[]>> = {
  uk: ukrainian,
  pl: polish,
  cs: czech,
  de: german,
  pt: portuguese,
  sr: serbian,
  sv: nordic,
  da: nordic,
  nb: nordic,
};

/** The forms of a place name in a language other than Russian and English. */
export function inflectedForms(name: string, l: Locale): string[] {
  const forms = BY_LANGUAGE[l];
  if (!forms) return [name];
  // Names of several words: Portuguese spellings only, the words as written.
  if (/[\s-]/.test(name.trim())) return l === "pt" ? portuguese(name) : [name];
  return uniq(forms(name));
}
