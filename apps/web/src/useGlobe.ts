import { createEngine, DEFAULT_STATE, type Camera, type Engine, type GlobeState } from "@hg/core";
import type { MapLibreRenderer } from "@hg/core/maplibre";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { LoadedData } from "./data";
import { DATA_URL } from "./data";
import { MAP_FONTS } from "./fonts";
import type { UrlView } from "./url";
import { viewPadding } from "./view-padding.ts";
import { TERRAIN_TILES } from "./offline";
import { translate } from "./i18n";

const DEFAULT_CAMERA: Camera = { center: [35.3, 32.0], zoom: 5.4, pitch: 40, bearing: -10 };
// On a phone the view is pushed up for the card below, so the Holy Land would sit at the
// top over half a screen of desert: aimed further north, it is in the middle, Paul's
// Asia Minor above it.
const PHONE_CAMERA: Camera = { center: [36.0, 35.6], zoom: 5.0, pitch: 40, bearing: -10 };

const TERRAIN = {
  // Development source. Production serves its own extract from R2 (ADR 0005).
  tiles: TERRAIN_TILES,
  // The licences ask for this line where the map is shown (Copernicus 6(a)); the rest of
  // the sources, with the Copernicus disclaimer, are on the About page the link opens.
  attribution:
    'Terrain: <a href="https://mapterhorn.com/attribution">Mapterhorn</a>, Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the EU and ESA · <a href="docs/sources.html">Sources</a>',
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
 * Whether a person's card is open (App.tsx): their places come with it, and the camera's
 * padding keeps its room. The engine's state knows the places, not the card.
 */
let personCard = false;
/** A compact frame on another site (App.tsx): no column, the chip above, the year below. */
let compactFrame = false;
export function setCompactFrame(on: boolean): void {
  compactFrame = on;
}
export function setPersonCardOpen(open: boolean): void {
  personCard = open;
}

function createGlobe(
  Renderer: typeof MapLibreRenderer,
  el: HTMLDivElement,
  data: LoadedData,
  init: UrlView,
): Globe {
  // The padding asks whether a card is open; the engine comes after the renderer.
  let cardOpen = () => true;
  // The chapter's chip under the header (not in a frame, where it sits in the top bar).
  let chipShown = () => false;
  const renderer = new Renderer({
    container: el,
    camera: init.camera ?? (innerWidth < 768 ? PHONE_CAMERA : DEFAULT_CAMERA),
    places: forMap(data.places),
    dataUrl: DATA_URL,
    terrainTiles: TERRAIN.tiles,
    // The credits' "Sources" link opens the docs in the language the map opened in.
    terrainAttribution:
      init.locale === "ru"
        ? TERRAIN.attribution.replace('href="docs/sources.html"', 'href="docs/ru/sources.html"')
        : TERRAIN.attribution,
    fonts: MAP_FONTS,
    initialYear: init.year ?? DEFAULT_STATE.year,
    initialLocale: init.locale ?? DEFAULT_STATE.locale,
    mapUi: (l) => ({
      km: translate(l, "mapui.km"),
      m: translate(l, "mapui.m"),
      zoomIn: translate(l, "mapui.zoom_in"),
      zoomOut: translate(l, "mapui.zoom_out"),
      north: translate(l, "mapui.north"),
      sources: translate(l, "mapui.sources"),
      title: translate(l, "mapui.title"),
    }),
    viewPadding: () =>
      viewPadding(innerWidth, innerHeight, compactFrame, timelineHeight(), cardOpen(), chipShown()),
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
  chipShown = () => !compactFrame && engine.store.get().focus !== null;
  cardOpen = () => {
    const s = engine.store.get();
    return s.selectedPlace !== null || s.tour !== null || personCard;
  };
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

/** The timeline's height as the app measures it (--hg-timeline-h), for the phone's padding. */
function timelineHeight(): number {
  const v = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--hg-timeline-h"),
  );
  return Number.isFinite(v) ? v : 124;
}
