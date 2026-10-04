import { Search } from "./icons";
import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import {
  formatCentury,
  formatYear,
  formatYearRange,
  medianYear,
  parseChapter,
  type Locale,
  placeName,
  isYearInput,
  parseYearInput,
  pick,
  namesOf,
} from "@hg/model";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "../i18n";
import { chapterFocus, type ChapterFocus } from "../chapter";
import { DATA_URL, foldName, searchPlaces, type LoadedData, type PlaceProps } from "../data";
import { loadPeople, peopleNow, personName, type People } from "../people";
import { Panel } from "./Panel";

/**
 * Two names that are the same words in other cases («Город Давидов», «Город Давида»):
 * word by word, each pair shares all but its last two letters.
 */
function sameWords(a: string, b: string): boolean {
  // Words first: foldName drops the spaces.
  const x = a.trim().split(/\s+/).map(foldName);
  const y = b.trim().split(/\s+/).map(foldName);
  return (
    x.length === y.length &&
    x.every((w, i) => {
      const v = y[i] ?? "";
      const n = Math.max(3, Math.min(w.length, v.length) - 2);
      return w.slice(0, n) === v.slice(0, n);
    })
  );
}

/** A site of the ancient world layer, as the search offers it. */
export interface AncientSearchSite {
  readonly id: string;
  readonly en: string;
  readonly ru: string;
  readonly kind: string;
  readonly rank: number;
  readonly approx?: boolean;
  readonly from: number;
  readonly to: number;
  readonly lon: number;
  readonly lat: number;
}

let ancientLoad: Promise<AncientSearchSite[]> | null = null;
/** ancient.geojson, fetched once when the search first opens (the map has it cached). */
function loadAncientSites(): Promise<AncientSearchSite[]> {
  ancientLoad ??= fetch(`${DATA_URL}/ancient.geojson`)
    .then((r) => (r.ok ? (r.json() as Promise<AncientFile>) : { features: [] }))
    .then((f) =>
      f.features.map((x) => ({
        ...x.properties,
        lon: x.geometry.coordinates[0] ?? 0,
        lat: x.geometry.coordinates[1] ?? 0,
      })),
    )
    .catch(() => {
      // Tried again the next time the search opens.
      ancientLoad = null;
      return [];
    });
  return ancientLoad;
}
type AncientFile = {
  features: {
    geometry: { coordinates: number[] };
    properties: Omit<AncientSearchSite, "lon" | "lat">;
  }[];
};

/**
 * The search in the header, in the title's place: the field on the header's line and the
 * results dropping below it, over the column. Esc or a choice gives the title back.
 */
export function SearchBox({
  data,
  inputRef,
  bibleOnly = false,
  takeTyped,
  onSelect,
  onChapter,
  onYear,
  onPerson,
  onAncient,
  onTour,
  onClose,
}: {
  data: LoadedData;
  inputRef: RefObject<HTMLInputElement | null>;
  /** The Bible alone (a setting): no sites of the ancient world it does not name. */
  bibleOnly?: boolean;
  /** What was typed while the search loaded: taken over when the field takes the focus. */
  takeTyped?: () => string;
  onSelect: (placeId: string) => void;
  /** A chapter typed ("Деян 16"): its places, picked out on the map. */
  onChapter: (focus: ChapterFocus) => void;
  /** A year typed ("586 до н. э."): the map goes to it. */
  onYear: (year: number) => void;
  /** A person typed ("Давид"): their card, their places on the map. */
  onPerson: (index: number) => void;
  /** An ancient site typed ("Хаттуса"): the map flies there, in a year it stood. */
  onAncient: (site: AncientSearchSite) => void;
  /** A tour found by its title ("путешествие Павла"): it starts. */
  onTour: (id: string) => void;
  /** `focusBack`: Esc or a choice hands the focus back to the magnifier; a click away does not. */
  onClose: (focusBack: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const found = useMemo(() => searchPlaces(data, query), [data, query]);
  const [people, setPeople] = useState<People | null>(peopleNow);
  useEffect(() => {
    if (!people) void loadPeople().then(setPeople, () => undefined);
  }, [people]);
  const [ancient, setAncient] = useState<AncientSearchSite[]>([]);
  useEffect(() => {
    void loadAncientSites().then(setAncient);
  }, []);
  const ru = i18n.language === "ru";
  // "Деян 16": the places whose verses include that chapter, offered above the names.
  // A place's own name before the number («Иерусалим 1», "Jericho 6") is not a book.
  const placeNames = useMemo(
    () => new Set([...data.byId.values()].flatMap(({ props }) => namesOf(props).map(foldName))),
    [data],
  );
  const chapter = useMemo(() => {
    const word = foldName(query.replace(/\d+\s*$/, ""));
    const c = placeNames.has(word) ? null : parseChapter(query, i18n.language as Locale);
    const focus = c && chapterFocus(data, c.ref);
    return focus ? { ...focus, label: c.label } : null;
  }, [data, query, i18n.language, placeNames]);
  // A year typed on its own, inside the map's range: offered first, as a chapter is.
  const year = useMemo(() => {
    if (chapter || !isYearInput(query)) return null;
    const y = parseYearInput(query);
    return y !== null && y >= YEAR_MIN && y <= YEAR_MAX ? y : null;
  }, [chapter, query]);
  // People after the places: those the map can show first, the most travelled first;
  // then those it cannot (Adam, Noah, Job, Mary) when the text names them in ten verses
  // or more, which leaves out the namesakes named once.
  const persons = useMemo(() => {
    // A name that is also a book ("Иоанн", "Даниил") offers the book first, then the people.
    if (!people || year !== null) return [];
    const q = foldName(query);
    if (q.length < 2) return [];
    const locale = i18n.language as Locale;
    return people.people
      .filter((p) => {
        if (!people.placesOf.has(p.index) && p.verses < 10) return false;
        return [personName(p, locale), p.name].some((n) => foldName(n).startsWith(q));
      })
      .map((p) => ({ person: p, places: people.placesOf.get(p.index)?.length ?? 0 }))
      .sort((a, b) => b.places - a.places || b.person.verses - a.person.verses)
      .slice(0, 4);
  }, [people, year, query, i18n.language]);
  const locale = i18n.language as Locale;
  const centuryOfPerson = (index: number) => {
    const y = medianYear(
      (people?.placesOf.get(index) ?? []).map((x) => x.verse),
      data.chapterYears,
    );
    return y === undefined ? undefined : formatCentury(y, locale);
  };
  // The ancient world last: a few sites the Bible does not name.
  const sites = useMemo(() => {
    if (year !== null || bibleOnly) return [];
    const q = foldName(query);
    if (q.length < 2) return [];
    return ancient.filter((a) => [a.ru, a.en].some((n) => foldName(n).startsWith(q))).slice(0, 3);
  }, [ancient, year, query, bibleOnly]);
  // Tours by their title, in either language: "путешествие Павла", "Exodus".
  const tours = useMemo(() => {
    if (year !== null) return [];
    const q = foldName(query);
    if (q.length < 4) return [];
    // Or whose traveller the name finds: «Павел» for «путешествие Павла».
    const who = new Set(persons.map(({ person }) => person.id));
    return data.tours
      .filter(
        (tour) =>
          Object.values(tour.title).some((n) => foldName(n).includes(q)) ||
          (tour.people ?? []).some((id) => who.has(id)),
      )
      .slice(0, 3);
  }, [data, year, query, persons]);
  // A place found only by a loose match (a case form, a stem) gives way when anything
  // starts with what was typed: "Хатт" offers Hatti and Hattusa, not Dinhabah.
  const results = useMemo(() => {
    const q = foldName(query);
    const startsWord = (text: string | undefined) =>
      text !== undefined &&
      text.split(/[\s\-\u2010-\u2015]+/).some((w) => foldName(w).startsWith(q));
    // Strong: the place's own name. A match on where it is today ("Adamah, at Tell
    // ed-Damiyeh near Hattin") is loose, and gives way to an ancient site named so.
    const strong = found.filter(({ props: p }) => [p.name, p.name_ru].some(startsWord));
    const anyStrong = strong.length > 0 || persons.length > 0 || sites.length > 0;
    return anyStrong && q.length >= 2 ? strong : found;
  }, [found, persons, sites, query]);
  // The chapter or the year, when there is one, is the first option; places, people, sites.
  const offset = chapter || year !== null ? 1 : 0;
  const total = offset + results.length + persons.length + sites.length + tours.length;
  const personAt = (i: number) => persons[i - offset - results.length];
  const siteAt = (i: number) => sites[i - offset - results.length - persons.length];
  const tourAt = (i: number) => tours[i - offset - results.length - persons.length - sites.length];
  const activeId =
    chapter && active === 0
      ? "search-chapter"
      : year !== null && active === 0
        ? "search-year"
        : results[active - offset]
          ? `search-${results[active - offset]?.props.id ?? ""}`
          : personAt(active)
            ? `search-person-${String(personAt(active)?.person.index)}`
            : siteAt(active)
              ? `search-site-${siteAt(active)?.id ?? ""}`
              : tourAt(active)
                ? `search-tour-${tourAt(active)?.id ?? ""}`
                : undefined;
  const open = query.trim().length >= 2;
  const nameOf = (p: PlaceProps) => placeName(p, i18n.language);

  const choose = (id: string) => {
    onSelect(id);
    setQuery("");
    onClose(true);
  };
  const choosePerson = (index: number) => {
    onPerson(index);
    setQuery("");
    onClose(true);
  };
  const chooseTour = (id: string) => {
    onTour(id);
    setQuery("");
    onClose(true);
  };
  const chooseSite = (site: AncientSearchSite) => {
    onAncient(site);
    setQuery("");
    onClose(true);
  };

  return (
    <div
      className="min-w-0 flex-1"
      // A click away (the map, the column) closes the search; a press inside the header
      // (its own cross) does not, and the results keep the focus with preventDefault.
      onBlur={(e) => {
        const header = e.currentTarget.parentElement;
        if (!header?.contains(e.relatedTarget)) onClose(false);
      }}
    >
      <label className="hg-grow flex items-center gap-2 rounded-full bg-paper-2/70 px-3 py-1.5 ring-1 ring-transparent transition focus-within:bg-paper focus-within:ring-2 focus-within:ring-accent/30">
        <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
        <input
          ref={inputRef}
          // Loaded on the press that opens it: the field takes the focus itself.
          autoFocus
          onFocus={() => {
            // The field shown while this loaded, read now: it is shown later than rendered.
            const early = takeTyped?.();
            if (early && !query) setQuery(early);
          }}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, total - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && chapter && active === 0) {
              onChapter(chapter);
              setQuery("");
              onClose(true);
            } else if (e.key === "Enter" && year !== null && active === 0) {
              onYear(year);
              setQuery("");
              onClose(true);
            } else if (e.key === "Enter" && results[active - offset])
              choose(results[active - offset]?.props.id ?? "");
            else if (e.key === "Enter" && personAt(active))
              choosePerson(personAt(active)?.person.index ?? 0);
            else if (e.key === "Enter" && siteAt(active)) {
              const site = siteAt(active);
              if (site) chooseSite(site);
            } else if (e.key === "Enter" && tourAt(active)) {
              chooseTour(tourAt(active)?.id ?? "");
            } else if (e.key === "Escape") {
              setQuery("");
              onClose(true);
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? "search-results" : undefined}
          aria-activedescendant={open ? activeId : undefined}
          className="w-full min-w-0 bg-transparent text-[15px] text-ink outline-hidden placeholder:text-[14px] placeholder:text-ink-soft/70"
        />
      </label>
      {open && (
        <Panel className="hg-pop absolute inset-x-0 top-full z-20 mt-2 origin-top overflow-hidden bg-paper!">
          {/* Opaque, unlike other panels: it opens over the overview, whose lines showed
              through the glass. */}
          <ul
            id="search-results"
            className="max-h-80 overflow-auto py-1"
            role="listbox"
            aria-label={t("search.placeholder")}
          >
            {chapter && (
              <li
                id="search-chapter"
                role="option"
                aria-selected={active === 0}
                onMouseEnter={() => {
                  setActive(0);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChapter(chapter);
                  setQuery("");
                  onClose(true);
                }}
                className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-line px-4 py-2 ${active === 0 ? "bg-paper-2" : ""}`}
              >
                <span className="font-serif text-[15px] text-accent">{chapter.label}</span>
                <span className="text-xs text-ink-soft">
                  {t("search.chapter", { count: chapter.places.length })}
                </span>
              </li>
            )}
            {year !== null && (
              <li
                id="search-year"
                role="option"
                aria-selected={active === 0}
                onMouseEnter={() => {
                  setActive(0);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onYear(year);
                  setQuery("");
                  onClose(true);
                }}
                className={`flex cursor-pointer items-baseline gap-2 border-b border-line px-4 py-2 ${active === 0 ? "bg-paper-2" : ""}`}
              >
                <span className="text-xs text-ink-soft">{t("search.go_to_year")}</span>
                <span className="font-serif text-[15px] text-accent">
                  {formatYear(year, i18n.language as Locale)}
                </span>
              </li>
            )}
            {results.length === 0 &&
              persons.length === 0 &&
              sites.length === 0 &&
              tours.length === 0 &&
              !chapter &&
              year === null && (
                <li className="px-4 py-2 text-sm text-ink-soft">{t("search.empty")}</li>
              )}
            {results.map(({ props }, i) => {
              const primary = nameOf(props);
              // Namesakes (three Beth-shemeshes) are told apart by where they are.
              const namesake = results.some(
                (r) => r.props.id !== props.id && nameOf(r.props) === primary,
              );
              // On the right, where the place is today, in the reader's language (never the
              // English name beside the Russian, design review 3); what kind of place it is
              // when that says nothing new ("City of David — City of David").
              const kind = t(`kind.${props.kind}`, { defaultValue: "" });
              const where = ru ? props.where_ru : props.where;
              const secondary =
                where && !sameWords(where, primary) && (namesake || !ru || !/[A-Za-z]/.test(where))
                  ? where
                  : kind;
              return (
                <li
                  key={props.id}
                  id={`search-${props.id}`}
                  role="option"
                  aria-selected={i + offset === active}
                  onMouseEnter={() => {
                    setActive(i + offset);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(props.id);
                  }}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-1.5 ${i + offset === active ? "bg-paper-2" : ""}`}
                >
                  <span className="font-serif text-[15px] text-ink">{primary}</span>
                  <span className="truncate text-xs text-ink-soft">{secondary}</span>
                </li>
              );
            })}
            {persons.map(({ person, places }, j) => {
              const i = offset + results.length + j;
              const name = personName(person, i18n.language as Locale);
              // Their century says who they are at a glance ("Давид — XI в. до н. э."); namesakes
              // of one century are told apart by the place most tied to them.
              const tied = people?.placesOf.get(person.index) ?? [];
              const year = medianYear(
                tied.map((x) => x.verse),
                data.chapterYears,
              );
              const century = year === undefined ? undefined : formatCentury(year, locale);
              const twin = persons.some(
                (o) =>
                  o.person.id !== person.id &&
                  personName(o.person, locale) === name &&
                  centuryOfPerson(o.person.index) === century,
              );
              const top = [...tied]
                .map((x) => ({ ...x, props: data.byId.get(x.place)?.props }))
                .filter((x) => x.props)
                .sort((a, b) => a.tier - b.tier || (a.props?.rank ?? 3) - (b.props?.rank ?? 3))[0];
              const where = top?.props ? nameOf(top.props) : undefined;
              const label = century && twin && where ? `${where} · ${century}` : (century ?? where);
              return (
                <li
                  key={person.id}
                  id={`search-person-${String(person.index)}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => {
                    setActive(i);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choosePerson(person.index);
                  }}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-1.5 ${j === 0 && results.length > 0 ? "border-t border-line" : ""} ${i === active ? "bg-paper-2" : ""}`}
                >
                  <span className="font-serif text-[15px] text-ink">{name}</span>
                  <span className="truncate text-xs text-ink-soft">
                    {label ?? (places > 0 ? t("search.chapter", { count: places }) : "")}
                  </span>
                </li>
              );
            })}
            {sites.map((site, j) => {
              const i = offset + results.length + persons.length + j;
              return (
                <li
                  key={site.id}
                  id={`search-site-${site.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => {
                    setActive(i);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    chooseSite(site);
                  }}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-1.5 ${j === 0 && results.length + persons.length > 0 ? "border-t border-line" : ""} ${i === active ? "bg-paper-2" : ""}`}
                >
                  <span className="font-serif text-[15px] text-ink">
                    {pick({ en: site.en, ru: site.ru }, i18n.language) ?? site.en}
                  </span>
                  <span className="truncate text-xs text-ink-soft">
                    {/* When it stood says more than "capital" (of what?) and sets it
                        apart from the Bible's places, which have no span here. */}
                    {/* As the tip on the map writes it. */}
                    {site.to >= YEAR_MAX
                      ? t("ancient.since", {
                          year:
                            (site.approx ? `${t("place.circa")} ` : "") +
                            formatYear(site.from, locale),
                        })
                      : (site.approx ? `${t("place.circa")} ` : "") +
                        formatYearRange(site.from, site.to, locale)}
                  </span>
                </li>
              );
            })}
            {tours.map((tour, j) => {
              const i = offset + results.length + persons.length + sites.length + j;
              return (
                <li
                  key={tour.id}
                  id={`search-tour-${tour.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => {
                    setActive(i);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    chooseTour(tour.id);
                  }}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-1.5 ${j === 0 && results.length + persons.length + sites.length > 0 ? "border-t border-line" : ""} ${i === active ? "bg-paper-2" : ""}`}
                >
                  <span className="font-serif text-[15px] text-ink">
                    {tour.title[locale] ?? tour.title.en}
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">{t("search.tour")}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
