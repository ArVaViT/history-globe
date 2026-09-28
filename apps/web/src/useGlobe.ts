import { createEngine, DEFAULT_STATE, type Camera, type Engine, type GlobeState } from "@hg/core";
import { MapLibreRenderer } from "@hg/core/maplibre";
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

export interface Globe {
  readonly engine: Engine;
  readonly renderer: MapLibreRenderer;
}

export function useGlobe(
  container: RefObject<HTMLDivElement | null>,
  data: LoadedData | null,
  initial: UrlView,
): Globe | null {
  const [globe, setGlobe] = useState<Globe | null>(null);
  const initialRef = useRef(initial);

  useEffect(() => {
    const el = container.current;
    if (!el || !data) return;
    const init = initialRef.current;
    const renderer = new MapLibreRenderer({
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
      },
    });
    if (import.meta.env.DEV) {
      // Handle for local debugging and screenshot scripts; never in production builds.
      (window as unknown as { __hgMap?: unknown }).__hgMap = renderer.map;
    }
    setGlobe({ engine, renderer });
    return () => {
      engine.destroy();
      setGlobe(null);
    };
  }, [container, data]);

  return globe;
}

const noop = () => () => undefined;

export function useGlobeState(engine: Engine | undefined): GlobeState {
  return useSyncExternalStore(
    engine ? engine.store.subscribe : noop,
    engine ? engine.store.get : () => DEFAULT_STATE,
  );
}
