import {
  formatYear,
  formatYearRange,
  sourcesOf,
  type HistoryBattle,
  type HistoryEvent,
  type Locale,
  type PlaceLife,
  type PlacePhoto,
  type PleiadesLink,
  placeName as nameOf,
  pick,
  formatRefOr,
  rebuiltIn,
} from "@hg/model";
import { ArrowLeft, MapPin, Ruler, X, ZoomIn } from "./icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import {
  beforeItsTime,
  inRuins,
  standingYear,
  standingSpan,
  siteCertainty,
  whereIn,
  type PlaceProps,
  type Site,
} from "../data";
import { mapsUrl, verseUrl } from "../links";
import { useLesson } from "../lesson-store";
import { LessonToggle } from "./LessonControls";
import { useFrame } from "../frame";
import { Photo } from "./Photo";
import { notifyVerse } from "../embed";
import { Panel } from "./Panel";
import { loadPeople, peopleNow, personName, type People } from "../people";
import { polityText, type PolityName } from "@hg/core";
import { Credit } from "./Credit";
import { AncientAuthors } from "./place/AncientAuthors";
import { PlaceQuestions } from "./place/PlaceQuestions";
import { ArticleSection } from "./place/ArticleSection";
import { Rulers } from "./place/Rulers";
import { VerseText } from "./place/VerseText";
import { reportMail, reportUrl } from "../report";
import { readPref, writePref } from "../storage";

/** Verses listed at first, and more per press: Jerusalem has 955. */
const VERSES_FIRST = 24;
const VERSES_STEP = 50;
const EVENTS_SHOWN = 8;

/** "c. AD 20" for an approximate year. */
function lifeYear(
  y: { year: number; approximate: boolean },
  locale: Locale,
  t: (key: string) => string,
): string {
  return `${y.approximate ? `${t("place.circa")} ` : ""}${formatYear(y.year, locale)}`;
}

type PlaceTab = "story" | "time" | "people" | "sites" | "verses";
const TAB_KEY = "hg:place-tab";
/** The tab picked last in this visit: the next place opens on it, when it has one. */
function readTab(): PlaceTab {
  const v = readPref(TAB_KEY, "session");
  return v === "time" || v === "people" || v === "sites" || v === "verses" ? v : "story";
}

/**
 * Other records on the same point shown before "and N more", at most: fewer where one line
 * does not hold them.
 */
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
  onMeasure,
  onLesson,
  pleiades,
  onPerson,
  onYear,
  onHighlight,
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
  /** Opens the distance tool with this place as its first end. */
  onMeasure?: (() => void) | undefined;
  /** Opens the lesson tool, this place just added to the lesson. */
  onLesson?: (() => void) | undefined;
  /** Moves the timeline to a year: from a faded place, to one where it stands. */
  onYear?: ((year: number) => void) | undefined;
  /** Marks a place on the map, or none: the names in the article, pointed at. */
  onHighlight?: ((placeId: string | null) => void) | undefined;
}) {
  // Opened lists stay open for this place; the card is keyed by place, so a new place
  // starts folded again.
  const [tall, setTall] = useState(false);
  const [versesShown, setVersesShown] = useState(VERSES_FIRST);
  // After "N more" (place.more), keyboard focus moves to the first verse that appeared.
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
  // Folded, the names keep to one line: as many of them as it holds, from three down to one,
  // and the count of the rest beside them («Landet på andra sidan floden» took a second line,
  // which pushed the tabs under the fold of a phone's card).
  const [alsoShown, setAlsoShown] = useState(ALSO_SHOWN);
  const folded = !allAlso && alsoHere.length > alsoShown;
  const alsoRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const line = alsoRef.current;
    if (folded && line && alsoShown > 1 && line.scrollWidth > line.clientWidth)
      setAlsoShown(alsoShown - 1);
  }, [folded, alsoShown]);
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
  const { embed } = useFrame();
  const ru = locale === "ru";
  const title = nameOf(place, locale);
  // Where it is today, in the reader's language, unless that only repeats the title
  // (Jordan River and Jordan are both «Иордан»).
  // In Russian an English line stands in only where it names something else (never «Argob»).
  const todayText = !place.where
    ? ""
    : locale === "en"
      ? place.where
      : (whereIn(place, locale) ?? (place.where !== place.name ? place.where : ""));
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
    // A place of the ancient world has no verses to list.
    ...(place.ancient ? [] : (["verses"] as const)),
  ];
  const [chosen, setChosen] = useState<PlaceTab>(readTab);
  const tab = tabs.includes(chosen) ? chosen : tabs[0];
  const tabRefs = useRef<Partial<Record<PlaceTab, HTMLButtonElement | null>>>({});
  const pickTab = (next: PlaceTab) => {
    setChosen(next);
    writePref(TAB_KEY, next, "session");
  };
  // A place of the ancient world says what it was (a capital; a city, nothing).
  const kindKey = place.ancient ? `ancient.${place.ancient}` : `kind.${place.kind}`;
  const kind = t(kindKey, { defaultValue: place.ancient ? "" : place.kind });
  const chip = place.kind !== "settlement" || (place.ancient !== undefined && kind !== "");

  return (
    <Panel
      className={`w-card max-h-[calc(100dvh-var(--hg-timeline-h)-48px)] overflow-auto ${tall ? "max-md:max-h-[calc(100dvh-var(--hg-timeline-h)-96px)]" : "max-md:max-h-[48dvh]"}`}
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
          <ArrowLeft className="size-4" />
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
          {/* One quiet line under the name: where the Synodal text reads the Russian form. The
              English form is not shown beside it: it tells a Russian reader nothing. */}
          {ru && place.name_ru_osis && (
            <div className="mt-0.5 text-[12px] text-ink-soft">
              {place.name_ru_osis && (
                // Where the Russian form is from, in full on hover and for screen readers.
                <span
                  title={t("place.synodal_from", { ref: formatRefOr(place.name_ru_osis, locale) })}
                >
                  <span aria-hidden>{formatRefOr(place.name_ru_osis, locale)}</span>
                  <span className="sr-only">
                    {t("place.synodal_from", { ref: formatRefOr(place.name_ru_osis, locale) })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="-mr-1 flex shrink-0 items-center gap-0.5">
          {/* Not in a frame on another site: a lesson is the globe's own. */}
          {!embed && place.osis.length > 0 && <LessonToggle lesson={lesson} onAdd={onLesson} />}
          {onMeasure && (
            <button
              onClick={onMeasure}
              aria-label={t("place.measure")}
              title={t("place.measure")}
              className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
            >
              <Ruler className="size-[18px]" />
            </button>
          )}
          <button
            onClick={onZoom}
            aria-label={t("place.zoom")}
            title={t("place.zoom")}
            className="rounded-full p-1.5 text-accent hover:bg-paper-2"
          >
            <ZoomIn className="size-5" />
          </button>
          <button
            onClick={onClose}
            aria-label={t("place.close")}
            title={t("place.close")}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {photo && <Photo photo={photo} placeId={place.id} title={title} />}

      {/* Chips only where they tell something: a town is the expected case, and so is an
          agreed location. */}
      {(chip || (certainty !== "unknown" && certainty !== "agreed")) && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          {chip && (
            <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs text-ink-soft">
              {kind}
            </span>
          )}
          {certainty !== "unknown" && certainty !== "agreed" && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${place.disputed ? "border-dispute-line bg-dispute-fill text-dispute-ink" : "border-line bg-paper-2 text-ink-soft"}`}
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
          {!life && !place.ancient
            ? t("place.nt_only")
            : inRuins(place, year)
              ? t("place.in_ruins")
              : year < (place.life_from ?? -Infinity)
                ? t(place.life_older ? "place.not_yet_older" : "place.not_yet")
                : t("place.no_longer")}
          {(() => {
            // Where it stands: one click instead of hunting the year on the timeline.
            const to = standingYear(place, year);
            return onYear && to !== undefined ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    onYear(to);
                  }}
                  className="not-italic link-soft"
                >
                  {t("place.go_year", { year: formatYear(to, locale) })}
                </button>
              </>
            ) : null;
          })()}
        </div>
      )}

      {ruled && ruled.year === year && (
        <div className="px-5 pt-3 text-[13.5px] leading-snug text-ink">
          <span className="text-ink-soft tabular-nums">{formatYear(year, locale)}:</span>{" "}
          {ruled.states
            .slice(0, 2)
            .map((p) => {
              const { name, vassal } = polityText(p, locale);
              return vassal ? `${name}, ${vassal}` : name;
            })
            .join(" · ")}
        </div>
      )}

      <Rulers placeId={place.id} year={year} locale={locale} onYear={onYear} />

      {place.ancient !== undefined && (
        // When it stood and where its record is: the gazetteers it comes from.
        <div className="px-5 pt-3 text-[13.5px] leading-snug text-ink">
          <span className="tabular-nums">{standingSpan(place, t, locale)}</span>
          {/^\d+$/.test(place.id) && (
            <>
              {" · "}
              <a
                href={`https://pleiades.stoa.org/places/${place.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent"
              >
                Pleiades
                <span className="sr-only"> ({t("new_tab")})</span>
              </a>
            </>
          )}
          {place.qid && (
            <>
              {" · "}
              <a
                href={`https://www.wikidata.org/wiki/${place.qid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent"
              >
                Wikidata
                <span className="sr-only"> ({t("new_tab")})</span>
              </a>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-5 pt-3 text-[14px] text-ink">
        <MapPin className="size-4 shrink-0 text-accent" />
        {/* The name of the place today opens it on Google Maps: no separate link to read. */}
        {today && <span className="text-ink-soft">{t("place.today")}:</span>}
        <a
          href={mapsUrl(at)}
          target="_blank"
          rel="noopener noreferrer"
          title={t("place.google_maps")}
          className="inline-flex items-center gap-1 link-accent"
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
        <div className={`px-5 pt-2 text-[13px] leading-snug text-ink ${folded ? "flex" : ""}`}>
          <span ref={alsoRef} className={folded ? "min-w-0 truncate" : ""}>
            <span className="text-ink-soft">{t("place.also_here")}:</span>{" "}
            {alsoHere.slice(0, allAlso ? undefined : alsoShown).map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <button
                  onClick={() => {
                    onSelect(p.id);
                  }}
                  className="link-accent"
                >
                  {nameOf(p, locale)}
                </button>
              </span>
            ))}
          </span>
          {folded && (
            <span className="shrink-0 whitespace-pre">
              {" · "}
              <button
                onClick={() => {
                  setAllAlso(true);
                }}
                className="text-ink-soft link-soft"
              >
                {t("place.more", { count: alsoHere.length - alsoShown })}
              </button>
            </span>
          )}
        </div>
      )}

      {/* What there is to read about the place, one part at a time (a place of the ancient
          world may have nothing yet). */}
      {tab !== undefined && (
        <>
          <div
            role="tablist"
            aria-label={title}
            className="sticky top-0 z-10 mt-3 flex overflow-x-auto border-b border-line bg-paper/95 px-3 pt-2 backdrop-blur [scrollbar-width:none]"
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
                className={`-mb-px border-b-2 px-1.5 pb-2 text-[13px] whitespace-nowrap ${
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
                        ? t("place.tab_sites")
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
            {tab === "story" && (
              <ArticleSection placeId={place.id} locale={locale} onHighlight={onHighlight} />
            )}
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
                          {formatRefOr(h.verse, locale)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="px-2 pt-2 text-[11px] text-ink-soft">
                  <Credit text={t("place.people_credit")} />
                </li>
              </ul>
            )}
            {tab === "sites" && (
              <div className="mx-5 mt-3 rounded-xl border border-dispute-line bg-dispute-note px-3 py-2.5">
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
                          {ru ? (s.labelRu ?? s.label) : (s.labels?.[locale] ?? s.label)}
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
                      // The year it stood again, as the note gives it (the return in 538 BC).
                      until: lifeYear(rebuiltIn(life.gap), locale, t),
                    })}
                </div>
                <div className="mt-0.5">{pick(life.note, locale)}</div>
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
                  className="link-soft"
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
                        className={`${locale === "en" ? "w-[72px]" : "w-[104px]"} shrink-0 text-right text-[12px] whitespace-nowrap text-ink-soft tabular-nums`}
                      >
                        {e.approximate ? `${t("place.circa")} ` : ""}
                        {formatYear(e.year, locale)}
                      </span>
                      <span>
                        {pick(e.title, locale)}
                        {/* Told in the Bible: its passage, to read. */}
                        {e.ref && (
                          <>
                            {" · "}
                            <a
                              href={verseUrl(e.ref, locale)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12.5px] text-ink-soft link-soft"
                            >
                              {formatRefOr(e.ref, locale)}
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
                    className="mt-0.5 text-[12.5px] text-ink-soft link-soft"
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
                <ul className="mt-1 space-y-2 border-l-2 border-danger/60 pl-3 text-[14px] leading-snug text-ink">
                  {battles.map((b) => (
                    <li key={b.id} className="flex gap-2">
                      <span
                        className={`${locale === "en" ? "w-[72px]" : "w-[104px]"} shrink-0 text-right text-[12px] whitespace-nowrap text-ink-soft tabular-nums`}
                      >
                        {b.approximate ? `${t("place.circa")} ` : ""}
                        {formatYear(b.year, locale)}
                      </span>
                      <span>
                        {pick(b.title, locale)}
                        {b.ref && (
                          <>
                            {" · "}
                            <a
                              href={verseUrl(b.ref, locale)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12.5px] text-ink-soft link-soft"
                            >
                              {formatRefOr(b.ref, locale)}
                            </a>
                          </>
                        )}
                        <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                          {pick(b.sides, locale)}. {pick(b.outcome, locale)}.
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
                  {/* The count once, here, not on the tab: the tabs do not fit with it. */}
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
                            aria-label={formatRefOr(o, locale)}
                            aria-expanded={openVerse === o}
                            aria-controls={openVerse === o ? "verse-text" : undefined}
                            onClick={() => {
                              setOpenVerse(openVerse === o ? null : o);
                              if (openVerse !== o) notifyVerse(o, embed);
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
                        setVersesShown(versesShown + VERSES_STEP);
                      }}
                      className="mt-1 ml-15 rounded-full px-2 py-0.5 text-[13px] text-ink-soft link-soft"
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
        </>
      )}

      <AncientAuthors placeId={place.id} locale={locale} />

      <PlaceQuestions placeId={place.id} locale={locale} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-3 pb-4 text-[11px] text-ink-soft">
        <span>
          {place.ancient !== undefined
            ? "Pleiades (CC BY 3.0) · Wikidata (CC0)"
            : "OpenBible.info (CC BY 4.0)"}
          {place.coord === "wikidata" ? ` · ${t("place.coords_wikidata")}` : ""}
        </span>
        {/* Readers and reviewers report a mistake where they see it, with the place named:
            by email for the many without a GitHub account, whom the form would stop at a login. */}
        <span className="shrink-0">
          {t("place.report")}{" "}
          <a href={reportMail(place, locale)} className="link-soft">
            {t("place.report_email")}
          </a>
          {" · "}
          <a
            href={reportUrl(place, locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="link-soft"
          >
            GitHub
          </a>
        </span>
      </div>
    </Panel>
  );
}

/** Verses grouped by their book, in order: "Нав" → ["10:1", "10:3"]. */
function byBook(
  osis: readonly string[],
  locale: Locale,
): { book: string; refs: { osis: string; cv: string }[] }[] {
  const groups: { book: string; refs: { osis: string; cv: string }[] }[] = [];
  for (const o of osis) {
    const label = formatRefOr(o, locale);
    const cut = label.lastIndexOf(" ");
    const book = label.slice(0, cut);
    const cv = label.slice(cut + 1);
    const last = groups.at(-1);
    if (last?.book === book) last.refs.push({ osis: o, cv });
    else groups.push({ book, refs: [{ osis: o, cv }] });
  }
  return groups;
}
