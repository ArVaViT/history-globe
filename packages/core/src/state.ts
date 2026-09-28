import type { Locale } from "@hg/model";

export interface LayerVisibility {
  readonly borders: boolean;
  readonly places: boolean;
  readonly relief: boolean;
  readonly routes: boolean;
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
}

export const DEFAULT_STATE: GlobeState = {
  year: 30,
  selectedPlace: null,
  locale: "ru",
  layers: { borders: true, places: true, relief: true, routes: true },
  tour: null,
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
