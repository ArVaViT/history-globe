import {
  formatRef,
  formatYear,
  formatYearRange,
  sourcesOf,
  type AncientMention,
  type HistoryBattle,
  type HistoryEvent,
  type Locale,
  type PlaceLife,
  type PlacePhoto,
  type PleiadesLink,
} from "@hg/model";
import { ArrowLeft, MapPin, Ruler, X, ZoomIn } from "./icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { loadArticle, type Article } from "../articles";
import { beforeItsTime, DATA_URL, siteCertainty, type PlaceProps, type Site } from "../data";
import { mapsUrl, verseUrl } from "../links";
import { distanceKm, roundKm, walkTime } from "../distance";
import { loadVerse } from "../verses";
import { LessonBar, LessonToggle, useLesson } from "./LessonRow";
import { readUrl } from "../url";

// The app's own reading of the address (`embed=1` or /embed/v1), as App's EMBED.
const EMBEDDED = readUrl().embed === true;
import { loadTextPlaces, splitPlaces, type Segment } from "../text-places";
import { Photo } from "./Photo";
import { notifyVerse } from "../embed";
import { Panel } from "./Panel";
import { loadPeople, peopleNow, personName, type People } from "../people";
import type { PolityName } from "@hg/core";

const VERSES_SHOWN = 24;
const EVENTS_SHOWN = 8;

/** "ок. 20 г. н. э." for an approximate year. */
function lifeYear(
  y: { year: number; approximate: boolean },
  locale: Locale,
  t: (key: string) => string,
): string {
  return `${y.approximate ? `${t("place.circa")} ` : ""}${formatYear(y.year, locale)}`;
}

function safeRef(osis: string, locale: Locale): string {
  try {
    return formatRef(osis, locale);
  } catch {
    return osis;
  }
}

type PlaceTab = "story" | "time" | "people" | "sites" | "verses";
/** The tab picked last: the next place opens on it, when it has one. */
function readTab(): PlaceTab {
  try {
    const v = sessionStorage.getItem("hg:place-tab");
    return v === "time" || v === "people" || v === "sites" || v === "verses" ? v : "story";
  } catch {
    return "story";
  }
}

function writeTab(tab: PlaceTab): void {
  try {
    sessionStorage.setItem("hg:place-tab", tab);
  } catch {
    // Storage refused: the tab still switches, the next card just opens on its first.
  }
}

/** Other records on the same point shown before "and N more". */
const ALSO_SHOWN = 3;

export function PlaceCard({
  place,
  sites,
  life,
  events = [],
  battles = [],
  at,
  alsoHere,
  locale,
  year,
  onClose,
  onSelect,
  onGoTo,
  placeName,
  onZoom,
  onFlyTo,
  back,
  hasArticle = false,
  photo,
  polities,
  measure,
  pleiades,
  questions,
  onPerson,
  focusTitle = false,
}: {
  place: PlaceProps;
  sites: readonly Site[];
  /** When the place existed, if known (content/place-life.yaml). */
  life?: PlaceLife | undefined;
  /** The turning points that happened here (events.yaml), in order. */
  events?: readonly HistoryEvent[];
  /** Battles and sieges fought here (battles.yaml), in order. */
  battles?: readonly HistoryBattle[];
  /** The place's point, [lon, lat]: where it is today on Google Maps. */
  at: readonly [number, number];
  /** Other records on the same point under another name. */
  alsoHere: readonly PlaceProps[];
  locale: Locale;
  onSelect: (placeId: string) => void;
  /** Another place, named in a verse: the map goes there and opens it. */
  onGoTo: (placeId: string) => void;
  /** A place's name in the reader's language, for a verse's links. */
  placeName: (placeId: string) => string | undefined;
  year: number;
  onClose: () => void;
  onZoom: () => void;
  onFlyTo: (at: readonly [number, number]) => void;
  /** Opened from a tour stop: the way back to that stop. */
  back?: { label: string; onBack: () => void } | undefined;
  /** The place has an article (content/articles): it loads when the card opens. */
  hasArticle?: boolean;
  /** A photo of the place (content/photos.yaml), with its credit. */
  photo?: PlacePhoto | undefined;
  /** The states drawn at the place for the year shown (the map's own borders). */
  polities?: ((at: readonly [number, number]) => Promise<readonly PolityName[] | null>) | undefined;
  /** Opened from another card (a person's): the focus moves to this one's title. */
  focusTitle?: boolean;
  /** A person of the place opened: their card, by index in people.json. */
  onPerson?: ((person: number) => void) | undefined;
  /** The place in Pleiades, with the span of the periods it is attested in. */
  pleiades?: PleiadesLink | undefined;
  /** Questions answered with this place on the map (their pages are /{locale}/q/{id}/). */
  questions?:
    readonly { readonly id: string; readonly en: string; readonly ru: string }[] | undefined;
  /** Distance from a place picked before ("Distance from here"), or this place is the start. */
  measure?:
    | {
        readonly from: { readonly name: string; readonly at: readonly [number, number] } | null;
        readonly isFrom: boolean;
        readonly onToggle: () => void;
        readonly onClear: () => void;
      }
    | undefined;
}) {
  // Opened lists stay open for this place; the card is keyed by place, so a new place
  // starts folded again.
  // Verses open fifty at a time: Jerusalem has 955.
  const [tall, setTall] = useState(false);
  const [versesShown, setVersesShown] = useState(VERSES_SHOWN);
  // After "ещё N", keyboard focus moves to the first verse that appeared.
  const versesRef = useRef<HTMLDivElement>(null);
  const focusVerse = useRef<number | null>(null);
  // The verse whose text is open under the list.
  const [openVerse, setOpenVerse] = useState<string | null>(null);
  useEffect(() => {
    if (focusVerse.current === null) return;
    versesRef.current
      ?.querySelectorAll<HTMLButtonElement>("button[data-verse]")
      [focusVerse.current]?.focus();
    focusVerse.current = null;
  }, [versesShown]);
  const [allAlso, setAllAlso] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  // Whose land it was in the year shown: read off the map's borders once the slider rests.
  // Kept with the year it was read for: while the slider moves, last year's states are
  // not shown under this year's number.
  const [ruled, setRuled] = useState<{ year: number; states: readonly PolityName[] } | null>(null);
  const [lon, lat] = at;
  useEffect(() => {
    if (!polities) return;
    let live = true;
    const timer = setTimeout(() => {
      void polities([lon, lat]).then((p) => {
        if (live) setRuled(p ? { year, states: p } : null);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [polities, lon, lat, year]);
  const [allEvents, setAllEvents] = useState(false);
  const { t } = useTranslation();
  const lesson = useLesson(place.id, year);
  const ru = locale === "ru";
  const title = ru ? (place.name_ru ?? place.name) : place.name;
  // Where it is today, in the reader's language, unless that only repeats the title
  // (Jordan River and Jordan are both «Иордан»).
  // In Russian an English line stands in only where it names something else (never «Argob»).
  const todayText = !place.where
    ? ""
    : ru
      ? (place.where_ru ?? (place.where !== place.name ? place.where : ""))
      : place.where;
  const today = todayText && todayText !== title ? todayText : null;
  // A version OpenBible rates at 0 % (Khirbet Minyeh for Capernaum) is noise beside a
  // settled site: listed only while it has a share.
  const versions = sites.filter((s) => s.share !== 0);
  // Who lived or acted here (STEP Bible): loaded with the card, 42 kB once.
  const [people, setPeople] = useState<People | null>(peopleNow);
  useEffect(() => {
    let live = true;
    loadPeople()
      .then((p) => {
        if (live) setPeople(p);
      })
      .catch(() => {
        // Without the file the card simply has no people tab.
      });
    return () => {
      live = false;
    };
  }, []);
  const here = people?.byPlace.get(place.id) ?? [];
  const certainty = siteCertainty(place);
  // The tabs this place has: its story, its dates, the proposed sites, its verses.
  const pleiadesTab: PlaceTab =
    life || events.length > 0 || battles.length > 0 ? "time" : hasArticle ? "story" : "verses";
  const tabs: PlaceTab[] = [
    ...(hasArticle ? (["story"] as const) : []),
    // A tab for dates only when there are some of our own: Pleiades' span alone (Bethel)
    // made a tab of one line; it then stands under the story, or the verses.
    ...(life || events.length > 0 || battles.length > 0 ? (["time"] as const) : []),
    ...(here.length > 0 && onPerson ? (["people"] as const) : []),
    ...(versions.length > 1 ? (["sites"] as const) : []),
    "verses",
  ];
  const [chosen, setChosen] = useState<PlaceTab>(readTab);
  const tab = tabs.includes(chosen) ? chosen : (tabs[0] ?? "verses");
  const tabRefs = useRef<Partial<Record<PlaceTab, HTMLButtonElement | null>>>({});
  const pickTab = (next: PlaceTab) => {
    setChosen(next);
    writeTab(next);
  };
  const kindKey = `kind.${place.kind}`;
  const kind = t(kindKey) === kindKey ? place.kind : t(kindKey);

  return (
    <Panel
      className={`w-[min(420px,calc(100vw-376px-32px))] max-md:w-full max-h-[calc(100dvh-var(--hg-timeline-h,124px)-48px)] overflow-auto ${tall ? "max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-96px)]" : "max-md:max-h-[48dvh]"}`}
    >
      {/* On a phone the card takes half the screen; its handle opens it up to the header. */}
      <button
        onClick={() => {
          setTall((v) => !v);
        }}
        aria-expanded={tall}
        aria-label={tall ? t("place.fold") : t("place.unfold")}
        className="sticky top-0 z-[1] flex w-full justify-center bg-gradient-to-b from-paper to-transparent pt-1.5 pb-1 md:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-ink/25" aria-hidden />
      </button>
      {back && (
        <button
          onClick={back.onBack}
          className="mx-3 mt-3 flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-accent hover:bg-paper-2"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </button>
      )}
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="font-serif text-[26px] leading-tight font-semibold text-ink outline-none"
          >
            {title}
          </h2>
          {/* One quiet line under the name: where the Russian form is read. The English form
              is not shown in Russian: it told the reader nothing (design review, 02.10). */}
          {ru && place.name_ru_osis && (
            <div className="mt-0.5 text-[12px] text-ink-soft">
              {place.name_ru_osis && (
                // Where the Russian form is from, in full on hover and for screen readers.
                <span title={t("place.synodal_from", { ref: safeRef(place.name_ru_osis, locale) })}>
                  <span aria-hidden>{safeRef(place.name_ru_osis, locale)}</span>
                  <span className="sr-only">
                    {t("place.synodal_from", { ref: safeRef(place.name_ru_osis, locale) })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="-mr-1 flex shrink-0 items-center gap-0.5">
          {/* Not in a frame on another site: a lesson is the globe's own. */}
          {!EMBEDDED && place.osis.length > 0 && <LessonToggle lesson={lesson} />}
          {measure && (
            <button
              onClick={measure.onToggle}
              aria-label={t("place.measure")}
              title={t(measure.isFrom ? "place.measure_stop" : "place.measure")}
              aria-pressed={measure.isFrom}
              className={`rounded-full p-1.5 hover:bg-paper-2 ${measure.isFrom ? "bg-paper-2 text-accent" : "text-ink-soft hover:text-ink"}`}
            >
              <Ruler className="size-[18px]" aria-hidden />
            </button>
          )}
          <button
            onClick={onZoom}
            aria-label={t("place.zoom")}
            title={t("place.zoom")}
            className="rounded-full p-1.5 text-accent hover:bg-paper-2"
          >
            <ZoomIn className="size-5" aria-hidden />
          </button>
          <button
            onClick={onClose}
            aria-label={t("place.close")}
            title={t("place.close")}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {!EMBEDDED && (lesson.picked.length > 0 || lesson.undo) && (
        <LessonBar lesson={lesson} locale={locale} />
      )}

      {photo && <Photo photo={photo} placeId={place.id} title={title} />}

      {/* Chips only where they tell something: a town is the expected case, and so is an
          agreed location. */}
      {(place.kind !== "settlement" || (certainty !== "unknown" && certainty !== "agreed")) && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          {place.kind !== "settlement" && (
            <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs text-ink-soft">
              {kind}
            </span>
          )}
          {certainty !== "unknown" && certainty !== "agreed" && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${place.disputed ? "border-[#e0b98f] bg-[#f4dfc9] text-[#7a4a1d]" : "border-line bg-paper-2 text-ink-soft"}`}
            >
              {certainty === "disputed"
                ? t("place.sites", { count: versions.length })
                : certainty === "likely"
                  ? t("place.likely_site")
                  : t("place.tentative_site")}
              {/* The score itself, for screen readers; About explains the levels. A
                  visible "556/1000" would read as precision OpenBible does not claim. */}
              {place.confidence !== undefined && (
                <span className="sr-only">
                  {". "}
                  {t("place.certainty_note", { score: place.confidence })}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {beforeItsTime(place, year) && (
        <div className="mx-5 mt-3 text-[12.5px] leading-snug text-ink-soft italic">
          {!life
            ? t("place.nt_only")
            : place.gap_from !== undefined &&
                year >= place.gap_from &&
                year < (place.gap_until ?? Infinity)
              ? t("place.in_ruins")
              : t(year < (place.life_from ?? -Infinity) ? "place.not_yet" : "place.no_longer")}
        </div>
      )}

      {ruled && ruled.year === year && (
        <div className="px-5 pt-3 text-[13.5px] leading-snug text-ink">
          <span className="text-ink-soft tabular-nums">{formatYear(year, locale)}:</span>{" "}
          {ruled.states
            .slice(0, 2)
            .map((p) => {
              const name = ru ? (p.nameRu ?? p.name) : p.name;
              const vassal = ru ? (p.vassalRu ?? p.vassal) : p.vassal;
              return vassal ? `${name}, ${vassal}` : name;
            })
            .join(" · ")}
        </div>
      )}

      {measure?.isFrom && (
        <div className="px-5 pt-3 text-[13px] text-ink-soft">{t("place.measure_hint")}</div>
      )}
      {measure?.from && !measure.isFrom && (
        <MeasureLine from={measure.from} to={title} at={at} onClear={measure.onClear} />
      )}

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-5 pt-3 text-[14px] text-ink">
        <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
        {/* The name of the place today opens it on Google Maps: no separate link to read. */}
        {today && <span className="text-ink-soft">{t("place.today")}:</span>}
        <a
          href={mapsUrl(at)}
          target="_blank"
          rel="noopener noreferrer"
          title={t("place.google_maps")}
          className="inline-flex items-center gap-1 text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {today ??
            // No other name today: the title again would only repeat it.
            t("place.google_maps")}
          <span className="sr-only">
            {" "}
            ({today ? `${t("place.google_maps")}, ` : ""}
            {t("new_tab")})
          </span>
        </a>
      </div>

      {alsoHere.length > 0 && (
        <div className="px-5 pt-2 text-[13px] leading-snug text-ink">
          <span className="text-ink-soft">{t("place.also_here")}:</span>{" "}
          {alsoHere.slice(0, allAlso ? undefined : ALSO_SHOWN).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <button
                onClick={() => {
                  onSelect(p.id);
                }}
                className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {ru ? (p.name_ru ?? p.name) : p.name}
              </button>
            </span>
          ))}
          {!allAlso && alsoHere.length > ALSO_SHOWN && (
            <>
              {" · "}
              <button
                onClick={() => {
                  setAllAlso(true);
                }}
                className="text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {t("place.more", { count: alsoHere.length - ALSO_SHOWN })}
              </button>
            </>
          )}
        </div>
      )}

      {/* What there is to read about the place, one part at a time. */}
      <div
        role="tablist"
        aria-label={title}
        className="sticky top-0 z-10 mt-3 flex gap-1 overflow-x-auto border-b border-line bg-paper/95 px-4 pt-2 backdrop-blur [scrollbar-width:none]"
        onKeyDown={(e) => {
          const i = tabs.indexOf(tab);
          const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = tabs[(i + d + tabs.length) % tabs.length];
          if (next) {
            pickTab(next);
            tabRefs.current[next]?.focus();
          }
        }}
      >
        {tabs.map((id) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            role="tab"
            id={`place-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="place-tabpanel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => {
              pickTab(id);
            }}
            className={`-mb-px border-b-2 px-2.5 pb-2 text-[13.5px] whitespace-nowrap ${
              tab === id
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {id === "story"
              ? t("place.tab_story")
              : id === "time"
                ? t("place.tab_time")
                : id === "people"
                  ? t("place.tab_people")
                  : id === "sites"
                    ? `${t("place.tab_sites")} · ${String(versions.length)}`
                    : t("place.tab_verses")}
          </button>
        ))}
      </div>
      <div
        id="place-tabpanel"
        role="tabpanel"
        aria-labelledby={`place-tab-${tab}`}
        className="pb-1"
      >
        {tab === "story" && <ArticleSection placeId={place.id} locale={locale} />}
        {tab === "people" && people && onPerson && (
          <ul className="mx-3 mt-2 mb-1">
            {here.map((h) => {
              const p = people.people[h.person];
              if (!p) return null;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onPerson(p.index);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper-2"
                  >
                    <span className="font-serif text-[15.5px] text-ink">
                      {personName(p, locale)}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
                      {safeRef(h.verse, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="px-2 pt-2 text-[11px] text-ink-soft">{t("place.people_credit")}</li>
          </ul>
        )}
        {tab === "sites" && (
          <div className="mx-5 mt-3 rounded-xl border border-[#e0b98f] bg-[#fbf1e4] px-3 py-2.5">
            <ul className="mt-1.5 space-y-1">
              {versions.map((s) => (
                <li key={`${s.label}-${s.at.join(",")}`}>
                  <button
                    onClick={() => {
                      onFlyTo(s.at);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-paper-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {ru ? (s.labelRu ?? s.label) : s.label}
                    </span>
                    {s.share !== null && (
                      <>
                        <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-paper-2">
                          <span
                            className="block h-full bg-accent"
                            style={{ width: `${s.share}%` }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-right text-[12px] text-ink-soft tabular-nums">
                          {s.share}%
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 text-[10.5px] leading-snug text-ink-soft">
              {t("place.sites_note")}
            </div>
          </div>
        )}

        {tab === "time" && life && (
          <div className="mx-5 mt-3 rounded-xl border border-line bg-paper-2/60 px-3 py-2 text-[14px] leading-snug text-ink">
            {/* When it stood first, then the years in ruins between its two lives. */}
            <div className="font-medium">
              {life.from && t("place.life_from", { year: lifeYear(life.from, locale, t) })}
              {life.from && life.until && " · "}
              {life.until &&
                t(life.from ? "place.life_until" : "place.life_until_only", {
                  year: lifeYear(life.until, locale, t),
                })}
              {life.gap && (life.from ?? life.until) && " · "}
              {life.gap &&
                t("place.life_gap", {
                  from: lifeYear(life.gap.from, locale, t),
                  until: lifeYear(life.gap.until, locale, t),
                })}
            </div>
            <div className="mt-0.5">{life.note[locale] ?? life.note.en}</div>
            <div className="mt-1 text-[11px] text-ink-soft">
              {sourcesOf(life, locale).join("; ")}
            </div>
          </div>
        )}

        {/* Pleiades: the periods the gazetteer attests it in, a span and not a founding. */}
        {tab === pleiadesTab && pleiades?.from !== undefined && pleiades.to !== undefined && (
          <div className="mx-5 mt-3 text-[13px] leading-snug text-ink-soft">
            {/* The span of the periods Pleiades attests the place in (Bethel from 30 BC is its
                first there, not its founding), so the line names Pleiades as its source. */}
            {t("place.attested", { span: formatYearRange(pleiades.from, pleiades.to, locale) })}{" "}
            <a
              href={`https://pleiades.stoa.org/places/${pleiades.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              Pleiades
              <span className="sr-only"> ({t("new_tab")})</span>
            </a>
          </div>
        )}

        {/* The gold marks of the slider that belong to this place. */}
        {tab === "time" && events.length > 0 && (
          <div className="mx-5 mt-3 border-l-2 border-gold pl-3 text-[14px] leading-snug text-ink">
            <ul className="space-y-1">
              {(allEvents ? events : events.slice(0, EVENTS_SHOWN)).map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span
                    className={`${ru ? "w-[104px]" : "w-[72px]"} shrink-0 text-right text-[12px] whitespace-nowrap text-ink-soft tabular-nums`}
                  >
                    {e.approximate ? `${t("place.circa")} ` : ""}
                    {formatYear(e.year, locale)}
                  </span>
                  <span>
                    {e.title[locale] ?? e.title.en}
                    {/* Told in the Bible: its passage, to read. */}
                    {e.ref && (
                      <>
                        {" · "}
                        <a
                          href={verseUrl(e.ref, locale)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12.5px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
                        >
                          {safeRef(e.ref, locale)}
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {!allEvents && events.length > EVENTS_SHOWN && (
              <button
                onClick={() => {
                  setAllEvents(true);
                }}
                className="mt-0.5 text-[12.5px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {t("place.more", { count: events.length - EVENTS_SHOWN })}
              </button>
            )}
          </div>
        )}

        {/* Battles and sieges fought here: who against whom, and how it ended. */}
        {tab === "time" && battles.length > 0 && (
          <div className="mx-5 mt-3">
            <h3 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {t("place.battles")}
            </h3>
            <ul className="mt-1 space-y-2 border-l-2 border-[#8e2a22]/60 pl-3 text-[14px] leading-snug text-ink">
              {battles.map((b) => (
                <li key={b.id} className="flex gap-2">
                  <span
                    className={`${ru ? "w-[104px]" : "w-[72px]"} shrink-0 text-right text-[12px] whitespace-nowrap text-ink-soft tabular-nums`}
                  >
                    {b.approximate ? `${t("place.circa")} ` : ""}
                    {formatYear(b.year, locale)}
                  </span>
                  <span>
                    {b.title[locale] ?? b.title.en}
                    {b.ref && (
                      <>
                        {" · "}
                        <a
                          href={verseUrl(b.ref, locale)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12.5px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
                        >
                          {safeRef(b.ref, locale)}
                        </a>
                      </>
                    )}
                    <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                      {b.sides[locale] ?? b.sides.en}. {b.outcome[locale] ?? b.outcome.en}.
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "verses" && (
          <>
            <div className="px-5 pt-3 text-[12.5px] text-ink-soft tabular-nums">
              {/* The count once, here, not on the tab: four tabs no longer fit with it. */}
              {[
                t("place.verse_count", { count: place.verses }),
                place.ot > 0 ? `${t("place.ot")} ${String(place.ot)}` : "",
                place.nt > 0 ? `${t("place.nt")} ${String(place.nt)}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {/* By book: the book once, then its chapters and verses, so the list says
                where the place is named and not only how often. */}
            <div ref={versesRef} className="px-5 pt-2">
              {byBook(place.osis.slice(0, versesShown), locale).map(({ book, refs }) => (
                <div key={book} className="flex gap-3 py-0.5">
                  <span className="w-12 shrink-0 pt-0.5 text-[12px] text-ink-soft">{book}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {refs.map(({ osis: o, cv }) => (
                      <button
                        key={o}
                        data-verse
                        aria-label={safeRef(o, locale)}
                        aria-expanded={openVerse === o}
                        aria-controls={openVerse === o ? "verse-text" : undefined}
                        onClick={() => {
                          setOpenVerse(openVerse === o ? null : o);
                          if (openVerse !== o) notifyVerse(o);
                        }}
                        className={`rounded-full border px-2 py-0.5 font-serif text-[13px] tabular-nums hover:border-accent hover:text-accent ${
                          openVerse === o
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-line bg-white/70 text-ink"
                        }`}
                      >
                        {cv}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {place.osis.length > versesShown && (
                <button
                  onClick={() => {
                    focusVerse.current = versesShown;
                    setVersesShown(versesShown + 50);
                  }}
                  className="mt-1 ml-15 rounded-full px-2 py-0.5 text-[13px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  {t("place.more", { count: place.osis.length - versesShown })}
                </button>
              )}
            </div>
            {openVerse && (
              <VerseText
                key={openVerse}
                osis={openVerse}
                locale={locale}
                self={[place.id, ...alsoHere.map((p) => p.id)]}
                placeName={placeName}
                onGoTo={onGoTo}
              />
            )}
          </>
        )}
      </div>

      <AncientAuthors placeId={place.id} locale={locale} />

      {questions && questions.length > 0 && (
        <div className="px-5 pt-3 text-[13px] leading-snug">
          <h3 className="text-[12px] text-ink-soft">{t("place.questions")}</h3>
          <ul className="mt-0.5">
            {questions.map((q) => (
              <li key={q.id}>
                <a
                  href={`${import.meta.env.BASE_URL}${locale}/q/${q.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
                >
                  {locale === "ru" ? q.ru : q.en}
                  <span className="sr-only"> ({t("new_tab")})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 px-5 pt-3 pb-4 text-[11px] text-ink-soft">
        <span>
          OpenBible.info (CC BY 4.0)
          {place.coord === "wikidata" ? ` · ${t("place.coords_wikidata")}` : ""}
        </span>
        {/* Readers and reviewers report a mistake where they see it, with the place named. */}
        <a
          href={reportUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("place.report")}
        </a>
      </div>
    </Panel>
  );
}

/**
 * The place's article, whole (its tab is for reading), then the verses and the sources
 * behind it and how far it has been checked.
 */
function ArticleSection({ placeId, locale }: { placeId: string; locale: Locale }) {
  const { t } = useTranslation();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    // A failed load leaves the card without the article; the next card tries again.
    loadArticle(placeId).then(
      (a) => {
        if (live) setArticle(a ?? null);
      },
      () => {
        if (live) setArticle(null);
      },
    );
    return () => {
      live = false;
    };
  }, [placeId]);
  // The tab is open while the article loads, or if it failed: say so rather than show nothing.
  if (article === undefined) return <p className="px-5 pt-3 text-[13px] text-ink-soft">…</p>;
  if (article === null)
    return <p className="px-5 pt-3 text-[13px] text-ink-soft">{t("place.article_failed")}</p>;
  const body = locale === "ru" ? article.body.ru : article.body.en;
  return (
    <section className="px-5 pt-3">
      <div className="space-y-3 font-serif text-[16px] leading-[1.65] text-ink">
        {body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-2 text-[12px] leading-snug text-ink-soft">
        <div>
          {t("place.article_scripture")}:{" "}
          {article.scripture.map((o, i) => (
            <span key={o}>
              {i > 0 && ", "}
              <a
                href={verseUrl(o, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {formatRef(o, locale)}
              </a>
            </span>
          ))}
        </div>
        <div className="mt-1">
          {t("place.article_sources")}: {sourcesOf(article, locale).join("; ")}.
        </div>
        <div className="mt-1 italic">
          {article.status === "reviewed" && article.reviewer
            ? t("place.article_reviewed", { name: article.reviewer })
            : t("place.article_checked")}
        </div>
      </div>
    </section>
  );
}

/** A new GitHub issue about this place, its name and id filled in. */
function reportUrl(place: PlaceProps): string {
  const name = place.name_ru ? `${place.name_ru} / ${place.name}` : place.name;
  const title = `Ошибка / Error: ${name} (${place.id})`;
  const body = `Место / Place: ${name} (${place.id})\nЧто не так / What is wrong:\n\nИсточник / Source:\n`;
  return `https://github.com/ArVaViT/history-globe/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/**
 * The text of the verse picked in the list, in the reader's language, with the chapter
 * on BibleGateway a click away.
 */
function VerseText({
  osis,
  locale,
  self,
  placeName,
  onGoTo,
}: {
  osis: string;
  locale: Locale;
  /** The card's own place and its other names on the same point: not linked. */
  self: readonly string[];
  placeName: (id: string) => string | undefined;
  onGoTo: (placeId: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null | undefined>(undefined);
  // The verse with the other places it names as links; plain until the index is in, and
  // for good if it does not load.
  // Kept with the verse and language they were made for: after a switch of language the
  // last one's links are not shown over the new text.
  const [linked, setLinked] = useState<{ key: string; parts: readonly Segment[] } | null>(null);
  const parts = linked?.key === `${osis}|${locale}` ? linked.parts : null;
  // A new array each render: the effect follows the ids, not the array.
  const selfKey = self.join(",");
  useEffect(() => {
    let live = true;
    loadVerse(osis, locale).then(
      (v) => {
        if (!live) return;
        setText(v ?? null);
        if (v)
          loadTextPlaces(locale).then(
            (index) => {
              if (live)
                setLinked({
                  key: `${osis}|${locale}`,
                  parts: splitPlaces(v, index, selfKey.split(",")),
                });
            },
            () => undefined,
          );
      },
      () => {
        if (live) setText(null);
      },
    );
    return () => {
      live = false;
    };
  }, [osis, locale, selfKey]);
  // Under a long list of verses the text may open below the card's fold: bring it in.
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (text !== undefined) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [text]);
  return (
    <figure
      ref={box}
      id="verse-text"
      aria-live="polite"
      className="mx-5 mt-3 border-l-2 border-accent/60 pl-3"
    >
      {text === undefined ? (
        <p className="text-[13px] text-ink-soft">…</p>
      ) : (
        text && (
          <blockquote className="font-serif text-[15px] leading-snug text-ink">
            {parts && parts.some((p) => p.place)
              ? parts.map((p, i) =>
                  // A namesake of the card's place (Babylon meaning Rome) is not linked.
                  p.place && placeName(p.place) !== placeName(self[0] ?? "") ? (
                    <button
                      key={i}
                      onClick={() => {
                        if (p.place) onGoTo(p.place);
                      }}
                      title={t("place.go_to", { name: placeName(p.place) ?? p.text })}
                      className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      {p.text}
                    </button>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )
              : text}
          </blockquote>
        )
      )}
      <figcaption className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px] text-ink-soft">
        <span>
          {safeRef(osis, locale)} · {t(locale === "ru" ? "place.verse_synodal" : "place.verse_kjv")}
        </span>
        <a
          href={verseUrl(osis, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("place.verse_open")}
          <span className="sr-only"> ({t("new_tab")})</span>
        </a>
      </figcaption>
    </figure>
  );
}

/** "Иерусалим → Вифлеем: 9 км по прямой · ≈ 2 ч пешком", with a way to clear it. */
function MeasureLine({
  from,
  to,
  at,
  onClear,
}: {
  from: { readonly name: string; readonly at: readonly [number, number] };
  to: string;
  at: readonly [number, number];
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const km = distanceKm(from.at, at);
  const w = walkTime(km);
  const walk =
    "hours" in w ? t("place.walk_hours", { n: w.hours }) : t("place.walk_days", { count: w.days });
  return (
    <div className="flex items-start gap-2 px-5 pt-3 text-[13.5px] leading-snug text-ink">
      <Ruler className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="flex-1">
        {t("place.distance_to", { from: from.name, to, km: roundKm(km), walk })}
      </span>
      <button
        onClick={onClear}
        aria-label={t("place.measure_stop")}
        title={t("place.measure_stop")}
        className="-mt-0.5 rounded-full p-0.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Verses grouped by their book, in order: "Нав" → ["10:1", "10:3"]. */
function byBook(
  osis: readonly string[],
  locale: Locale,
): { book: string; refs: { osis: string; cv: string }[] }[] {
  const groups: { book: string; refs: { osis: string; cv: string }[] }[] = [];
  for (const o of osis) {
    const label = safeRef(o, locale);
    const cut = label.lastIndexOf(" ");
    const book = label.slice(0, cut);
    const cv = label.slice(cut + 1);
    const last = groups.at(-1);
    if (last?.book === book) last.refs.push({ osis: o, cv });
    else groups.push({ book, refs: [{ osis: o, cv }] });
  }
  return groups;
}

let ancient: Promise<Readonly<Record<string, readonly AncientMention[]>>> | null = null;
/** What ancient authors say of places (content/ancient-authors.yaml): loaded once, on demand. */
function loadAncient() {
  ancient ??= fetch(`${DATA_URL}/ancient-authors.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, AncientMention[]>>) : {}))
    .catch(() => {
      ancient = null;
      return {};
    });
  return ancient;
}

/**
 * The place in ancient writers outside the Bible, in the manner of ToposText: who, where in
 * the work, a free text of the passage, and what it says in our words.
 */
function AncientAuthors({ placeId, locale }: { placeId: string; locale: Locale }) {
  const { t } = useTranslation();
  const [mentions, setMentions] = useState<readonly AncientMention[]>([]);
  useEffect(() => {
    let live = true;
    void loadAncient().then((all) => {
      if (live) setMentions(all[placeId] ?? []);
    });
    return () => {
      live = false;
    };
  }, [placeId]);
  if (mentions.length === 0) return null;
  const ru = locale === "ru";
  return (
    <div className="px-5 pt-3 text-[13px] leading-snug">
      <h3 className="text-[12px] text-ink-soft">{t("place.ancient_authors")}</h3>
      <ul className="mt-1 flex flex-col gap-1.5">
        {mentions.map((m) => (
          <li key={`${m.author.en} ${m.work.en} ${m.passage}`}>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {ru ? m.author.ru : m.author.en}, <i>{ru ? m.work.ru : m.work.en}</i>{" "}
              {m.passage.replace(/-/g, "–")}
              <span className="sr-only"> ({t("new_tab")})</span>
            </a>
            <span className="text-ink"> — {ru ? m.note.ru : m.note.en}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
