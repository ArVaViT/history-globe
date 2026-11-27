// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * A quiz on a tour (or a lesson): for each stop, what happened there with the place taken
 * out, and four places to choose from. Played on screen (QuizPanel) or printed (print.ts).
 */
import { formatRefOr, inCaseOf, pick, placeName, withoutYo, escapeRegExp } from "@hg/model";
import { passageSpan } from "./chapter";
import { whereIn, type LoadedData } from "./data";
import type { Globe } from "./useGlobe";
import { loadVerse } from "./verses";

/**
 * The languages whose names take case endings: «в Иерусалиме», "w Jerozolimie",
 * "v Jeruzalémě", «у Јерусалиму».
 */
const DECLINED: ReadonlySet<string> = new Set(["ru", "uk", "pl", "cs", "sr"]);
/**
 * The languages that add their cases to the end of a name, longer than a Slavic ending
 * ("Jeruzsálemben", "Jerusalemissa"), a name's last vowel changing before them ("Betánia"
 * → "Betániában", "Egypti" → "Egyptissä"), and Romanian, whose article and case stand at a
 * name's end ("Ierusalimul", "Betaniei").
 */
const SUFFIXED: ReadonlySet<string> = new Set(["hu", "fi", "ro"]);

/** A stop's text with its place taken out, for a quiz: every mention, in any case. */
export function maskPlace(
  text: string,
  index: { readonly pattern: RegExp; readonly forms: Readonly<Record<string, string>> } | null,
  placeId: string,
  names: readonly string[],
  locale: string,
): string {
  const gap = "______";
  let out = text;
  if (index)
    out = out.replace(index.pattern, (m) => {
      const k = withoutYo(m.replace(/\s+/g, " "));
      return index.forms[k] === placeId ? gap : m;
    });
  // Names the index leaves alone (one of two Antiochs). English names do not decline: the
  // whole word only, so "Caesarea" leaves "Caesar". Russian ones by their stem with a
  // capital and at most three letters more («Антиохии» as «Антиохия»), never a lower-case
  // word («кесарю» stays). A short word is taken whole.
  // Names in the languages with cases take endings: match their stem.
  const declined = DECLINED.has(locale);
  const suffixed = SUFFIXED.has(locale);
  for (const name of names)
    for (const word of name.split(/\s+/)) {
      if (word.length < 3) continue;
      const stem =
        declined && word.length > 4
          ? word.slice(0, -2)
          : suffixed && word.length > 4
            ? word.replace(locale === "ro" ? /e?a$|[eiouăâî]$/u : /[aeiouyáéíóöőúüűäăâî]$/u, "")
            : word;
      const esc = escapeRegExp(stem);
      // A short Russian name keeps its whole word and takes a case ending («до Дана»),
      // never a longer name («Даниил»).
      const tail = suffixed
        ? "\\p{L}{0,6}"
        : !declined
          ? ""
          : stem === word
            ? "\\p{L}{0,2}"
            : "\\p{L}{0,3}";
      out = out.replace(new RegExp(`(?<![\\p{L}])${esc}${tail}(?![\\p{L}])`, "gu"), gap);
    }
  // Two words of one name taken out are one gap.
  return out.replace(/______(?:[\s-]*______)+/g, gap).trim();
}

/** A verse quoted from mid-sentence («они, узнав…») starts the question with a capital. */
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Four options a question offers: the answer and up to three other stops, in name order. */
export function quizOptions(answer: string, others: readonly string[], seed: number): string[] {
  const pool = [...new Set(others)].filter((n) => n !== answer);
  const picked: string[] = [];
  for (let k = 0; picked.length < 3 && pool.length > 0; k++) {
    const i = (seed * 7 + k * 13) % pool.length;
    picked.push(...pool.splice(i, 1));
  }
  return [answer, ...picked].sort((a, b) => a.localeCompare(b));
}

/** One question of a quiz: the text with its place taken out, four names, the right one. */
export interface QuizItem {
  readonly text: string;
  /** The passage, as the reader writes it (Деян 16:12). */
  readonly ref: string;
  readonly options: readonly string[];
  /** Index of the right option. */
  readonly answer: number;
  /** The options in the nominative, to name the right one after a wrong choice. */
  readonly names: readonly string[];
  /** The place each option names, to fly to it and measure how far off a wrong one is. */
  readonly ids: readonly string[];
}

/**
 * The questions of a quiz on the tour (or lesson) on the map: for each stop, what happened
 * there (its note, or for a lesson its verse) with the place taken out, and four places to
 * choose from. Printed (printQuiz) or played on screen (QuizPanel).
 */
export async function buildQuiz({
  globe,
  data,
}: {
  globe: Globe;
  data: LoadedData;
}): Promise<{ readonly title: string; readonly items: readonly QuizItem[] } | null> {
  const s = globe.engine.store.get();
  const tour = s.tour ? data.tours.find((x) => x.id === s.tour?.id) : undefined;
  if (!tour) return null;

  const nameOf = (id: string) => {
    const p = data.byId.get(id)?.props;
    return p ? placeName(p, s.locale) : id;
  };
  const { loadTextPlaces } = await import("./text-places");
  const index = await loadTextPlaces(s.locale).catch(() => null);
  const texts = await Promise.all(
    tour.stops.map(async (st) => {
      const note = st.note[s.locale] || st.note.en || "";
      // A note too short to ask by («Снова в Листре.» → «Снова ______.»): the verse instead.
      if (note.length >= 30 || !st.ref) return note;
      return (await loadVerse(st.ref, s.locale).catch(() => null)) ?? note;
    }),
  );
  // Two places of one name (the Antiochs, the Bethanys) are told apart by where they are.
  const plain = tour.stops.map((st) => nameOf(st.placeId));
  const names = tour.stops.map((st, i) => {
    const n = plain[i] ?? "";
    const twin = tour.stops.some((o, k) => plain[k] === n && o.placeId !== st.placeId);
    const p = data.byId.get(st.placeId)?.props;
    // In English the source's short name ("Antioch in Pisidia"), not the long today line;
    // in the other languages their own line where it has one.
    const where = !p
      ? undefined
      : s.locale === "en"
        ? (p.where_ref_text ?? p.where)
        : (whereIn(p, s.locale) ?? p.where);
    return twin && where && where !== n ? `${n} (${where})` : n;
  });
  // A tour of two or three places (Ruth) borrows choices from places its chapters name, the
  // most named first, so that each question still offers four.
  const own = new Set(names);
  const chapters = new Set(
    tour.stops.flatMap((st) =>
      (st.ref ?? "").split("-").map((r) => r.split(".").slice(0, 2).join(".")),
    ),
  );
  const borrowed =
    own.size >= 4
      ? []
      : [...data.byId.values()]
          .filter(
            ({ props }) =>
              // Another name of a place already offered (Ephrathah, Bethlehem) is no choice.
              props.where_tpl !== "same" &&
              props.where_tpl !== "same_name" &&
              !props.dup &&
              props.osis.some((o) => chapters.has(o.split(".").slice(0, 2).join("."))),
          )
          .sort((a, b) => b.props.verses - a.props.verses)
          .map(({ props }) => ({
            id: props.id,
            n: placeName(props, s.locale),
          }))
          .filter((x, k, all) => !own.has(x.n) && all.findIndex((y) => y.n === x.n) === k)
          .slice(0, 4 - own.size + 2);
  const pool = [...names, ...borrowed.map((b) => b.n)];
  // Each name offered, back to its place.
  const idOf = new Map<string, string>([
    ...borrowed.map((b) => [b.n, b.id] as const),
    ...tour.stops.map((st, i) => [names[i] ?? "", st.placeId] as const),
  ]);
  // A stop whose passage overlaps another place's (Acts 14:21 names Lystra, Iconium and
  // Antioch at once) would have two right answers: it is left out of the quiz.
  const overlaps = (i: number) =>
    tour.stops.some((o, k) => {
      if (k === i || o.placeId === tour.stops[i]?.placeId) return false;
      // A stop told outside the Bible has no passage to share (Josephus, Jerome).
      const own = tour.stops[i]?.ref;
      if (!own || !o.ref) return false;
      const x = passageSpan(own);
      const y = passageSpan(o.ref);
      return x.book === y.book && x.from <= y.to && y.from <= x.to;
    });
  const items = tour.stops.flatMap((st, i) => {
    const text = texts[i] ?? "";
    if (!text || overlaps(i)) return [];
    const p = data.byId.get(st.placeId)?.props;
    const options = quizOptions(names[i] ?? "", pool, i + 1);
    const shown = s.locale === "ru" ? inCaseOf(text, plain[i] ?? "", options) : options;
    return [
      {
        text: capital(
          maskPlace(text, index, st.placeId, [plain[i] ?? "", p?.name ?? ""], s.locale),
        ),
        ref: st.ref ? formatRefOr(st.ref, s.locale) : (pick(st.source?.cite, s.locale) ?? ""),
        options: shown,
        names: options,
        answer: options.indexOf(names[i] ?? ""),
        ids: options.map((o) => idOf.get(o) ?? ""),
      },
    ];
  });
  return { title: pick(tour.title, s.locale) ?? "", items };
}
