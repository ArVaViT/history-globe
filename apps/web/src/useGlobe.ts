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

/**
 * Where the interface leaves the map open, for a flight to put its place there. On a phone
 * the header covers the top and the card and the timeline the lower half; wider, the
 * panels cover the left, the timeline the bottom and the card the top right: beside the
 * card when there is room, below it when not. Shrunk to fit a small screen (a phone on
 * its side), which MapLibre would otherwise clamp.
 */
function viewPadding() {
  const w = innerWidth;
  const h = innerHeight;
  const p =
    w < 768
      ? { top: 64, bottom: h * 0.55, left: 0, right: 0 }
      : w - 356 - 396 >= 400
        ? { top: 0, bottom: 140, left: 356, right: 396 }
        : { top: 360, bottom: 140, left: 356, right: 0 };
  const k = Math.min(1, (w - 80) / (p.left + p.right || 1), (h - 80) / (p.top + p.bottom));
  return {
    top: Math.round(p.top * k),
    bottom: Math.round(p.bottom * k),
    left: Math.round(p.left * k),
    right: Math.round(p.right * k),
  };
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
    places: forMap(data.places),
    dataUrl: DATA_URL,
    terrainTiles: TERRAIN.tiles,
    terrainAttribution: TERRAIN.attribution,
    fonts: MAP_FONTS,
    initialYear: init.year ?? DEFAULT_STATE.year,
    initialLocale: init.locale ?? DEFAULT_STATE.locale,
    viewPadding,
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

/**
 * What the map needs of a place: the card keeps the verse list and the "where" lines, the
 * map would only carry them through every tile (Jerusalem alone has 955 verses).
 */
function forMap(places: LoadedData["places"]): LoadedData["places"] {
  return {
    ...places,
    features: places.features.map((f) => {
      return { ...f, properties: { ...f.properties, osis: [], where: "" } };
    }),
  };
}
