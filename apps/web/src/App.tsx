import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import type { Locale } from "@hg/model";
import { Menu, PanelLeftClose } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { focusOf, keyAction } from "./keys";
import { timelineEventsOf } from "./timeline-events";
import { readUrl, writeUrl } from "./url";
import { useGlobe, useGlobeState } from "./useGlobe";

const INITIAL = readUrl();
const PLAY_STEP = 5;
const PLAY_INTERVAL_MS = 80;

export function App() {
  const { i18n, t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // The whole left column hides at once (burger in the header), remembered in this browser.
  const [panelsOpen, setPanelsOpen] = useState(() => {
    try {
      return localStorage.getItem("hg:panels-hidden") === null;
    } catch {
      return true;
    }
  });
  const togglePanels = (open: boolean) => {
    setPanelsOpen(open);
    try {
      if (open) localStorage.removeItem("hg:panels-hidden");
      else localStorage.setItem("hg:panels-hidden", "1");
    } catch {
      // Storage refused: the column still toggles, it just forgets.
    }
  };
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ id: string; at: { x: number; y: number } } | null>(null);
  const [inView, setInView] = useState<string[]>([]);
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

  // Keep the URL shareable: year, place, camera, locale (ADR 0006).
  useEffect(() => {
    if (!globe) return;
    let timer = 0;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = globe.engine.store.get();
        if (!s.camera) return;
        writeUrl({
          year: s.year,
          camera: s.camera,
          locale: s.locale,
          ...(s.selectedPlace ? { place: s.selectedPlace } : {}),
          layers: s.layers,
          ...(s.tour ? { tour: s.tour.id } : {}),
        });
      }, 300);
    };
    const offState = globe.engine.store.subscribe(save);
    return () => {
      offState();
      window.clearTimeout(timer);
    };
  }, [globe]);

  useEffect(() => {
    if (!globe) return;
    const refreshInView = () => {
      setInView(globe.renderer.visiblePlaces());
    };
    const offReady = globe.renderer.on("ready", () => {
      setReady(true);
      refreshInView();
    });
    const offCamera = globe.renderer.on("cameraChanged", refreshInView);
    const offHover = globe.renderer.on("hover", (id, at) => {
      setHover(id && at ? { id, at } : null);
    });
    return () => {
      offReady();
      offCamera();
      offHover();
    };
  }, [globe]);

  // Toggling the places layer changes what is in view without moving the camera.
  const placesShown = state.layers.places;
  useEffect(() => {
    if (!globe) return;
    const map = globe.renderer.map;
    const refresh = () => {
      setInView(globe.renderer.visiblePlaces());
    };
    map.once("idle", refresh);
    map.triggerRepaint();
    return () => {
      map.off("idle", refresh);
    };
  }, [globe, placesShown]);

  // Fly to the place from the URL once the globe exists, or start its tour.
  useEffect(() => {
    if (!engine) return;
    if (INITIAL.tour && data?.tours.some((t) => t.id === INITIAL.tour)) {
      engine.startTour(INITIAL.tour);
      return;
    }
    if (INITIAL.place && !INITIAL.camera) engine.selectPlace(INITIAL.place);
  }, [engine, data]);

  useEffect(() => {
    if (!playing || !engine) return;
    const id = window.setInterval(() => {
      const y = engine.store.get().year;
      if (y >= YEAR_MAX) setPlaying(false);
      else engine.setYear(y + PLAY_STEP);
    }, PLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, engine]);

  useEffect(() => {
    if (!globe) return;
    const { engine } = globe;
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction({
        key: e.key,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        focus: focusOf(e.target),
      });
      if (!action) return;
      if (action.kind === "year") engine.stepYear(action.delta);
      else if (action.kind === "play") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (action.kind === "search") {
        e.preventDefault();
        // The search may be hidden with the panels: show them, then focus it.
        togglePanels(true);
        requestAnimationFrame(() => {
          searchRef.current?.focus();
        });
      } else if (action.kind === "close") {
        engine.selectPlace(null);
        engine.stopTour();
      } else engine.northUp();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [globe]);

  const hoverPlace = hover ? data?.byId.get(hover.id)?.props : undefined;
  // Founding, destruction and ruin of places, and the turning points of the history.
  const timelineEvents = useMemo(
    () => (data ? timelineEventsOf(data, state.locale, t) : []),
    [data, state.locale, t],
  );
  const selected = state.selectedPlace ? data?.byId.get(state.selectedPlace)?.props : undefined;
  const tour = state.tour ? data?.tours.find((x) => x.id === state.tour?.id) : undefined;
  const tourStop = tour && state.tour ? tour.stops[state.tour.step] : undefined;

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
          <div className="absolute top-4 bottom-12 left-4 flex flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] *:shrink-0">
            {/* On a panel, not on the map: state labels run under the corner. */}
            <Panel className="flex w-[340px] items-center justify-between gap-2 px-2 py-2">
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
              <div id="side-panels" className="flex flex-col gap-3 *:shrink-0">
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

          <div className="absolute top-4 right-4">
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

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
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
