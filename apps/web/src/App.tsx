// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { YEAR_MAX, YEAR_MIN, type Engine, type LonLat, type Renderer } from "@hg/core";
import { formatYear, pick, placeName as nameOf } from "@hg/model";
import { X } from "./components/icons";
import type { Tool } from "./components/ToolsPanel";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useEffectEvent,
  useState,
} from "react";
import { useTranslation } from "./i18n";
import { Panel } from "./components/Panel";
import { Header, HeaderButton } from "./components/Header";
import { Player } from "./components/Player";

import { loadData, type LoadedData } from "./data";
import { firstPaint } from "./first-paint";
import { focusNextFrame, LIVE_ID, useCardFocus } from "./focus";
import { offerAgentTools } from "./webmcp";
import {
  useScrollsMark,
  useKeys,
  useMapControlSlots,
  useMapFeed,
  useMedia,
  useNarrow,
  usePlayback,
  useBibleOnly,
  useUrlSync,
  useTimelineMarks,
  usePrintSheet,
} from "./app-hooks";
import {
  chapterFocus,
  chapterLabel,
  chapterOf,
  isPersonRef,
  personRef,
  withoutYear,
} from "./chapter";
import { useEmbed, useEmbedError } from "./embed";
import { FrameContext, frameParts } from "./frame";
import { rememberLocale, startLocale, type UrlView } from "./url";
import { loadPeople, personName, personYear, type People } from "./people";
import { useGlobe, useGlobeState } from "./useGlobe";
import { isNarrow, SIDEWAYS, sitesFrame } from "./view-padding";
import { readPref, writePref } from "./storage";

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
const ToolsPanel = lazy(() =>
  import("./components/ToolsPanel").then((m) => ({ default: m.ToolsPanel })),
);
const SettingsDialog = lazy(() =>
  import("./components/Settings").then((m) => ({ default: m.SettingsDialog })),
);
// The hover tips come in their own chunk, out of the first: they show nothing until the
// first hover, and their chunk loads as the map does.
const tips = () => import("./components/HoverTip");
const HoverTip = lazy(() => tips().then((m) => ({ default: m.HoverTip })));
const PolityTip = lazy(() => tips().then((m) => ({ default: m.PolityTip })));
const BattleTip = lazy(() => tips().then((m) => ({ default: m.BattleTip })));
const Overview = lazy(() => import("./components/Overview").then((m) => ({ default: m.Overview })));
// The overview's tabs: all four fetched once the overview opens, so a switch of tab shows
// the next at once instead of a blank while its code loads.
const loadTours = () => import("./components/ToursPanel");
const loadEvents = () => import("./components/EventsPanel");
const loadArticles = () => import("./components/ArticlesPanel");
const loadPeoplePanel = () => import("./components/PeoplePanel");
const ToursPanel = lazy(() => loadTours().then((m) => ({ default: m.ToursPanel })));
const EventsPanel = lazy(() => loadEvents().then((m) => ({ default: m.EventsPanel })));
const ArticlesPanel = lazy(() => loadArticles().then((m) => ({ default: m.ArticlesPanel })));
// Only inside another site's frame.
const EmbedBar = lazy(() => import("./components/EmbedBar").then((m) => ({ default: m.EmbedBar })));
const ChapterPicker = lazy(() =>
  import("./components/EmbedBar").then((m) => ({ default: m.ChapterPicker })),
);
const PeoplePanel = lazy(() => loadPeoplePanel().then((m) => ({ default: m.PeoplePanel })));
// The tour's quiz played on screen: on a press in the menu.
const QuizPanel = lazy(() =>
  import("./components/QuizPanel").then((m) => ({ default: m.QuizPanel })),
);

/** Once the map is up, the cards' code is fetched ahead, after the data has settled in. */
const WARM_DELAY_MS = 1500;
/**
 * The distance's second end opened: its place's flight sets off, and this much later the
 * frame widens to both ends (fitTo takes over from the flight where it is).
 */
const MEASURE_FIT_DELAY_MS = 900;

/**
 * The globe. `link` is the address it opened at (main.tsx): the view to open, and the frame.
 * Embedded, the map, the card and the slider show, no column; map-only (`ui=map`), the host
 * has its own search and place box: the map, the folded year and the link to the globe, no
 * chapter bar and no card. A place picked on the map is still selected and told to the host
 * (`hg:view-changed`).
 */
export function App({ link }: { link: UrlView }) {
  const { i18n, t } = useTranslation();
  const [initial] = useState(() => ({ ...link, locale: startLocale(link) }));
  const [frame] = useState(() => ({
    embed: initial.embed === true,
    mapOnly: initial.mapOnly === true,
  }));
  const { embed, mapOnly } = frame;
  const container = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Once opened, the settings window stays mounted, so it can close as a dialog does.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (settingsOpen && !settingsLoaded) setSettingsLoaded(true);
  const [moreOpen, setMoreOpen] = useState(readMore);
  // The tool open (its menu or one of them), or none.
  const [tool, setTool] = useState<Tool | null>(null);
  // The distance tool: the first place opened is one end, the next the other; a third
  // opened is a new other end, measured from the same first.
  const [measure, setMeasure] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  // Both ends set: the link carries them (useUrlSync), so a copied link reopens the distance.
  const measured = useMemo(
    () => (measure.from && measure.to ? ([measure.from, measure.to] as const) : null),
    [measure.from, measure.to],
  );
  // The search is a magnifier until pressed: one field less on the map.
  const [searchOpen, setSearchOpen] = useState(false);
  // The tour's quiz on screen, kept with the tour it was made for.
  const [quizOf, setQuiz] = useState<{
    readonly tour: string;
    readonly quiz: NonNullable<Awaited<ReturnType<typeof import("./quiz").buildQuiz>>>;
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
  const columnBox = useScrollsMark();
  // The map's controls, moved from its corners into the player.
  const [scaleSlot, setScaleSlot] = useState<HTMLDivElement | null>(null);
  // The scale and the sources' (i) stand on the map, just above the player.
  const [mapSlot, setMapSlot] = useState<HTMLElement | null>(null);
  const { globe, error: mapError, setLayout } = useGlobe(container, data, initial);
  // A place's name in the reader's language.
  // Stable between renders: the people list memoises on them.
  const placeLabel = useCallback(
    (id: string): string | undefined => {
      const p = data?.byId.get(id)?.props;
      return p ? nameOf(p, i18n.language) : undefined;
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
  // The first screen of index.html holds the title bar until the column is drawn in its
  // place (in the same frame, so it never blinks), or until an error takes the screen.
  const shellDone = embed || error !== null || (data !== null && engine !== undefined);
  useLayoutEffect(() => {
    if (shellDone) document.getElementById("hg-shell")?.remove();
  }, [shellDone]);
  const bigFrame = useMedia("(min-width: 900px) and (min-height: 600px)");
  // A map-only frame is compact at any size and has no card or chapter bar (frame.ts).
  const parts = frameParts(embed, mapOnly, bigFrame);
  const compact = parts.compact;
  useEffect(() => {
    document.documentElement.classList.toggle("hg-embed", compact);
    setLayout({ compact, mapOnly });
  }, [compact, mapOnly, setLayout]);
  // The player folds to its year (a button in it); in a compact frame it starts folded.
  const [timeOpen, setTimeOpen] = useState(!compact);
  const folded = !timeOpen;
  // A frame in a reader's column is short: the card drops its photo and keeps to half of it.
  const short = useMedia("(max-height: 519px)");
  const shortFrame = compact && short;
  useEffect(() => {
    setLayout({ personCard: person !== null });
  }, [person, setLayout]);
  // The way back holds only while the stop's place stays open: another place, or the
  // card closed, and it goes (adjusted during render, as React recommends).
  if (backToTour && state.selectedPlace !== backToTour.place && !state.tour) setBackToTour(null);
  // The same for the way back to a person.
  if (backToPerson && state.selectedPlace !== backToPerson.place) setBackToPerson(null);
  // A place opened (from the map, the search, the person's own list) replaces the person's
  // card: closing that place then shows the map, not the person again.
  if (person && state.selectedPlace !== null) setPerson(null);
  const personOf = (ref: string | undefined) =>
    isPersonRef(ref) ? people?.people.find((p) => personRef(p.id) === ref) : undefined;
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
        setLayout({ personCard: true });
        engine.stopTour();
        engine.selectPlace(null);
        // The map goes to their time.
        const year = data ? personYear(pp, index, data.chapterYears) : undefined;
        if (year !== undefined) engine.setYear(year);
        setPerson({ index, from });
        engine.focusPlaces(places.length > 0 ? { ref: personRef(p.id), places } : null);
      });
    },
    [engine, data, setLayout],
  );
  // A place named in an article, under the reader's pointer: the ring goes to it for as long.
  // Stable: the card's article re-runs its effect when this changes, and clears the mark.
  const [pointedAt, setPointedAt] = useState<LonLat | null>(null);
  const highlightPlace = useCallback(
    (id: string | null) => {
      setPointedAt(id ? (data?.byId.get(id)?.info.at ?? null) : null);
    },
    [data],
  );
  const closePerson = useCallback(() => {
    setPerson(null);
    engine?.focusPlaces(null);
  }, [engine]);

  useEffect(() => {
    // After the first screen is drawn (first-paint.ts).
    firstPaint()
      .then(loadData)
      .then(setData, (e: unknown) => {
        setDataError(String(e));
      });
  }, []);
  // WebMCP, an experiment (webmcp.ts): read-only tools for an AI agent in the reader's
  // browser, once the data is in. Without WebMCP in the browser nothing is loaded.
  useEffect(
    () =>
      data
        ? offerAgentTools({
            data,
            site: new URL(import.meta.env.BASE_URL, window.location.origin).href,
            language: () => i18n.language,
            article: (id, l) => import("./articles").then((m) => m.loadArticle(id, l)),
          })
        : undefined,
    [data, i18n],
  );

  useEffect(() => {
    // The map's own words come from the dictionary, which a first switch to a language
    // loads: the map is relabelled once it is in.
    void i18n.changeLanguage(state.locale).then(() => {
      // A quicker switch since then has the last word: no older language relabels the map.
      if (i18n.language === state.locale) globe?.renderer.setLocale(state.locale);
    });
    document.documentElement.lang = state.locale;
  }, [i18n, state.locale, globe]);

  useUrlSync(globe, data, measured, link);
  const { ready, hover } = useMapFeed(globe);
  useMapControlSlots(container, globe, scaleSlot, mapSlot);
  useEmbed(globe?.renderer, engine, data, ready, embed, mapOnly);
  // Once the map is up, fetch the cards in the background: the first click opens at once.
  useEffect(() => {
    // Map-only, no card or search ever opens in the frame: nothing to fetch ahead.
    if (!ready || mapOnly) return;
    const warm = () => {
      void import("./components/PlaceCard");
      void import("./components/TourStopCard");
      void import("./components/SearchBox");
      void import("./components/MoreMenuPanel");
      if (!embed) {
        void import("./components/PersonCard");
        void loadPeople().catch(() => undefined);
      }
    };
    const id = setTimeout(warm, WARM_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, [ready, embed, mapOnly]);
  useEmbedError(
    dataError !== null ? "data" : mapError !== null ? "map" : null,
    dataError ?? mapError ?? "",
    embed,
  );
  // Playback speed, cycled by the button in the player: 1×, 2×, 4×, ½×.
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = usePlayback(engine, speed);
  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, [setPlaying]);
  const searchButton = useRef<HTMLButtonElement>(null);
  const overviewButton = useRef<HTMLButtonElement>(null);
  // On a phone an open card covers the column: it closes before the column opens something.
  const closeCardOnPhone = useCallback(() => {
    if (!engine || !isNarrow()) return;
    const s = engine.store.get();
    if (s.selectedPlace || s.tour) {
      engine.selectPlace(null);
      engine.stopTour();
    }
  }, [engine]);
  const focusSearch = useCallback(() => {
    closeCardOnPhone();
    setSearchOpen(true);
    focusNextFrame(searchRef);
  }, [closeCardOnPhone]);
  const closeOwn = useCallback(() => {
    // Escape in a quiz closes the quiz, not the tour under it.
    if (quizOf) {
      setQuiz(null);
      return true;
    }
    if (person && !state.selectedPlace) {
      closePerson();
      return true;
    }
    if (tool && !state.selectedPlace && !state.tour) {
      setTool(null);
      return true;
    }
    // The overview is a panel like the others: Escape folds it when nothing else is open.
    if (moreOpen && !searchOpen && !state.selectedPlace && !state.tour) {
      setMoreOpen(false);
      writeMore(false);
      return true;
    }
    return false;
  }, [quizOf, person, state.selectedPlace, state.tour, closePerson, moreOpen, searchOpen, tool]);
  useKeys(globe, { togglePlay, focusSearch, closeOwn });

  // Fly to the place from the URL once the globe exists, or start its tour or chapter.
  useEffect(() => {
    if (!engine) return;
    if (initial.tour && data?.tours.some((t) => t.id === initial.tour)) {
      engine.startTour(initial.tour, (initial.stop ?? 1) - 1);
      return;
    }
    // A chapter link (`ref=Acts.16`) picks out its places; the link's own year wins.
    const focus = initial.ref && data ? chapterFocus(data, initial.ref) : null;
    if (focus) {
      // A shared view keeps its own camera and open place; a bare chapter link is framed.
      engine.focusPlaces(
        initial.year === undefined ? focus : withoutYear(focus),
        !initial.camera && !initial.place,
      );
    }
    if (initial.place && !initial.camera) engine.selectPlace(initial.place);
  }, [engine, data, initial]);

  // The quiz of a tour on screen, made from its stops (quiz.ts).
  const openQuiz = (tourId: string) => {
    if (!globe || !data) return;
    void import("./quiz")
      .then((m) => m.buildQuiz({ globe, data }))
      .then((q) => {
        // A tour with no question to ask (every passage shared) opens none.
        setQuiz(q && q.items.length > 0 ? { tour: tourId, quiz: q } : null);
      });
  };

  // The map as it is now, named by what it shows: the tour, the chapter or the place.
  const savePicture = async () => {
    if (!globe || !data) return;
    const s = globe.engine.store.get();
    const tour = s.tour ? data.tours.find((x) => x.id === s.tour?.id) : undefined;
    const place = s.selectedPlace ? data.byId.get(s.selectedPlace)?.props : undefined;
    const title = tour
      ? (pick(tour.title, s.locale) ?? "")
      : s.focus
        ? isPersonRef(s.focus.ref)
          ? personLabel
          : chapterLabel(s.focus.ref, s.locale)
        : place
          ? nameOf(place, s.locale)
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
  // An A4 sheet for a class: a tour is framed whole first, its stops listed with their
  // passages and notes; a chapter lists its places in reading order with the first verse.
  const { preparing, printForClass } = usePrintSheet(globe, data, personLabel);

  const hoverPlace = hover ? data?.byId.get(hover.id)?.props : undefined;
  // The Bible alone (a setting): the events it tells, no ancient world around them.
  const [bibleOnly, setBibleOnly] = useBibleOnly();
  const { events, timelineEvents } = useTimelineMarks(data, bibleOnly, state.locale, t);
  // The events with the battles, in their years (under the Bible alone, those it tells): the
  // overview's list and the search offer the same ones.
  const eventsAndBattles = useMemo(
    () =>
      [
        ...events,
        ...(data?.battles ?? [])
          .filter((b) => !bibleOnly || b.ref !== undefined)
          // Told as an event too (Samaria, 722 BC; `event` in battles.yaml): listed once, as
          // the event the timeline marks.
          .filter((b) => !events.some((e) => e.id === b.event))
          .map((b) => ({ ...b, id: `battle:${b.id}`, battle: true })),
      ].sort((a, b) => a.year - b.year),
    [events, data, bibleOnly],
  );
  // "The Bible alone" leaves out the tours told by other authors (Josephus, Jerome): in its
  // lists, its quiz and a person's card alike.
  const tours = useMemo(
    () =>
      bibleOnly
        ? (data?.tours ?? []).filter((tour) => tour.stops.every((st) => st.ref))
        : (data?.tours ?? []),
    [data, bibleOnly],
  );
  useEffect(() => {
    globe?.renderer.setBibleOnly(bibleOnly);
  }, [globe, bibleOnly]);
  const selected = state.selectedPlace ? data?.byId.get(state.selectedPlace)?.props : undefined;
  // The place picked wears the ring that breathes out from it (still for a reader who asked
  // for less motion), on the site as in the map-only frame: the eye finds the place without a
  // mark that covers its neighbours. A place named in an article, under the pointer, takes the
  // ring for as long. With the places layer off, no ring stands where no place is drawn.
  const ringAt =
    state.layers.places && state.selectedPlace
      ? data?.byId.get(state.selectedPlace)?.info.at
      : undefined;
  useEffect(() => {
    engine?.highlight(pointedAt ?? ringAt ?? null);
  }, [engine, pointedAt, ringAt]);
  // Its own years, for the line under the slider; a gate's years are its city's: none.
  const selectedLife = selected ? data?.life[selected.id] : undefined;
  const ownLife = selectedLife && !selectedLife.inherited ? selectedLife : undefined;
  const openTool = useCallback((next: Tool | null) => {
    setTool(next);
    if (next !== "measure") setMeasure({ from: null, to: null });
  }, []);
  // A link with two places measured (`measure=`, the "how far" question pages): the tool
  // opens between them once the data is there, once. An id the data has not is passed over,
  // as a bad `place=` is: links come from anywhere.
  const [linkMeasured, setLinkMeasured] = useState(false);
  if (data && initial.measure && !linkMeasured) {
    setLinkMeasured(true);
    const [from, to] = initial.measure.map((id) => data.aliases.get(id) ?? id) as [string, string];
    if (data.byId.has(from) && data.byId.has(to)) {
      setTool("measure");
      setMeasure({ from, to });
    }
  }
  // A place opened while a tool is open is the tool's next step: an end of the distance, or
  // a stop of the lesson (at the year shown). Opening the tool with a place open counts it.
  const pickedFor = tool === "measure" || tool === "lesson" ? tool : null;
  // A phone on its side (SIDEWAYS): wider than `narrow`, as short as a phone.
  const sideways = useMedia(SIDEWAYS) && !compact;
  // On a phone, upright or on its side, a place picked for the distance or the lesson opens
  // no card: the card would take half the map and the next place could not be reached. The
  // tool's panel names what was picked.
  const picking = (narrow || sideways) && pickedFor !== null && !compact;
  const opened = state.selectedPlace;
  const [stepSeen, setStepSeen] = useState<string | null>(null);
  const stepKey = pickedFor && opened ? `${pickedFor}:${opened}` : null;
  if (stepKey !== stepSeen) {
    setStepSeen(stepKey);
    if (stepKey && pickedFor === "measure" && opened) {
      if (!measure.from) setMeasure({ from: opened, to: null });
      else if (opened !== measure.from) setMeasure({ from: measure.from, to: opened });
    }
  }
  // At the year the place was opened at, not a later one: read when it opens.
  const addStop = useEffectEvent((id: string) => {
    void import("./lesson-store").then((m) => m.addToLesson({ id, year: state.year }));
  });
  useEffect(() => {
    if (pickedFor !== "lesson" || !opened) return;
    // Only a place with verses makes a stop.
    if (data?.byId.get(opened)?.props.osis.length) addStop(opened);
  }, [pickedFor, opened, data]);
  // Taken by the tool, a pick on a phone leaves no place selected behind: closing the tool
  // comes back to the map, not to the last pick's card, and a link copied meanwhile opens
  // none. (The effects above have read it by now.)
  useEffect(() => {
    if (picking && opened) engine?.selectPlace(null, { fly: false });
  }, [picking, opened, engine]);
  const fromEntry = measure.from ? data?.byId.get(measure.from) : undefined;
  const toEntry = measure.to ? data?.byId.get(measure.to) : undefined;
  const toAt = toEntry?.info.at;
  useEffect(() => {
    globe?.renderer.setMeasure(fromEntry?.info.at ?? null, toAt ?? null);
    // Both ends in view: the place's own flight sets off first, then the frame widens.
    const from = fromEntry?.info.at;
    if (!globe || !from || !toAt) return;
    const id = setTimeout(() => {
      globe.renderer.fitTo([from, toAt]);
    }, MEASURE_FIT_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, [globe, fromEntry, toAt]);
  // A disputed place on a phone: its candidate sites lie around it, some beyond the narrow
  // map's sides, so once its flight has set off the frame widens to all of them, above the
  // card. Not on a tour's stop, which frames its own way.
  const framedSites =
    narrow && !compact && !state.tour && !picking && state.selectedPlace
      ? state.selectedPlace
      : null;
  useEffect(() => {
    const entry = framedSites ? data?.byId.get(framedSites) : undefined;
    const points = entry ? sitesFrame(entry.info.at, data?.sites.get(entry.props.id)) : null;
    // Sites a street apart (Golgotha's) are framed as close as the place's own flight, which
    // sets it beside its great town; sites far apart (Emmaus's) still widen the frame.
    const maxZoom = Math.max(9, (framedSites && globe?.engine.placeZoom(framedSites)) || 0);
    // One more move after the flight: not for those who asked for less motion.
    if (!globe || !points || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => {
      globe.renderer.fitTo(points, { maxZoom });
    }, MEASURE_FIT_DELAY_MS);
    // A reader who takes the map meanwhile keeps it where they put it.
    const el = container.current;
    const yours = () => {
      clearTimeout(id);
    };
    el?.addEventListener("pointerdown", yours);
    el?.addEventListener("wheel", yours, { passive: true });
    return () => {
      clearTimeout(id);
      el?.removeEventListener("pointerdown", yours);
      el?.removeEventListener("wheel", yours);
    };
  }, [globe, data, framedSites]);
  const tour = state.tour ? data?.tours.find((x) => x.id === state.tour?.id) : undefined;
  const tourStop = tour && state.tour ? tour.stops[state.tour.step] : undefined;
  // On a phone an open card takes the lower half: the column folds to its header.
  // A quiz on the tour stands where the tour's card was: its stop would give answers.
  const cardOpen = parts.card && Boolean((tour && state.tour) || (selected && !picking));
  // Picking, the tool's panel stands over the top of the map: the frame keeps below it.
  useEffect(() => {
    setLayout({ noCard: picking });
    const el = picking ? document.getElementById("tools-panel") : null;
    if (!el) {
      setLayout({ cover: 0 });
      return;
    }
    const sizes = new ResizeObserver(() => {
      setLayout({ cover: Math.round(el.getBoundingClientRect().bottom) });
    });
    sizes.observe(el);
    return () => {
      sizes.disconnect();
    };
  }, [picking, setLayout]);
  // A phone, upright or on its side: the open player under the card left the map a strip
  // above them (a 360 x 640 phone: 140 px), so the player folds to its year while a card
  // is open and opens again when the card closes. Opened again from its year, it stays open
  // until the card closes.
  // On its side a phone has no room for the overview or a tool above the open player
  // either: it folds while one is open too.
  const sidePanel = sideways && ((moreOpen && !searchOpen) || tool !== null);
  const covered = ((sideways || narrow) && cardOpen) || sidePanel;
  const [overCard, setOverCard] = useState(false);
  if (overCard && !covered) setOverCard(false);
  const playerFolded = folded || (covered && !overCard);
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
  // Something open in the left column takes its room from the map: the centre moves over.
  const leftPanel = columnShown && (moreShown || searchOpen || tool !== null);
  useEffect(() => {
    setLayout({ leftPanel });
  }, [leftPanel, setLayout]);
  useEffect(() => {
    if (!moreShown) return;
    void loadTours();
    void loadEvents();
    void loadArticles();
    void loadPeoplePanel();
  }, [moreShown]);

  // The tab names what is open: a shared link or a history entry says where it leads.
  const placeName = selected ? nameOf(selected, state.locale) : undefined;
  const tourName = tour && state.tour ? pick(tour.title, state.locale) : undefined;
  const openName = tourName && placeName ? `${tourName} · ${placeName}` : (placeName ?? tourName);
  // Nothing open: the site's name and what it is, in the reader's language.
  const tagline = t("tagline");
  useEffect(() => {
    document.title = openName ? `${openName} — History Globe` : `History Globe — ${tagline}`;
  }, [openName, tagline]);
  // The card beside the map takes the focus from the control that opened it and gives it
  // back when it closes (focus.ts); the live region says what opened.
  const cardBox = useRef<HTMLElement>(null);
  const shownPerson = person && !selected ? people?.people[person.index] : undefined;
  const cardKey = !parts.card
    ? null
    : quiz
      ? `quiz:${quizTourNow ?? ""}`
      : tour && state.tour
        ? `tour:${tour.id}`
        : person && !selected
          ? `person:${String(person.index)}`
          : selected && !picking
            ? `place:${selected.id}`
            : null;
  const cardSaid =
    tour && state.tour && !quiz
      ? `${t("a11y.opened", { name: tourName ?? "" })}. ${t("tours.stop", { n: state.tour.step + 1, total: tour.stops.length })}`
      : t("a11y.opened", {
          name: shownPerson ? personName(shownPerson, state.locale) : (openName ?? ""),
        });
  useCardFocus(cardKey, cardSaid, cardBox, (el) =>
    // A control gone by then: the overview's (closed for a tour) gives the focus to the
    // book that opens it, the search's to its magnifier; a card opened by a link, too.
    el?.closest("#side-panels") ? overviewButton : searchButton,
  );

  return (
    <FrameContext value={frame}>
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
            {globe && <BattleTip renderer={globe.renderer} locale={state.locale} />}
          </Suspense>

          {error && (
            <Panel className="absolute top-1/2 left-1/2 -translate-1/2 px-6 py-4 text-ink">
              {error}
            </Panel>
          )}
        </main>
        {/* Said to screen readers: what opened, how many results the search found. */}
        <div id={LIVE_ID} role="status" aria-live="polite" className="sr-only" />

        {data && engine && (
          <>
            {compact ? (
              <Suspense fallback={null}>
                <EmbedBar
                  // Map-only, the host lists the chapter's places itself: only the link stays.
                  focus={parts.chapter ? state.focus : null}
                  linkOnly={!parts.chapter}
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
                      globe.renderer.flyTo({
                        center: at,
                        zoom: Math.min(8, Math.max(zoom + 1, 6)),
                      });
                    }
                  }}
                />
              </Suspense>
            ) : (
              // The column is as tall as the map beside the timeline and mostly empty: it lets
              // the pointer through to the map (a place the host selects in a large frame lands
              // right under it), and only its panels take it, unless it scrolls (its scrollbar).
              <aside
                ref={columnBox}
                aria-label={t("panels.label")}
                className={`pointer-events-none absolute top-4 bottom-[calc(var(--hg-timeline-h)+24px)] left-4 -m-4 flex flex-col gap-3 overflow-y-auto overscroll-contain p-4 pr-5 [scrollbar-width:thin] *:pointer-events-auto *:shrink-0 data-scrolls:pointer-events-auto max-md:inset-x-3 max-md:top-3 max-md:bottom-auto max-md:z-10 max-md:max-h-[calc(100dvh-var(--hg-timeline-h)-32px)] max-md:pr-4 ${searchOpen ? "max-md:overflow-visible" : ""}`}
              >
                <Header
                  search={{
                    data,
                    bibleOnly,
                    onSelect: (id) => {
                      engine.selectPlace(id);
                    },
                    onChapter: (focus) => {
                      setPlaying(false);
                      engine.stopTour();
                      engine.selectPlace(null);
                      engine.focusPlaces(focus);
                    },
                    onYear: (y) => {
                      setPlaying(false);
                      engine.stopTour();
                      engine.setYear(y);
                    },
                    onPerson: (i) => {
                      setPlaying(false);
                      openPerson(i, null);
                    },
                    onTour: (id) => {
                      setPlaying(false);
                      engine.startTour(id);
                    },
                    events: eventsAndBattles,
                    onEvent: (ev) => {
                      setPlaying(false);
                      goToEvent(engine, globe.renderer, ev);
                    },
                  }}
                  searchOpen={searchOpen}
                  inputRef={searchRef}
                  searchButton={searchButton}
                  overviewButton={overviewButton}
                  onSearch={focusSearch}
                  onSearchClose={(focusBack) => {
                    setSearchOpen(false);
                    if (focusBack) focusNextFrame(searchButton);
                  }}
                  overviewOpen={moreShown}
                  onOverview={() => {
                    const next = !moreShown;
                    if (next) closeCardOnPhone();
                    setMoreOpen(next);
                    writeMore(next);
                  }}
                  tools={
                    embed
                      ? null
                      : {
                          open: tool !== null,
                          onToggle: () => {
                            const next = tool === null;
                            // On a phone the tools and the overview share the column.
                            if (next && narrow) {
                              setMoreOpen(false);
                              writeMore(false);
                            }
                            openTool(next ? "menu" : null);
                          },
                        }
                  }
                  onSettings={() => {
                    setSettingsOpen(true);
                  }}
                />
                {/* A chapter picked out from the search: what is shown, and the way back. */}
                {/* Not while a person's card is open: its title already says whose places these are. */}
                {state.focus && !(person && !state.selectedPlace) && (
                  <Panel className="flex w-fit max-w-[360px] items-start gap-2 py-1.5 pr-1.5 pl-4 max-md:max-w-full">
                    {isPersonRef(state.focus.ref) ? (
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
                        focusNextFrame(searchButton);
                      }}
                    >
                      <X className="size-4" />
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
                      onLocale={(l) => {
                        rememberLocale(l);
                        engine.setLocale(l);
                      }}
                      layers={state.layers}
                      onLayer={engine.setLayer}
                      bibleOnly={bibleOnly}
                      onBibleOnly={setBibleOnly}
                    />
                  </Suspense>
                )}
                {tool && (
                  <div id="tools-panel">
                    <Suspense fallback={null}>
                      <ToolsPanel
                        tool={tool}
                        // On its side a phone has no height for the distance's steps under
                        // the header: one line, the distance in it.
                        compact={
                          (narrow && cardOpen) || (sideways && picking && tool === "measure")
                        }
                        onTool={openTool}
                        onClose={() => {
                          openTool(null);
                        }}
                        locale={state.locale}
                        year={state.year}
                        placeName={(id) => placeLabel(id) ?? id}
                        measure={{
                          from: fromEntry
                            ? { name: nameOf(fromEntry.props, state.locale), at: fromEntry.info.at }
                            : null,
                          to: toEntry
                            ? { name: nameOf(toEntry.props, state.locale), at: toEntry.info.at }
                            : null,
                          onReset: () => {
                            setMeasure({ from: null, to: null });
                          },
                        }}
                        tours={tours.map((x) => ({
                          id: x.id,
                          title: pick(x.title, state.locale) ?? x.id,
                        }))}
                        onQuiz={(id, print) => {
                          setPlaying(false);
                          if (narrow) setMoreOpen(false);
                          engine.startTour(id);
                          if (print) {
                            void import("./print").then((m) => m.printQuiz({ globe, data }));
                            return;
                          }
                          // The quiz stands where the tour's card is: the tool has done its part.
                          openTool(null);
                          openQuiz(id);
                        }}
                      />
                    </Suspense>
                  </div>
                )}
                <div
                  id="side-panels"
                  className={`flex flex-col gap-3 *:shrink-0 ${cardOpen ? "max-md:hidden" : ""}`}
                >
                  {moreShown && (
                    <Suspense fallback={null}>
                      <Overview
                        onClose={() => {
                          setMoreOpen(false);
                          writeMore(false);
                          // The focus goes back to the book that opened it.
                          focusNextFrame(overviewButton);
                        }}
                        panels={{
                          tours: (
                            <ToursPanel
                              tours={tours}
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
                              events={eventsAndBattles}
                              year={state.year}
                              locale={state.locale}
                              onPick={(e) => {
                                setPlaying(false);
                                goToEvent(engine, globe.renderer, e);
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
                        }}
                      />
                    </Suspense>
                  )}
                </div>
              </aside>
            )}

            {/* Map-only, the host shows its own box for the place selected. */}
            {parts.card && (
              <section
                ref={cardBox}
                aria-label={t("details_label")}
                className={`hg-card absolute top-4 right-4 max-md:top-auto max-md:right-3 max-md:bottom-[calc(var(--hg-timeline-h)+20px)] max-md:left-3 ${compact ? `z-[3] md:top-14 md:right-[60px] ${shortFrame ? `max-h-[52%] overflow-y-auto overscroll-contain rounded-[20px] ${state.selectedPlace !== null || state.tour !== null ? "hg-fade" : ""}` : ""}` : ""}`}
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
                        // The last stop's close (tours.close) ends the tour as Esc does, not onto its card.
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
                        return p ? nameOf(p, state.locale) : id;
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
                      tours={tours}
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
                    selected &&
                    !picking && (
                      <PlaceCard
                        key={selected.id}
                        place={selected}
                        at={data.byId.get(selected.id)?.info.at ?? [0, 0]}
                        sites={data.sites.get(selected.id) ?? []}
                        life={data.life[selected.id]}
                        // An event told again as a battle here (Samaria, 722 BC; Masada; `event`
                        // in battles.yaml) is listed once, as the battle.
                        events={events.filter(
                          (e) =>
                            (e.place ?? e.site?.id) === selected.id &&
                            !data.battles.some((b) => b.event === e.id),
                        )}
                        battles={data.battles.filter(
                          (b) => b.place === selected.id && (!bibleOnly || b.ref !== undefined),
                        )}
                        alsoHere={(data.alsoHere[state.locale].get(selected.id) ?? []).flatMap(
                          (id) => {
                            const p = data.byId.get(id)?.props;
                            return p ? [p] : [];
                          },
                        )}
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
                        // The card's ruler and list open their tools, this place the first step.
                        onMeasure={
                          compact
                            ? undefined
                            : () => {
                                openTool("measure");
                                setMeasure({ from: selected.id, to: null });
                              }
                        }
                        onLesson={() => {
                          openTool("lesson");
                        }}
                        photo={shortFrame ? undefined : data.photos[selected.id]}
                        onPerson={(i) => {
                          setPlaying(false);
                          openPerson(i, selected.id);
                        }}
                        onHighlight={highlightPlace}
                        onYear={(y) => {
                          setPlaying(false);
                          engine.setYear(y);
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
                                      pick(
                                        data.tours.find((x) => x.id === backToTour.id)?.title,
                                        state.locale,
                                      ) ?? "",
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
            )}

            {!compact && (
              <section
                ref={setMapSlot}
                aria-label={t("mapui.sources")}
                // Folded, the player is a pill in the corner: the two sit on its line.
                // With a card open they stand left of it; on a phone the card covers that spot.
                className={`hg-map-slot hg-map-float pointer-events-auto absolute flex items-center gap-2 max-md:right-4 ${cardOpen ? "right-[456px] max-md:hidden" : "right-5"} ${playerFolded ? "bottom-[27px] max-md:bottom-[23px]" : "bottom-[calc(var(--hg-timeline-h)+24px)]"}`}
              ></section>
            )}
            <Player
              folded={playerFolded}
              onOpen={() => {
                setTimeOpen(true);
                setOverCard(true);
              }}
              onFold={() => {
                setTimeOpen(false);
              }}
              year={state.year}
              locale={state.locale}
              playing={playing}
              speed={speed}
              onSpeed={setSpeed}
              onPicture={
                // Inside another site's frame a download may be blocked: no picture there.
                embed
                  ? undefined
                  : () => {
                      void savePicture();
                    }
              }
              onPrint={
                embed
                  ? undefined
                  : () => {
                      setPlaying(false);
                      void printForClass();
                    }
              }
              // An outline map, for a tour or a chapter: numbered places to name.
              onPrintBlank={
                embed || !(state.tour || chapterOf(state.focus))
                  ? undefined
                  : () => {
                      setPlaying(false);
                      void printForClass(true);
                    }
              }
              // The same quiz on screen: a choice shows the place on the map.
              onQuiz={
                embed || !state.tour
                  ? undefined
                  : () => {
                      setPlaying(false);
                      if (state.tour) openQuiz(state.tour.id);
                    }
              }
              // A quiz, for a tour or a lesson: where each thing happened.
              onPrintQuiz={
                embed || !state.tour
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
                goToEvent(engine, globe.renderer, ev);
              }}
              onYear={engine.setYear}
              onPlay={() => {
                if (!playing && state.year >= YEAR_MAX) engine.setYear(YEAR_MIN);
                setPlaying((p) => !p);
              }}
            />
          </>
        )}
      </div>
    </FrameContext>
  );
}

/** The overview folds behind one button; the choice is remembered. */
function readMore(): boolean {
  // On a phone the overview covers half the screen: it is not reopened on arrival.
  return !isNarrow() && readPref("hg:more") === "1";
}

function writeMore(open: boolean): void {
  writePref("hg:more", open ? "1" : "0");
}

/**
 * An event or a battle picked (the list, the slider's marks, the search): the map goes to its
 * year and to where it happened, its place's card open, else its site or its field.
 */
function goToEvent(
  engine: Engine,
  renderer: Renderer,
  ev: {
    readonly year: number;
    readonly place?: string;
    /** An ancient site: a place like any other, by its id. */
    readonly site?: { readonly id: string };
    readonly battlefield?: { readonly lon: number; readonly lat: number };
  },
): void {
  engine.stopTour();
  engine.setYear(ev.year);
  if (ev.place) engine.selectPlace(ev.place, { fly: true });
  else if (ev.site) engine.selectPlace(ev.site.id, { fly: true });
  else if (ev.battlefield) {
    engine.selectPlace(null);
    // The battles layer is on by default; its mark stands on the field in this year.
    if (!engine.store.get().layers.battles) engine.setLayer("battles", true);
    renderer.flyTo({ center: [ev.battlefield.lon, ev.battlefield.lat], zoom: 7 }, 1400);
  }
}
