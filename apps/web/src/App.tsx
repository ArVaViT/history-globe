import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import { ChevronDown, Menu, PanelLeftClose, Search, Settings, X } from "./components/icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "./i18n";
import { HoverTip, PolityTip } from "./components/HoverTip";
import { InViewPanel } from "./components/InViewPanel";
import { InGroup, Panel } from "./components/Panel";
import { SettingsDialog } from "./components/Settings";
import { PlaceCard } from "./components/PlaceCard";
import { SearchBox } from "./components/SearchBox";
import { Timeline } from "./components/Timeline";
import { ToursPanel } from "./components/ToursPanel";
import { EventsPanel } from "./components/EventsPanel";
import { TourStopCard } from "./components/TourStopCard";
import { loadData, type LoadedData } from "./data";
import {
  useHeightVar,
  useKeys,
  useMapFeed,
  useNarrow,
  usePanelsOpen,
  usePlayback,
  useUrlSync,
} from "./app-hooks";
import { timelineEventsOf } from "./timeline-events";
import { readUrl } from "./url";
import { useGlobe, useGlobeState } from "./useGlobe";

const INITIAL = readUrl();

export function App() {
  const { i18n, t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [panelsOpen, togglePanels] = usePanelsOpen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(readMore);
  // The search is a magnifier until pressed: one field less on the map.
  const [searchOpen, setSearchOpen] = useState(false);
  // "About the place" leaves a tour for the stop's card; this is the way back to the stop.
  const [backToTour, setBackToTour] = useState<{
    id: string;
    step: number;
    place: string;
  } | null>(null);
  const narrow = useNarrow();
  const timelineBox = useHeightVar("--hg-timeline-h");
  const { globe, error: mapError } = useGlobe(container, data, INITIAL);
  const error =
    dataError !== null
      ? t("error_data", { msg: dataError })
      : mapError !== null
        ? t("error_map", { msg: mapError })
        : null;
  const engine = globe?.engine;
  const state = useGlobeState(engine);
  // The way back holds only while the stop's place stays open: another place, or the
  // card closed, and it goes (adjusted during render, as React recommends).
  if (backToTour && state.selectedPlace !== backToTour.place && !state.tour) setBackToTour(null);

  useEffect(() => {
    loadData().then(setData, (e: unknown) => {
      setDataError(String(e));
    });
  }, []);

  useEffect(() => {
    void i18n.changeLanguage(state.locale);
    document.documentElement.lang = state.locale;
  }, [i18n, state.locale]);

  useUrlSync(globe);
  const { ready, hover, inView } = useMapFeed(globe, state.layers.places);
  // Playback speed, cycled by the button in the player: 1×, 2×, 4×, ½×.
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = usePlayback(engine, speed);
  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, [setPlaying]);
  // The search may be hidden with the panels: show them, then focus it.
  const focusSearch = useCallback(() => {
    togglePanels(true);
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }, [togglePanels]);
  useKeys(globe, { togglePlay, focusSearch });

  // Fly to the place from the URL once the globe exists, or start its tour.
  useEffect(() => {
    if (!engine) return;
    if (INITIAL.tour && data?.tours.some((t) => t.id === INITIAL.tour)) {
      engine.startTour(INITIAL.tour, (INITIAL.stop ?? 1) - 1);
      return;
    }
    if (INITIAL.place && !INITIAL.camera) engine.selectPlace(INITIAL.place);
  }, [engine, data]);

  const hoverPlace = hover ? data?.byId.get(hover.id)?.props : undefined;
  // Founding, destruction and ruin of places, and the turning points of the history.
  const timelineEvents = useMemo(
    () => (data ? timelineEventsOf(data, state.locale, t) : []),
    [data, state.locale, t],
  );
  const selected = state.selectedPlace ? data?.byId.get(state.selectedPlace)?.props : undefined;
  const tour = state.tour ? data?.tours.find((x) => x.id === state.tour?.id) : undefined;
  const tourStop = tour && state.tour ? tour.stops[state.tour.step] : undefined;
  // On a phone an open card takes the lower half: the column folds to its header.
  const cardOpen = Boolean((tour && state.tour) || selected);
  const columnShown = panelsOpen && !(narrow && cardOpen);

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

        {hoverPlace && hover && <HoverTip place={hoverPlace} at={hover.at} locale={state.locale} />}
        {globe && <PolityTip renderer={globe.renderer} locale={state.locale} />}

        {error && (
          <Panel className="absolute top-1/2 left-1/2 -translate-1/2 px-6 py-4 text-ink">
            {error}
          </Panel>
        )}
      </main>

      {data && engine && (
        <>
          <aside
            aria-label={t("panels.label")}
            className={`absolute top-4 bottom-12 left-4 -m-4 flex flex-col gap-3 overflow-y-auto p-4 pr-5 [scrollbar-width:thin] *:shrink-0 max-md:inset-x-3 max-md:top-3 max-md:bottom-auto max-md:z-10 max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-32px)] max-md:pr-4 ${searchOpen ? "max-md:overflow-visible" : ""}`}
          >
            {/* On a panel, not on the map: state labels run under the corner. Closed, the
                burger alone; open: the title (or the search in its place), the magnifier,
                one chevron for tours, events and the in-view list, and the settings. */}
            <Panel
              className={`relative z-10 flex items-center gap-0.5 px-1.5 py-1.5 ${columnShown ? "w-[340px] max-md:w-full" : "w-fit"}`}
            >
              <button
                onClick={() => {
                  // On a phone an open card hides the column: the burger closes the card
                  // and shows the column, rather than toggling what cannot be seen.
                  if (narrow && cardOpen) {
                    engine.selectPlace(null);
                    engine.stopTour();
                    togglePanels(true);
                  } else togglePanels(!columnShown);
                }}
                aria-expanded={columnShown}
                aria-controls={columnShown ? "side-panels" : undefined}
                aria-label={columnShown ? t("panels.hide") : t("panels.show")}
                title={columnShown ? t("panels.hide") : t("panels.show")}
                className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink"
              >
                {columnShown ? (
                  <PanelLeftClose className="size-5" aria-hidden />
                ) : (
                  <Menu className="size-5" aria-hidden />
                )}
              </button>
              <h1
                className={`flex-1 pl-1 font-serif text-[19px] font-semibold tracking-tight text-ink ${columnShown && !searchOpen ? "" : "sr-only"}`}
              >
                History Globe
              </h1>
              {columnShown && (
                <>
                  {searchOpen && (
                    <SearchBox
                      data={data}
                      inputRef={searchRef}
                      onSelect={(id) => {
                        engine.selectPlace(id);
                      }}
                      onClose={() => {
                        setSearchOpen(false);
                      }}
                    />
                  )}
                  <HeaderButton
                    label={searchOpen ? t("search.close") : t("search.open")}
                    active={searchOpen}
                    onClick={() => {
                      const next = !searchOpen;
                      setSearchOpen(next);
                      if (next) requestAnimationFrame(() => searchRef.current?.focus());
                    }}
                  >
                    {searchOpen ? (
                      <X className="size-[18px]" aria-hidden />
                    ) : (
                      <Search className="size-[18px]" aria-hidden />
                    )}
                  </HeaderButton>
                  <HeaderButton
                    label={t("more")}
                    active={moreOpen}
                    expanded={moreOpen}
                    controls={moreOpen ? "more-panels" : undefined}
                    onClick={() => {
                      setMoreOpen(!moreOpen);
                      writeMore(!moreOpen);
                    }}
                  >
                    <ChevronDown
                      className={`size-5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </HeaderButton>
                  <HeaderButton
                    label={t("settings.title")}
                    dialog
                    onClick={() => {
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings className="size-5" aria-hidden />
                  </HeaderButton>
                </>
              )}
            </Panel>
            <SettingsDialog
              open={settingsOpen}
              onClose={() => {
                setSettingsOpen(false);
              }}
              locale={state.locale}
              onLocale={engine.setLocale}
              layers={state.layers}
              onLayer={engine.setLayer}
            />
            {panelsOpen && (
              <div
                id="side-panels"
                className={`flex flex-col gap-3 *:shrink-0 ${cardOpen ? "max-md:hidden" : ""}`}
              >
                {/* On a phone the results drop over the column: the shared panel waits. */}
                {moreOpen && !(narrow && searchOpen) && (
                  <Panel className="w-[340px] max-md:w-full">
                    <div id="more-panels">
                      <InGroup.Provider value={true}>
                        <ToursPanel
                          tours={data.tours}
                          onStart={(id) => {
                            setPlaying(false);
                            engine.startTour(id);
                          }}
                        />
                        <EventsPanel
                          events={data.events}
                          year={state.year}
                          locale={state.locale}
                          onPick={(e) => {
                            setPlaying(false);
                            engine.stopTour();
                            engine.setYear(e.year);
                            if (e.place) engine.selectPlace(e.place, { fly: true });
                          }}
                        />
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
                      </InGroup.Provider>
                    </div>
                  </Panel>
                )}
              </div>
            )}
          </aside>

          <section
            aria-label={t("details_label")}
            className="hg-card absolute top-4 right-4 max-md:top-auto max-md:right-3 max-md:bottom-[calc(var(--hg-timeline-h,124px)+20px)] max-md:left-3"
          >
            {tour && state.tour ? (
              <TourStopCard
                tour={tour}
                step={state.tour.step}
                place={tourStop ? data.byId.get(tourStop.placeId)?.props : undefined}
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
            ) : (
              selected && (
                <PlaceCard
                  key={selected.id}
                  place={selected}
                  at={data.byId.get(selected.id)?.info.at ?? [0, 0]}
                  sites={data.sites.get(selected.id) ?? []}
                  life={data.life[selected.id]}
                  events={data.events.filter((e) => e.place === selected.id)}
                  alsoHere={(data.alsoHere[state.locale].get(selected.id) ?? []).flatMap((id) => {
                    const p = data.byId.get(id)?.props;
                    return p ? [p] : [];
                  })}
                  onSelect={(id) => {
                    engine.selectPlace(id);
                  }}
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
                  back={
                    backToTour && backToTour.place === selected.id
                      ? {
                          label: t("tours.back_to", {
                            title:
                              data.tours.find((x) => x.id === backToTour.id)?.title[state.locale] ??
                              "",
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
          </section>

          <section
            aria-label={t("time.timeline")}
            ref={timelineBox}
            className={`absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 max-xl:right-[64px] max-xl:translate-x-0 ${panelsOpen ? "max-xl:left-[372px]" : "max-xl:left-4"} max-md:inset-x-3 max-md:bottom-3 max-md:translate-x-0`}
          >
            <Timeline
              year={state.year}
              locale={state.locale}
              playing={playing}
              speed={speed}
              onSpeed={() => {
                setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : s === 4 ? 0.5 : 1));
              }}
              events={timelineEvents}
              onYear={engine.setYear}
              onPlay={() => {
                if (!playing && state.year >= YEAR_MAX) engine.setYear(YEAR_MIN);
                setPlaying((p) => !p);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}

/** Tours, events and the in-view list fold behind one button; the choice is remembered. */
function readMore(): boolean {
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
  label,
  active = false,
  expanded,
  controls,
  dialog = false,
  onClick,
  children,
}: {
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
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={dialog ? "dialog" : undefined}
      className={`grid size-9 shrink-0 place-items-center rounded-full hover:bg-paper-2 hover:text-ink ${active ? "bg-paper-2 text-accent" : "text-ink-soft"}`}
    >
      {children}
    </button>
  );
}
