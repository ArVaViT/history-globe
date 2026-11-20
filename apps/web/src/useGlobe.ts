import { createEngine, DEFAULT_STATE, type Camera, type Engine, type GlobeState } from "@hg/core";
import type { MapLibreRenderer } from "@hg/core/maplibre";
import { docsPath } from "@hg/model";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { DATA_URL, type LoadedData } from "./data";
import { firstPaint } from "./first-paint";
import { MAP_FONTS } from "./fonts";
import { translate } from "./i18n";
import { TERRAIN_ATTRIBUTION, TERRAIN_TILES } from "./terrain";
import type { UrlView } from "./url";
import { isNarrow, TIMELINE_FALLBACK_PX, viewPadding } from "./view-padding";

/** The view the map opens on: the link's, its language always settled (App.tsx). */
export type StartView = UrlView & { readonly locale: NonNullable<UrlView["locale"]> };

const DEFAULT_CAMERA: Camera = { center: [35.3, 32.0], zoom: 5.4, pitch: 40, bearing: -10 };
// On a phone, a little closer and a little north: the Holy Land in the middle of the open
// screen, Paul's Asia Minor above it.
const PHONE_CAMERA: Camera = { center: [35.6, 32.6], zoom: 5.0, pitch: 40, bearing: -10 };

// MapLibre is most of the JavaScript. It is a separate chunk, fetched in parallel with the
// data while the panels render without waiting for it, once the first screen (index.html)
// is on the screen (first-paint.ts).
const rendererModule = firstPaint().then(() => import("@hg/core/maplibre"));

export interface Globe {
  readonly engine: Engine;
  readonly renderer: MapLibreRenderer;
}

/**
 * What of the interface covers the map, beyond what the engine's state tells (App.tsx): the
 * camera's padding keeps room for it.
 */
export interface Layout {
  /** A compact frame on another site: no column, the chip above, the year below. */
  readonly compact: boolean;
  /** A map-only frame (`ui=map`): no card and no chapter bar, whatever is selected. */
  readonly mapOnly: boolean;
  /** A person's card: their places come with it, and the engine knows the places only. */
  readonly personCard: boolean;
  /** A panel open in the left column: the overview, a tool or the search. */
  readonly leftPanel: boolean;
  /** A place picked for a tool on a phone: its card stays closed, the map is the screen's. */
  readonly noCard: boolean;
  /** How far down the column's panels cover the map on a phone while it picks, in px. */
  readonly cover: number;
}

export function useGlobe(
  container: RefObject<HTMLDivElement | null>,
  data: LoadedData | null,
  initial: StartView,
): {
  globe: Globe | null;
  error: string | null;
  /** Changes the layout; the camera's padding follows at once. */
  setLayout: (change: Partial<Layout>) => void;
} {
  const [globe, setGlobe] = useState<Globe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef(initial);
  const layout = useRef<Layout>({
    compact: false,
    mapOnly: false,
    personCard: false,
    leftPanel: false,
    noCard: false,
    cover: 0,
  });
  const renderer = useRef<MapLibreRenderer | null>(null);
  const setLayout = useCallback((change: Partial<Layout>) => {
    const was = layout.current;
    const now = { ...was, ...change };
    if ((Object.keys(now) as (keyof Layout)[]).every((k) => now[k] === was[k])) return;
    layout.current = now;
    renderer.current?.syncPadding();
  }, []);

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
        created = createGlobe(MapLibreRenderer, el, data, init, () => layout.current);
        renderer.current = created.renderer;
        setGlobe(created);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
      if (renderer.current === created?.renderer) renderer.current = null;
      created?.engine.destroy();
      setGlobe(null);
    };
  }, [container, data]);

  return { globe, error, setLayout };
}

function createGlobe(
  Renderer: typeof MapLibreRenderer,
  el: HTMLDivElement,
  data: LoadedData,
  init: StartView,
  layout: () => Layout,
): Globe {
  // The padding asks whether a card is open; the engine comes after the renderer.
  let cardOpen = () => true;
  // The chapter's chip under the header (not in a frame, where it sits in the top bar).
  let chipShown = () => false;
  const renderer = new Renderer({
    container: el,
    camera: init.camera ?? (isNarrow() ? PHONE_CAMERA : DEFAULT_CAMERA),
    places: forMap(data.places),
    dataUrl: DATA_URL,
    terrainTiles: TERRAIN_TILES,
    terrainAttribution: TERRAIN_ATTRIBUTION,
    fonts: MAP_FONTS,
    initialYear: init.year ?? DEFAULT_STATE.year,
    initialLocale: init.locale,
    mapUi: (l) => ({
      km: translate(l, "mapui.km"),
      m: translate(l, "mapui.m"),
      zoomIn: translate(l, "mapui.zoom_in"),
      zoomOut: translate(l, "mapui.zoom_out"),
      north: translate(l, "mapui.north"),
      sources: translate(l, "mapui.sources"),
      title: translate(l, "mapui.title"),
      // The credits end with a link to the sources' page, in the language shown.
      sourcesPage: { href: docsPath(l, "sources"), label: translate(l, "mapui.sources_page") },
    }),
    viewPadding: () => {
      const l = layout();
      return viewPadding({
        embed: l.compact,
        timeline: timelineHeight(),
        card: cardOpen(),
        chip: chipShown(),
        panel: l.leftPanel,
        mapOnly: l.compact && l.mapOnly,
        cover: l.cover,
      });
    },
  });
  const engine = createEngine({
    renderer,
    places: new Map([...data.byId].map(([id, p]) => [id, p.info])),
    tours: data.tours,
    initial: {
      ...(init.year === undefined ? {} : { year: init.year }),
      locale: init.locale,
      ...(init.place === undefined ? {} : { selectedPlace: init.place }),
      ...(init.layers === undefined ? {} : { layers: init.layers }),
    },
  });
  chipShown = () => !layout().compact && engine.store.get().focus !== null;
  cardOpen = () => {
    const s = engine.store.get();
    if (s.tour !== null || layout().personCard) return true;
    return s.selectedPlace !== null && !layout().noCard;
  };
  // Until now the padding guessed a card was open: set the real one before the first frame,
  // then let the centre follow a card or a chapter's chip opening and closing.
  renderer.syncPadding(0);
  let framed = `${String(cardOpen())}${String(chipShown())}`;
  engine.store.subscribe(() => {
    const now = `${String(cardOpen())}${String(chipShown())}`;
    if (now === framed) return;
    framed = now;
    renderer.syncPadding();
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

/** The timeline's height as the app measures it (--hg-timeline-h), for the phone's padding. */
function timelineHeight(): number {
  const v = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--hg-timeline-h"),
  );
  return Number.isFinite(v) ? v : TIMELINE_FALLBACK_PX;
}
