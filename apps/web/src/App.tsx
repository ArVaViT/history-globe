import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import type { Locale } from "@hg/model";
import { Menu, PanelLeftClose } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HoverTip, PolityTip } from "./components/HoverTip";
import { InViewPanel } from "./components/InViewPanel";
import { LayersPanel, LegendPanel } from "./components/LayersPanel";
import { Panel } from "./components/Panel";
import { PlaceCard } from "./components/PlaceCard";
import { SearchBox } from "./components/SearchBox";
import { Timeline } from "./components/Timeline";
import { ToursPanel } from "./components/ToursPanel";
import { EventsPanel } from "./components/EventsPanel";
import { TourStopCard } from "./components/TourStopCard";
import { loadData, type LoadedData } from "./data";
import { useKeys, useMapFeed, usePanelsOpen, usePlayback, useUrlSync } from "./app-hooks";
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
  const { globe, error: mapError } = useGlobe(container, data, INITIAL);
  const error =
    dataError !== null
      ? t("error_data", { msg: dataError })
      : mapError !== null
        ? t("error_map", { msg: mapError })
        : null;
  const engine = globe?.engine;
  const state = useGlobeState(engine);

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
  const [playing, setPlaying] = usePlayback(engine);
  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, [setPlaying]);
  // The search may be hidden with the panels: show them, then focus it.
  const focusSearch = useCallback(() => {
    togglePanels(true);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }, [togglePanels]);
  useKeys(globe, { togglePlay, focusSearch });

  // Fly to the place from the URL once the globe exists, or start its tour.
  useEffect(() => {
    if (!engine) return;
    if (INITIAL.tour && data?.tours.some((t) => t.id === INITIAL.tour)) {
      engine.startTour(INITIAL.tour);
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

  return (
    <div className="fixed inset-0 overflow-hidden bg-night font-sans">
      {/* MapLibre sets position: relative on its container, so it needs a sized parent. */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

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

      {data && engine && (
        <>
          <div className="absolute top-4 bottom-12 left-4 flex flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] *:shrink-0 max-md:inset-x-3 max-md:top-3 max-md:bottom-auto max-md:z-10 max-md:max-h-[calc(100dvh-150px)] max-md:pr-0">
            {/* On a panel, not on the map: state labels run under the corner. */}
            <Panel className="flex w-[340px] max-md:w-full items-center justify-between gap-2 px-2 py-2">
              <button
                onClick={() => {
                  togglePanels(!panelsOpen);
                }}
                aria-expanded={panelsOpen}
                aria-controls={panelsOpen ? "side-panels" : undefined}
                aria-label={panelsOpen ? t("panels.hide") : t("panels.show")}
                title={panelsOpen ? t("panels.hide") : t("panels.show")}
                className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink"
              >
                {panelsOpen ? (
                  <PanelLeftClose className="size-5" aria-hidden />
                ) : (
                  <Menu className="size-5" aria-hidden />
                )}
              </button>
              <h1 className="flex-1 font-serif text-[20px] font-semibold tracking-tight text-ink">
                History Globe
              </h1>
              <LocaleSwitch value={state.locale} onChange={engine.setLocale} />
            </Panel>
            {panelsOpen && (
              <div
                id="side-panels"
                className={`flex flex-col gap-3 *:shrink-0 ${cardOpen ? "max-md:hidden" : ""}`}
              >
                <SearchBox
                  data={data}
                  inputRef={searchRef}
                  onSelect={(id) => {
                    engine.selectPlace(id);
                  }}
                />
                <LayersPanel layers={state.layers} onToggle={engine.setLayer} />
                <LegendPanel />
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
              </div>
            )}
          </div>

          <div className="absolute top-4 right-4 max-md:top-auto max-md:right-3 max-md:bottom-[136px] max-md:left-3">
            {tour && state.tour ? (
              <TourStopCard
                tour={tour}
                step={state.tour.step}
                place={tourStop ? data.byId.get(tourStop.placeId)?.props : undefined}
                locale={state.locale}
                onStep={engine.goToStop}
                onClose={engine.stopTour}
                onOpenPlace={(id) => {
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
                />
              )
            )}
          </div>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 max-xl:right-[64px] max-xl:left-[372px] max-xl:translate-x-0 max-md:inset-x-3 max-md:bottom-3 max-md:translate-x-0">
            <Timeline
              year={state.year}
              locale={state.locale}
              playing={playing}
              events={timelineEvents}
              onYear={engine.setYear}
              onPlay={() => {
                if (!playing && state.year >= YEAR_MAX) engine.setYear(YEAR_MIN);
                setPlaying((p) => !p);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function LocaleSwitch({ value, onChange }: { value: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex overflow-hidden rounded-full border border-line bg-paper/90 text-xs">
      {(["ru", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => {
            onChange(l);
          }}
          aria-pressed={value === l}
          className={`px-2.5 py-1 uppercase ${value === l ? "bg-accent text-paper" : "text-ink-soft hover:bg-paper-2"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
