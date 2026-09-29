import type { Locale } from "@hg/model";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HoverTip } from "./components/HoverTip";
import { InViewPanel } from "./components/InViewPanel";
import { LayersPanel } from "./components/LayersPanel";
import { Panel } from "./components/Panel";
import { PlaceCard } from "./components/PlaceCard";
import { SearchBox } from "./components/SearchBox";
import { Timeline } from "./components/Timeline";
import { ToursPanel } from "./components/ToursPanel";
import { TourStopCard } from "./components/TourStopCard";
import { loadData, type LoadedData } from "./data";
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
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ id: string; at: { x: number; y: number } } | null>(null);
  const [inView, setInView] = useState<string[]>([]);
  const globe = useGlobe(container, data, INITIAL);
  const engine = globe?.engine;
  const state = useGlobeState(engine);

  useEffect(() => {
    loadData().then(setData, (e: unknown) => {
      setError(String(e));
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
        writeUrl({
          year: s.year,
          camera: globe.renderer.getCamera(),
          locale: s.locale,
          ...(s.selectedPlace ? { place: s.selectedPlace } : {}),
        });
      }, 300);
    };
    const offCam = globe.renderer.on("cameraChanged", save);
    const offState = globe.engine.store.subscribe(save);
    return () => {
      offCam();
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

  // Fly to the place from the URL once the globe exists.
  useEffect(() => {
    if (engine && INITIAL.place && !INITIAL.camera) engine.selectPlace(INITIAL.place);
  }, [engine]);

  useEffect(() => {
    if (!playing || !engine) return;
    const id = window.setInterval(() => {
      const y = engine.store.get().year;
      if (y >= 100) setPlaying(false);
      else engine.setYear(y + PLAY_STEP);
    }, PLAY_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, engine]);

  useEffect(() => {
    if (!globe) return;
    const { engine, renderer } = globe;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" && (target as HTMLInputElement).type !== "range") return;
      const big = e.shiftKey ? 100 : 10;
      if (e.key === "[" || e.key === "{") engine.stepYear(-big);
      else if (e.key === "]" || e.key === "}") engine.stepYear(big);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        engine.selectPlace(null);
        engine.stopTour();
      } else if (e.key.toLowerCase() === "n") renderer.map.easeTo({ bearing: 0, duration: 600 });
      else return;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [globe]);

  const hoverPlace = hover ? data?.byId.get(hover.id)?.props : undefined;
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

      {error && (
        <Panel className="absolute top-1/2 left-1/2 -translate-1/2 px-6 py-4 text-ink">
          Не удалось загрузить данные: {error}
        </Panel>
      )}

      {data && engine && (
        <>
          <div className="absolute top-4 bottom-12 left-4 flex flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] *:shrink-0">
            <div className="flex items-center justify-between px-1">
              <div className="font-serif text-[20px] font-semibold tracking-tight text-paper drop-shadow">
                History Globe
              </div>
              <LocaleSwitch value={state.locale} onChange={engine.setLocale} />
            </div>
            <SearchBox
              data={data}
              inputRef={searchRef}
              onSelect={(id) => {
                engine.selectPlace(id);
              }}
            />
            <LayersPanel layers={state.layers} onToggle={engine.setLayer} />
            <ToursPanel
              tours={data.tours}
              onStart={(id) => {
                setPlaying(false);
                engine.startTour(id);
              }}
            />
            <InViewPanel
              ids={inView}
              data={data}
              locale={state.locale}
              selected={state.selectedPlace}
              onSelect={(id) => {
                engine.selectPlace(id);
              }}
            />
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
              />
            ) : (
              selected && (
                <PlaceCard
                  place={selected}
                  sites={data.sites.get(selected.id) ?? []}
                  locale={state.locale}
                  onClose={() => {
                    engine.selectPlace(null);
                  }}
                  onZoom={() => {
                    engine.selectPlace(selected.id, { fly: true });
                  }}
                  onFlyTo={(at) => {
                    globe.renderer.flyTo({ center: at, zoom: 11, pitch: 50 }, 1600);
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
              onYear={engine.setYear}
              hints={t("hints")}
              onPlay={() => {
                if (!playing && state.year >= 100) engine.setYear(-2000);
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
