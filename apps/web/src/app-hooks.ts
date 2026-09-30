import { YEAR_MAX, type Engine } from "@hg/core";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { focusOf, keyAction } from "./keys";
import { writeUrl } from "./url";
import type { Globe } from "./useGlobe";

const PLAY_STEP = 5;
const PLAY_INTERVAL_MS = 80;
const PANELS_KEY = "hg:panels-hidden";

/**
 * Whether the left column is shown (the burger hides it all at once), remembered in
 * this browser: "0" shown, "1" hidden. Without a choice yet it shows, except on a
 * phone, where it would cover the map.
 */
export function usePanelsOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    try {
      const saved = localStorage.getItem(PANELS_KEY);
      return saved === null ? !narrow : saved === "0";
    } catch {
      return !narrow;
    }
  });
  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(PANELS_KEY, next ? "0" : "1");
    } catch {
      // Storage refused: the column still toggles, it just forgets.
    }
  }, []);
  return [open, toggle];
}

/** Keep the URL shareable: year, place, camera, locale, layers, tour (ADR 0006). */
export function useUrlSync(globe: Globe | null): void {
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
}

export interface MapFeed {
  /** The first frame is drawn. */
  readonly ready: boolean;
  /** The place under the pointer and where the pointer is. */
  readonly hover: { id: string; at: { x: number; y: number } } | null;
  /** The places on screen (ids). */
  readonly inView: string[];
}

/** What the map reports back: ready, the hovered place, the places in view. */
export function useMapFeed(globe: Globe | null, placesShown: boolean): MapFeed {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<MapFeed["hover"]>(null);
  const [inView, setInView] = useState<string[]>([]);

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

  return { ready, hover, inView };
}

/** Play: the year runs forward five years a tick and stops at the end. */
export function usePlayback(
  engine: Engine | undefined,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [playing, setPlaying] = useState(false);
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
  return [playing, setPlaying];
}

/** The keyboard shortcuts (keys.ts decides what a key means). */
export function useKeys(
  globe: Globe | null,
  on: {
    readonly togglePlay: () => void;
    readonly focusSearch: () => void;
  },
): void {
  const { togglePlay, focusSearch } = on;
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
        togglePlay();
      } else if (action.kind === "search") {
        e.preventDefault();
        focusSearch();
      } else if (action.kind === "close") {
        engine.selectPlace(null);
        engine.stopTour();
      } else engine.northUp();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [globe, togglePlay, focusSearch]);
}
