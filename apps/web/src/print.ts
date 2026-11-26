// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import {
  distanceKm,
  formatRefOr,
  formatYear,
  periodAt,
  periodName,
  placeName,
  roundKm,
  pick,
} from "@hg/model";
import { chapterLabel, chapterOf, firstVerseIn, isPersonRef, readingOrder } from "./chapter";
import type { LoadedData } from "./data";
import type { Globe } from "./useGlobe";
import { loadVerse } from "./verses";
import { translate } from "./i18n";
import { loadRoadLegs, roadKm } from "./leg";
import { buildQuiz } from "./quiz";
import { LESSON } from "./lesson";

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
  /** A scale bar: its length and its label ("50 km"), as a share of the map's width. */
  readonly scale?: { readonly share: number; readonly label: string };
  /** "↑ N": the sheet's map has north up. */
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
 * of them keeps two columns and takes the pages it needs.
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

/**
 * A new sheet in place of any earlier one, headed by its title and the line under it. It
 * is for the printer only: hidden from screen readers.
 */
function newSheet(className: string, locale: string, title: string, sub: string): HTMLElement {
  document.getElementById("hg-print")?.remove();
  const sheet = make("section", className);
  sheet.id = "hg-print";
  sheet.lang = locale;
  sheet.setAttribute("aria-hidden", "true");
  const head = make("header", "hg-sheet-head");
  const titles = make("div", "");
  titles.append(make("h1", "", title), make("p", "hg-sheet-when", sub));
  head.append(titles, make("p", "hg-sheet-brand", "History Globe"));
  sheet.append(head);
  return sheet;
}

/** Prints the sheet, and takes it away once the browser's print is done. */
function printAndRemove(sheet: HTMLElement): void {
  const done = () => {
    sheet.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/**
 * The English words of the map's credits (@hg/core style.ts, useGlobe.ts) and the keys
 * that put them in the sheet's language; the Copernicus notice stays as worded.
 */
export const CREDIT_WORDS: readonly (readonly [
  RegExp | string,
  string,
  (word: string) => string,
])[] = [
  [/, modified/g, "sheet.credit_modified", (w) => `, ${w}`],
  ["Ancient sites:", "sheet.credit_ancient", (w) => `${w}:`],
  ["Roman roads:", "sheet.credit_roads", (w) => `${w}:`],
  ["Terrain:", "sheet.credit_terrain", (w) => `${w}:`],
  [" et al.", "sheet.credit_et_al", (w) => ` ${w}`],
];

/** The map's credits in the sheet's language. */
export function sheetCredits(attribution: string, locale: string): string {
  return CREDIT_WORDS.reduce(
    (text, [english, key, put]) => text.replace(english, put(translate(locale, key))),
    attribution,
  );
}

export async function printSheet(s: PrintSheet): Promise<void> {
  const sheet = newSheet(
    `hg-sheet${s.blank ? " blank" : ""}`,
    s.locale,
    s.title || "History Globe",
    s.when,
  );
  const img = make("img", "hg-sheet-map");
  img.alt = "";
  img.src = s.image;

  sheet.append(img);
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
  printAndRemove(sheet);
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
  const nameOf = (id: string) => {
    const p = data.byId.get(id)?.props;
    return p ? placeName(p, s.locale) : id;
  };
  const ref = (osis: string) => formatRefOr(osis, s.locale);
  const tour = s.tour ? data.tours.find((x) => x.id === s.tour?.id) : undefined;
  const chapter = chapterOf(s.focus);
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
    if (tour?.id === LESSON && lesson) q.set("lesson", lesson);
    const title = new URLSearchParams(window.location.search).get("title");
    if (tour?.id === LESSON && lesson && title) q.set("title", title);
    // Layers turned off stay off.
    const hide = new URLSearchParams(window.location.search).get("hide");
    if (hide) q.set("hide", hide);
    return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
  };
  const period = periodAt(s.year);
  // A lesson's stops have no notes: the sheet gives each one its verse, as the screen does.
  const verses =
    tour?.id === LESSON && !blank
      ? await Promise.all(
          tour.stops.map((st) =>
            loadVerse(st.ref ?? "", s.locale).then(
              (v) => v ?? "",
              () => "",
            ),
          ),
        )
      : [];
  // The legs along the Roman roads, as the stop's card gives them.
  const roads = tour && !blank ? await loadRoadLegs() : null;
  const byRoad = (i: number) => (tour && roads ? roadKm(roads, tour, i) : null);
  const leg = (i: number) => {
    const a = tour?.stops[i - 1]?.at;
    const b = tour?.stops[i]?.at;
    if (!a || !b) return "";
    const d = distanceKm(a, b);
    if (d < 2) return "";
    const n = new Intl.NumberFormat(s.locale).format(roundKm(d));
    const road = byRoad(i);
    const by = road ? new Intl.NumberFormat(s.locale).format(roundKm(road)) : "";
    // The number keeps its sign and its unit on its line (a thousands separator included);
    // the way by road stays whole.
    const nb = (x: string) => x.replace(/^≈ /, "≈\u00a0").replace(/(\d) (?=\p{L})/u, "$1\u00a0");
    const line = nb(translate(s.locale, "sheet.distance", { km: n }));
    const way = translate(s.locale, "sheet.distance_road", { km: by }).replace(/ /g, "\u00a0");
    return by ? `${line}, ${way}` : line;
  };
  await printSheet({
    locale: s.locale,
    title: tour
      ? (pick(tour.title, s.locale) ?? "")
      : chapter
        ? chapterLabel(chapter.ref, s.locale)
        : s.focus
          ? personLabel
          : place
            ? nameOf(place.id)
            : "",
    blank,
    notes: translate(s.locale, "sheet.notes"),
    north: translate(s.locale, "sheet.north"),
    when: [
      blank ? translate(s.locale, "sheet.outline") : "",
      formatYear(s.year, s.locale),
      period ? periodName(period, s.locale) : "",
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
          return { scale: { share: km / across, label: translate(s.locale, "sheet.km", { n }) } };
        })()
      : {}),
    items: tour
      ? tour.stops.map((st, i) => ({
          n: i + 1,
          name: nameOf(st.placeId),
          // The passage, and how far the stop is from the one before, as the card says it.
          ref: [st.ref ? ref(st.ref) : pick(st.source?.cite, s.locale), leg(i)]
            .filter(Boolean)
            .join(" · "),
          note: st.note[s.locale] || st.note.en || verses[i] || "",
        }))
      : chapter
        ? chapterOrder.map((id, i) => {
            const v = firstVerseIn(data.byId.get(id)?.props.osis ?? [], chapter.ref);
            return { n: i + 1, name: nameOf(id), ref: v ? ref(v) : "" };
          })
        : [],
    attribution: sheetCredits(shot.attribution, s.locale),
    // A short address a class can type: what is shown, not the camera's decimals.
    // A person's view is not in the address: that one keeps the camera as it is.
    url: isPersonRef(s.focus?.ref) ? window.location.href : shortUrl(),
  });
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
  const letters = translate(s.locale, "sheet.letters").split(" ");
  const items = quiz.items.map((it) => ({ ...it, answer: letters[it.answer] ?? "" }));
  const sheet = newSheet(
    "hg-sheet quiz",
    s.locale,
    quiz.title,
    translate(s.locale, "sheet.quiz_intro"),
  );
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
      `${translate(s.locale, "sheet.answers")}: ${items.map((it, i) => `${String(i + 1)} — ${it.answer}`).join("; ")}`,
    ),
  );
  sheet.append(foot);
  document.body.append(sheet);
  printAndRemove(sheet);
}
