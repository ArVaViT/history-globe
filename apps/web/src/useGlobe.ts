import { createEngine, DEFAULT_STATE, type Camera, type Engine, type GlobeState } from "@hg/core";
import type { MapLibreRenderer } from "@hg/core/maplibre";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { LoadedData } from "./data";
import { DATA_URL } from "./data";
import { MAP_FONTS } from "./fonts";
import type { UrlView } from "./url";

const DEFAULT_CAMERA: Camera = { center: [35.3, 32.0], zoom: 5.4, pitch: 40, bearing: -10 };

const TERRAIN = {
  // Development source. Production serves its own extract from R2 (ADR 0005).
  tiles: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
  attribution: "Terrain: Mapterhorn (Copernicus DEM and others)",
};

// MapLibre is most of the JavaScript. It is a separate chunk that starts downloading at
// once, in parallel with the data, while the panels render without waiting for it.
const rendererModule = import("@hg/core/maplibre");

export interface Globe {
  readonly engine: Engine;
  readonly renderer: MapLibreRenderer;
}

export function useGlobe(
  container: RefObject<HTMLDivElement | null>,
  data: LoadedData | null,
  initial: UrlView,
): { globe: Globe | null; error: string | null } {
  const [globe, setGlobe] = useState<Globe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef(initial);

  useEffect(() => {
    const el = container.current;
    if (!el || !data) return;
    const init = initialRef.current;
    let cancelled = false;
    let created: Globe | null = null;
    // A failed chunk download or a missing WebGL context must surface as an error,
    // not leave the loading overlay up for ever.
    rendererModule
      .then(({ MapLibreRenderer }) => {
        if (cancelled) return;
        created = createGlobe(MapLibreRenderer, el, data, init);
        setGlobe(created);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
      created?.engine.destroy();
      setGlobe(null);
    };
  }, [container, data]);

  return { globe, error };
}

function createGlobe(
  Renderer: typeof MapLibreRenderer,
  el: HTMLDivElement,
  data: LoadedData,
  init: UrlView,
): Globe {
  const renderer = new Renderer({
    container: el,
    camera: init.camera ?? DEFAULT_CAMERA,
    places: data.places,
    dataUrl: DATA_URL,
    terrainTiles: TERRAIN.tiles,
    terrainAttribution: TERRAIN.attribution,
    fonts: MAP_FONTS,
    initialYear: init.year ?? DEFAULT_STATE.year,
    initialLocale: init.locale ?? DEFAULT_STATE.locale,
  });
  const engine = createEngine({
    renderer,
    places: new Map([...data.byId].map(([id, p]) => [id, p.info])),
    tours: data.tours,
    initial: {
      ...(init.year === undefined ? {} : { year: init.year }),
      ...(init.locale === undefined ? {} : { locale: init.locale }),
      ...(init.place === undefined ? {} : { selectedPlace: init.place }),
      ...(init.layers === undefined ? {} : { layers: init.layers }),
    },
  });
  if (import.meta.env.DEV) {
    // Handle for local debugging and screenshot scripts; never in production builds.
    (window as unknown as { __hgMap?: unknown }).__hgMap = renderer.map;
  }
  return { engine, renderer };
}

const noop = () => () => undefined;

export function useGlobeState(engine: Engine | undefined): GlobeState {
  return useSyncExternalStore(
    engine ? engine.store.subscribe : noop,
    engine ? engine.store.get : () => DEFAULT_STATE,
  );
}
