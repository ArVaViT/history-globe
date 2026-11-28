/**
 * The related blocks of a place's static page as HTML (scripts/build-pages.ts): the
 * breadcrumb, the small map with its caption and credits, the article with its places
 * linked (article-links.ts), the questions about the place, the nearby places, and the
 * breadcrumb in the structured data. What is chosen is decided in place-related.ts and
 * article-links.ts; this file only words and marks it up. The question pages take the same
 * links in their answers, and a breadcrumb.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChapterYears } from "../packages/model/src/chapter-years.ts";
import type { SiteLocale } from "../packages/model/src/locales.ts";
import type { Segment, TextPlaces } from "../packages/model/src/text-places.ts";
import { formatYear } from "../packages/model/src/time.ts";
import { linkedPlaces, type LinkOptions, linkParagraphs } from "./article-links.ts";
import type { Pt } from "./place-map.ts";
import { esc } from "./page-shell.ts";
import { LISTS, T } from "./page-words.ts";
import { RELATED } from "./place-related-words.ts";
import {
  breadcrumbLd,
  mapYear,
  nearbyPlaces,
  type PlaceMap,
  placeMaps,
  questionsAbout,
  type RelatedPlace,
} from "./place-related.ts";

type Lang = SiteLocale;
const BY4 = '<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>';

interface Feature {
  readonly geometry: { readonly coordinates: [number, number] };
  readonly properties: {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly verses: number;
    readonly disputed: boolean;
    readonly confidence?: number | undefined;
    readonly dup?: boolean | undefined;
  };
}
interface Question {
  readonly id: string;
  readonly question: Record<Lang, string>;
  readonly map?: { readonly place?: string; readonly measure?: readonly string[] };
}

/** The maps' maker (place-related.ts `placeMaps`), or a stand-in in the tests. */
export interface Maps {
  render(id: string, coords: Pt, kind: string, year: number): PlaceMap | undefined;
  finish(): { count: number; kb: number; largestKb: number; removed: number };
}

/** Kinds that name a land: "modern Syria" there is today's state (article-links.ts). */
const LAND_KINDS: ReadonlySet<string> = new Set(["region", "people group"]);

export interface RelatedContext<F extends Feature, Q extends Question> {
  readonly root: string;
  readonly data: string;
  /** SITE_URL, or "" for a local build (no structured data then). */
  readonly site: string;
  readonly places: readonly F[];
  /** The places with a page of their own (verses), by id. */
  readonly byId: ReadonlyMap<string, F>;
  readonly slugOf: ReadonlyMap<string, string>;
  readonly nameOf: (p: F["properties"], l: Lang) => string;
  /** Whether a place's page is one search engines index (it has an article, not a thin one: ADR 0023). */
  readonly indexed: (id: string) => boolean;
  /** Whether a question's page is one search engines index (ADR 0023); all, if not given. */
  readonly questionIndexed?: (id: string) => boolean;
  /** A place's other records on its point (not linked from its page). */
  readonly samePoint: (f: F) => readonly string[];
  readonly questions: readonly Q[];
  readonly textPlaces: Partial<Record<Lang, TextPlaces>>;
  /** When the chapters happen (content.json `chapter_years`) and the towns stood (`life`). */
  readonly chapterYears?: ChapterYears;
  readonly life?: Readonly<Record<string, { from?: { year: number }; until?: { year: number } }>>;
  /** The maps; by default drawn from the data (`placeMaps`), none when it is not there. */
  readonly maps?: Maps | undefined;
}

/** Segments as HTML, each place a link to its page under `up` ("../", "../../place/"). */
const segmentsHtml = (segs: readonly Segment[], slugOf: ReadonlyMap<string, string>, up: string) =>
  segs
    .map((s) =>
      s.place
        ? `<a href="${up}${slugOf.get(s.place) ?? s.place}/">${esc(s.text)}</a>`
        : esc(s.text),
    )
    .join("");

export function placeRelatedHtml<
  F extends Feature & { properties: { nt?: number; ot?: number; osis?: string[] } },
  Q extends Question,
>(c: RelatedContext<F, Q>) {
  const maps = "maps" in c ? c.maps : placeMaps(c.data);
  const dict = Object.fromEntries(
    (Object.keys(RELATED) as Lang[]).map((l) => [
      l,
      JSON.parse(readFileSync(join(c.root, `apps/web/src/i18n/${l}.json`), "utf8")) as {
        place: Record<string, string>;
        layers: Record<string, string>;
      },
    ]),
  ) as Record<Lang, { place: Record<string, string>; layers: Record<string, string> }>;
  const linkable = (id: string) => !!c.byId.get(id)?.properties.verses && c.indexed(id);
  const land = (id: string) => LAND_KINDS.has(c.byId.get(id)?.properties.kind ?? "");
  const related: RelatedPlace[] = c.places
    .filter((f) => f.properties.verses > 0)
    .map((f) => ({ ...f.properties, coords: f.geometry.coordinates }));
  /** Each place's map, drawn once for all languages. */
  const mapOf = new Map<string, PlaceMap | undefined>();
  /** The places of each name, by language: a place's namesakes are not linked from its page. */
  const byName = new Map<Lang, Map<string, string[]>>();
  const named = (name: string, l: Lang) => {
    let m = byName.get(l);
    if (!m) {
      m = new Map();
      for (const g of c.places) {
        const n = c.nameOf(g.properties, l);
        m.set(n, [...(m.get(n) ?? []), g.properties.id]);
      }
      byName.set(l, m);
    }
    return m.get(name) ?? [];
  };
  /**
   * A place's own records: on its point, and its namesakes in English or the page's language
   * (on the page of Babylon meaning Rome, "Babylon" is not Mesopotamia's).
   */
  const selfOf = (f: F, l: Lang) => [
    ...c.samePoint(f),
    ...named(c.nameOf(f.properties, "en"), "en"),
    ...named(c.nameOf(f.properties, l), l),
  ];
  if (!c.textPlaces.en && Object.keys(c.textPlaces).length > 0)
    throw new Error("pages: text-places.en.json is missing; the translations' links follow it");

  /**
   * The places the English text of an article or answer may lend its translations: those it
   * links, less any it refused somewhere (a place met inside a longer name or as a person).
   */
  const english = new Map<string, Set<string>>();
  /** The article or answer's paragraphs with their places linked, as HTML. */
  const linked = (
    texts: Readonly<Record<Lang, readonly string[]>>,
    l: Lang,
    o: { text: string; self: (l: Lang) => readonly string[]; up: string },
  ): string[] => {
    const index = c.textPlaces[l];
    const en = c.textPlaces.en;
    if (!index || !en) return texts[l].map((p) => esc(p));
    const cut = (lang: Lang, ix: TextPlaces, extra: Partial<LinkOptions>) =>
      linkParagraphs(texts[lang], ix, {
        self: o.self(lang),
        linkable,
        land,
        text: o.text,
        lang,
        ...extra,
      });
    if (l === "en") return cut("en", en, {}).map((segs) => segmentsHtml(segs, c.slugOf, o.up));
    let allow = english.get(o.text);
    if (!allow) {
      const refused = new Set<string>();
      const links = linkedPlaces(cut("en", en, { refused }));
      english.set(o.text, (allow = new Set([...links].filter((id) => !refused.has(id)))));
    }
    // Places the English tells apart that this language names alike (Babylon and Babylonia
    // are both «Babilonia»): linked in neither, the form cannot say which is meant.
    const sameName = new Map<string, string[]>();
    for (const id of allow) {
      const g = c.byId.get(id);
      if (!g) continue;
      const n = c.nameOf(g.properties, l);
      sameName.set(n, [...(sameName.get(n) ?? []), id]);
    }
    const ambiguous = new Set([...sameName.values()].filter((ids) => ids.length > 1).flat());
    return cut(l, index, { allow, ambiguous }).map((segs) => segmentsHtml(segs, c.slugOf, o.up));
  };

  const crumbsHtml = (l: Lang, section: { name: string; href: string }, name: string) =>
    `<nav class="crumbs" aria-label="${esc(RELATED[l].crumbs)}"><ol><li><a href="../../">History Globe</a></li><li><a href="${section.href}">${esc(section.name)}</a></li><li aria-current="page">${esc(name)}</li></ol></nav>`;
  const crumbsLd = (l: Lang, section: { name: string; path: string }, name: string) =>
    breadcrumbLd([
      { name: "History Globe", url: `${c.site}/${l}/` },
      { name: section.name, url: `${c.site}/${section.path}` },
      { name },
    ]);

  /** A place page's blocks, in its language. */
  const forPlace = (f: F, l: Lang) => {
    const p = f.properties;
    const w = RELATED[l];
    const name = c.nameOf(p, l);
    // The map: one file for every language, drawn on the first page that needs it.
    if (!mapOf.has(p.id))
      mapOf.set(
        p.id,
        maps?.render(
          p.id,
          f.geometry.coordinates,
          p.kind,
          mapYear(p, c.chapterYears, c.life?.[p.id]),
        ),
      );
    const m = mapOf.get(p.id);
    let map = "";
    if (m) {
      const when = formatYear(m.year, l);
      const state = m.state ? (m.state[l] ?? m.state.en) : undefined;
      // The year and its state, when the picture draws states; the credits of what it draws.
      const caption = state
        ? `${(dict[l].place.rulers ?? "").replace("{{span}}", when)}${w.colon}${state}`
        : m.drawn.states
          ? `${dict[l].layers.borders ?? ""}, ${when}`
          : "";
      const credits = [
        "Natural Earth",
        ...(m.drawn.states ? [`Cliopatria (${BY4})`] : []),
        ...(m.drawn.rivers ? [`RiverATLAS (${BY4})`] : []),
      ].join(w.semicolon);
      map = `
      <figure class="place-map"><img src="../../../${esc(m.src)}" alt="${esc(w.mapAlt(name))}" width="360" height="240" loading="lazy" decoding="async" /><figcaption class="note">${caption ? `${esc(caption)}.<br />` : ""}${esc(w.map)}${w.colon}${credits}</figcaption></figure>`;
    }
    const near = nearbyPlaces({ ...p, coords: f.geometry.coordinates }, related, linkable);
    const fmt = new Intl.NumberFormat(l);
    const nearby = near.length
      ? `
      <h2>${esc(w.nearby)}</h2>
      <ul class="cards">${near
        .map((n) => {
          const q = c.byId.get(n.id)?.properties;
          return q
            ? `<li><a href="../${c.slugOf.get(n.id) ?? n.id}/">${esc(c.nameOf(q, l))} <span class="km">${esc(LISTS[l].km(fmt.format(n.km)))}</span></a></li>`
            : "";
        })
        .join("")}</ul>
      <p class="note">${esc(w.nearbyNote)}</p>`
      : "";
    const section = { name: T[l].places, href: "../../places/", path: `${l}/places/` };
    return {
      crumbs: crumbsHtml(l, section, name),
      map,
      nearby,
      questions: questionsAbout(p.id, c.questions).filter((q) => c.questionIndexed?.(q.id) ?? true),
      article: (texts: Readonly<Record<Lang, readonly string[]>>, id: string) =>
        linked(texts, l, { text: id, self: (o) => selfOf(f, o), up: "../" }).map(
          (h) => `<p>${h}</p>`,
        ),
      /** The page's structured data with the breadcrumb beside it. */
      ld: (place: object): object[] => [place, crumbsLd(l, section, name)],
    };
  };

  /** A question page's blocks, in its language. */
  const forQuestion = (q: Q, l: Lang) => {
    const section = { name: T[l].questions, href: "../../questions/", path: `${l}/questions/` };
    return {
      crumbs: crumbsHtml(l, section, q.question[l]),
      answer: (texts: Readonly<Record<Lang, readonly string[]>>) =>
        linked(texts, l, { text: `q:${q.id}`, self: () => [], up: "../../place/" }).map(
          (h) => `<p>${h}</p>`,
        ),
      ld: (page: object): object[] => [page, crumbsLd(l, section, q.question[l])],
    };
  };

  /** Once every page is written: the maps of places gone removed, and the maps' sizes. */
  const finish = () => maps?.finish();
  return { forPlace, forQuestion, finish };
}
