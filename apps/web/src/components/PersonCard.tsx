import {
  canonicalPosition,
  formatCentury,
  formatRef,
  medianYear,
  type ChapterYears,
  type Locale,
} from "@hg/model";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { loadPeople, personName, type People } from "../people";
import { useNarrow } from "../app-hooks";
import { ArrowLeft, X } from "./icons";
import { Panel } from "./Panel";

/**
 * Names shown in a family row before "ещё N" opens the rest; fewer on a phone, where the
 * card has half the screen and David's eight wives and nineteen children took all of it.
 */
const SHOWN = {
  wide: { spouses: 99, children: 8, line: 5 },
  phone: { spouses: 3, children: 4, line: 3 },
};
/** Places shown before "ещё N": David has eighty. */
const PLACES_SHOWN = 8;

/**
 * A person of the Bible: their family as links, and the places they lived or acted in,
 * which the map highlights meanwhile (App). From STEP Bible's TIPNR (pipeline/people).
 */
export function PersonCard({
  index,
  locale,
  placeName,
  placeRank,
  chapterYears,
  onPerson,
  onPlace,
  onClose,
  back,
  tours = [],
  onTour,
}: {
  index: number;
  locale: Locale;
  placeName: (id: string) => string | undefined;
  /** 0 for the most named places: among those equally tied to the person, they lead. */
  placeRank: (id: string) => number;
  /** When the chapters happen: the person's century under their name. */
  chapterYears: ChapterYears;
  onPerson: (index: number) => void;
  onPlace: (placeId: string) => void;
  onClose: () => void;
  /** Opened from a place card: the way back to it. */
  back?: { label: string; onBack: () => void } | undefined;
  /** The tours; those that name this person as theirs are offered on the card. */
  tours?: readonly {
    readonly id: string;
    readonly title: Readonly<Record<string, string>>;
    readonly people?: readonly string[];
    readonly stops: readonly unknown[];
  }[];
  onTour?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [people, setPeople] = useState<People | null>(null);
  const shown = SHOWN[useNarrow() ? "phone" : "wide"];
  const [allSpouses, setAllSpouses] = useState(false);
  const [allChildren, setAllChildren] = useState(false);
  const [wholeLine, setWholeLine] = useState(false);
  const [allPlaces, setAllPlaces] = useState(false);
  // "ещё N" goes away when pressed: the focus moves to the oldest ancestor it showed.
  const lineStart = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (wholeLine) lineStart.current?.nextElementSibling?.querySelector("button")?.focus();
  }, [wholeLine]);
  // The card opens from a button that goes away with the card before it: the focus moves
  // to this card's title, so keyboard and screen reader users carry on from here.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    void loadPeople().then((p) => {
      if (live) setPeople(p);
    });
    return () => {
      live = false;
    };
  }, []);
  const person = people?.people[index];
  useEffect(() => {
    if (person) title.current?.focus();
  }, [person]);
  if (!people || !person) return null;
  const name = personName(person, locale);
  const year = medianYear(
    (people.placesOf.get(index) ?? []).map((p) => p.verse),
    chapterYears,
  );
  const century = year === undefined ? undefined : formatCentury(year, locale);
  // The places most tied to them first (Jerusalem for David, not a well named once), then
  // shown in the order of the text: the story of their life as the Bible tells it.
  const tied = (people.placesOf.get(index) ?? [])
    .filter((p) => placeName(p.place))
    .map((p) => ({ ...p, at: position(p.verse), rank: placeRank(p.place) }))
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank);
  const inOrder = (list: typeof tied) => [...list].sort((a, b) => a.at - b.at);
  const places = inOrder(tied);
  const placesShown = allPlaces ? places : inOrder(tied.slice(0, PLACES_SHOWN));
  const link = (i: number) => {
    const p = people.people[i];
    if (!p) return null;
    return (
      <button
        key={p.id}
        onClick={() => {
          onPerson(i);
        }}
        // Colour alone marks a name as a link: twenty dotted underlines made the card ripple.
        className="text-accent underline-offset-2 hover:underline focus-visible:underline"
      >
        {personName(p, locale)}
      </button>
    );
  };
  // A row of names, folded after `limit` with "ещё N" to open it.
  const row = (label: string, all: readonly number[], limit = all.length, more?: () => void) => {
    const ids = more && all.length > limit ? all.slice(0, limit) : all;
    return (
      ids.length > 0 && (
        <div className="flex gap-3 py-1">
          <dt className="w-[76px] shrink-0 text-ink-soft">{label}</dt>
          <dd className="flex flex-wrap gap-x-1.5 gap-y-0.5">
            {ids.map((i, k) => (
              <span key={i}>
                {link(i)}
                {k < ids.length - 1 && ","}
              </span>
            ))}
            {ids.length < all.length && (
              <button
                onClick={more}
                className="text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {t("place.more", { count: all.length - ids.length })}
              </button>
            )}
          </dd>
        </div>
      )
    );
  };
  // The father's line, the oldest first (Adam … Jesse for David): only when it goes
  // further back than the father, who has his own row.
  const line: number[] = [];
  for (
    let cur = person.fathers[0], seen = new Set([index]);
    cur !== undefined && !seen.has(cur);
    cur = people.people[cur]?.fathers[0]
  ) {
    seen.add(cur);
    line.unshift(cur);
  }
  // The root (Adam), "… N" for the generations between, then the nearest five.
  // Folded only when it hides more than four generations: "… 3" read like a footnote.
  const folded = !wholeLine && line.length > shown.line + 5;
  const lineShown = folded ? line.slice(-shown.line) : line;
  const lineRoot = folded ? line[0] : undefined;

  return (
    <Panel className="w-[min(420px,calc(100vw-376px-32px))] max-md:w-full max-h-[calc(100dvh-var(--hg-timeline-h,124px)-48px)] max-md:max-h-[48dvh] overflow-auto pb-3">
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
            ref={title}
            tabIndex={-1}
            className="font-serif text-[26px] leading-tight font-semibold text-ink outline-none"
          >
            {name}
          </h2>
          {/* The century only: the English name beside the Russian one said nothing a
              reader of Russian needs, and the search no longer shows it either. */}
          {century && <div className="text-[13px] text-ink-soft">{century}</div>}
        </div>
        <button
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
          className="-mr-1 rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <dl className="px-5 pt-3 text-[14px] leading-snug text-ink">
        {row(t("person.fathers"), person.fathers)}
        {row(t("person.mothers"), person.mothers)}
        {row(
          t(
            person.female
              ? person.spouses.length > 1
                ? "person.husbands"
                : "person.husband"
              : person.spouses.length > 1
                ? "person.wives"
                : "person.wife",
          ),
          person.spouses,
          allSpouses ? undefined : shown.spouses,
          () => {
            setAllSpouses(true);
          },
        )}
        {row(
          t("person.children"),
          person.children,
          allChildren ? undefined : shown.children,
          () => {
            setAllChildren(true);
          },
        )}
        {line.length > 1 && (
          <div className="flex gap-3 py-1">
            <dt className="w-[76px] shrink-0 text-ink-soft">{t("person.line")}</dt>
            <dd className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              {lineRoot !== undefined && (
                <>
                  <span className="whitespace-nowrap">{link(lineRoot)}</span>
                  <span className="whitespace-nowrap">
                    <span className="mr-1 text-ink-soft" aria-hidden>
                      →
                    </span>
                    <button
                      onClick={() => {
                        setWholeLine(true);
                      }}
                      className="text-ink-soft hover:text-ink"
                    >
                      {t("person.generations", { count: line.length - lineShown.length - 1 })}
                    </button>
                  </span>
                </>
              )}
              {lineShown.map((i, k) => (
                <span key={i} ref={k === 0 ? lineStart : undefined} className="whitespace-nowrap">
                  {(k > 0 || lineRoot !== undefined) && (
                    <span className="mr-1 text-ink-soft" aria-hidden>
                      →
                    </span>
                  )}
                  {link(i)}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* Their own way as a tour (Paul's journeys): what a teacher looking them up wants. */}
      {onTour && tours.some((x) => x.people?.includes(person.id)) && (
        <>
          <h3 className="px-5 pt-4 pb-1 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
            {t("person.tours")}
          </h3>
          <ul className="mx-3">
            {tours
              .filter((x) => x.people?.includes(person.id))
              .map((x) => (
                <li key={x.id}>
                  <button
                    onClick={() => {
                      onTour(x.id);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper-2"
                  >
                    <span className="font-serif text-[15.5px] text-ink">
                      {x.title[locale] ?? x.title.en}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
                      {t("tours.stops", { count: x.stops.length })}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {places.length > 0 && (
        <>
          <h3 className="px-5 pt-4 pb-1 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
            {t("person.places")}
          </h3>
          <ul className="mx-3">
            {placesShown.map((p) => (
              <li key={p.place}>
                <button
                  onClick={() => {
                    onPlace(p.place);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper-2"
                >
                  <span className="font-serif text-[15.5px] text-ink">{placeName(p.place)}</span>
                  <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
                    {verseLabel(p.verse, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {placesShown.length < places.length && (
            <button
              onClick={() => {
                setAllPlaces(true);
              }}
              className="mx-5 mt-1 text-[13px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              {t("place.more", { count: places.length - placesShown.length })}
            </button>
          )}
        </>
      )}
      <div className="px-5 pt-3 text-[11px] text-ink-soft">{t("person.credit")}</div>
    </Panel>
  );
}

function verseLabel(osis: string, locale: Locale): string {
  try {
    return formatRef(osis, locale);
  } catch {
    return osis;
  }
}

/** Where a verse stands in the canon, for the order of the text; unknown ones last. */
function position(osis: string): number {
  try {
    return canonicalPosition(osis);
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
