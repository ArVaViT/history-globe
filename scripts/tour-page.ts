/**
 * The parts of a tour's page that build-pages.ts puts together (tourPages): the distance and
 * the time of each leg and of the whole tour (packages/model/src/travel.ts), the route map
 * (route-map.ts), the intro, the stops' stories and sources (tour-texts.ts) and the
 * structured data. Kept apart from build-pages.ts so the page's logic is tested and read in
 * one place.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TourFile } from "../packages/model/src/content.ts";
import { sourcesOf } from "../packages/model/src/citation.ts";
import { roundKm, wayKm } from "../packages/model/src/distance.ts";
import type { SiteLocale } from "../packages/model/src/locales.ts";
import { formatRef } from "../packages/model/src/scripture.ts";
import { type LegInput, type LegTime, legTime, tourTime } from "../packages/model/src/travel.ts";
import type { Ring } from "./geo.ts";
import { esc } from "./page-shell.ts";
import { LISTS, T } from "./page-words.ts";
import { type LegKinds, type LonLat, type MapLayers, routeMap } from "./route-map.ts";
import { shortHash } from "./content-hash.ts";
import { TOUR_WORDS } from "./tour-words.ts";
import type { TourTexts } from "./tour-texts.ts";

type Lang = SiteLocale;
type Tour = TourFile;

/** A leg as the page reads it: travel.ts's, and whether it is measured through `via`. */
export type TourLeg = LegInput & { readonly via?: boolean | undefined };

/** The map's own words for time on foot and at sea (apps/web/src/i18n/<lang>.json). */
export interface UiWords {
  readonly tours: Readonly<Record<string, string>>;
  readonly place: Readonly<Record<string, string>>;
}

/** The sea and the states from the data build, or nothing without it (route-map.ts). */
export function loadMapLayers(data: string): MapLayers | undefined {
  const read = (f: string) =>
    existsSync(join(data, f))
      ? (JSON.parse(readFileSync(join(data, f), "utf8")) as {
          features: {
            geometry: { type: string; coordinates: unknown };
            properties: Record<string, unknown>;
          }[];
        })
      : undefined;
  const polygons = (g: { type: string; coordinates: unknown }): Ring[][] =>
    g.type === "Polygon"
      ? [g.coordinates as Ring[]]
      : g.type === "MultiPolygon"
        ? (g.coordinates as Ring[][])
        : [];
  const water = read("water.geojson");
  const states = read("polities.geojson");
  if (!water || !states) return undefined;
  return {
    water: water.features.flatMap((f) => polygons(f.geometry)),
    // The alliances left out, as the map's polity layers leave them (place-map.ts too).
    polities: states.features
      .filter((f) => !f.properties.rel)
      .map((f) => ({
        polygons: polygons(f.geometry),
        y0: Number(f.properties.y0),
        y1: Number(f.properties.y1),
        c: Number(f.properties.c ?? 0),
        names: Object.fromEntries(
          Object.entries(f.properties).filter(
            (e): e is [string, string] => e[0].startsWith("name") && typeof e[1] === "string",
          ),
        ),
      })),
  };
}

/**
 * The legs of a tour, one per stop (the first from nowhere): as travel.ts reads them. A
 * voyage is measured through the points it keeps to (`via`), as the map draws it.
 */
export function legsOf(
  t: Tour,
  pointOf: (id: string) => LonLat | undefined,
  roadLegs: Readonly<Record<string, readonly (number | null)[] | undefined>>,
): TourLeg[] {
  return t.stops.map((s, i) => {
    const a = i > 0 ? pointOf(t.stops[i - 1]?.place ?? "") : undefined;
    const b = pointOf(s.place);
    const via = s.by === "sea" ? s.via : undefined;
    return {
      km: a && b ? wayKm(a, b, via) : 0,
      via: via !== undefined,
      // A leg sailed or untold, or a tour not travelled, has no way by road.
      road: s.by || t.walked === false ? null : (roadLegs[t.id]?.[i] ?? null),
      by: s.by,
      sailed: s.sailed,
      took: s.took,
      withinNext: s.within_next === true,
    };
  });
}

/** "≈ 3 days" or "≈ 5 h" in the map's words; a floor ("≥") when only a straight line. */
function walkWords(
  ui: UiWords,
  l: Lang,
  time: { readonly hours: number } | { readonly days: number },
  floor = false,
): string {
  const p = ui.place;
  const text =
    "hours" in time
      ? (p.walk_hours ?? "≈ {{n}} h").replace("{{n}}", String(time.hours))
      : (
          p[`walk_days_${new Intl.PluralRules(l).select(time.days)}`] ??
          p.walk_days_other ??
          "≈ {{count}}"
        ).replace("{{count}}", new Intl.NumberFormat(l).format(time.days));
  return floor ? text.replace("≈", "≥") : text;
}

/** Days as a range, "≈ 1–3 days", in the plural of the larger number. */
function dayRange(ui: UiWords, l: Lang, min: number, max: number): string {
  const p = ui.place;
  const form =
    p[`walk_days_${new Intl.PluralRules(l).select(max)}`] ?? p.walk_days_other ?? "≈ {{count}}";
  const n = new Intl.NumberFormat(l);
  return form.replace(
    "{{count}}",
    min === max ? n.format(max) : `${n.format(min)}–${n.format(max)}`,
  );
}

const onFoot = (ui: UiWords, walk: string) =>
  (ui.tours.walk ?? "{{walk}}").replace("{{walk}}", walk);

/** The time of one leg as the stop's line ends it: ", ≈ 3 days on foot", ", by sea, …". */
export function legTimeWords(ui: UiWords, l: Lang, t: LegTime): string {
  const W = TOUR_WORDS[l];
  switch (t.kind) {
    case "none":
      return "";
    case "untold":
      return T[l].untold;
    case "within":
      // Cauda: passed on the next leg's fourteen days (Acts 27:27), not counted apart.
      return `, ${t.sea ? `${ui.tours.by_sea ?? "by sea"}, ` : ""}${W.withinNext}`;
    case "foot":
      // The text's own days, with the verse; "≈" only where the text gives them roughly.
      if (t.told) {
        const days = walkWords(ui, l, { days: t.told.days });
        return `, ${onFoot(ui, t.told.about ? days : days.replace(/≈\s*/u, ""))} (${formatRef(t.told.ref, l)})`;
      }
      return `, ${onFoot(ui, walkWords(ui, l, t.time, !t.byRoad))}`;
    case "sea":
      if ("told" in t)
        return T[l].sea(t.told.days, formatRef(t.told.ref, l), t.told.about === true);
      return `, ${ui.tours.by_sea ?? "by sea"}, ${
        "underADay" in t.estimate ? W.underADay : dayRange(ui, l, t.estimate.min, t.estimate.max)
      } (${W.estimate})`;
  }
}

/**
 * The stop's line after its reference: the distance (in a straight line, by road where
 * known, or along a voyage's course through its points at sea) and the time.
 */
export function legLine(ui: UiWords, l: Lang, leg: TourLeg, walked: boolean): string {
  if (leg.km < 2) return "";
  const num = (km: number) => new Intl.NumberFormat(l).format(roundKm(km));
  const time = legTimeWords(ui, l, legTime(leg, walked));
  if (leg.via) return `${TOUR_WORDS[l].course(num(leg.km))}${time}`;
  const road = leg.road ?? null;
  return T[l].leg(num(leg.km), road ? num(road) : null, time);
}

/** The tour's facts under its title: stops, distance, days on foot and at sea. */
export function factsLine(ui: UiWords, l: Lang, t: Tour, legs: readonly LegInput[]): string[] {
  const walked = t.walked !== false;
  const km = legs.reduce((sum, g) => sum + g.km, 0);
  const n = new Intl.NumberFormat(l);
  const facts = [LISTS[l].stops(t.stops.length)];
  if (!walked || km < 2) return facts;
  facts.push(LISTS[l].km(n.format(roundKm(km))));
  const time = tourTime(legs, walked);
  if (time.foot) facts.push(onFoot(ui, walkWords(ui, l, time.foot.time, time.foot.floor)));
  if (time.sea)
    facts.push(
      `${ui.tours.by_sea ?? "by sea"} ${dayRange(ui, l, time.sea.min, time.sea.max)}${
        time.sea.allTold ? "" : ` (${TOUR_WORDS[l].estimate})`
      }`,
    );
  if (time.untold > 0) facts.push(TOUR_WORDS[l].untold);
  return facts;
}

/** Whether a tour gives any time at all (else no note on how times are reckoned). */
export const givesTime = (t: Tour, legs: readonly LegInput[]): boolean =>
  t.walked !== false && legs.some((g) => g.km >= 2 && g.by !== "untold");

/** The map's legend, for the kinds of leg it draws; none for a walk alone (solid, as expected). */
export function legendWords(l: Lang, kinds: LegKinds): string {
  if (!kinds.sea && !kinds.untold) return "";
  const W = TOUR_WORDS[l].legend;
  const parts = [kinds.foot && W.foot, kinds.sea && W.sea, kinds.untold && W.untold].filter(
    (x): x is string => typeof x === "string",
  );
  const text = parts.join(W.sep);
  return `${text.charAt(0).toLocaleUpperCase(l)}${text.slice(1)}.`;
}

/**
 * The route map and its caption, or nothing for a tour with no point. The drawing has no
 * words, so it is the same in every language: `writeMap` writes it once as a file
 * (tourMaps, data/tour-maps/<id>.svg) and the page links it as an image. The image's text is
 * the map's label ("Route map: …"); the caption under it names the states and the lines, so
 * a screen reader does not hear the caption twice.
 */
export function mapFigure(o: {
  readonly l: Lang;
  readonly t: Tour;
  readonly pointOf: (id: string) => LonLat | undefined;
  readonly roadPaths: Readonly<Record<string, readonly LonLat[] | undefined>>;
  readonly layers: MapLayers | undefined;
  readonly label: string;
  readonly yearLabel: string;
  /** Writes the drawing for the tour and gives its address from the page, versioned. */
  readonly writeMap: (svg: string) => string;
}): string {
  const stops = o.t.stops.flatMap((s, i) => {
    const at = o.pointOf(s.place);
    if (!at) return [];
    const prev = o.t.stops[i - 1]?.place;
    const there = prev ? o.roadPaths[`${prev}>${s.place}`] : undefined;
    const back = prev ? o.roadPaths[`${s.place}>${prev}`] : undefined;
    return [
      {
        at,
        id: s.place,
        by: s.by,
        road: there ?? (back ? [...back].reverse() : undefined),
        via: s.via,
        year: s.year,
      },
    ];
  });
  const map = routeMap({
    stops,
    year: o.t.year,
    walked: o.t.walked !== false,
    layers: o.layers,
  });
  if (!map) return "";
  const names = [
    ...new Set(map.states.map((s) => s[`name_${o.l}`] ?? s.name ?? "").filter(Boolean)),
  ];
  // Every state a stop lies in is named; the others, while the caption stays short.
  const shown = names.slice(0, Math.max(6, map.touched));
  const legend = legendWords(o.l, map.kinds);
  const caption = [TOUR_WORDS[o.l].caption(o.yearLabel, shown.join(", ")), legend]
    .filter(Boolean)
    .join(" ");
  // Its own colours and a <style> of its own: never put in the page, whose classes it would set.
  const picture = `<img class="tour-map" src="${esc(o.writeMap(map.svg))}" alt="${esc(o.label)}" width="800" height="500" decoding="async">`;
  return `<figure class="tour-figure">${picture}<figcaption class="note">${esc(caption)}</figcaption></figure>`;
}

/**
 * The tours' maps as files, data/tour-maps/<id>.svg, one per tour for all its languages
 * (the place maps have data/maps/ of their own, which they clear of what they did not
 * write). `writer(id)` gives mapFigure's `writeMap`: the file is written when it changes,
 * and the page links it from data/ with its content's hash (`?v=`), so a browser keeps it
 * until the picture changes. `finish()` removes the maps of tours no longer built.
 */
export function tourMaps(data: string, up: string) {
  const dir = join(data, "tour-maps");
  mkdirSync(dir, { recursive: true });
  const written = new Map<string, string>();
  return {
    writer:
      (id: string) =>
      (svg: string): string => {
        if (written.get(id) !== svg) {
          const file = join(dir, `${id}.svg`);
          if (!existsSync(file) || readFileSync(file, "utf8") !== svg) writeFileSync(file, svg);
          written.set(id, svg);
        }
        return `${up}data/tour-maps/${id}.svg?v=${shortHash(svg)}`;
      },
    finish: (): void => {
      for (const f of readdirSync(dir))
        if (f.endsWith(".svg") && !written.has(f.slice(0, -4))) rmSync(join(dir, f));
    },
  };
}

/** The intro's paragraphs, or nothing. */
export function introHtml(texts: TourTexts | undefined, l: Lang): string {
  const ps = texts?.intro[l] ?? [];
  return ps.map((p) => `<p class="tour-intro">${esc(p)}</p>`).join("\n      ");
}

/** The stop's story where the tour has one, else its note (the map card's line). */
export function stopText(texts: TourTexts | undefined, t: Tour, i: number, l: Lang): string {
  const s = t.stops[i];
  return texts?.stories[i]?.[l] ?? s?.note[l] ?? s?.note.en ?? "";
}

/** The sources under the stops, folded as under an article. */
export function sourcesHtml(texts: TourTexts | undefined, l: Lang): string {
  if (!texts) return "";
  return `<details class="note"><summary>${T[l].sources}</summary><ul>${sourcesOf(texts, l)
    .map((s) => `<li>${esc(s)}</li>`)
    .join("")}</ul></details>`;
}

/**
 * The page's structured data: the stops as an ordered list (each a Place with its point
 * and page), and the way from the language's home through all tours to this one. Written
 * only with SITE_URL (page-shell.ts), so every URL is absolute. No author: the site names
 * none (the owner's wish).
 */
export function tourLd(o: {
  readonly site: string;
  readonly l: Lang;
  readonly t: Tour;
  readonly title: string;
  readonly desc: string;
  readonly path: string;
  readonly toursTitle: string;
  readonly stopName: (id: string) => string;
  readonly pointOf: (id: string) => LonLat | undefined;
  /** The stop's page, from the site root, where it has one. */
  readonly placePath: (id: string) => string | undefined;
}): object[] {
  const url = `${o.site}/${o.path}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: o.title,
      description: o.desc,
      url,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: o.t.stops.length,
      itemListElement: o.t.stops.map((s, i) => {
        const at = o.pointOf(s.place);
        const page = o.placePath(s.place);
        return {
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Place",
            name: o.stopName(s.place),
            ...(page ? { url: `${o.site}/${page}` } : {}),
            ...(at
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: Number(at[1].toFixed(4)),
                    longitude: Number(at[0].toFixed(4)),
                  },
                }
              : {}),
          },
        };
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "History Globe", item: `${o.site}/${o.l}/` },
        { name: o.toursTitle, item: `${o.site}/${o.l}/tours/` },
        { name: o.title, item: url },
      ].map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })),
    },
  ];
}
