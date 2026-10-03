/**
 * The forms of a Russian place name in running text, for places in any text
 * (scripts/build-text-places.ts): «Иерусалим» is also «Иерусалима», «Иерусалиме»…, and
 * «Антиохия Писидийская» «Антиохию Писидийскую». Rules by ending only, no dictionary: a
 * form never met in a text costs nothing, a missed one leaves a name unlinked.
 */
/** «ё» is written as «е» in most texts: forms are kept with «е» and matched with either. */
export const plain = (s: string) => s.replaceAll("ё", "е").replaceAll("Ё", "Е");

const HUSH = /[гкхжшчщ]$/;
/** Cases in order: nominative, genitive, dative, accusative, instrumental, prepositional,
 * and the old instrumental in «-ою» the Synodal text uses. */
type Cases = readonly string[];
const ends = (stem: string, e: readonly string[]): Cases => e.map((x) => stem + x);
const SPECIAL: Record<string, readonly string[]> = {
  Море: ["Море", "Моря", "Морю", "Море", "Морем", "Море", "Морем"],
  Поле: ["Поле", "Поля", "Полю", "Поле", "Полем", "Поле", "Полем"],
  Ворота: ["Ворота", "Ворот", "Воротам", "Ворота", "Воротами", "Воротах", "Воротами"],
  // A vowel that drops out: «в Египте», «из Египта».
  Египет: ["Египет", "Египта", "Египту", "Египет", "Египтом", "Египте", "Египтом"],
};
/** A noun's cases by its ending; null when the ending does not tell (a soft sign). */
function nounCases(w: string): Cases | null {
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const special = SPECIAL[cap];
  if (special) return special.map((x) => (w === cap ? x : x.toLowerCase()));
  const s = (k: number) => w.slice(0, w.length - k);
  // A vowel before the ending, and short names, are not declined («Коа» would give «Кое»,
  // «Шоа» «Шоу»); nor are foreign names in a vowel: Мегиддо, Мамре.
  if (w.length < 3 || /[аеиоуыэюя]а$/.test(w)) return null;
  if (w.endsWith("ия")) return ends(s(2), ["ия", "ии", "ии", "ию", "ией", "ии", "иею"]);
  if (w.endsWith("я")) return ends(s(1), ["я", "и", "е", "ю", "ей", "е", "ею"]);
  if (w.endsWith("а"))
    return ends(s(1), ["а", HUSH.test(s(1)) ? "и" : "ы", "е", "у", "ой", "е", "ою"]);
  if (w.endsWith("й")) return ends(s(1), ["й", "я", "ю", "й", "ем", "е", "ем"]);
  // Plural names: Афины, Фивы, Колоссы.
  if (w.endsWith("ы")) return ends(s(1), ["ы", "", "ам", "ы", "ами", "ах", "ами"]);
  if (/[бвгдзклмнпрстфхжшчщц]$/.test(w)) {
    const o = /[жшчщц]$/.test(w) ? "ем" : "ом";
    return ends(w, ["", "а", "у", "", o, "е", o]);
  }
  return null;
}
/** An adjective's cases (Писидийская, Галаадский, Филиппова); null if it is none. */
function adjectiveCases(w: string): Cases | null {
  const s = (k: number) => w.slice(0, w.length - k);
  if (/[^я]ая$/.test(w)) return ends(s(2), ["ая", "ой", "ой", "ую", "ой", "ой", "ою"]);
  if (w.endsWith("яя")) return ends(s(2), ["яя", "ей", "ей", "юю", "ей", "ей", "ею"]);
  if (w.endsWith("ий"))
    return HUSH.test(s(2))
      ? ends(s(2), ["ий", "ого", "ому", "ий", "им", "ом", "им"])
      : ends(s(2), ["ий", "его", "ему", "ий", "им", "ем", "им"]);
  if (w.endsWith("ый")) return ends(s(2), ["ый", "ого", "ому", "ый", "ым", "ом", "ым"]);
  if (w.endsWith("ое")) {
    const ym = HUSH.test(s(2)) ? "им" : "ым";
    return ends(s(2), ["ое", "ого", "ому", "ое", ym, "ом", ym]);
  }
  if (w.endsWith("ее")) return ends(s(2), ["ее", "его", "ему", "ее", "им", "ем", "им"]);
  if (w.endsWith("ие")) return ends(s(2), ["ие", "их", "им", "ие", "ими", "их", "ими"]);
  if (w.endsWith("ые")) return ends(s(2), ["ые", "ых", "ым", "ые", "ыми", "ых", "ыми"]);
  return null;
}
/**
 * A possessive after a noun: «Кесария Филиппова», «Кедес Неффалимов». Only in second place
 * and of a long enough stem: «Долина» and «Син» end the same way and are nouns.
 */
function possessiveCases(w: string): Cases | null {
  if (!/^\p{Lu}/u.test(w) || w.length < 6) return null;
  if (/(ов|ев|ин)а$/.test(w)) return ends(w.slice(0, -1), ["а", "ой", "ой", "у", "ой", "ой", "ою"]);
  if (/(ов|ев|ин)$/.test(w)) return ends(w, ["", "а", "у", "", "ым", "ом", "ым"]);
  return null;
}
/** Words a name begins with that running text writes small: «на горе Синай». */
export const COMMON =
  /^(Гора|Горы|Долина|Поток|Пустыня|Море|Озеро|Река|Ворота|Башня|Город|Источник|Холм|Земля|Страна|Дубрава|Лес|Пруд|Притвор|Улица)$/;

/** The forms of a Russian name in running text: its cases, by the endings of its words. */
export function russianForms(name: string): string[] {
  const n = plain(name);
  const words = n.split(" ");
  const uniq = (xs: readonly string[]) => [...new Set(xs)];
  if (words.length === 1) {
    const c = nounCases(n);
    if (c) return uniq(c);
    // A soft sign does not tell the gender: both declensions (Вефиль, Сихарь).
    if (n.endsWith("ь") && n.length >= 4)
      return uniq(ends(n.slice(0, -1), ["ь", "я", "ю", "ем", "е", "и", "ью"]));
    return [n];
  }
  const [w0 = "", w1 = "", ...rest] = words;
  const tail = rest.length ? ` ${rest.join(" ")}` : "";
  let forms: string[] = [n];
  const a0 = COMMON.test(w0) ? null : adjectiveCases(w0);
  const n0 = nounCases(w0);
  const n1 = nounCases(w1);
  const a1 = adjectiveCases(w1) ?? possessiveCases(w1);
  // «Соленое море», «Нижний Беф-Орон»: both words agree.
  if (a0) forms = n1 ? a0.map((x, i) => `${x} ${n1[i]}${tail}`) : [n];
  // A possessive in front («Аппиева площадь»): the second word's case is not known.
  else if (/^\p{Lu}/u.test(w0) && /(ов|ев|ин)[аоы]?$/.test(w0) && !COMMON.test(w0)) forms = [n];
  // «Антиохия Писидийская»: both words agree; «Гора Синай», «Долина Сорек»: the first only.
  else if (n0 && a1) forms = n0.map((x, i) => `${x} ${a1[i]}${tail}`);
  else if (n0) forms = n0.map((x) => `${x} ${w1}${tail}`);
  // «на горе Синай»: a common noun in front is written small, the name stays capitalised.
  if (COMMON.test(w0) && /^\p{Lu}/u.test(w1))
    forms = [...forms, ...forms.map((f) => f.charAt(0).toLowerCase() + f.slice(1))];
  return uniq(forms);
}

/**
 * What a text also calls a place of two words by one of them: «Кармил» for «Гора Кармил»,
 * «Антиохия» for «Антиохия Писидийская», «Кадес» for «Кадес-Варни». Not a name to link,
 * but a claim on the shorter one, which a namesake must not take unchallenged.
 */
export function russianHeads(name: string): string[] {
  const n = plain(name);
  const words = n.split(" ");
  const heads: string[] = [];
  const [w0 = "", w1 = ""] = words;
  if (words.length === 2 && COMMON.test(w0) && /^\p{Lu}/u.test(w1)) heads.push(w1);
  if (words.length === 2 && (adjectiveCases(w1) ?? possessiveCases(w1))) heads.push(w0);
  const hyphen = /^(\p{Lu}\p{Ll}+)-\p{Lu}/u.exec(n);
  if (words.length === 1 && hyphen?.[1]) heads.push(hyphen[1]);
  return heads;
}
