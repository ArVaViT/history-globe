import { formatRef, formatYear, periodAt } from "@hg/model";
import { chapterLabel, firstVerseIn, readingOrder } from "./chapter";
import { DATA_URL, type LoadedData } from "./data";
import type { Globe } from "./useGlobe";
import { loadVerse } from "./verses";
import { distanceKm, roundKm } from "./distance";
import { romanLeg } from "./leg";
import { russianCases } from "../../../scripts/russian-forms.ts";

/**
 * A sheet for a class: the map as drawn, under a title and the year, with the stops of the
 * tour or the places of the chapter and their verses, the data's credits (the licences ask
 * for them on every copy) and the address of the view. Built when asked, printed by the
 * browser on A4 (styles.css, `@page hg-sheet`), and taken away after.
 */
export interface PrintSheet {
  readonly locale: string;
  readonly title: string;
  /** The year and the period: "AD 50 · Early Roman". */
  readonly when: string;
  readonly image: string;
  readonly items: readonly {
    readonly n?: number;
    readonly name: string;
    readonly ref: string;
    readonly note?: string;
  }[];
  readonly attribution: string;
  readonly url: string;
  /** An outline map: a line to write each name on, the passage beside it. */
  readonly blank?: boolean;
  /** Over the lines left for the pupils' notes on an outline map. */
  readonly notes?: string;
  /** A scale bar: its length and its label ("50 км"), as a share of the map's width. */
  readonly scale?: { readonly share: number; readonly label: string };
  /** "↑ С": the sheet's map has north up. */
  readonly north?: string;
}

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

/**
 * The link as read, not escaped: a lesson's name in its own letters, and only what would
 * break the link if typed back (a space, &, #, +, %) still escaped.
 */
export function readableLink(link: string): string {
  const [base = "", query = ""] = link.split("?");
  return query
    ? `${base}?${[...new URLSearchParams(query)]
        .map(([k, v]) => `${k}=${v.replace(/[%&#+]/g, encodeURIComponent).replace(/ /g, "+")}`)
        .join("&")}`
    : link;
}

/** The height of an A4 page inside its margins (styles.css, `@page hg-sheet`), less a
 * little for the browser's own breaks, in CSS pixels. */
const PAGE_PX = ((297 - 24 - 4) * 96) / 25.4;

/**
 * The layout that keeps the sheet one page, measured off screen at the page's width: as
 * built, the stops in two columns, then the map a little smaller. A sheet longer than all
 * of them keeps two columns and takes the pages it needs. Balaam's eighth stop went over
 * to a second page alone.
 */
function fitOnePage(sheet: HTMLElement, list: HTMLElement | null): void {
  sheet.classList.add("hg-measure");
  const fits = () => sheet.getBoundingClientRect().height <= PAGE_PX;
  const tries: [Element | null, string][] = [
    [list, "many"],
    [sheet, "tight"],
    [sheet, "tighter"],
    [sheet, "tightest"],
  ];
  for (const [el, name] of tries) {
    if (fits()) break;
    el?.classList.add(name);
  }
  if (!fits()) sheet.classList.remove("tight", "tighter", "tightest");
  sheet.classList.remove("hg-measure");
}

export async function printSheet(s: PrintSheet): Promise<void> {
  document.getElementById("hg-print")?.remove();
  const sheet = make("section", `hg-sheet${s.blank ? " blank" : ""}`);
  sheet.id = "hg-print";
  sheet.lang = s.locale;
  sheet.setAttribute("aria-hidden", "true");

  const head = make("header", "hg-sheet-head");
  const titles = make("div", "");
  titles.append(make("h1", "", s.title || "History Globe"), make("p", "hg-sheet-when", s.when));
  head.append(titles, make("p", "hg-sheet-brand", "History Globe"));

  const img = make("img", "hg-sheet-map");
  img.alt = "";
  img.src = s.image;

  sheet.append(head, img);
  if (s.scale) {
    const bar = make("div", "hg-sheet-scale");
    const line = make("span", "");
    line.style.width = `${String(s.scale.share * 100)}%`;
    // The sheet's map is framed north up (frameForPrint): said once, beside the scale.
    bar.append(line, make("span", "", s.scale.label), make("span", "hg-sheet-north", s.north));
    sheet.append(bar);
  }
  if (s.items.length > 0) {
    // A long tour's stops in two columns, so that the sheet stays one page (fitOnePage
    // chooses for fewer stops).
    const list = make(
      "ol",
      `hg-sheet-list${s.blank || s.items.some((i) => i.note) ? " notes" : ""}${s.items.length >= 10 ? " many" : ""}`,
    );
    for (const i of s.items) {
      const li = make("li", "");
      if (i.n !== undefined) li.append(make("span", "hg-sheet-n", String(i.n)));
      const body = make("div", "");
      const line = make("p", "hg-sheet-place");
      line.append(
        s.blank ? make("span", "hg-sheet-blank") : make("b", "", i.name),
        make("span", "hg-sheet-ref", i.ref),
      );
      body.append(line);
      if (i.note && !s.blank) body.append(make("p", "hg-sheet-note", i.note));
      li.append(body);
      list.append(li);
    }
    sheet.append(list);
  }
  // An outline map's free room: lines for what the pupils find, while the page has it.
  if (s.blank && s.notes && s.items.length < 10) {
    const lines = make("div", "hg-sheet-lines");
    lines.append(make("p", "", s.notes));
    for (let i = 0; i < 10 - s.items.length; i++) lines.append(make("span", ""));
    sheet.append(lines);
  }
  const foot = make("footer", "hg-sheet-foot");
  const url = readableLink(s.url);
  foot.append(make("p", "", s.attribution), make("p", "hg-sheet-url", url));
  sheet.append(foot);
  document.body.append(sheet);

  await img.decode().catch(() => undefined);
  fitOnePage(sheet, sheet.querySelector("ol"));
  const done = () => {
    sheet.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/**
 * The sheet for the view as it is: a tour framed whole with its stops and notes, a
 * chapter with its places numbered in reading order, or the open place; the map is
 * reframed for the picture and given back as it was.
 */
export async function printForClass({
  globe,
  data,
  personLabel,
  setPreparing,
  blank = false,
}: {
  globe: Globe;
  data: LoadedData;
  personLabel: string;
  setPreparing: (on: boolean) => void;
  /** An outline map for pupils to fill in (a tour's or a chapter's). */
  blank?: boolean;
}): Promise<void> {
  const s = globe.engine.store.get();
  const ru = s.locale === "ru";
  const nameOf = (id: string) => {
    const p = data.byId.get(id)?.props;
    return p ? (ru ? (p.name_ru ?? p.name) : p.name) : id;
  };
  const ref = (osis: string) => {
    try {
      return formatRef(osis, s.locale);
    } catch {
      return osis;
    }
  };
  const tour = s.tour ? data.tours.find((x) => x.id === s.tour?.id) : undefined;
  const chapter = s.focus && !s.focus.ref.startsWith("person:") ? s.focus : null;
  const chapterOrder = chapter
    ? readingOrder(chapter.places, (id) => data.byId.get(id)?.props.osis ?? [], chapter.ref)
    : [];
  const place = s.selectedPlace ? data.byId.get(s.selectedPlace)?.props : undefined;
  // The route or the chapter framed on the whole sheet, then the view as it was.
  const points = tour
    ? tour.stops.map((st) => st.at)
    : chapter
      ? chapter.places.flatMap((id) => {
          const at = data.byId.get(id)?.info.at;
          return at ? [at] : [];
        })
      : place
        ? [data.byId.get(place.id)?.info.at].filter((at) => at !== undefined)
        : [];
  setPreparing(true);
  let shot: Awaited<ReturnType<typeof globe.renderer.snapshot>>;
  let across = 0;
  // A tour's whole route as walked on the sheet, no stop singled out (from its first stop,
  // the rest was a faint dash); the route as it was comes back after.
  const route = tour?.stops.map((st) => st.at) ?? [];
  if (tour) globe.renderer.setRoute(route, route.length);
  try {
    // A chapter's places numbered in reading order, on the map and in the list alike.
    const restore = await globe.renderer.frameForPrint(
      points,
      chapterOrder.flatMap((id, i) => {
        const at = data.byId.get(id)?.info.at;
        return at ? [{ at, n: i + 1 }] : [];
      }),
      blank,
    );
    try {
      shot = await globe.renderer.snapshot();
      // How far the sheet's map reaches across its middle, for its scale bar (flat, as framed).
      const m = globe.renderer.map;
      const box = m.getContainer();
      const a = m.unproject([0, box.clientHeight / 2]);
      const b = m.unproject([box.clientWidth, box.clientHeight / 2]);
      across = distanceKm([a.lng, a.lat], [b.lng, b.lat]);
    } finally {
      restore();
    }
  } finally {
    // The route as the engine has it now (a tour may have ended meanwhile).
    if (tour) {
      const now = globe.engine.store.get().tour;
      const running = now ? data.tours.find((x) => x.id === now.id) : undefined;
      globe.renderer.setRoute(running?.stops.map((st) => st.at) ?? [], now?.step ?? -1);
    }
    setPreparing(false);
  }
  const shortUrl = () => {
    const q = new URLSearchParams(
      tour
        ? { tour: tour.id, locale: s.locale }
        : chapter
          ? { ref: chapter.ref, locale: s.locale }
          : place
            ? { place: place.id, year: String(s.year), locale: s.locale }
            : { year: String(s.year), locale: s.locale },
    );
    // A lesson's places travel with it (lesson.ts).
    const lesson = new URLSearchParams(window.location.search).get("lesson");
    if (tour?.id === "lesson" && lesson) q.set("lesson", lesson);
    const title = new URLSearchParams(window.location.search).get("title");
    if (tour?.id === "lesson" && lesson && title) q.set("title", title);
    // Layers turned off stay off.
    const hide = new URLSearchParams(window.location.search).get("hide");
    if (hide) q.set("hide", hide);
    return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
  };
  const period = periodAt(s.year);
  // A lesson's stops have no notes: the sheet gives each one its verse, as the screen does.
  const verses =
    tour?.id === "lesson" && !blank
      ? await Promise.all(
          tour.stops.map((st) =>
            loadVerse(st.ref, s.locale).then(
              (v) => v ?? "",
              () => "",
            ),
          ),
        )
      : [];
  // The legs along the Roman roads, as the stop's card gives them (build-road-legs.ts):
  // the tour's own, or for a lesson's stop picked in their time, the same two places'.
  const roads = (
    tour && !blank
      ? await fetch(`${DATA_URL}/road-legs.json`)
          .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : {}))
          // Without the roads the sheet still prints, in straight lines.
          .catch(() => ({}))
      : {}
  ) as Record<string, unknown>;
  const byRoad = (i: number) => {
    const own = (roads[tour?.id ?? ""] as (number | null)[] | undefined)?.[i];
    const st = tour?.stops[i];
    const prev = tour?.stops[i - 1];
    // As the card: no road for a voyage or for stops that are not a way travelled.
    if (!tour || !st || !prev || st.sea || tour.walked === false) return null;
    if (own != null) return own;
    return tour.id === "lesson" && romanLeg(tour, i)
      ? ((roads["@pairs"] as Record<string, number> | undefined)?.[
          `${prev.placeId}>${st.placeId}`
        ] ?? null)
      : null;
  };
  const leg = (i: number) => {
    const a = tour?.stops[i - 1]?.at;
    const b = tour?.stops[i]?.at;
    if (!a || !b) return "";
    const d = distanceKm(a, b);
    if (d < 2) return "";
    const n = new Intl.NumberFormat(s.locale).format(roundKm(d));
    const road = byRoad(i);
    const by = road ? new Intl.NumberFormat(s.locale).format(roundKm(road)) : "";
    return ru
      ? `≈\u00a0${n}\u00a0км по прямой${by ? `, ≈\u00a0${by}\u00a0км по\u00a0римским\u00a0дорогам` : ""}`
      : `≈\u00a0${n}\u00a0km in a straight line${by ? `, ≈\u00a0${by}\u00a0km by\u00a0Roman\u00a0roads` : ""}`;
  };
  await printSheet({
    locale: s.locale,
    title: tour
      ? (tour.title[s.locale] ?? tour.title.en ?? "")
      : chapter
        ? chapterLabel(chapter.ref, s.locale)
        : s.focus
          ? personLabel
          : place
            ? nameOf(place.id)
            : "",
    blank,
    notes: ru ? "Заметки и вопросы" : "Notes and questions",
    north: ru ? "↑\u00a0север" : "↑\u00a0north",
    when: [
      blank ? (ru ? "Контурная карта: подпишите места" : "Outline map: name the places") : "",
      formatYear(s.year, s.locale),
      period ? (ru ? period.name.ru : period.name.en) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    image: shot.image,
    // A round length near a quarter of the width: 1, 2 or 5 times a power of ten.
    ...(across > 0
      ? (() => {
          const step = 10 ** Math.floor(Math.log10(across / 4));
          const km = [5, 2, 1].map((k) => k * step).find((k) => k <= across / 4) ?? step;
          const n = new Intl.NumberFormat(s.locale).format(km);
          return { scale: { share: km / across, label: ru ? `${n}\u00a0км` : `${n}\u00a0km` } };
        })()
      : {}),
    items: tour
      ? tour.stops.map((st, i) => ({
          n: i + 1,
          name: nameOf(st.placeId),
          // The passage, and how far the stop is from the one before, as the card says it.
          ref: [ref(st.ref), leg(i)].filter(Boolean).join(" · "),
          note: st.note[s.locale] || st.note.en || verses[i] || "",
        }))
      : chapter
        ? chapterOrder.map((id, i) => {
            const v = firstVerseIn(data.byId.get(id)?.props.osis ?? [], chapter.ref);
            return { n: i + 1, name: nameOf(id), ref: v ? ref(v) : "" };
          })
        : [],
    // The credits in the sheet's language (the Copernicus notice stays as worded).
    attribution: ru
      ? shot.attribution
          .replace(/, modified/g, ", с изменениями")
          .replace("Ancient sites:", "Древние города:")
          .replace("Roman roads:", "Римские дороги:")
          .replace("Terrain:", "Рельеф:")
          .replace(" et al.", " и др.")
      : shot.attribution,
    // A short address a class can type: what is shown, not the camera's decimals.
    // A person's view is not in the address: that one keeps the camera as it is.
    url: s.focus?.ref.startsWith("person:") ? window.location.href : shortUrl(),
  });
}

/** A stop's text with its place taken out, for a quiz: every mention, in any case. */
export function maskPlace(
  text: string,
  index: { readonly pattern: RegExp; readonly forms: Readonly<Record<string, string>> } | null,
  placeId: string,
  names: readonly string[],
  locale = "ru",
): string {
  const gap = "______";
  let out = text;
  if (index)
    out = out.replace(index.pattern, (m) => {
      const k = m.replace(/\s+/g, " ").replace(/ё/g, "е").replace(/Ё/g, "Е");
      return index.forms[k] === placeId ? gap : m;
    });
  // Names the index leaves alone (one of two Antiochs). English names do not decline: the
  // whole word only, so "Caesarea" leaves "Caesar". Russian ones by their stem with a
  // capital and at most three letters more («Антиохии» as «Антиохия»), never a lower-case
  // word («кесарю» stays). A short word is taken whole.
  for (const name of names)
    for (const word of name.split(/\s+/)) {
      if (word.length < 3) continue;
      const ru = locale === "ru";
      const stem = ru && word.length > 4 ? word.slice(0, -2) : word;
      const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // A short Russian name keeps its whole word and takes a case ending («до Дана»),
      // never a longer name («Даниил»).
      const tail = !ru ? "" : stem === word ? "\\p{L}{0,2}" : "\\p{L}{0,3}";
      out = out.replace(new RegExp(`(?<![\\p{L}])${esc}${tail}(?![\\p{L}])`, "gu"), gap);
    }
  // Two words of one name taken out are one gap.
  return out.replace(/______(?:[\s-]*______)+/g, gap).trim();
}

/** The case a preposition before a Russian name asks for (index into russianCases). */
const CASE_AFTER: Readonly<Record<string, number>> = {
  в: 5,
  во: 5,
  на: 5,
  о: 5,
  об: 5,
  при: 5,
  из: 1,
  от: 1,
  до: 1,
  у: 1,
  около: 1,
  близ: 1,
  к: 2,
  ко: 2,
  по: 2,
};

/**
 * The quiz's choices in the case the gap stands in: «вышел из ______» offers «Ефеса» and
 * «Вифлеема», not «Ефес». The case is the one the answer's name takes in the text; where a
 * form could be several cases («Самарии»), the preposition before it decides. Unknown, or
 * one choice that does not decline: the choices stay as they are.
 */
export function inCaseOf(text: string, answer: string, options: readonly string[]): string[] {
  const own = russianCases(answer);
  if (!own) return [...options];
  const plain = (x: string) => x.replace(/ё/g, "е");
  const t = plain(text);
  // Every mention of the answer, whole form against whole form, with the cases it can be.
  const found = new Map<number, Set<number>>();
  own.forEach((form, i) => {
    const esc = plain(form).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of t.matchAll(new RegExp(`(?<![\\p{L}-])${esc}(?![\\p{L}-])`, "gu")))
      found.set(m.index, (found.get(m.index) ?? new Set()).add(i));
  });
  if (found.size === 0) return [...options];
  const cases = new Set<number>();
  for (const [at, can] of found) {
    if (can.has(0)) return [...options];
    const before = (/(\p{L}+)\s+$/u.exec(t.slice(0, at))?.[1] ?? "").toLowerCase();
    const after = CASE_AFTER[before];
    const index =
      can.size === 1 ? [...can][0] : after !== undefined && can.has(after) ? after : undefined;
    if (index === undefined) return [...options];
    cases.add(index === 6 ? 4 : index);
  }
  // Two gaps in two cases («в ______ … из ______»): one set of choices cannot fit both.
  if (cases.size !== 1) return [...options];
  const index = [...cases][0] ?? 0;
  const out = options.map((o) => {
    const [base = "", rest] = o.split(/(?= \()/);
    const c = russianCases(base);
    return c?.[index] === undefined ? null : `${c[index]}${rest ?? ""}`;
  });
  return out.every((x) => x !== null) ? out : [...options];
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
  const ru = s.locale === "ru";
  const nameOf = (id: string) => {
    const p = data.byId.get(id)?.props;
    return p ? (ru ? (p.name_ru ?? p.name) : p.name) : id;
  };
  const { loadTextPlaces } = await import("./text-places");
  const index = await loadTextPlaces(s.locale).catch(() => null);
  const texts = await Promise.all(
    tour.stops.map(async (st) => {
      const note = st.note[s.locale] || st.note.en || "";
      // A note too short to ask by («Снова в Листре.» → «Снова ______.»): the verse instead.
      if (note.length >= 30) return note;
      return (await loadVerse(st.ref, s.locale).catch(() => null)) ?? note;
    }),
  );
  // Two places of one name (the Antiochs, the Bethanys) are told apart by where they are.
  const plain = tour.stops.map((st) => nameOf(st.placeId));
  const names = tour.stops.map((st, i) => {
    const n = plain[i] ?? "";
    const twin = tour.stops.some((o, k) => plain[k] === n && o.placeId !== st.placeId);
    const p = data.byId.get(st.placeId)?.props;
    // In English the source's short name ("Antioch in Pisidia"), not the long today line.
    const where = ru ? (p?.where_ru ?? p?.where) : (p?.where_ref_text ?? p?.where);
    return twin && where && where !== n ? `${n} (${where})` : n;
  });
  // A tour of two or three places (Ruth) borrows choices from places its chapters name, the
  // most named first, so that each question still offers four.
  const own = new Set(names);
  const chapters = new Set(
    tour.stops.flatMap((st) => st.ref.split("-").map((r) => r.split(".").slice(0, 2).join("."))),
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
            n: ru ? (props.name_ru ?? props.name) : props.name,
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
  const span = (ref: string) => {
    const [a = "", b = a] = ref.split("-");
    const at = (r: string) => {
      const [book = "", c = "0", v = "0"] = r.split(".");
      return { book, n: Number(c) * 1000 + Number(v) };
    };
    return { from: at(a), to: at(b) };
  };
  const overlaps = (i: number) =>
    tour.stops.some((o, k) => {
      if (k === i || o.placeId === tour.stops[i]?.placeId) return false;
      const x = span(tour.stops[i]?.ref ?? "");
      const y = span(o.ref);
      return x.from.book === y.from.book && x.from.n <= y.to.n && y.from.n <= x.to.n;
    });
  const items = tour.stops.flatMap((st, i) => {
    const text = texts[i] ?? "";
    if (!text || overlaps(i)) return [];
    const p = data.byId.get(st.placeId)?.props;
    const options = quizOptions(names[i] ?? "", pool, i + 1);
    const shown = ru ? inCaseOf(text, plain[i] ?? "", options) : options;
    return [
      {
        text: capital(
          maskPlace(text, index, st.placeId, [plain[i] ?? "", p?.name ?? ""], s.locale),
        ),
        ref: (() => {
          try {
            return formatRef(st.ref, s.locale);
          } catch {
            return st.ref;
          }
        })(),
        options: shown,
        names: options,
        answer: options.indexOf(names[i] ?? ""),
        ids: options.map((o) => idOf.get(o) ?? ""),
      },
    ];
  });
  return { title: tour.title[s.locale] ?? tour.title.en ?? "", items };
}

/**
 * The quiz printed for a class, on A4 as the sheets are: the questions with four lettered
 * places each, the answers at the foot of the sheet.
 */
export async function printQuiz({
  globe,
  data,
}: {
  globe: Globe;
  data: LoadedData;
}): Promise<void> {
  const quiz = await buildQuiz({ globe, data });
  if (!quiz) return;
  const s = globe.engine.store.get();
  const ru = s.locale === "ru";
  const letters = ru ? ["А", "Б", "В", "Г"] : ["A", "B", "C", "D"];
  const items = quiz.items.map((it) => ({ ...it, answer: letters[it.answer] ?? "" }));

  document.getElementById("hg-print")?.remove();
  const sheet = make("section", "hg-sheet quiz");
  sheet.id = "hg-print";
  sheet.lang = s.locale;
  sheet.setAttribute("aria-hidden", "true");
  const head = make("header", "hg-sheet-head");
  const titles = make("div", "");
  titles.append(
    make("h1", "", quiz.title),
    make(
      "p",
      "hg-sheet-when",
      ru
        ? "Викторина: где это было? Найдите отрывок и обведите букву."
        : "Quiz: where did it happen? Find the passage and circle a letter.",
    ),
  );
  head.append(titles, make("p", "hg-sheet-brand", "History Globe"));
  sheet.append(head);
  const list = make("ol", "hg-quiz");
  items.forEach((it, i) => {
    const li = make("li", "");
    const q = make("p", "hg-quiz-q");
    q.append(
      make("b", "hg-quiz-n", `${String(i + 1)}.`),
      make("span", "", it.text),
      make("span", "hg-sheet-ref", it.ref),
    );
    const opts = make("p", "hg-quiz-o");
    it.options.forEach((o, k) => {
      opts.append(make("span", "", `${letters[k] ?? ""}) ${o}`));
    });
    li.append(q, opts);
    list.append(li);
  });
  sheet.append(list);
  const foot = make("footer", "hg-sheet-foot");
  foot.append(
    make(
      "p",
      "hg-quiz-key",
      `${ru ? "Ответы" : "Answers"}: ${items.map((it, i) => `${String(i + 1)} — ${it.answer}`).join("; ")}`,
    ),
  );
  sheet.append(foot);
  document.body.append(sheet);
  const done = () => {
    sheet.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
