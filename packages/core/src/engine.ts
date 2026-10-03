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

/**
 * 3500 BC to AD 1300 in astronomical years (ADR 0003): from the Early Bronze Age, the first
 * towns of Canaan and Mesopotamia, through the Byzantine and early Islamic centuries to the
 * end of the Crusader states (Acre, 1291). Widened on 1.10.2026 from 2000 BC – AD 100 and
 * on 2.10.2026 from AD 500; it stops before modern borders.
 */
export const YEAR_MIN = -3499;
export const YEAR_MAX = 1300;

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
  /** The map's year at this stop; the tour's year otherwise. */
  readonly year?: number;
  /** The leg to this stop was sailed. */
  readonly sea?: boolean;
  /** The text does not trace the leg to this stop (regions crossed): no time on foot. */
  readonly untold?: boolean;
  /** How many days the voyage took, and the verse that says so. */
  readonly sailed?: {
    readonly days: number;
    readonly about?: true | undefined;
    readonly ref: string;
  };
}

export interface Tour {
  readonly id: string;
  readonly year: number;
  /** False when the stops are not a way travelled: no time on foot. */
  readonly walked?: boolean;
  readonly stops: readonly TourStop[];
}

export interface Engine {
  readonly store: Store;
  readonly setYear: (year: number) => void;
  readonly stepYear: (delta: number) => void;
  readonly selectPlace: (placeId: string | null, options?: { readonly fly?: boolean }) => void;
  readonly setLocale: (locale: Locale) => void;
  readonly setLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  /** Start a tour, at its first stop or at `step` (back from a stop's place card). */
  readonly startTour: (tourId: string, step?: number) => void;
  readonly goToStop: (step: number) => void;
  readonly stopTour: () => void;
  /** Show these places alone (a chapter's), at the year given if any; null shows all. */
  readonly focusPlaces: (
    focus: { ref: string; places: readonly string[]; year?: number } | null,
    /** Fly to frame them; false keeps the camera (a shared link brings its own). */
    frame?: boolean,
  ) => void;
  /** Show a point up close, e.g. one candidate site of a disputed place. */
  readonly lookAt: (at: LonLat) => void;
  /** Turn the map so that north is up, keeping the view. */
  readonly northUp: () => void;
  readonly destroy: () => void;
}

export function clampYear(year: number): number {
  if (!Number.isFinite(year)) return DEFAULT_STATE.year;
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
  // A tour flies as close as its spread allows: Paul's journeys at 7.6, a walk through
  // Jerusalem much closer, so its stops do not pile into one point.
  const tourZoom = new Map(
    [...tours].map(([id, t]) => [id, zoomForSpread(t.stops.map((st) => st.at))]),
  );
  // The initial state may come from a link: keep only what the data can show.
  const initial = { ...DEFAULT_STATE, ...options.initial };
  const store = createStore({
    ...initial,
    year: clampYear(initial.year),
    selectedPlace:
      initial.selectedPlace !== null && places.has(initial.selectedPlace)
        ? initial.selectedPlace
        : null,
  });

  const sync = (s: GlobeState, prev: GlobeState | null): void => {
    if (!prev || s.year !== prev.year) renderer.setYear(s.year);
    if (!prev || s.locale !== prev.locale) renderer.setLocale(s.locale);
    if (!prev || s.layers !== prev.layers) renderer.setLayers(s.layers);
    if (!prev || s.selectedPlace !== prev.selectedPlace) renderer.setSelected(s.selectedPlace);
    if (!prev || s.tour?.id !== prev.tour?.id || s.focus !== prev.focus) {
      const tour = s.tour ? tours.get(s.tour.id) : undefined;
      renderer.setTourPlaces(tour ? tour.stops.map((st) => st.placeId) : (s.focus?.places ?? []));
    }
    if (!prev || s.tour !== prev.tour) {
      const tour = s.tour ? tours.get(s.tour.id) : undefined;
      renderer.setRoute(
        // The whole route: the stops ahead are drawn faint, so the way is seen from the start.
        tour && s.tour ? tour.stops.map((st) => st.at) : [],
        s.tour?.step ?? -1,
      );
    }
  };
  sync(store.get(), null);
  const unsubscribe = store.subscribe(sync);

  const selectPlace: Engine["selectPlace"] = (placeId, opts) => {
    if (placeId !== null && !places.has(placeId)) return;
    // Picking another place (map, search, list) during a tour leaves the tour: its card
    // would otherwise stay over the place's and the pick would show nothing.
    const running = store.get().tour;
    const stop = running ? tours.get(running.id)?.stops[running.step] : undefined;
    const leave = running !== null && placeId !== null && placeId !== stop?.placeId;
    store.set(leave ? { selectedPlace: placeId, tour: null } : { selectedPlace: placeId });
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

  const goToStop = (step: number, whole = false) => {
    const current = store.get().tour;
    const tour = current ? tours.get(current.id) : undefined;
    const stop = tour?.stops[step];
    if (!tour || !stop) return;
    store.set({
      tour: { id: tour.id, step },
      selectedPlace: places.has(stop.placeId) ? stop.placeId : null,
      year: clampYear(stop.year ?? tour.year),
    });
    // A tour opens on its whole route, as a teacher shows a class the journey first; each
    // later stop is flown to.
    if (whole && tour.stops.length > 1) {
      renderer.fitTo(tour.stops.map((st) => st.at));
      return;
    }
    renderer.flyTo({
      center: stop.at,
      zoom: tourZoom.get(tour.id) ?? 7.6,
      pitch: 55,
      bearing: -20 + step * 3,
    });
  };

  store.set({ camera: renderer.getCamera() });
  const offCamera = renderer.on("cameraChanged", (camera) => {
    store.set({ camera });
  });
  const offPick = renderer.on("pick", (id) => {
    selectPlace(id, { fly: false });
    // A place tapped where its card then opens (a phone's lower half) is brought out.
    const at = places.get(id)?.at;
    if (at) renderer.reveal?.(at);
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
    startTour: (tourId, step = 0) => {
      const tour = tours.get(tourId);
      if (!tour) return;
      const at = Math.min(Math.max(Math.trunc(step), 0), tour.stops.length - 1);
      store.set({ tour: { id: tourId, step: at }, year: clampYear(tour.year), focus: null });
      goToStop(at, at === 0);
    },
    goToStop: (step) => {
      goToStop(step);
    },
    focusPlaces: (focus, frame = true) => {
      const known = focus ? focus.places.filter((id) => places.has(id)) : [];
      store.set({
        focus: focus && known.length > 0 ? { ref: focus.ref, places: known } : null,
        ...(focus?.year === undefined ? {} : { year: clampYear(focus.year) }),
      });
      if (frame && known.length > 0)
        renderer.fitTo(known.map((id) => places.get(id)?.at ?? [0, 0]));
    },
    stopTour: () => {
      store.set({ tour: null });
    },
    lookAt: (at) => {
      renderer.flyTo({ center: at, zoom: 11, pitch: 50 });
    },
    northUp: () => {
      renderer.flyTo({ center: renderer.getCamera().center, bearing: 0 }, 600);
    },
    destroy: () => {
      unsubscribe();
      offPick();
      offCamera();
      renderer.destroy();
    },
  };
}

/**
 * The zoom for a tour from how far its stops spread: 7.6 for 150 km and more, one step
 * closer for each halving, at most 13 (a city's streets).
 */
export function zoomForSpread(points: readonly (readonly [number, number])[]): number {
  if (points.length === 0) return 7.6;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const dx = (Math.max(...lons) - Math.min(...lons)) * 111 * Math.cos(midLat);
  const dy = (Math.max(...lats) - Math.min(...lats)) * 111;
  const km = Math.hypot(dx, dy);
  return Math.min(13, Math.max(7.6, 7.6 + Math.log2(150 / Math.max(km, 1))));
}
