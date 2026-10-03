import { YEAR_MAX, YEAR_MIN, type Engine, type Renderer } from "@hg/core";
import { formatYear, medianYear, periodAt } from "@hg/model";
import { BookOpen, ChevronDown, Search, Settings, X } from "./components/icons";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "./i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Panel } from "./components/Panel";
import { Timeline } from "./components/Timeline";

// Opened on demand, not needed for the first frame: loaded when first shown (ADR 0011).
const PersonCard = lazy(() =>
  import("./components/PersonCard").then((m) => ({ default: m.PersonCard })),
);
const PlaceCard = lazy(() =>
  import("./components/PlaceCard").then((m) => ({ default: m.PlaceCard })),
);
const TourStopCard = lazy(() =>
  import("./components/TourStopCard").then((m) => ({ default: m.TourStopCard })),
);
const SettingsDialog = lazy(() =>
  import("./components/Settings").then((m) => ({ default: m.SettingsDialog })),
);
// The hover tips come in their own chunk, out of the first: they show nothing until the
// first hover, and their chunk loads as the map does.
const tips = () => import("./components/HoverTip");
const HoverTip = lazy(() => tips().then((m) => ({ default: m.HoverTip })));
const PolityTip = lazy(() => tips().then((m) => ({ default: m.PolityTip })));
const AncientTip = lazy(() => tips().then((m) => ({ default: m.AncientTip })));
const BattleTip = lazy(() => tips().then((m) => ({ default: m.BattleTip })));
const Overview = lazy(() => import("./components/Overview").then((m) => ({ default: m.Overview })));
const ToursPanel = lazy(() =>
  import("./components/ToursPanel").then((m) => ({ default: m.ToursPanel })),
);
const EventsPanel = lazy(() =>
  import("./components/EventsPanel").then((m) => ({ default: m.EventsPanel })),
);
const ArticlesPanel = lazy(() =>
  import("./components/ArticlesPanel").then((m) => ({ default: m.ArticlesPanel })),
);
// The search opens on a press: its code (and the people's and sites' lookups) waits for it.
const SearchBox = lazy(() =>
  import("./components/SearchBox").then((m) => ({ default: m.SearchBox })),
);
// Only inside another site's frame.
const EmbedBar = lazy(() => import("./components/EmbedBar").then((m) => ({ default: m.EmbedBar })));
const ChapterPicker = lazy(() =>
  import("./components/EmbedBar").then((m) => ({ default: m.ChapterPicker })),
);
const PeoplePanel = lazy(() =>
  import("./components/PeoplePanel").then((m) => ({ default: m.PeoplePanel })),
);
// Jerusalem's walls laid over another place, to compare sizes: on a press in the menu.
const WallsPanel = lazy(() =>
  import("./components/WallsPanel").then((m) => ({ default: m.WallsPanel })),
);
// The tour's quiz played on screen: on a press in the menu.
const QuizPanel = lazy(() =>
  import("./components/QuizPanel").then((m) => ({ default: m.QuizPanel })),
);
const InViewPanel = lazy(() =>
  import("./components/InViewPanel").then((m) => ({ default: m.InViewPanel })),
);
import { loadData, type LoadedData } from "./data";
import {
  useHeightVar,
  useKeys,
  useMapFeed,
  useMedia,
  useNarrow,
  usePanelsOpen,
  usePlayback,
  useBibleOnly,
  useUrlSync,
} from "./app-hooks";
import { timelineEventsOf } from "./timeline-events";
import { chapterFocus, chapterLabel } from "./chapter";
import { useEmbed, useEmbedError } from "./embed";
import { readUrl } from "./url";
import { loadPeople, personName, type People } from "./people";
import { setCompactFrame, setPersonCardOpen, useGlobe, useGlobeState } from "./useGlobe";

const INITIAL = readUrl();
/** Inside another site's page: the map, the card and the slider, no column. */
const EMBED = INITIAL.embed === true;
// Inside another site, the map's controls are trimmed (styles.css: no scale bar; no zoom
// buttons in a narrow column, where gestures zoom).

export function App() {
  const { i18n, t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** What was typed into the search before it loaded: it carries on from there. */
  const typed = useRef("");
  const [data, setData] = useState<LoadedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [, togglePanels] = usePanelsOpen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Once opened, the settings window stays mounted, so it can close as a dialog does.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (settingsOpen && !settingsLoaded) setSettingsLoaded(true);
  const [moreOpen, setMoreOpen] = useState(readMore);
  // The search is a magnifier until pressed: one field less on the map.
  const [searchOpen, setSearchOpen] = useState(false);
  const [wallsOpen, setWallsOpen] = useState(false);
  // The tour's quiz on screen, kept with the tour it was made for.
  const [quizOf, setQuiz] = useState<{
    readonly tour: string;
    readonly quiz: NonNullable<Awaited<ReturnType<typeof import("./print").buildQuiz>>>;
  } | null>(null);
  // "About the place" leaves a tour for the stop's card; this is the way back to the stop.
  const [backToTour, setBackToTour] = useState<{
    id: string;
    step: number;
    place: string;
  } | null>(null);
  // A person's card (from a place's people), and the place it was opened from.
  const [person, setPerson] = useState<{ index: number; from: string | null } | null>(null);
  // Opened a place from a person's card: the way back to that person (and where they came from).
  const [backToPerson, setBackToPerson] = useState<{
    index: number;
    from: string | null;
    place: string;
  } | null>(null);
  // people.json once a person has been opened: names follow the language.
  const [people, setPeople] = useState<People | null>(null);
  const narrow = useNarrow();
  const timelineBox = useHeightVar("--hg-timeline-h");
  // The map's controls, moved from its corners into the player.
  const [scaleSlot, setScaleSlot] = useState<HTMLDivElement | null>(null);
  const { globe, error: mapError } = useGlobe(container, data, INITIAL);
  // A place's name in the reader's language.
  // Stable between renders: the people list memoises on them.
  const placeLabel = useCallback(
    (id: string): string | undefined => {
      const p = data?.byId.get(id)?.props;
      return p ? (i18n.language === "ru" ? (p.name_ru ?? p.name) : p.name) : undefined;
    },
    [data, i18n.language],
  );
  const placeRank = useCallback((id: string) => data?.byId.get(id)?.props.rank ?? 3, [data]);
  // Whose land a place was in the year shown, read off the map's own borders.
  const polities = useMemo(
    () =>
      globe ? (at: readonly [number, number]) => globe.renderer.politiesAtPoint(at) : undefined,
    [globe],
  );
  const error =
    dataError !== null
      ? t("error_data", { msg: dataError })
      : mapError !== null
        ? t("error_map", { msg: mapError })
        : null;
  const engine = globe?.engine;
  const state = useGlobeState(engine);
  // A large frame on another site gets the whole interface; a reader's column (under
  // 900 x 600) the compact one: the chapter's chip, the card, the year folded.
  const bigFrame = useMedia("(min-width: 900px) and (min-height: 600px)");
  const compact = EMBED && !bigFrame;
  useEffect(() => {
    document.documentElement.classList.toggle("hg-embed", compact);
    setCompactFrame(compact);
  }, [compact]);
  // The player folds to its year (a button in it); in a compact frame it starts folded.
  const [timeOpen, setTimeOpen] = useState(!compact);
  const foldButton = useRef<HTMLButtonElement>(null);
  const folded = !timeOpen;
  // A frame in a reader's column is short: the card drops its photo and keeps to half of it.
  const short = useMedia("(max-height: 519px)");
  const shortFrame = compact && short;
  useEffect(() => {
    setPersonCardOpen(person !== null);
  }, [person]);
  const periodNow = folded ? periodAt(state.year) : undefined;
  // The way back holds only while the stop's place stays open: another place, or the
  // card closed, and it goes (adjusted during render, as React recommends).
  if (backToTour && state.selectedPlace !== backToTour.place && !state.tour) setBackToTour(null);
  // The same for the way back to a person.
  if (backToPerson && state.selectedPlace !== backToPerson.place) setBackToPerson(null);
  // A place opened (from the map, the search, the person's own list) replaces the person's
  // card: closing that place then shows the map, not the person again.
  if (person && state.selectedPlace !== null) setPerson(null);
  const personOf = (ref: string | undefined) =>
    ref?.startsWith("person:") ? people?.people.find((p) => `person:${p.id}` === ref) : undefined;
  const focusPerson = personOf(state.focus?.ref);
  const personLabel = focusPerson ? personName(focusPerson, state.locale) : "";
  // A person's card: their places stand out on the map while it is open.
  const openPerson = useCallback(
    (index: number, from: string | null) => {
      if (!engine) return;
      void loadPeople().then((pp) => {
        const p = pp.people[index];
        if (!p) return;
        const tied = pp.placesOf.get(index) ?? [];
        const places = tied.map((x) => x.place);
        setPeople(pp);
        // At once, before the map frames their places: the card's room is kept.
        setPersonCardOpen(true);
        engine.stopTour();
        engine.selectPlace(null);
        // The map goes to their time: the middle year of the chapters that tie them to places.
        const year = data
          ? medianYear(
              tied.map((x) => x.verse),
              data.chapterYears,
            )
          : undefined;
        if (year !== undefined) engine.setYear(year);
        setPerson({ index, from });
        engine.focusPlaces(places.length > 0 ? { ref: `person:${p.id}`, places } : null);
      });
    },
    [engine, data],
  );
  const closePerson = useCallback(() => {
    setPerson(null);
    engine?.focusPlaces(null);
  }, [engine]);

  useEffect(() => {
    loadData().then(setData, (e: unknown) => {
      setDataError(String(e));
    });
  }, []);

  useEffect(() => {
    void i18n.changeLanguage(state.locale);
    document.documentElement.lang = state.locale;
  }, [i18n, state.locale]);

  useUrlSync(globe, data);
  const { ready, hover, inView } = useMapFeed(globe, state.layers.places);
  useEffect(() => {
    // The map's own controls (scale, zoom and compass, the sources' (i)) move into the
    // player: one bar at the bottom instead of pieces floating over the map.
    const root = container.current;
    const parts = [
      [".maplibregl-ctrl-scale", ".maplibregl-ctrl-bottom-left"],
      [".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group", ".maplibregl-ctrl-bottom-right"],
      [".maplibregl-ctrl-attrib", ".maplibregl-ctrl-bottom-right"],
    ].flatMap(([what = "", home = ""]) => {
      const el = root?.querySelector(what);
      const corner = root?.querySelector(home);
      return el && corner ? [{ el, corner }] : [];
    });
    if (!scaleSlot || parts.length === 0) return;
    for (const { el } of parts) scaleSlot.append(el);
    return () => {
      for (const { el, corner } of parts) corner.append(el);
    };
  }, [globe, scaleSlot]);
  useEmbed(globe?.renderer, engine, data, ready, EMBED);
  // Once the map is up, fetch the cards in the background: the first click opens at once.
  useEffect(() => {
    if (!ready) return;
    const warm = () => {
      void import("./components/PlaceCard");
      void import("./components/TourStopCard");
      void import("./components/SearchBox");
      void import("./components/MoreMenuPanel");
      if (!EMBED) {
        void import("./components/PersonCard");
        void loadPeople().catch(() => undefined);
      }
    };
    const id = setTimeout(warm, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [ready]);
  useEmbedError(
    dataError !== null ? "data" : mapError !== null ? "map" : null,
    dataError ?? mapError ?? "",
    EMBED,
  );
  // Playback speed, cycled by the button in the player: 1×, 2×, 4×, ½×.
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = usePlayback(engine, speed);
  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, [setPlaying]);
  // The search may be hidden with the panels: show them, then focus it.
  const searchButton = useRef<HTMLButtonElement>(null);
  const overviewButton = useRef<HTMLButtonElement>(null);
  const focusSearch = useCallback(() => {
    // On a phone an open card hides the column: close it first, as the burger does.
    if (engine && innerWidth < 768) {
      const s = engine.store.get();
      if (s.selectedPlace || s.tour) {
        engine.selectPlace(null);
        engine.stopTour();
      }
    }
    togglePanels(true);
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }, [togglePanels, engine]);
  const closeOwn = useCallback(() => {
    // Escape in a quiz closes the quiz, not the tour under it.
    if (quizOf) {
      setQuiz(null);
      return true;
    }
    if (!person || state.selectedPlace) return false;
    closePerson();
    return true;
  }, [quizOf, person, state.selectedPlace, closePerson]);
  useKeys(globe, { togglePlay, focusSearch, closeOwn });

  // Fly to the place from the URL once the globe exists, or start its tour or chapter.
  useEffect(() => {
    if (!engine) return;
    if (INITIAL.tour && data?.tours.some((t) => t.id === INITIAL.tour)) {
      engine.startTour(INITIAL.tour, (INITIAL.stop ?? 1) - 1);
      return;
    }
    // A chapter link (`ref=Acts.16`) picks out its places; the link's own year wins.
    const focus = INITIAL.ref && data ? chapterFocus(data, INITIAL.ref) : null;
    if (focus) {
      // A shared view keeps its own camera and open place; a bare chapter link is framed.
      engine.focusPlaces(
        INITIAL.year === undefined ? focus : { ref: focus.ref, places: focus.places },
        !INITIAL.camera && !INITIAL.place,
      );
    }
    if (INITIAL.place && !INITIAL.camera) engine.selectPlace(INITIAL.place);
  }, [engine, data]);

  // The map as it is now, named by what it shows: the tour, the chapter or the place.
  const savePicture = async () => {
    if (!globe || !data) return;
    const s = globe.engine.store.get();
    const tour = s.tour ? data.tours.find((x) => x.id === s.tour?.id) : undefined;
    const place = s.selectedPlace ? data.byId.get(s.selectedPlace)?.props : undefined;
    const title = tour
      ? (tour.title[s.locale] ?? tour.title.en ?? "")
      : s.focus
        ? s.focus.ref.startsWith("person:")
          ? personLabel
          : chapterLabel(s.focus.ref, s.locale)
        : place
          ? s.locale === "ru"
            ? (place.name_ru ?? place.name)
            : place.name
          : "";
    const shot = await globe.renderer.snapshot();
    const { download, mapPicture } = await import("./snapshot");
    const blob = await mapPicture({
      shot,
      title,
      year: formatYear(s.year, s.locale),
      site: window.location.host || "History Globe",
    });
    if (blob) download(blob, `history-globe-${String(s.year)}.png`);
  };

  // An A4 sheet for a class: a tour is framed whole first, its stops listed with their
  // passages and notes; a chapter lists its places in reading order with the first verse.
  // The heights of the open tour's stops, read from the relief once per tour.
  const [tourHeights, setTourHeights] = useState<{
    tour: string;
    values: readonly (number | null)[];
  } | null>(null);
  const tourId = state.tour?.id;
  useEffect(() => {
    const t = tourId ? data?.tours.find((x) => x.id === tourId) : undefined;
    if (!globe || !t) return;
    let live = true;
    void globe.renderer.heightsAt(t.stops.map((s) => s.at)).then((values) => {
      if (live) setTourHeights({ tour: t.id, values });
    });
    return () => {
      live = false;
    };
  }, [globe, data, tourId]);
  // The relief along the leg to the open stop and the next one, read as the reader gets
  // there: the next stop's card is ready when Next is pressed, and a long tour does not
  // read every tile it crosses at once.

  // While the sheet is drawn the map is briefly resized and reframed: a cover hides it,
  // and a second press waits for the first.
  const [preparing, setPreparing] = useState(false);
  // The cover stops the mouse; the keys (a tour's arrows, the map's own) wait too, or a
  // stop would change while the sheet is drawn.
  useEffect(() => {
    if (!preparing) return;
    const hold = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", hold, true);
    return () => {
      window.removeEventListener("keydown", hold, true);
    };
  }, [preparing]);
  // Set at once, before the module loads: a second press meanwhile must not start another.
  const printing = useRef(false);
  const printForClass = async (blank = false) => {
    if (!globe || !data || printing.current) return;
    printing.current = true;
    try {
      const { printForClass: print } = await import("./print");
      await print({ globe, data, personLabel, setPreparing, blank });
    } finally {
      printing.current = false;
    }
  };

  const hoverPlace = hover ? data?.byId.get(hover.id)?.props : undefined;
  // The Bible alone (a setting): the events it tells, no ancient world around them.
  const [bibleOnly, setBibleOnly] = useBibleOnly();
  const events = useMemo(
    () => (!data ? [] : bibleOnly ? data.events.filter((e) => e.ref !== undefined) : data.events),
    [data, bibleOnly],
  );
  useEffect(() => {
    globe?.renderer.setBibleOnly(bibleOnly);
  }, [globe, bibleOnly]);
  // Founding, destruction and ruin of places, and the turning points of the history.
  // Under the Bible alone the battles it tells are marks too: before Solomon the Bible's
  // dated events are few (no disputed early dates), its battles many (Jericho, Ai, Gibeon).
  const timelineEvents = useMemo(() => {
    if (!data) return [];
    const battles = bibleOnly
      ? data.battles.flatMap((b) =>
          // Told as an event too (Lachish, 588 BC): marked once, as the card lists it once.
          b.ref === undefined ||
          events.some((e) => e.place === b.place && Math.abs(e.year - b.year) <= 1)
            ? []
            : [
                {
                  id: `battle:${b.id}`,
                  year: b.year,
                  approximate: b.approximate,
                  title: b.title,
                  place: b.place,
                  ref: b.ref,
                  sources: b.sources,
                },
              ],
        )
      : [];
    return timelineEventsOf(
      { life: data.life, byId: data.byId, events: [...events, ...battles] },
      state.locale,
      t,
    );
  }, [data, events, bibleOnly, state.locale, t]);
  const selected = state.selectedPlace ? data?.byId.get(state.selectedPlace)?.props : undefined;
  // Its own years, for the line under the slider; a gate's years are its city's: none.
  const selectedLife = selected ? data?.life[selected.id] : undefined;
  const ownLife = selectedLife && !selectedLife.inherited ? selectedLife : undefined;
  // "Distance from here": the place measured from, kept while other places are opened.
  const [measureFrom, setMeasureFrom] = useState<string | null>(null);
  const fromEntry = measureFrom ? data?.byId.get(measureFrom) : undefined;
  const measureTo = selected && measureFrom && selected.id !== measureFrom ? selected.id : null;
  const toAt = measureTo ? data?.byId.get(measureTo)?.info.at : undefined;
  useEffect(() => {
    globe?.renderer.setMeasure(fromEntry?.info.at ?? null, toAt ?? null);
    // Both ends in view: the place's own flight lands first, then the frame widens.
    const from = fromEntry?.info.at;
    if (!globe || !from || !toAt) return;
    const id = setTimeout(() => {
      globe.renderer.fitTo([from, toAt]);
    }, 900);
    return () => {
      clearTimeout(id);
    };
  }, [globe, fromEntry, toAt]);
  const tour = state.tour ? data?.tours.find((x) => x.id === state.tour?.id) : undefined;
  const tourStop = tour && state.tour ? tour.stops[state.tour.step] : undefined;
  // On a phone an open card takes the lower half: the column folds to its header.
  // A quiz on the tour stands where the tour's card was: its stop would give answers.
  const cardOpen = Boolean((tour && state.tour) || selected);
  // The quiz is the tour's: it ends with the tour.
  // Ended with its tour: closed and opened again, the tour opens on its card. (A stop moved
  // to is the same tour: the quiz stays.)
  const quizTourNow = state.tour?.id ?? null;
  const [quizTour, setQuizTour] = useState(quizTourNow);
  if (quizTour !== quizTourNow) {
    setQuizTour(quizTourNow);
    if (quizOf) setQuiz(null);
  }
  const quiz = quizOf && quizOf.tour === quizTourNow ? quizOf.quiz : null;
  // On a phone an open card takes the lower half: the overview under the bar gives way.
  const columnShown = !(narrow && cardOpen);
  // The search results drop over the column: the shared panel waits, or its list would
  // read as more results. It comes back, on the same tab, when the search closes.
  const moreShown = moreOpen && !searchOpen;

  // The tab names what is open: a shared link or a history entry says where it leads.
  const placeName = selected
    ? state.locale === "ru"
      ? (selected.name_ru ?? selected.name)
      : selected.name
    : undefined;
  const tourName = tour && state.tour ? (tour.title[state.locale] ?? tour.title.en) : undefined;
  const openName = tourName && placeName ? `${tourName} · ${placeName}` : (placeName ?? tourName);
  useEffect(() => {
    document.title = openName ? `${openName} — History Globe` : "History Globe";
  }, [openName]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-night font-sans"
      data-panels={columnShown ? "open" : "closed"}
      data-card={cardOpen ? "open" : "closed"}
    >
      {/* Landmarks (WCAG 1.3.1): the map, the column, the card and the slider.
          MapLibre sets position: relative on its container, so it needs a sized parent. */}
      <main className="absolute inset-0" aria-label={t("map_label")}>
        <div ref={container} className="h-full w-full" />

        {!ready && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-3 rounded-full bg-paper/90 px-5 py-2.5 text-[14px] text-ink shadow-lg">
              <span className="size-3 animate-ping rounded-full bg-accent" aria-hidden />
              {t("loading")}
            </div>
          </div>
        )}

        {preparing && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-paper" role="status">
            <div className="flex items-center gap-3 text-[15px] text-ink">
              <span className="size-3 animate-ping rounded-full bg-accent" aria-hidden />
              {t("time.preparing")}
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          {hoverPlace && hover && (
            <HoverTip place={hoverPlace} at={hover.at} locale={state.locale} />
          )}
          {globe && <PolityTip renderer={globe.renderer} locale={state.locale} />}
          {globe && <AncientTip renderer={globe.renderer} locale={state.locale} />}
          {globe && <BattleTip renderer={globe.renderer} locale={state.locale} />}
        </Suspense>

        {error && (
          <Panel className="absolute top-1/2 left-1/2 -translate-1/2 px-6 py-4 text-ink">
            {error}
          </Panel>
        )}
      </main>

      {data && engine && (
        <>
          {compact ? (
            <Suspense fallback={null}>
              <EmbedBar
                focus={state.focus}
                data={data}
                locale={state.locale}
                selected={state.selectedPlace}
                onPlace={(id) => {
                  setPlaying(false);
                  // In a reader's frame the place stays among the chapter's: closer, but
                  // not down to its streets (a town's own zoom showed 5 km and no sea).
                  engine.selectPlace(id, { fly: false });
                  const at = data.byId.get(id)?.info.at;
                  if (at) {
                    const { zoom } = globe.renderer.getCamera();
                    globe.renderer.flyTo({ center: at, zoom: Math.min(8, Math.max(zoom + 1, 6)) });
                  }
                }}
              />
            </Suspense>
          ) : (
            <aside
              aria-label={t("panels.label")}
              className={`absolute top-4 bottom-[calc(var(--hg-timeline-h,124px)+24px)] left-4 -m-4 flex flex-col gap-3 overflow-y-auto p-4 pr-5 [scrollbar-width:thin] *:shrink-0 max-md:inset-x-3 max-md:top-3 max-md:bottom-auto max-md:z-10 max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-32px)] max-md:pr-4 ${searchOpen ? "max-md:overflow-visible" : ""}`}
            >
              {/* On a panel, not on the map: state labels run under the corner. The magnifier,
                  the title, the overview (it opens just below) and the settings; searching,
                  the field takes the whole bar. */}
              <Panel className="relative z-10 flex w-[360px] items-center gap-0.5 px-1.5 py-1.5 max-md:w-full">
                <h1
                  className={`order-2 flex-1 pl-1 font-serif text-[19px] font-semibold tracking-tight text-ink ${searchOpen ? "sr-only" : ""}`}
                >
                  History Globe
                </h1>
                {searchOpen ? (
                  <>
                    <ErrorBoundary fallback={null}>
                      <Suspense
                        fallback={
                          // While the search loads: a field that keeps what is typed into it.
                          <input
                            autoFocus
                            aria-label={t("search.placeholder")}
                            placeholder={t("search.placeholder")}
                            onChange={(e) => {
                              typed.current = e.target.value;
                            }}
                            className="hg-grow w-full min-w-0 rounded-full bg-paper px-3 py-1.5 pl-9 text-[15px] text-ink outline-hidden ring-2 ring-accent/30 placeholder:text-[14px] placeholder:text-ink-soft/70"
                          />
                        }
                      >
                        <SearchBox
                          data={data}
                          inputRef={searchRef}
                          bibleOnly={bibleOnly}
                          takeTyped={() => {
                            const early = typed.current;
                            typed.current = "";
                            return early;
                          }}
                          onSelect={(id) => {
                            engine.selectPlace(id);
                          }}
                          onChapter={(focus) => {
                            setPlaying(false);
                            engine.stopTour();
                            engine.selectPlace(null);
                            engine.focusPlaces(focus);
                          }}
                          onYear={(y) => {
                            setPlaying(false);
                            engine.stopTour();
                            engine.setYear(y);
                          }}
                          onPerson={(i) => {
                            setPlaying(false);
                            openPerson(i, null);
                          }}
                          onTour={(id) => {
                            setPlaying(false);
                            engine.startTour(id);
                          }}
                          onAncient={(site) => {
                            setPlaying(false);
                            engine.stopTour();
                            engine.selectPlace(null);
                            // Into a year it stood, if the map is not in one already.
                            if (state.year < site.from || state.year > site.to)
                              engine.setYear(Math.round((site.from + site.to) / 2));
                            flyToSite(engine, globe.renderer, state.layers.ancient, site);
                          }}
                          onClose={(focusBack) => {
                            typed.current = "";
                            setSearchOpen(false);
                            if (focusBack)
                              requestAnimationFrame(() => searchButton.current?.focus());
                          }}
                        />
                      </Suspense>
                    </ErrorBoundary>
                    <span className="order-3">
                      <HeaderButton
                        label={t("search.close")}
                        onClick={() => {
                          setSearchOpen(false);
                          requestAnimationFrame(() => searchButton.current?.focus());
                        }}
                      >
                        <X className="size-[18px]" aria-hidden />
                      </HeaderButton>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="order-1">
                      <HeaderButton
                        buttonRef={searchButton}
                        label={t("search.open")}
                        onClick={() => {
                          // On a phone an open card covers the column: close it first.
                          if (narrow && cardOpen) {
                            engine.selectPlace(null);
                            engine.stopTour();
                          }
                          setSearchOpen(true);
                          requestAnimationFrame(() => searchRef.current?.focus());
                        }}
                      >
                        <Search className="size-[18px]" aria-hidden />
                      </HeaderButton>
                    </span>
                    <span className="order-3 flex">
                      {/* The overview opens right below: tours, events, articles, in view. */}
                      <HeaderButton
                        buttonRef={overviewButton}
                        label={t("more")}
                        active={moreShown}
                        expanded={moreShown}
                        controls="more-panels"
                        onClick={() => {
                          const next = !moreShown;
                          if (next && narrow && cardOpen) {
                            engine.selectPlace(null);
                            engine.stopTour();
                          }
                          setMoreOpen(next);
                          writeMore(next);
                        }}
                      >
                        <BookOpen className="size-[18px]" aria-hidden />
                      </HeaderButton>
                      <HeaderButton
                        label={t("settings.title")}
                        dialog
                        onClick={() => {
                          setSettingsOpen(true);
                        }}
                      >
                        <Settings className="size-[18px]" aria-hidden />
                      </HeaderButton>
                    </span>
                  </>
                )}
              </Panel>
              {/* A chapter picked out from the search: what is shown, and the way back. */}
              {/* Not while a person's card is open: its title already says whose places these are. */}
              {state.focus && !(person && !state.selectedPlace) && (
                <Panel className="flex w-fit max-w-[360px] items-start gap-2 py-1.5 pr-1.5 pl-4 max-md:max-w-full">
                  {state.focus.ref.startsWith("person:") ? (
                    <span className="font-serif text-[15px] text-accent">{personLabel}</span>
                  ) : (
                    // A chapter opens its places in reading order (a phone has no other list).
                    <Suspense
                      fallback={
                        <span className="font-serif text-[15px] text-accent">
                          {chapterLabel(state.focus.ref, state.locale)}
                        </span>
                      }
                    >
                      <ChapterPicker
                        chapter={state.focus}
                        data={data}
                        locale={state.locale}
                        selected={state.selectedPlace}
                        onPlace={(id) => {
                          setPlaying(false);
                          engine.selectPlace(id, { fly: true });
                        }}
                        className="flex items-center gap-2 rounded-full py-0.5 hover:text-ink"
                        inline
                      />
                    </Suspense>
                  )}
                  <HeaderButton
                    label={t("focus.clear")}
                    onClick={() => {
                      engine.focusPlaces(null);
                      // The chip goes away: the focus goes to the search it came from.
                      requestAnimationFrame(() => searchButton.current?.focus());
                    }}
                  >
                    <X className="size-4" aria-hidden />
                  </HeaderButton>
                </Panel>
              )}
              {settingsLoaded && (
                <Suspense fallback={null}>
                  <SettingsDialog
                    open={settingsOpen}
                    onClose={() => {
                      setSettingsOpen(false);
                    }}
                    locale={state.locale}
                    onLocale={engine.setLocale}
                    layers={state.layers}
                    onLayer={engine.setLayer}
                    bibleOnly={bibleOnly}
                    onBibleOnly={setBibleOnly}
                  />
                </Suspense>
              )}
              {
                <div
                  id="side-panels"
                  className={`flex flex-col gap-3 *:shrink-0 ${cardOpen ? "max-md:hidden" : ""}`}
                >
                  {wallsOpen && (
                    <Suspense fallback={null}>
                      <WallsPanel
                        renderer={globe.renderer}
                        locale={state.locale}
                        onClose={() => {
                          setWallsOpen(false);
                        }}
                      />
                    </Suspense>
                  )}
                  {moreShown && (
                    <Suspense fallback={null}>
                      <Overview
                        onClose={() => {
                          setMoreOpen(false);
                          writeMore(false);
                          // The focus goes back to the book that opened it.
                          requestAnimationFrame(() => overviewButton.current?.focus());
                        }}
                        panels={{
                          tours: (
                            <ToursPanel
                              tours={data.tours}
                              onStart={(id) => {
                                setPlaying(false);
                                // The tour's route wants the map: the overview steps aside
                                // (its remembered state stays, for the next visit).
                                setMoreOpen(false);
                                engine.startTour(id);
                              }}
                            />
                          ),
                          events: (
                            <EventsPanel
                              // With the battles, in their years (under the Bible alone, those it tells).
                              events={[
                                ...events,
                                ...data.battles
                                  .filter((b) => !bibleOnly || b.ref !== undefined)
                                  // Their own ids: a battle may share one with an event (Carchemish).
                                  .map((b) => ({ ...b, id: `battle:${b.id}`, battle: true })),
                              ].sort((a, b) => a.year - b.year)}
                              year={state.year}
                              locale={state.locale}
                              onPick={(e) => {
                                setPlaying(false);
                                engine.stopTour();
                                engine.setYear(e.year);
                                if (e.place) engine.selectPlace(e.place, { fly: true });
                                else if (e.site)
                                  flyToSite(engine, globe.renderer, state.layers.ancient, e.site);
                              }}
                            />
                          ),
                          articles: (
                            <ArticlesPanel
                              data={data}
                              locale={state.locale}
                              onPick={(id) => {
                                setPlaying(false);
                                engine.stopTour();
                                engine.focusPlaces(null);
                                engine.selectPlace(id, { fly: true });
                              }}
                            />
                          ),
                          people: (
                            <PeoplePanel
                              chapterYears={data.chapterYears}
                              placeName={placeLabel}
                              placeRank={placeRank}
                              onPerson={(i) => {
                                setPlaying(false);
                                // On a phone the card comes up under the overview: it gives way.
                                if (narrow) setMoreOpen(false);
                                openPerson(i, null);
                              }}
                            />
                          ),
                          inview: (
                            <InViewPanel
                              ids={inView}
                              data={data}
                              locale={state.locale}
                              year={state.year}
                              selected={state.selectedPlace}
                              onSelect={(id) => {
                                engine.selectPlace(id);
                              }}
                            />
                          ),
                        }}
                      />
                    </Suspense>
                  )}
                </div>
              }
            </aside>
          )}

          <section
            aria-label={t("details_label")}
            className={`hg-card absolute top-4 right-4 max-md:top-auto max-md:right-3 max-md:bottom-[calc(var(--hg-timeline-h,124px)+20px)] max-md:left-3 ${compact ? `z-[3] md:top-14 md:right-[60px] ${shortFrame ? `max-h-[52%] overflow-y-auto rounded-[20px] ${state.selectedPlace !== null || state.tour !== null ? "hg-fade" : ""}` : ""}` : ""}`}
          >
            <Suspense fallback={null}>
              {quiz ? (
                <QuizPanel
                  quiz={quiz}
                  data={data}
                  locale={state.locale}
                  renderer={globe.renderer}
                  onClose={() => {
                    setQuiz(null);
                  }}
                />
              ) : tour && state.tour ? (
                <TourStopCard
                  tour={tour}
                  step={state.tour.step}
                  place={tourStop ? data.byId.get(tourStop.placeId)?.props : undefined}
                  photo={tourStop && !shortFrame ? data.photos[tourStop.placeId] : undefined}
                  compact={shortFrame}
                  heights={tourHeights?.tour === tour.id ? tourHeights.values : undefined}
                  profileAlong={globe.renderer.profileAlong}
                  locale={state.locale}
                  onStep={engine.goToStop}
                  onClose={() => {
                    // "Закончить" closes the tour as Esc does, not onto its last stop's card.
                    engine.stopTour();
                    engine.selectPlace(null);
                  }}
                  onOpenPlace={(id) => {
                    if (state.tour) setBackToTour({ ...state.tour, place: id });
                    engine.stopTour();
                    engine.selectPlace(id);
                  }}
                  stopName={(id) => {
                    const p = data.byId.get(id)?.props;
                    return p ? (state.locale === "ru" ? (p.name_ru ?? p.name) : p.name) : id;
                  }}
                />
              ) : person && !selected ? (
                <PersonCard
                  key={person.index}
                  index={person.index}
                  locale={state.locale}
                  placeName={placeLabel}
                  placeRank={placeRank}
                  chapterYears={data.chapterYears}
                  onPerson={(i) => {
                    setPlaying(false);
                    openPerson(i, person.from);
                  }}
                  onPlace={(id) => {
                    setBackToPerson({ index: person.index, from: person.from, place: id });
                    engine.selectPlace(id, { fly: true });
                  }}
                  onClose={closePerson}
                  tours={data.tours}
                  onTour={(id) => {
                    closePerson();
                    engine.startTour(id);
                  }}
                  back={
                    person.from
                      ? {
                          label: placeLabel(person.from) ?? "",
                          onBack: () => {
                            const from = person.from;
                            closePerson();
                            if (from) engine.selectPlace(from);
                          },
                        }
                      : undefined
                  }
                />
              ) : (
                selected && (
                  <PlaceCard
                    key={selected.id}
                    place={selected}
                    at={data.byId.get(selected.id)?.info.at ?? [0, 0]}
                    sites={data.sites.get(selected.id) ?? []}
                    questions={data.questions[selected.id]}
                    life={data.life[selected.id]}
                    // An event told again as a battle here (Samaria, 722 BC) is listed once, as the battle.
                    events={events.filter(
                      (e) =>
                        e.place === selected.id &&
                        !data.battles.some(
                          (b) => b.place === e.place && Math.abs(b.year - e.year) <= 1,
                        ),
                    )}
                    battles={data.battles.filter(
                      (b) => b.place === selected.id && (!bibleOnly || b.ref !== undefined),
                    )}
                    alsoHere={(data.alsoHere[state.locale].get(selected.id) ?? []).flatMap((id) => {
                      const p = data.byId.get(id)?.props;
                      return p ? [p] : [];
                    })}
                    onSelect={(id) => {
                      engine.selectPlace(id);
                    }}
                    onGoTo={(id) => {
                      engine.selectPlace(id, { fly: true });
                    }}
                    placeName={placeLabel}
                    locale={state.locale}
                    year={state.year}
                    onClose={() => {
                      engine.selectPlace(null);
                    }}
                    onZoom={() => {
                      engine.selectPlace(selected.id, { fly: true });
                    }}
                    onFlyTo={(at) => {
                      engine.lookAt(at);
                    }}
                    hasArticle={selected.id in data.articles}
                    polities={polities}
                    pleiades={data.pleiades[selected.id]}
                    measure={
                      compact
                        ? undefined
                        : {
                            from: fromEntry
                              ? {
                                  name:
                                    state.locale === "ru"
                                      ? (fromEntry.props.name_ru ?? fromEntry.props.name)
                                      : fromEntry.props.name,
                                  at: fromEntry.info.at,
                                }
                              : null,
                            isFrom: measureFrom === selected.id,
                            onToggle: () => {
                              setMeasureFrom(measureFrom === selected.id ? null : selected.id);
                            },
                            onClear: () => {
                              setMeasureFrom(null);
                            },
                          }
                    }
                    photo={shortFrame ? undefined : data.photos[selected.id]}
                    onPerson={(i) => {
                      setPlaying(false);
                      openPerson(i, selected.id);
                    }}
                    focusTitle={backToPerson?.place === selected.id}
                    back={
                      backToPerson && backToPerson.place === selected.id && !backToTour
                        ? {
                            label: (() => {
                              const p = people?.people[backToPerson.index];
                              return p ? personName(p, state.locale) : "";
                            })(),
                            onBack: () => {
                              setPlaying(false);
                              openPerson(backToPerson.index, backToPerson.from);
                              setBackToPerson(null);
                            },
                          }
                        : backToTour && backToTour.place === selected.id
                          ? {
                              label: t("tours.back_to", {
                                title:
                                  data.tours.find((x) => x.id === backToTour.id)?.title[
                                    state.locale
                                  ] ?? "",
                              }),
                              onBack: () => {
                                setPlaying(false);
                                engine.startTour(backToTour.id, backToTour.step);
                                setBackToTour(null);
                              },
                            }
                          : undefined
                    }
                  />
                )
              )}
            </Suspense>
          </section>

          <section
            aria-label={t("time.timeline")}
            ref={timelineBox}
            className={`absolute inset-x-4 bottom-4 max-md:inset-x-3 max-md:bottom-3 ${folded ? "pointer-events-none" : ""}`}
          >
            {folded && (
              // Embedded, the player is folded to its year: the frame is for the map.
              <button
                ref={foldButton}
                onClick={() => {
                  setTimeOpen(true);
                  // The button goes; the focus moves to the slider it opened.
                  requestAnimationFrame(() => {
                    document.querySelector<HTMLInputElement>("input.timeline-range")?.focus();
                  });
                }}
                aria-label={`${formatYear(state.year, state.locale).replace(/\.$/, "")}. ${t("time.expand")}`}
                aria-expanded={false}
                className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/45 bg-paper/90 py-1.5 pr-3 pl-4 shadow-[0_8px_24px_-12px_rgba(20,14,8,0.55)] backdrop-blur-xl hover:bg-paper"
              >
                <span className="font-serif text-[17px] font-semibold text-ink tabular-nums">
                  {formatYear(state.year, state.locale)}
                </span>
                {periodNow && (
                  <span className="text-[12.5px] text-ink-soft max-[360px]:hidden">
                    {state.locale === "ru" ? periodNow.name.ru : periodNow.name.en}
                  </span>
                )}
                <ChevronDown className="size-4 rotate-180 text-ink-soft" aria-hidden />
              </button>
            )}
            <div className={folded ? "hidden" : undefined}>
              <Timeline
                year={state.year}
                locale={state.locale}
                playing={playing}
                speed={speed}
                onSpeed={setSpeed}
                onPicture={
                  // Inside another site's frame a download may be blocked: no picture there.
                  EMBED
                    ? undefined
                    : () => {
                        void savePicture();
                      }
                }
                onPrint={
                  EMBED
                    ? undefined
                    : () => {
                        setPlaying(false);
                        void printForClass();
                      }
                }
                // An outline map, for a tour or a chapter: numbered places to name.
                onPrintBlank={
                  EMBED || !(state.tour || (state.focus && !state.focus.ref.startsWith("person:")))
                    ? undefined
                    : () => {
                        setPlaying(false);
                        void printForClass(true);
                      }
                }
                // Jerusalem's walls over another place, to compare sizes.
                onWalls={
                  EMBED
                    ? undefined
                    : () => {
                        setWallsOpen(true);
                      }
                }
                // The same quiz on screen: a choice shows the place on the map.
                onQuiz={
                  EMBED || !state.tour
                    ? undefined
                    : () => {
                        setPlaying(false);
                        const tourNow = state.tour?.id;
                        void import("./print")
                          .then((m) => m.buildQuiz({ globe, data }))
                          .then((q) => {
                            // A tour with no question to ask (every passage shared) opens none.
                            setQuiz(
                              q && tourNow && q.items.length > 0
                                ? { tour: tourNow, quiz: q }
                                : null,
                            );
                          });
                      }
                }
                // A quiz, for a tour or a lesson: where each thing happened.
                onPrintQuiz={
                  EMBED || !state.tour
                    ? undefined
                    : () => {
                        setPlaying(false);
                        void import("./print").then((m) => m.printQuiz({ globe, data }));
                      }
                }
                events={timelineEvents}
                scaleSlot={compact ? undefined : setScaleSlot}
                life={
                  ownLife && selected
                    ? { name: placeName ?? selected.name, life: ownLife }
                    : undefined
                }
                onEvent={(ev) => {
                  setPlaying(false);
                  engine.stopTour();
                  engine.setYear(ev.year);
                  if (ev.place) engine.selectPlace(ev.place, { fly: true });
                  else if (ev.site)
                    flyToSite(engine, globe.renderer, state.layers.ancient, ev.site);
                }}
                onYear={engine.setYear}
                onPlay={() => {
                  if (!playing && state.year >= YEAR_MAX) engine.setYear(YEAR_MIN);
                  setPlaying((p) => !p);
                }}
                onCollapse={() => {
                  setTimeOpen(false);
                  requestAnimationFrame(() => foldButton.current?.focus());
                }}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Tours, events and the in-view list fold behind one button; the choice is remembered. */
function readMore(): boolean {
  // On a phone the overview covers half the screen: it is not reopened on arrival.
  if (innerWidth < 768) return false;
  try {
    return localStorage.getItem("hg:more") === "1";
  } catch {
    return false;
  }
}

function writeMore(open: boolean): void {
  try {
    localStorage.setItem("hg:more", open ? "1" : "0");
  } catch {
    // Private windows may refuse storage: the button still works, it just forgets.
  }
}

/** A round icon button in the header; `active` marks what it has opened. */
function HeaderButton({
  buttonRef,
  label,
  active = false,
  expanded,
  controls,
  dialog = false,
  onClick,
  children,
}: {
  buttonRef?: React.Ref<HTMLButtonElement>;
  label: string;
  active?: boolean;
  expanded?: boolean;
  controls?: string | undefined;
  dialog?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-haspopup={dialog ? "dialog" : undefined}
      // The ring sits inside the button: outside, it ran into the title beside it.
      className={`grid size-9 shrink-0 place-items-center rounded-full hover:bg-paper-2 hover:text-ink focus-visible:outline-offset-[-2px] ${active ? "bg-paper-2 text-accent" : "text-ink-soft"}`}
    >
      {children}
    </button>
  );
}

/**
 * To an ancient site: any open card closes, the layer comes on if it was off (else the
 * flight ends on an empty spot), and the zoom is one at which the site is drawn (the
 * least of them from zoom 8, style.ts).
 */
function flyToSite(
  engine: Engine,
  renderer: Renderer,
  layerOn: boolean,
  site: { readonly lon: number; readonly lat: number; readonly rank?: number },
): void {
  engine.selectPlace(null);
  if (!layerOn) engine.setLayer("ancient", true);
  renderer.flyTo({ center: [site.lon, site.lat], zoom: (site.rank ?? 0) >= 2 ? 8.4 : 7 }, 1400);
}
