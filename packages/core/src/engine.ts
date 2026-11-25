import type { Locale } from "@hg/model";
import { POINT_ZOOM, zoomForKind } from "./kinds.ts";
import { type GreatTown, type Life, zoomBeside } from "./majors.ts";
import type { LonLat, Renderer } from "./renderer.ts";
import {
  createStore,
  DEFAULT_STATE,
  type Focus,
  type GlobeState,
  type LayerVisibility,
  type Store,
} from "./state.ts";

/**
 * 3500 BC to AD 1300 in astronomical years (ADR 0003): from the Early Bronze Age, the first
 * towns of Canaan and Mesopotamia, through the Byzantine and early Islamic centuries to the
 * end of the Crusader states (Acre, 1291); it stops before modern borders.
 */
export const YEAR_MIN = -3499;
export const YEAR_MAX = 1300;

/** A tour's zoom when its stops lie 150 km apart or more (Paul's journeys). */
export const TOUR_ZOOM = 7.6;

export interface PlaceInfo {
  readonly id: string;
  readonly at: LonLat;
  /** OpenBible type: settlement, region, body of water, mountain, … (kinds.ts) */
  readonly kind: string;
  /** A great town (majors.ts isMajor): when it stands, for the places flown to beside it. */
  readonly great?: Life;
}

export interface TourStop {
  readonly placeId: string;
  readonly at: LonLat;
  /** The verse that tells it; outside the Bible, the `source` that does. */
  readonly ref?: string;
  readonly source?: {
    readonly cite: Readonly<Record<string, string>>;
    readonly url: string;
  };
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
  /** The zoom a place is flown to when selected (selectedZoom), at the current year. */
  readonly placeZoom: (placeId: string) => number | undefined;
  readonly setLocale: (locale: Locale) => void;
  readonly setLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  /** Start a tour, at its first stop or at `step` (back from a stop's place card). */
  readonly startTour: (tourId: string, step?: number) => void;
  readonly goToStop: (step: number) => void;
  readonly stopTour: () => void;
  /** Show these places alone (a chapter's), at the year given if any; null shows all. */
  readonly focusPlaces: (
    focus: FocusRequest | null,
    /** Fly to frame them; false keeps the camera (a shared link brings its own). */
    frame?: boolean,
  ) => void;
  /** Show a point up close, e.g. one candidate site of a disputed place. */
  readonly lookAt: (at: LonLat) => void;
  /** Mark a point on the map without moving it (a place named in an article, pointed at). */
  readonly highlight: (at: LonLat | null) => void;
  /** Turn the map so that north is up, keeping the view. */
  readonly northUp: () => void;
  readonly destroy: () => void;
}

export interface FocusRequest extends Focus {
  readonly year?: number;
  /** The places to frame, when not all of them (a region or a sea named in passing). */
  readonly frame?: readonly string[];
}

export function clampYear(year: number): number {
  if (!Number.isFinite(year)) return DEFAULT_STATE.year;
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(year)));
}

export function createEngine(options: {
  readonly renderer: Renderer;
  readonly places: ReadonlyMap<string, PlaceInfo>;
  /** A retired place id → the place it was merged into: an old link still opens the place. */
  readonly aliases?: ReadonlyMap<string, string>;
  readonly tours?: readonly Tour[];
  readonly initial?: Partial<GlobeState>;
}): Engine {
  const { renderer, places } = options;
  const canonical = (id: string) => options.aliases?.get(id) ?? id;
  const greatTowns: GreatTown[] = [];
  for (const p of places.values())
    if (p.great) greatTowns.push({ id: p.id, at: p.at, life: p.great });
  const tours = new Map((options.tours ?? []).map((t) => [t.id, t]));
  // A walk through Jerusalem flies much closer than a journey, so its stops do not pile
  // into one point.
  const tourZoom = new Map(
    [...tours].map(([id, t]) => [id, zoomForSpread(t.stops.map((st) => st.at))]),
  );
  // The initial state may come from a link: keep only what the data can show.
  const initial = { ...DEFAULT_STATE, ...options.initial };
  const store = createStore({
    ...initial,
    year: clampYear(initial.year),
    selectedPlace:
      initial.selectedPlace !== null && places.has(canonical(initial.selectedPlace))
        ? canonical(initial.selectedPlace)
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
    if (!prev || s.tour !== prev.tour || s.focus !== prev.focus) {
      const tour = s.tour ? tours.get(s.tour.id) : undefined;
      if (tour && s.tour)
        // The whole route: the stops ahead are drawn faint, so the way is seen from the start.
        renderer.setRoute(
          tour.stops.map((st) => st.at),
          s.tour.step,
          { placeIds: tour.stops.map((st) => st.placeId) },
        );
      else {
        // A chapter's way, whole and still: the reader has the chapter before them, not a
        // tour under way.
        const route = s.focus?.route ?? [];
        renderer.setRoute(route, route.length - 1, {
          placeIds: s.focus?.routePlaces ?? [],
          still: true,
        });
      }
    }
  };
  sync(store.get(), null);
  const unsubscribe = store.subscribe(sync);

  const selectPlace: Engine["selectPlace"] = (asked, opts) => {
    const placeId = asked === null ? null : canonical(asked);
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
        zoom: Math.max(camera.zoom, selectedZoom(place, greatTowns, store.get().year)),
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
      zoom: tourZoom.get(tour.id) ?? TOUR_ZOOM,
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
    if (at) renderer.reveal(at);
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
    placeZoom: (placeId) => {
      const place = places.get(placeId);
      return place ? selectedZoom(place, greatTowns, store.get().year) : undefined;
    },
    setLocale: (locale) => {
      store.set({ locale });
    },
    setLayer: (layer, visible) => {
      store.set({ layers: { ...store.get().layers, [layer]: visible } });
    },
    startTour: (tourId, step = 0) => {
      const tour = tours.get(tourId);
      if (!tour || tour.stops.length === 0) return;
      const at = Math.min(Math.max(Math.trunc(step), 0), tour.stops.length - 1);
      store.set({ tour: { id: tourId, step: at }, year: clampYear(tour.year), focus: null });
      goToStop(at, at === 0);
    },
    goToStop: (step) => {
      goToStop(step);
    },
    focusPlaces: (focus, frame = true) => {
      const known = focus ? focus.places.filter((id) => places.has(id)) : [];
      const route = focus?.route && focus.route.length > 1 ? focus.route : undefined;
      store.set({
        focus:
          focus && known.length > 0
            ? {
                ref: focus.ref,
                places: known,
                ...(route ? { route, routePlaces: focus.routePlaces ?? [] } : {}),
              }
            : null,
        ...(focus?.year === undefined ? {} : { year: clampYear(focus.year) }),
      });
      if (!frame || known.length === 0) return;
      // The places that make the chapter's map, and its way: a region or a sea named in
      // passing (Italy, the Adriatic) would pull the frame out to half a continent.
      const framed = (focus?.frame ?? known).filter((id) => places.has(id));
      const points = (framed.length > 0 ? framed : known).flatMap((id) => {
        const at = places.get(id)?.at;
        return at ? [at] : [];
      });
      renderer.fitTo([...points, ...(route ?? [])]);
    },
    stopTour: () => {
      store.set({ tour: null });
    },
    lookAt: (at) => {
      renderer.flyTo({ center: at, zoom: 11, pitch: 50 });
    },
    highlight: (at) => {
      renderer.highlight(at);
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
 * The zoom a selected place is flown to: its kind's, and for a town or a landmark close
 * enough to set it apart from the great town beside it (Golgotha by Jerusalem). Regions,
 * seas and rivers keep their kind's: they are framed whole, not set beside a town.
 */
export function selectedZoom(
  place: PlaceInfo,
  greatTowns: readonly GreatTown[],
  year: number,
): number {
  const zoom = zoomForKind(place.kind);
  // A great town is itself the setting: Jerusalem is not flown in to part it from the City
  // of David, 400 m off, whose ring waits for a closer view (majors.ts thinMajors).
  if (zoom < POINT_ZOOM || place.great) return zoom;
  return zoomBeside(place, zoom, greatTowns, year);
}

/**
 * The zoom for a tour from how far its stops spread: TOUR_ZOOM for 150 km and more, one step
 * closer for each halving, at most 13 (a city's streets).
 */
export function zoomForSpread(points: readonly LonLat[]): number {
  if (points.length === 0) return TOUR_ZOOM;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const dx = (Math.max(...lons) - Math.min(...lons)) * 111 * Math.cos(midLat);
  const dy = (Math.max(...lats) - Math.min(...lats)) * 111;
  const km = Math.hypot(dx, dy);
  return Math.min(13, Math.max(TOUR_ZOOM, TOUR_ZOOM + Math.log2(150 / Math.max(km, 1))));
}
