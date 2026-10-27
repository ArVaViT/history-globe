/**
 * The forms of a place name in running text in the languages beyond Russian
 * (scripts/build-text-places.ts; Russian is scripts/russian-forms.ts): the cases of a
 * one-word Ukrainian, Polish, Czech or Serbian name («Єрусалима», "w Jerozolimie",
 * "v Jeruzalémě", «у Јерусалиму»), the German and Nordic genitive ("Jerusalems"), the
 * Hungarian and Finnish case endings ("Jeruzsálemben", "Jerusalemissa") and the Romanian
 * article ("Ierusalimului"). Rules by
 * ending only, no dictionary: a form never met in a text costs nothing, a missed one leaves a
 * name unlinked, and a form that is also an ordinary word is dropped by the index's checks.
 * Names of several words are matched as written, but for the last word's case in Hungarian and
 * Finnish; so are names in a vowel these rules do not know (Мегіддо, Hebrón). Vietnamese and
 * Bulgarian names take no endings.
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

// Hungarian: the case suffixes go straight onto the name, in its vowel harmony: back
// (Pátmoszon, Hebronba), front (Sikemben, Ninivébe) or front rounded (völgyön, völgyhöz).
// A final -a or -e lengthens before them (Betánia → Betániában, Ninive → Ninivét); -val/-vel
// and -vá/-vé take on a final consonant (Jeruzsálemmel, Hebronnal, Ciprussal). The last vowel
// that is not i, í or é decides: Jeruzsálemben, Názárettől, but Dáviddal.
type Harmony = "back" | "front" | "round";
const HU_SUFFIX: Record<Harmony, readonly string[]> = {
  // inessive, illative, elative, dative, allative, sublative, delative, ablative, adessive
  back: ["ban", "ba", "ból", "nak", "hoz", "ra", "ról", "tól", "nál"],
  front: ["ben", "be", "ből", "nek", "hez", "re", "ről", "től", "nél"],
  round: ["ben", "be", "ből", "nek", "höz", "re", "ről", "től", "nél"],
};
// The link vowel of the superessive and the accusative, and the instrumental's and
// translative's own after an assimilated consonant.
const HU_LINK: Record<Harmony, { on: string; at: string[]; val: string; va: string }> = {
  back: { on: "on", at: ["ot"], val: "al", va: "á" },
  front: { on: "en", at: ["et"], val: "el", va: "é" },
  // völgyet, but ködöt: both.
  round: { on: "ön", at: ["et", "öt"], val: "el", va: "é" },
};
const huHarmonies = (w: string): Harmony[] => {
  const vowels = w.toLowerCase().match(/[aáeéiíoóöőuúüű]/g) ?? [];
  // i, í and é are neutral: the vowel before them decides (Dávid → Dáviddal, Karkemis →
  // Karkemisnél); a name of these alone is front (Siddim → Siddimben).
  const decides = [...vowels].reverse().find((v) => !/[iíé]/.test(v)) ?? "e";
  if (/[öőüű]/.test(decides)) return ["round"];
  if (!/[aáoóuú]/.test(decides)) return ["front"];
  // After a back vowel an é goes either way: Athénban, Joppétól, but Penuélnek.
  return /[aáoóuú][^aáoóuú]*é/.test(vowels.join("")) ? ["back", "front"] : ["back"];
};
/** The written consonants, digraphs whole: a doubled sz is ssz, a doubled ny nny. */
const HU_FINAL = /(dzs|cs|dz|gy|ly|ny|sz|ty|zs|[bcdfghjklmnprstvwxz])$/;
/** Common words at the end of a name with a stem of their own: «a Genezáreti-tavon», «utat». */
const HU_STEMS: Record<string, readonly string[]> = {
  tó: ["tavat", "tavon"],
  út: ["utat"],
  kút: ["kutat"],
  torony: ["tornyot", "tornyon"],
  fal: ["falat"],
  tér: ["teret"],
  kő: ["követ", "kövön"],
  víz: ["vizet", "vizen"],
};
function hungarian(w: string): string[] {
  const own = HU_STEMS[w] ?? [];
  if (tooShort(w) && !own.length) return [w];
  const out = [w, ...own, `${w}ként`];
  const vowelEnd = /[aáeéiíoóöőuúüű]$/i.test(w);
  // Betánia → Betániá-, Ninive → Ninivé-; the -i adjective keeps the short vowel (betániai).
  const stem = w.replace(/a$/, "á").replace(/e$/, "é");
  for (const h of huHarmonies(w)) {
    const link = HU_LINK[h];
    // -ként alone keeps the short vowel: Rómaként, but Rómáig.
    out.push(...ends(stem, [...HU_SUFFIX[h], "ig", "ért", "é"]));
    if (vowelEnd) {
      out.push(`${stem}n`, `${stem}t`, `${stem}v${link.val}`, `${stem}v${link.va}`);
      // The possessed name: «Fülöp Cézáreája», «Rómájának».
      out.push(`${stem}j${h === "back" ? "a" : "e"}`, `${stem}j${h === "back" ? "ának" : "ének"}`);
    } else {
      const c = HU_FINAL.exec(w)?.[1] ?? "";
      const double = `${w.slice(0, w.length - c.length)}${c.charAt(0)}${c}`;
      out.push(`${w}${link.on}`, ...link.at.map((a) => w + a), double + link.val, double + link.va);
      // A foreign s said as sz doubles as one: Tiberiasszal (but Ciprussal).
      if (/[^csz]s$/.test(w)) out.push(`${w}sz${link.val}`, `${w}sz${link.va}`);
      // After a sonorant or a hiss the accusative is a bare -t: Hebront, Ciprust, Damaszkuszt.
      if (/(ly|ny|zs|[jlnrsz])$/.test(w)) out.push(`${w}t`);
    }
  }
  // The adjective: «a Jeruzsálemi Talmud»; running text writes it small (jeruzsálemi), which
  // the index leaves to the word checks.
  if (!/[ií]$/.test(w)) out.push(`${w}i`);
  return uniq(out);
}

// Finnish: the cases of a foreign name. A final consonant takes -i- (Jerusalemissa,
// Kapernaumiin); a final vowel takes the endings itself and repeats in the illative (Betaniaan,
// Niiniveen); the Greek -os drops its s in the Bible (Efesos → Efesossa, Efesoon) and becomes
// -okse- today (Efesoksessa, Kyproksella). Endings follow the name's harmony: -ssa after a, o
// or u anywhere, -ssä otherwise (Niinivessä, Egyptissä).
// Consonant gradation, a native word's, is left alone but for the doubled stop of a borrowed
// -tti, -kki, -ppi (Korintti → Korintissa, Korintin; Korinttiin).
const FI_STEMS: Record<string, string> = {
  // The common words that end a name, with a stem of their own: Karmelvuorella, Välimeressä.
  vuori: "vuore",
  meri: "mere",
  järvi: "järve",
};
function finnish(w: string): string[] {
  if (tooShort(w)) return [w];
  const element = Object.keys(FI_STEMS).find((e) => w.endsWith(e));
  if (element) {
    const head = w.slice(0, w.length - element.length);
    const stem = head + (FI_STEMS[element] ?? element);
    // The last word of a compound sets the harmony: Galileanjärvessä.
    const a = /[aou]/.test(element) ? "a" : "ä";
    return uniq([
      w,
      ...ends(stem, ["n", `ss${a}`, `st${a}`, "en", `ll${a}`, "lle", `lt${a}`, `n${a}`, "ksi"]),
      // vuorta, merta, but järveä.
      element === "järvi" ? `${stem}ä` : `${head}${element.slice(0, -1)}ta`,
    ]);
  }
  const a = /[aou]/i.test(w) ? "a" : "ä";
  const greek = /[^aeiouyäö]os$/i.test(w);
  const v = greek ? w.slice(0, -1) : /[aeiouyäö]$/i.test(w) ? w : `${w}i`;
  const weak = v.replace(/(kk|pp|tt)i$/, (m) => `${m.charAt(0)}i`);
  const last = v.charAt(v.length - 1);
  // A long vowel or a diphthong takes -hVn and -tA: Siinaihin, Siinaita.
  const long = /(aa|ee|ii|oo|uu|yy|ää|öö|[aeiouyäö]i|[aeio]u|[äö]y)$/i.test(v);
  return uniq([
    w,
    ...ends(weak, ["n", `ss${a}`, `st${a}`, `ll${a}`, "lle", `lt${a}`, "ksi"]),
    long ? `${v}h${last}n` : `${v}${last}n`,
    long ? `${v}t${a}` : `${v}${a}`,
    `${v}n${a}`,
    // Today's way with the Greek -os, as with a Finnish word in -s: Kyproksella, Patmokselle.
    ...(greek
      ? [
          ...ends(`${v}kse`, ["n", `ss${a}`, `st${a}`, "en", `ll${a}`, "lle", `lt${a}`, `n${a}`]),
          `${w}t${a}`,
        ]
      : []),
  ]);
}

/**
 * Romanian: the article is part of the name. A masculine one takes -ul and -ului (Ierusalimul,
 * Betleemului; Cipru → Ciprul, Ciprului) and the vocative -e (Ierusalime); a feminine one
 * the genitive and dative -ei or -ii (Roma → Romei, Samaria → Samariei; Galileea → Galileii,
 * the older Galileei; Africa → Africii). Pages written with the cedilla letters ş and ţ in place
 * of ș and ț are matched too.
 */
function romanian(w: string): string[] {
  const forms = ((): string[] => {
    if (tooShort(w)) return [w];
    const s = (k: number) => w.slice(0, -k);
    if (w.endsWith("ia")) return [w, `${s(1)}ei`];
    if (w.endsWith("ea")) return [w, `${s(1)}i`, `${s(2)}ii`];
    if (/[cg]a$/.test(w)) return [w, `${s(1)}ii`];
    if (w.endsWith("a")) return [w, `${s(1)}ei`];
    if (w.endsWith("e")) return [w, `${w}i`];
    if (w.endsWith("u")) return [w, `${w}l`, `${w}lui`];
    if (/[bcdfghjklmnprsștțvxz]$/.test(w)) return [w, `${w}ul`, `${w}ului`, `${w}e`];
    return [w];
  })();
  return forms.flatMap((f) => [f, f.replace(/ș/g, "ş").replace(/ț/g, "ţ")]);
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
  hu: hungarian,
  fi: finnish,
  ro: romanian,
};

/**
 * The forms of a name whose last word alone is declined. A Finnish adjective before it would be
 * declined too (Uusi portti → Uudessa portissa), so there only a genitive may stand before it
 * (Jordanin laakso, Pisidian Antiokia); a hyphen joins one word (Abel-Mehola → Abel-Meholassa).
 */
function lastWordForms(name: string, forms: (w: string) => string[]): string[] {
  const at = Math.max(name.lastIndexOf(" "), name.lastIndexOf("-"));
  const head = name.slice(0, at + 1);
  const words = head.trim().split(/\s+/);
  const fi = forms === finnish;
  if (fi && head.includes(" ") && !words.every((x) => /n$/.test(x.split("-").pop() ?? "")))
    return [name];
  return uniq(forms(name.slice(at + 1)).map((f) => head + f));
}

/** The forms of a place name in a language other than Russian and English. */
export function inflectedForms(name: string, l: Locale): string[] {
  const forms = BY_LANGUAGE[l];
  if (!forms) return [name];
  // Names of several words: Portuguese spellings only, the words as written; in Hungarian
  // and Finnish the last word takes the case (a Holt-tengerbe, Pisidian Antiokiassa).
  if (/[\s-]/.test(name.trim())) {
    if (l === "pt") return portuguese(name);
    if (l === "hu" || l === "fi") return lastWordForms(name.trim(), forms);
    return [name];
  }
  return uniq(forms(name));
}
