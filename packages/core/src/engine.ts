import type { Locale } from "@hg/model";
import { zoomForKind } from "./kinds.ts";
import type { LonLat, Renderer } from "./renderer.ts";
import {
  createStore,
  DEFAULT_STATE,
  type GlobeState,
  type LayerVisibility,
  type Store,
} from "./state.ts";

export const YEAR_MIN = -2000;
export const YEAR_MAX = 100;

export interface PlaceInfo {
  readonly id: string;
  readonly at: LonLat;
  /** OpenBible type: settlement, region, body of water, mountain, … (kinds.ts) */
  readonly kind: string;
}

export interface TourStop {
  readonly placeId: string;
  readonly at: LonLat;
  readonly ref: string;
  readonly note: Readonly<Record<string, string>>;
}

export interface Tour {
  readonly id: string;
  readonly year: number;
  readonly stops: readonly TourStop[];
}

export interface Engine {
  readonly store: Store;
  readonly setYear: (year: number) => void;
  readonly stepYear: (delta: number) => void;
  readonly selectPlace: (placeId: string | null, options?: { readonly fly?: boolean }) => void;
  readonly setLocale: (locale: Locale) => void;
  readonly setLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  readonly startTour: (tourId: string) => void;
  readonly goToStop: (step: number) => void;
  readonly stopTour: () => void;
  readonly destroy: () => void;
}

export function clampYear(year: number): number {
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(year)));
}

export function createEngine(options: {
  readonly renderer: Renderer;
  readonly places: ReadonlyMap<string, PlaceInfo>;
  readonly tours?: readonly Tour[];
  readonly initial?: Partial<GlobeState>;
}): Engine {
  const { renderer, places } = options;
  const tours = new Map((options.tours ?? []).map((t) => [t.id, t]));
  const store = createStore({ ...DEFAULT_STATE, ...options.initial });

  const sync = (s: GlobeState, prev: GlobeState | null): void => {
    if (!prev || s.year !== prev.year) renderer.setYear(s.year);
    if (!prev || s.locale !== prev.locale) renderer.setLocale(s.locale);
    if (!prev || s.layers !== prev.layers) renderer.setLayers(s.layers);
    if (!prev || s.selectedPlace !== prev.selectedPlace) renderer.setSelected(s.selectedPlace);
    if (!prev || s.tour !== prev.tour) {
      const tour = s.tour ? tours.get(s.tour.id) : undefined;
      renderer.setRoute(
        tour && s.tour ? tour.stops.slice(0, s.tour.step + 1).map((st) => st.at) : [],
        s.tour?.step ?? -1,
      );
    }
  };
  sync(store.get(), null);
  const unsubscribe = store.subscribe(sync);

  const selectPlace: Engine["selectPlace"] = (placeId, opts) => {
    if (placeId !== null && !places.has(placeId)) return;
    store.set({ selectedPlace: placeId });
    const place = placeId ? places.get(placeId) : undefined;
    if (place && (opts?.fly ?? true)) {
      const camera = renderer.getCamera();
      renderer.flyTo({
        center: place.at,
        zoom: Math.max(camera.zoom, zoomForKind(place.kind)),
        pitch: Math.max(camera.pitch, 45),
      });
    }
  };

  const goToStop: Engine["goToStop"] = (step) => {
    const current = store.get().tour;
    const tour = current ? tours.get(current.id) : undefined;
    const stop = tour?.stops[step];
    if (!tour || !stop) return;
    store.set({
      tour: { id: tour.id, step },
      selectedPlace: places.has(stop.placeId) ? stop.placeId : null,
    });
    renderer.flyTo({ center: stop.at, zoom: 7.6, pitch: 55, bearing: -20 + step * 3 });
  };

  const offPick = renderer.on("pick", (id) => {
    selectPlace(id, { fly: false });
  });

  return {
    store,
    setYear: (year) => {
      store.set({ year: clampYear(year) });
    },
    stepYear: (delta) => {
      store.set({ year: clampYear(store.get().year + delta) });
    },
    selectPlace,
    setLocale: (locale) => {
      store.set({ locale });
    },
    setLayer: (layer, visible) => {
      store.set({ layers: { ...store.get().layers, [layer]: visible } });
    },
    startTour: (tourId) => {
      const tour = tours.get(tourId);
      if (!tour) return;
      store.set({ tour: { id: tourId, step: 0 }, year: clampYear(tour.year) });
      goToStop(0);
    },
    goToStop,
    stopTour: () => {
      store.set({ tour: null });
    },
    destroy: () => {
      unsubscribe();
      offPick();
      renderer.destroy();
    },
  };
}
