import type { Locale } from "@hg/model";
import type { Camera } from "./renderer.ts";

export interface LayerVisibility {
  readonly borders: boolean;
  readonly places: boolean;
  readonly relief: boolean;
  readonly routes: boolean;
  /** Roman roads (Itiner-e), from 312 BC and zoom 5. */
  readonly roads: boolean;
  /** The ancient world around the Bible: cities and sanctuaries it does not name. */
  readonly ancient: boolean;
  /** Battles and sieges, each in its years (content/battles.yaml). */
  readonly battles: boolean;
}

export interface TourState {
  readonly id: string;
  readonly step: number;
}

/** The single store of globe state (ADR 0004). */
export interface GlobeState {
  readonly year: number;
  readonly selectedPlace: string | null;
  readonly locale: Locale;
  readonly layers: LayerVisibility;
  readonly tour: TourState | null;
  /**
   * Places picked out without a tour (a chapter typed in the search): the rest of the map
   * steps back as during a tour. A tour, once started, takes over. `ref` names the chapter
   * (OSIS, `Acts.16`): the link keeps it and the interface shows it in its language.
   */
  readonly focus: { readonly ref: string; readonly places: readonly string[] } | null;
  /**
   * The settled view, as the renderer reports it after each move. It flows one way,
   * renderer → store: the camera is moved by commands (selectPlace, lookAt, tours).
   */
  readonly camera: Camera | null;
}

export const DEFAULT_STATE: GlobeState = {
  year: 30,
  selectedPlace: null,
  locale: "ru",
  layers: {
    borders: true,
    places: true,
    relief: true,
    routes: true,
    roads: true,
    ancient: true,
    battles: true,
  },
  tour: null,
  focus: null,
  camera: null,
};

export type Listener = (state: GlobeState, previous: GlobeState) => void;

export interface Store {
  readonly get: () => GlobeState;
  readonly set: (patch: Partial<GlobeState>) => void;
  readonly subscribe: (listener: Listener) => () => void;
}

export function createStore(initial: GlobeState = DEFAULT_STATE): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (patch) => {
      const previous = state;
      state = { ...state, ...patch };
      for (const l of listeners) l(state, previous);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
