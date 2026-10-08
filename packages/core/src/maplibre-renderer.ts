import { elevationReader, pointsAlongPath } from "./elevation.ts";
import { routeWalker } from "./route-walker.ts";
import { POLITY_SPLIT_YEAR, type Locale } from "@hg/model";
import type { Feature, FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import type { Camera, LonLat, PolityName, Renderer, RendererEvents } from "./renderer.ts";
import type { LayerVisibility } from "./state.ts";
import { buildStyle, layersInGroup, MAP_FONT, seaLabels, type StyleOptions } from "./style.ts";
import { drawIcon } from "./icons.ts";
import { thinMajors } from "./majors.ts";
import { WheelClassifier } from "./wheel.ts";

const READY_FALLBACK_MS = 8000;

/** The Via Appia, 312 BC: Roman roads are drawn from then on (style.ts). */
const ROADS_FROM = -311;

/** MapLibre's own interface words: the app gives them in the reader's language (`mapUi`). */
export interface MapUiWords {
  readonly km: string;
  readonly m: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly north: string;
  readonly sources: string;
  readonly title: string;
}
const ENGLISH_UI: MapUiWords = {
  km: "km",
  m: "m",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  north: "Reset bearing to north",
  sources: "Map sources",
  title: "Map",
};
/** The words as MapLibre keys them. */
const toMapLibre = (w: MapUiWords) =>
  ({
    "ScaleControl.Kilometers": w.km,
    "ScaleControl.Meters": w.m,
    "NavigationControl.ZoomIn": w.zoomIn,
    "NavigationControl.ZoomOut": w.zoomOut,
    "NavigationControl.ResetBearing": w.north,
    "AttributionControl.ToggleAttribution": w.sources,
    "Map.Title": w.title,
  }) as const;

/** The buttons MapLibre labelled when it made them, to relabel on a language change. */
const MAP_UI_TITLES = [
  [".maplibregl-ctrl-zoom-in", "NavigationControl.ZoomIn"],
  [".maplibregl-ctrl-zoom-out", "NavigationControl.ZoomOut"],
  [".maplibregl-ctrl-compass", "NavigationControl.ResetBearing"],
  [".maplibregl-ctrl-attrib-button", "AttributionControl.ToggleAttribution"],
] as const;

const PLACE_LAYERS = [
  "place-label-major",
  "place-dot",
  "place-dot-past",
  "landmark-icon",
  "place-label",
  "place-label-past",
  "place-label-picked",
  "place-label-area",
  "place-label-water",
  "place-label-sea",
  "place-label-landmark",
  "place-label-selected",
];

export interface MapLibreRendererOptions extends StyleOptions {
  readonly container: HTMLElement;
  readonly camera: Camera;
  /** Place features with a numeric top-level `id` (feature-state) and `properties.id`. */
  readonly places: FeatureCollection;
  /** Screen edges covered by the interface, so a flight puts its target where it shows. */
  readonly viewPadding?: () => { top: number; bottom: number; left: number; right: number };
  /** MapLibre's words in a language; English when not given. */
  readonly mapUi?: (locale: string) => MapUiWords;
}

type Box = readonly [number, number, number, number];
/** A shape's bounding box, west, south, east, north. */
function bboxOf(g: GeoJSON.Geometry): Box {
  const polys =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of polys)
    for (const [x = 0, y = 0] of rings[0] ?? []) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
}
const inBox = (b: Box, x: number, y: number) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/** Whether a polygon (a tile's piece of a shape) covers a point: even-odd over its rings. */
function covers(g: GeoJSON.Geometry, lon: number, lat: number): boolean {
  const polys =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some((rings) => {
    let inside = false;
    for (const ring of rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi = 0, yi = 0] = ring[i] ?? [];
        const [xj = 0, yj = 0] = ring[j] ?? [];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
    return inside;
  });
}

export class MapLibreRenderer implements Renderer {
  readonly map: MLMap;
  private readonly featureIdByPlace = new Map<string, number>();
  private readonly places: FeatureCollection;
  /** The great towns as last drawn (majors.ts): written again only when they change. */
  private majorsNow = "";
  private selectedPlace: string | null = null;
  private readonly groups: Record<string, string[]>;
  private selected: number | null = null;
  private hovered: number | null = null;
  private hoveredPlace: string | null = null;
  private polityShown = false;
  private ancientShown: string | null = null;
  private battleShown = false;
  private readonly handlers: { [E in keyof RendererEvents]: Set<RendererEvents[E]> } = {
    pick: new Set(),
    hover: new Set(),
    hoverPolity: new Set(),
    hoverAncient: new Set(),
    hoverBattle: new Set(),
    cameraChanged: new Set(),
    ready: new Set(),
  };
  private pendingYear: number | null = null;
  private pending: (() => void)[] = [];
  private loaded = false;
  private destroyed = false;
  /** Which framing is current: a correction after a fit runs only if no move began since. */
  private fitId = 0;
  /** While a sheet is being drawn: the resize handler must not put the screen's padding back. */
  private printing = false;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  /** The edge labels last written (nameEdgeStates): unchanged, nothing is set. */
  private edgeLabels = "[]";
  /** Whether the view changed since the edge labels were worked out. */
  private edgeDirty = true;
  private readonly viewPadding: MapLibreRendererOptions["viewPadding"];
  private pulse: { frame: number; markers: maplibregl.Marker[] } | null = null;
  private readonly dataUrl: string;
  private lateStates: Promise<boolean> | null = null;
  private readonly roads: Record<"major" | "minor", "no" | "loading" | "yes"> = {
    major: "no",
    minor: "no",
  };
  private year = 0;
  private roadsOn = true;
  private ancient: "no" | "loading" | "yes" = "no";
  private ancientOn = true;
  private battles: "no" | "loading" | "yes" = "no";
  /** The Bible alone (a setting): the ancient world off, whatever its switch says. */
  private bibleOnly = false;
  private layersNow: LayerVisibility | null = null;
  private battlesOn = true;
  /** A tour's numbered stops are drawn: the route has stops and the routes layer is on. */
  private stops = { route: false, layer: true, shown: false };

  /** Heights above sea level from the relief's tiles (elevation.ts), for the tours. */
  readonly heightsAt: (points: readonly LonLat[]) => Promise<(number | null)[]>;
  /**
   * The relief along the straight line between two stops, `n` heights from `a` to `b`, for
   * a leg's profile: zoom 9 (about 160 m a pixel), so a long leg takes a dozen tiles, not
   * a hundred.
   */
  /** Heights at `n` points along a way: two points for a straight line, or a road's. */
  readonly profileAlong: (path: readonly LonLat[], n: number) => Promise<(number | null)[]>;

  private readonly mapUi: (locale: string) => MapUiWords;

  constructor(o: MapLibreRendererOptions) {
    this.mapUi = o.mapUi ?? (() => ENGLISH_UI);
    this.heightsAt = elevationReader(o.terrainTiles);
    const coarse = elevationReader(o.terrainTiles, 9);
    this.profileAlong = (path, n) => coarse(pointsAlongPath(path, n));
    this.viewPadding = o.viewPadding;
    this.dataUrl = o.dataUrl;
    const style = buildStyle(o);
    this.groups = {
      borders: layersInGroup(style, "borders"),
      places: layersInGroup(style, "places"),
      relief: layersInGroup(style, "relief"),
      routes: layersInGroup(style, "routes"),
      roads: layersInGroup(style, "roads"),
      ancient: layersInGroup(style, "ancient"),
      battles: layersInGroup(style, "battles"),
    };
    this.places = o.places;
    this.year = o.initialYear;
    for (const f of o.places.features) {
      const pid = (f.properties as { id?: string } | null)?.id;
      if (pid !== undefined && typeof f.id === "number") this.featureIdByPlace.set(pid, f.id);
    }
    this.map = new maplibregl.Map({
      container: o.container,
      style,
      center: [...o.camera.center],
      zoom: o.camera.zoom,
      pitch: o.camera.pitch,
      bearing: o.camera.bearing,
      maxPitch: 80,
      attributionControl: { compact: true },
      // MapLibre's words in the page's language from the first frame: the scale draws
      // before setLocale runs and would stay "km" until the map moved.
      locale: toMapLibre(this.mapUi(o.initialLocale)),
      canvasContextAttributes: { antialias: true },
      // Wheel handled below: two fingers pan, a pinch or a mouse wheel zooms.
      scrollZoom: false,
    });
    // The padding a flight uses stays with the map (the centre is the open part of the
    // screen): set it from the start, so a link opens as a flight would, and on resize.
    const pad = o.viewPadding;
    if (pad) {
      this.map.setPadding(pad());
      // setPadding stops a flight: during one, wait for it to end.
      const apply = () => {
        this.map.setPadding(pad());
      };
      let waiting = false;
      this.map.on("resize", () => {
        if (this.printing) return;
        if (!this.map.isMoving()) {
          apply();
        } else if (!waiting) {
          waiting = true;
          this.map.once("moveend", () => {
            waiting = false;
            apply();
          });
        }
      });
    }
    // MapLibre unfolds the compact attribution once by itself, when it first fills: fold
    // it back, so the (i) only opens when someone presses it.
    const attrib = this.map.getContainer().querySelector(".maplibregl-ctrl-attrib");
    if (attrib) {
      const fold = new MutationObserver(() => {
        if (!attrib.classList.contains("maplibregl-compact-show")) return;
        attrib.classList.remove("maplibregl-compact-show");
        fold.disconnect();
      });
      fold.observe(attrib, { attributes: true, attributeFilter: ["class"] });
    }
    // Place icons are drawn when the style first asks for them.
    this.map.setMissingStyleImageResolver((id) => {
      if (this.map.hasImage(id)) return;
      const img = drawIcon(id);
      if (img) this.map.addImage(id, img, { sdf: true, pixelRatio: 2 });
    });
    const wheel = new WheelClassifier();
    this.map.getCanvasContainer().addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const intent = wheel.classify(e, e.timeStamp);
        if (intent.kind === "pan") {
          this.map.panBy([intent.dx, intent.dy], { animate: false });
          return;
        }
        // Zoom around the pointer. On the globe MapLibre ignores `around`, so keep the
        // point under the pointer by hand: zoom, then move it back under the pointer.
        const rect = this.map.getCanvasContainer().getBoundingClientRect();
        const point: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
        const anchor = this.map.unproject(point);
        this.map.jumpTo({ zoom: this.map.getZoom() + intent.dz });
        // Two passes: on a sphere one screen-space shift does not land exactly.
        for (let pass = 0; pass < 2; pass++) {
          const moved = this.map.project(anchor);
          this.map.panBy([moved.x - point[0], moved.y - point[1]], { animate: false });
        }
      },
      { passive: false },
    );
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    this.map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // The style is enough to set data and run queued work. "load" also waits for the
    // tiles in view, and in some views (zoom 22 over a pole) it never comes.
    this.map.once("style.load", () => {
      void (this.map.getSource("places") as GeoJSONSource).setData(o.places);
      void this.map.getSource<GeoJSONSource>("sea-labels")?.setData(seaLabels(o.places));
      this.fillMajors();
      this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.5 });
      this.loaded = true;
      for (const run of this.pending) run();
      this.pending = [];
      // A link may open close in, on a Roman year, without moving the map afterwards.
      this.loadRoads();
      this.loadAncient();
      this.loadBattles();
    });
    // Ready at the first frame that shows the places, or at the first idle frame if that
    // comes sooner. Waiting for idle alone kept the loading state up until every relief
    // tile had arrived: some 7 s on a 4G line, with the map long in view. Some views
    // never go idle (a camera over the pole keeps re-rendering), so the loading state
    // also ends a few seconds after creation.
    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      this.map.off("sourcedata", onPlaces);
      for (const h of this.handlers.ready) h();
    };
    const onPlaces = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === "places" && this.map.isSourceLoaded("places"))
        this.map.once("render", fireReady);
    };
    this.map.on("sourcedata", onPlaces);
    this.map.once("idle", fireReady);
    this.readyTimer = setTimeout(fireReady, READY_FALLBACK_MS);

    // One handler over all place layers: per-layer mouseleave fired after the next
    // layer's mousemove, so moving from a label to its own dot dropped the hover.
    // A name pressed is its place; dots on one point (Jerusalem, Zion, the City of David)
    // give the most named, not whichever was drawn last.
    const placeAt = (e: MapMouseEvent) => {
      if (!this.loaded) return undefined;
      const fs = this.map.queryRenderedFeatures(e.point, { layers: PLACE_LAYERS });
      return (
        fs.find((f) => f.layer.id.startsWith("place-label")) ??
        fs.reduce<(typeof fs)[number] | undefined>(
          (a, f) => (a && Number(a.properties.verses) >= Number(f.properties.verses) ? a : f),
          undefined,
        )
      );
    };
    // A battle's mark opens the place it was fought at (its card tells the battle).
    // A little room round the point: a finger on a phone lands near the mark, not on it.
    const battleAt = (e: MapMouseEvent) =>
      this.loaded && this.battles === "yes" && this.battlesOn
        ? (this.map.queryRenderedFeatures(
            [
              [e.point.x - 8, e.point.y - 8],
              [e.point.x + 8, e.point.y + 8],
            ],
            { layers: ["battle-icon"] },
          )[0]?.properties as
            | { place?: string; en?: string; ru?: string; year?: number; approx?: boolean }
            | undefined)
        : undefined;
    this.map.on("click", (e: MapMouseEvent) => {
      const id = battleAt(e)?.place ?? (placeAt(e)?.properties as { id?: string } | undefined)?.id;
      if (id) {
        this.hideAncient();
        // A tap on a phone also "hovers": its tip would stay over the card it opens.
        if (e.originalEvent instanceof PointerEvent && e.originalEvent.pointerType === "touch") {
          this.hoveredPlace = null;
          for (const h of this.handlers.hover) h(null, null);
          this.battleShown = false;
          for (const h of this.handlers.hoverBattle) h(null, null);
        }
        for (const h of this.handlers.pick) h(id);
      }
      // A tap names an ancient site as hovering does: a phone has no hover.
      else this.showAncient(e);
    });
    // A tip would otherwise stay over a map that moved away: a tap on a phone, or a click
    // that flies to the place picked while the pointer rests where it was.
    this.map.on("movestart", () => {
      this.hideAncient();
      if (this.hoveredPlace !== null) {
        this.hoveredPlace = null;
        for (const h of this.handlers.hover) h(null, null);
      }
      if (this.battleShown) {
        this.battleShown = false;
        for (const h of this.handlers.hoverBattle) h(null, null);
      }
    });
    this.map.on("mousemove", (e: MapMouseEvent) => {
      const f = placeAt(e);
      const fid = typeof f?.id === "number" ? f.id : null;
      const battle = battleAt(e);
      this.map.getCanvas().style.cursor = f || battle ? "pointer" : "";
      // Over a battle's mark its name is told, not the place's under it.
      const named = battle?.en
        ? {
            en: battle.en,
            ru: battle.ru ?? battle.en,
            year: battle.year ?? 0,
            approx: battle.approx === true,
          }
        : null;
      if (named || this.battleShown) {
        this.battleShown = named !== null;
        for (const h of this.handlers.hoverBattle)
          h(named, named ? { x: e.point.x, y: e.point.y } : null);
      }
      if (fid !== this.hovered) this.setHoverState(fid);
      const pid = (f?.properties as { id?: string } | undefined)?.id ?? null;
      const at = { x: e.point.x, y: e.point.y };
      // Over no biblical place, an ancient site is named; over neither, the states under
      // the pointer: their labels often give way to town names.
      const site = pid ? undefined : this.showAncient(e);
      const states = pid || site ? null : this.politiesAt(e);
      // Nothing to say twice: "no state here" is sent once, not on every mouse move.
      if (states || this.polityShown) {
        this.polityShown = states !== null;
        for (const h of this.handlers.hoverPolity) h(states, states ? at : null);
      }
      if (pid === this.hoveredPlace && pid === null) return;
      this.hoveredPlace = pid;
      for (const h of this.handlers.hover) h(pid, pid ? at : null);
    });
    this.map.getCanvasContainer().addEventListener("mouseleave", () => {
      this.map.getCanvas().style.cursor = "";
      this.setHoverState(null);
      this.hoveredPlace = null;
      for (const h of this.handlers.hover) h(null, null);
      this.polityShown = false;
      for (const h of this.handlers.hoverPolity) h(null, null);
      this.ancientShown = null;
      for (const h of this.handlers.hoverAncient) h(null, null);
      this.battleShown = false;
      for (const h of this.handlers.hoverBattle) h(null, null);
    });
    // Edge labels are worked out again only when the view or what it shows has changed:
    // "idle" also follows a hover or the edge labels' own new data.
    this.map.on("idle", () => {
      if (!this.edgeDirty || this.printing) return;
      this.edgeDirty = false;
      this.nameEdgeStates();
    });
    for (const event of ["moveend", "resize"] as const)
      this.map.on(event, () => {
        this.edgeDirty = true;
      });
    this.map.on("sourcedata", (e) => {
      if (e.sourceId === "polities" && e.isSourceLoaded) this.edgeDirty = true;
    });
    // A trackpad sends dozens of small moves a second: report the camera once it rests.
    this.map.on("moveend", () => {
      this.loadRoads();
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        if (this.destroyed) return;
        const cam = this.getCamera();
        for (const h of this.handlers.cameraChanged) h(cam);
      }, 150);
    });
  }

  private politiesAt(e: MapMouseEvent): PolityName[] | null {
    return this.politiesAtPixel(e.point);
  }

  /**
   * The states drawn at a place for the year now shown, topmost first: null when the place
   * is off screen, at sea or the borders are hidden. Read after the map has drawn the year.
   */
  politiesAtPoint(at: LonLat): Promise<PolityName[] | null> {
    return new Promise((resolve) => {
      this.whenLoaded(() => {
        const read = () => {
          if (this.destroyed) {
            resolve(null);
            return;
          }
          const pt = this.map.project([at[0], at[1]]);
          const box = this.map.getCanvas();
          const inside =
            pt.x >= 0 && pt.y >= 0 && pt.x <= box.clientWidth && pt.y <= box.clientHeight;
          resolve(inside ? this.politiesAtPixel(pt) : null);
        };
        // After AD 500 the later states must be in before the borders are read.
        const ready = this.year > POLITY_SPLIT_YEAR ? this.loadLateStates() : Promise.resolve(true);
        void ready.then(() => {
          this.map.once("idle", read);
          this.map.triggerRepaint();
        });
      });
    });
  }

  private politiesAtPixel(point: maplibregl.PointLike): PolityName[] | null {
    if (!this.loaded || this.map.getLayoutProperty("polity-fill", "visibility") === "none")
      return null;
    // States are drawn under the sea: over water there is nothing to name.
    if (this.map.queryRenderedFeatures(point, { layers: ["water"] }).length > 0) return null;
    const seen = new Set<string>();
    const out: PolityName[] = [];
    for (const f of this.map.queryRenderedFeatures(point, { layers: ["polity-fill"] })) {
      const p = f.properties as { name?: string; name_ru?: string; v?: string; v_ru?: string };
      if (!p.name || seen.has(p.name)) continue;
      seen.add(p.name);
      out.push({
        name: p.name,
        ...(p.name_ru ? { nameRu: p.name_ru } : {}),
        ...(p.v ? { vassal: p.v } : {}),
        ...(p.v_ru ? { vassalRu: p.v_ru } : {}),
      });
    }
    return out.length > 0 ? out : null;
  }

  /**
   * Names a large state that the view shows unnamed: its own label points off screen
   * (Parthia east of the first view, the Sasanians at AD 400) or crowded out. A point
   * inside the part in view, in the open (not under a panel, not at sea), written once
   * the map rests. Over 28 years at the first view, 12 large states went unnamed before.
   */
  private nameEdgeStates(): void {
    const source = this.map.getSource<GeoJSONSource>("polity-edge-labels");
    if (!source || this.destroyed) return;
    const canvas = this.map.getCanvas();
    const box = canvas.getBoundingClientRect();
    // One query for the view, then the samples tested in memory: a query per sample took
    // half a second.
    const shapes = (layer: string) =>
      this.map.getLayer(layer) && this.map.getLayoutProperty(layer, "visibility") !== "none"
        ? this.map.queryRenderedFeatures({ layers: [layer] })
        : [];
    const states = shapes("polity-fill");
    const water = shapes("water").map((f) => ({ f, box: bboxOf(f.geometry) }));
    const seen = new Map<string, { p: Record<string, unknown>; at: [number, number][] }>();
    let cells = 0;
    const step = 80;
    if (states.length > 0)
      for (let x = step / 2; x < box.width; x += step)
        for (let y = step / 2; y < box.height; y += step) {
          if (document.elementFromPoint(box.left + x, box.top + y) !== canvas) continue;
          const { lng, lat } = this.map.unproject([x, y]);
          // Off the globe (in space, or the sky when tilted) a pixel unprojects to the
          // horizon: such a sample is not map.
          const back = this.map.project([lng, lat]);
          if (Math.hypot(back.x - x, back.y - y) > 2) continue;
          cells += 1;
          if (water.some(({ f, box }) => inBox(box, lng, lat) && covers(f.geometry, lng, lat)))
            continue;
          // A state comes in a piece per tile: counted once a sample.
          const here = new Set<string>();
          for (const f of states) {
            const name = (f.properties as { name?: string }).name;
            if (!name || here.has(name) || !covers(f.geometry, lng, lat)) continue;
            here.add(name);
            const s = seen.get(name) ?? { p: f.properties, at: [] as [number, number][] };
            s.at.push([x, y]);
            seen.set(name, s);
          }
        }
    const named = new Set(
      this.map
        .queryRenderedFeatures({ layers: ["polity-label", "polity-label-pin"] })
        .map((f) => (f.properties as { name?: string }).name),
    );
    // The names already written: the label goes where it is farthest from them, near the
    // middle of the state's part in view. At its middle alone Rome lost to the towns of
    // Judea on a phone.
    // Only the names placed before it (the layers above): it cannot push those away, so the
    // choice does not swing between two points as it pushes a town's name in and out.
    const order = this.map.getLayersOrder();
    const symbols = order
      .slice(order.indexOf("polity-label-edge") + 1)
      .filter((id) => this.map.getLayer(id)?.type === "symbol");
    const written = this.map
      .queryRenderedFeatures({ layers: symbols })
      .flatMap((f) => (f.geometry.type === "Point" ? [f.geometry.coordinates] : []))
      .map(([lon = 0, lat = 0]) => this.map.project([lon, lat]));
    // Room to the names around and to the edges of the screen: a name at the edge is cut.
    const room = ([x, y]: [number, number]) =>
      Math.min(
        160,
        x,
        box.width - x,
        y * 2,
        (box.height - y) * 2,
        ...written.map((q) => Math.hypot(q.x - x, (q.y - y) * 2)),
      );
    const features: GeoJSON.Feature[] = [];
    for (const [name, { p, at }] of seen) {
      // A state over a twentieth of the open map at least: a sliver at the edge goes unnamed.
      if (named.has(name) || at.length < Math.max(3, cells / 20)) continue;
      const mx = at.reduce((a, [x]) => a + x, 0) / at.length;
      const my = at.reduce((a, [, y]) => a + y, 0) / at.length;
      const score = (q: [number, number]) => room(q) - 0.25 * Math.hypot(q[0] - mx, q[1] - my);
      const [x, y] = at.reduce((a, b) => (score(b) > score(a) ? b : a));
      const { lng, lat } = this.map.unproject([x, y]);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [+lng.toFixed(3), +lat.toFixed(3)] },
        properties: {
          name,
          name_ru: p.name_ru,
          y0: p.y0,
          y1: p.y1,
          size: 3.4,
          ...(p.v ? { v: p.v, v_ru: p.v_ru } : {}),
        },
      });
    }
    const data = JSON.stringify(features);
    if (data === this.edgeLabels) return;
    this.edgeLabels = data;
    void source.setData({ type: "FeatureCollection", features });
  }

  private whenLoaded(run: () => void): void {
    if (this.destroyed) return;
    if (this.loaded) run();
    else this.pending.push(run);
  }

  private setHoverState(fid: number | null): void {
    // The great towns are drawn from their own source, with the places' ids.
    for (const source of ["places", "majors"]) {
      if (this.hovered !== null)
        this.map.setFeatureState({ source, id: this.hovered }, { hover: false });
      if (fid !== null) this.map.setFeatureState({ source, id: fid }, { hover: true });
    }
    this.hovered = fid;
  }

  private paddingQueued = false;

  /**
   * The open part of the screen changed (a card or a panel opened or closed): the centre
   * glides with it. During a move it waits for the move to end; setPadding would stop it.
   */
  syncPadding(duration = 450): void {
    const pad = this.viewPadding?.();
    if (!pad || this.printing) return;
    if (this.map.isMoving()) {
      if (this.paddingQueued) return;
      this.paddingQueued = true;
      this.map.once("moveend", () => {
        this.paddingQueued = false;
        this.syncPadding(duration);
      });
      return;
    }
    const now = this.map.getPadding();
    if (
      now.top === pad.top &&
      now.bottom === pad.bottom &&
      now.left === pad.left &&
      now.right === pad.right
    )
      return;
    if (duration > 0) this.map.easeTo({ padding: pad, duration });
    else this.map.setPadding(pad);
  }

  setYear(year: number): void {
    this.edgeDirty = true;
    // Dragging the slider fires many input events per frame; apply at most one year per
    // animation frame so the map re-filters once, not dozens of times.
    const schedule = this.pendingYear === null;
    this.pendingYear = year;
    if (!schedule) return;
    requestAnimationFrame(() => {
      const y = this.pendingYear;
      this.pendingYear = null;
      if (y === null || this.destroyed) return;
      this.whenLoaded(() => {
        this.map.setGlobalStateProperty("year", y);
      });
      if (y > POLITY_SPLIT_YEAR) void this.loadLateStates();
      // The site named may not stand in the new year.
      if (y !== this.year) this.hideAncient();
      this.year = y;
      this.whenLoaded(() => {
        this.fillMajors();
      });
      this.loadRoads();
    });
  }

  private hideAncient(): void {
    if (this.ancientShown === null) return;
    this.ancientShown = null;
    for (const h of this.handlers.hoverAncient) h(null, null);
  }

  /** Names the ancient site under the pointer (or stops naming one); returns it. */
  private showAncient(e: MapMouseEvent) {
    const site = this.ancientAt(e);
    const siteId = (site?.properties as { id?: string } | undefined)?.id ?? null;
    if (siteId === this.ancientShown) return site;
    this.ancientShown = siteId;
    const p = site?.properties as
      | { en: string; ru: string; from: number; to: number; approx?: boolean; kind?: string }
      | undefined;
    const value =
      p && siteId
        ? {
            en: p.en,
            ru: p.ru,
            from: p.from,
            to: p.to,
            approx: p.approx === true,
            kind: p.kind ?? "",
          }
        : null;
    const at = { x: e.point.x, y: e.point.y };
    for (const h of this.handlers.hoverAncient) h(value, value ? at : null);
    return site;
  }

  private ancientAt(e: MapMouseEvent) {
    if (!this.loaded || this.ancient !== "yes" || !this.ancientOn) return undefined;
    return this.map.queryRenderedFeatures(e.point, { layers: ["ancient-label"] })[0];
  }

  /** The battles (a few kB) load once the map is up, while their layer is on. */
  private loadBattles(): void {
    if (!this.loaded || !this.battlesOn || this.battles !== "no") return;
    this.battles = "loading";
    void this.fill("battles", "battles.geojson").then((ok) => {
      this.battles = ok ? "yes" : "no";
    });
  }

  /** The Bible alone (a setting): the battles it does not tell step off the map. */
  setBibleOnly(on: boolean): void {
    this.bibleOnly = on;
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("bibleOnly", on);
    });
    if (this.layersNow) this.setLayers(this.layersNow);
  }

  /** Names kept off the map (a quiz's answers until given): place ids, or none. */
  setHiddenNames(ids: readonly string[]): void {
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("hiddenNames", [...ids]);
    });
  }

  /** The ancient sites (some 50 kB) load once the map is up, while their layer is on. */
  private loadAncient(): void {
    if (!this.loaded || !this.ancientOn || this.ancient !== "no") return;
    this.ancient = "loading";
    void this.fill("ancient", "ancient.geojson").then((ok) => {
      this.ancient = ok ? "yes" : "no";
    });
  }

  /**
   * The Roman roads load the first time they could show: the layer on, the year after
   * 312 BC and the map close enough, the main roads from zoom 4.5, the others from 6.5.
   */
  private loadRoads(): void {
    if (!this.loaded || !this.roadsOn || this.year < ROADS_FROM) return;
    const zoom = this.map.getZoom();
    for (const [kind, from] of [
      ["major", 4.5],
      ["minor", 6.5],
    ] as const) {
      if (this.roads[kind] !== "no" || zoom < from) continue;
      this.roads[kind] = "loading";
      void this.fill(`roads-${kind}`, `roads-${kind}.geojson`).then((ok) => {
        this.roads[kind] = ok ? "yes" : "no";
      });
    }
  }

  /**
   * Point a source at a data file, parsed in MapLibre's worker, once the file answers:
   * false when it does not, so the caller can try again (setData(url) itself reports a
   * failed fetch only as an error event).
   */
  private async fill(source: string, file: string): Promise<boolean> {
    const url = `${this.dataUrl}/${file}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    const src = this.map.getSource<GeoJSONSource>(source);
    if (!src || this.destroyed) return false;
    await src.setData(url);
    return true;
  }

  /**
   * The states after AD 500 ship apart from the first frame's (scripts/build-content.ts):
   * the first time the year passes AD 500 the sources switch to the files with every
   * state, parsed in the worker. Resolves when they are in; tried again after a failure.
   */
  private loadLateStates(): Promise<boolean> {
    if (!this.lateStates) {
      const loading: Promise<boolean> = new Promise<boolean>((resolve) => {
        this.whenLoaded(() => {
          void Promise.all([
            this.fill("polities", "polities-all.geojson"),
            this.fill("polity-labels", "polity-labels-all.geojson"),
          ]).then(([a, b]) => {
            resolve(a && b);
          });
        });
      }).then((ok) => {
        if (!ok) this.lateStates = null;
        return ok;
      });
      this.lateStates = loading;
    }
    return this.lateStates;
  }

  setLocale(locale: Locale): void {
    this.edgeDirty = true;
    // MapLibre's own words (the scale's "km", the buttons' tooltips) in the same language.
    const ui = toMapLibre(this.mapUi(locale));
    Object.assign(this.map._locale, ui);
    // The canvas is named for screen readers by MapLibre at start: renamed with the language.
    this.map.getCanvas().setAttribute("aria-label", ui["Map.Title"]);
    // The app moves the controls out of the map's container (into its own bar): looked
    // for in the whole page, or a switch of language never relabelled them.
    for (const [selector, key] of MAP_UI_TITLES)
      for (const button of this.map.getContainer().ownerDocument.querySelectorAll(selector)) {
        button.setAttribute("title", ui[key]);
        button.setAttribute("aria-label", ui[key]);
      }
    // The scale writes its unit when the map moves: once now, in the new words.
    this.map.fire("move");
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("locale", locale);
    });
  }

  setLayers(layers: LayerVisibility): void {
    this.edgeDirty = true;
    this.layersNow = layers;
    this.whenLoaded(() => {
      for (const [group, ids] of Object.entries(this.groups)) {
        // The Bible alone (a setting) keeps the ancient world off without touching the
        // reader's own switch: a link they share still says what they chose.
        const visible =
          layers[group as keyof LayerVisibility] && !(group === "ancient" && this.bibleOnly);
        for (const id of ids)
          this.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
      // The lights along a route go with the routes layer.
      this.map.getContainer().classList.toggle("hg-no-routes", !layers.routes);
      this.stops.layer = layers.routes;
      this.showStops();
      if (layers.relief) this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.5 });
      else this.map.setTerrain(null);
      this.roadsOn = layers.roads;
      this.loadRoads();
      this.ancientOn = layers.ancient && !this.bibleOnly;
      this.loadAncient();
      this.battlesOn = layers.battles;
      this.loadBattles();
      // A tip over a site goes with its layer.
      if (!this.ancientOn) this.hideAncient();
    });
  }

  setSelected(placeId: string | null): void {
    this.whenLoaded(() => {
      if (this.selected !== null) {
        this.map.setFeatureState({ source: "places", id: this.selected }, { selected: false });
      }
      this.selected = placeId ? (this.featureIdByPlace.get(placeId) ?? null) : null;
      if (this.selected !== null) {
        this.map.setFeatureState({ source: "places", id: this.selected }, { selected: true });
      }
      // Drives the "sites of the selected place" layers (disputed locations).
      this.map.setGlobalStateProperty("selected", placeId ?? "");
      this.selectedPlace = placeId;
      this.fillMajors();
    });
  }

  /**
   * The great towns standing in the year, each with the zooms its ring is drawn at
   * (majors.ts): written to their source only when that changes, a few times a century
   * of the slider, not on every step.
   */
  private fillMajors(): void {
    const majors = thinMajors(this.places, this.year, this.selectedPlace);
    const key = majors.features
      .map((f) => `${String(f.id)}:${String(f.properties?.["keep"])}`)
      .join();
    if (key === this.majorsNow) return;
    this.majorsNow = key;
    void this.map.getSource<GeoJSONSource>("majors")?.setData(majors);
  }

  flyTo(target: Partial<Camera> & { readonly center: LonLat }, durationMs?: number): void {
    // A new flight: a correction still waiting from an earlier fit is no longer wanted.
    this.fitId++;
    this.map.flyTo({
      center: [...target.center],
      ...(target.zoom === undefined ? {} : { zoom: target.zoom }),
      ...(target.pitch === undefined ? {} : { pitch: target.pitch }),
      ...(target.bearing === undefined ? {} : { bearing: target.bearing }),
      // Without an explicit duration the flight takes as long as the distance needs:
      // a hop to the next village is quick, Jerusalem → Rome is not rushed.
      ...(durationMs === undefined ? { speed: 1.1, maxDuration: 4500 } : { duration: durationMs }),
      ...(this.viewPadding ? { padding: this.viewPadding() } : {}),
      curve: 1.6,
      essential: true,
    });
  }

  reveal(at: LonLat): void {
    const pad = this.viewPadding?.();
    if (!pad) return;
    const p = this.map.project([at[0], at[1]]);
    const box = this.map.getContainer();
    if (
      p.x < pad.left ||
      p.y < pad.top ||
      p.x > box.clientWidth - pad.right ||
      p.y > box.clientHeight - pad.bottom
    )
      this.map.easeTo({ center: [at[0], at[1]], padding: pad, duration: 700 });
  }

  fitTo(points: readonly LonLat[]): void {
    if (points.length === 0) return;
    // This framing is now the current one: setPadding and fitBounds below stop any move
    // under way, and the moveend that sends must not run an earlier fit's correction.
    const id = ++this.fitId;
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    // The interface's edges as they are now: the timeline grows once its period line and
    // chip are in, after the padding was first set.
    const pad = this.viewPadding?.();
    if (pad) this.map.setPadding(pad);
    // On a phone the open strip above the card is short: the margins shrink with it, or
    // the places no longer fit and the flight zooms in on a corner of them.
    const free = this.map.getContainer().clientHeight - (pad?.top ?? 0) - (pad?.bottom ?? 0);
    const m = Math.max(8, Math.min(60, free * 0.12));
    const margin = { top: Math.min(100, m * 1.6), bottom: m + 16, left: m, right: m };
    this.map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        // A margin only: MapLibre adds the map's own padding (the interface's edges, set
        // in the constructor) to this, so passing viewPadding here would count it twice.
        // More at the top, where the chapter's chip sits on a phone, and below, where the
        // names of the lowest places hang under their points.
        padding: margin,
        maxZoom: 9,
        pitch: 30,
        bearing: 0,
        duration: 1600,
        essential: true,
      },
    );
    // On the globe and tilted, fitBounds frames the box only roughly: in a small frame
    // the nearest place ended under the timeline. Once there, measure where the places
    // landed and move once more to bring them all inside; not if another move (a flight,
    // a print) began meanwhile, nor long after, when fitBounds could not move at all.
    if (!this.map.isMoving()) {
      this.correctFit(points, margin);
      return;
    }
    this.map.once("moveend", () => {
      if (id === this.fitId) this.correctFit(points, margin);
    });
  }

  /**
   * The view for a printed sheet: every point framed on the whole canvas (no interface
   * covers paper), seen from straight above. Resolves once drawn, with the way back to the
   * view as it was.
   */
  async frameForPrint(
    points: readonly LonLat[],
    /** Numbered marks for the sheet (a chapter's places in reading order), taken away after. */
    marks: readonly { at: LonLat; n: number }[] = [],
    /**
     * An outline map for a class: every name on the map hidden, the numbers of the stops
     * and marks kept, for pupils to write the names in.
     */
    blank = false,
  ): Promise<() => void> {
    // A flight under way ends first, at its target: the view to come back to.
    this.fitId++;
    if (this.map.isMoving())
      await new Promise<void>((resolve) => {
        this.map.once("moveend", () => {
          resolve();
        });
      });
    this.map.stop();
    this.printing = true;
    const before = {
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      pitch: this.map.getPitch(),
      bearing: this.map.getBearing(),
      padding: this.map.getPadding(),
    };
    // A smaller canvas for the sheet: on A4 the names come out half as large again as
    // they would from a full screen (1000 px across ≈ 186 mm).
    const box = this.map.getContainer();
    const size = { width: box.style.width, height: box.style.height };
    box.style.width = "1000px";
    box.style.height = "625px";
    this.map.resize();
    // MapLibre's own watcher notices the new size a little later (throttled to 50 ms):
    // the framing waits for it, or a late resize would reframe the sheet.
    await new Promise((resolve) => setTimeout(resolve, 120));
    const MARKS = "print-marks";
    const KEEP = new Set(["route-num", "route-also", MARKS, `${MARKS}-also`]);
    const hidden = blank
      ? this.map
          .getStyle()
          .layers.filter(
            (l) =>
              l.type === "symbol" &&
              !KEEP.has(l.id) &&
              this.map.getLayoutProperty(l.id, "visibility") !== "none",
          )
          // Each with the visibility it had, given back as it was (not forced on).
          .map((l) => ({
            id: l.id,
            was: this.map.getLayoutProperty(l.id, "visibility") as "visible" | undefined,
          }))
      : [];
    // An outline map is a line drawing to write on: no relief, no tint of states, no
    // dots of other places (symbols, hidden above with the names); pale land and sea, the
    // coast and the rivers, the route.
    const PLAIN = ["relief", "hillshade", "polity-fill"];
    if (blank)
      for (const id of PLAIN)
        if (this.map.getLayer(id) && this.map.getLayoutProperty(id, "visibility") !== "none")
          hidden.push({
            id,
            was: this.map.getLayoutProperty(id, "visibility") as "visible" | undefined,
          });
    type Paint = Parameters<MLMap["setPaintProperty"]>;
    const plain: { id: string; key: Paint[1]; to: Paint[2] }[] = [
      { id: "land", key: "background-color", to: "#ffffff" },
      { id: "water", key: "fill-color", to: "#e8eff2" },
      { id: "coast", key: "line-opacity", to: 1 },
    ];
    const paints = blank
      ? plain
          .filter((x) => this.map.getLayer(x.id))
          .map((x) => ({ ...x, was: this.map.getPaintProperty(x.id, x.key) }))
      : [];
    for (const x of paints) {
      // At once: the sheet is taken in the next frame, not after a fade.
      this.map.setPaintProperty(x.id, `${x.key}-transition` as Paint[1], { duration: 0, delay: 0 });
      this.map.setPaintProperty(x.id, x.key, x.to);
    }
    for (const l of hidden) this.map.setLayoutProperty(l.id, "visibility", "none");
    // No battles on the sheet: their swords crowded round the stops and covered the
    // numbers of a lesson sheet; the sheet is the tour's.
    const battles =
      this.map.getLayer("battle-icon") &&
      this.map.getLayoutProperty("battle-icon", "visibility") !== "none";
    if (battles) this.map.setLayoutProperty("battle-icon", "visibility", "none");
    // The edge labels were worked out for the screen's view, not the sheet's.
    void this.map
      .getSource<GeoJSONSource>("polity-edge-labels")
      ?.setData({ type: "FeatureCollection", features: [] });
    this.edgeLabels = "[]";
    const restore = () => {
      if (battles && this.map.getLayer("battle-icon"))
        this.map.setLayoutProperty("battle-icon", "visibility", "visible");
      this.edgeDirty = true;
      for (const x of paints)
        if (this.map.getLayer(x.id)) this.map.setPaintProperty(x.id, x.key, x.was);
      for (const l of hidden)
        if (this.map.getLayer(l.id)) this.map.setLayoutProperty(l.id, "visibility", l.was);
      if (this.map.getLayer(`${MARKS}-also`)) this.map.removeLayer(`${MARKS}-also`);
      if (this.map.getLayer(MARKS)) this.map.removeLayer(MARKS);
      if (this.map.getLayer(`${MARKS}-dot`)) this.map.removeLayer(`${MARKS}-dot`);
      if (this.map.getSource(MARKS)) this.map.removeSource(MARKS);
      box.style.width = size.width;
      box.style.height = size.height;
      this.map.resize();
      this.map.setPadding(before.padding);
      this.printing = false;
      this.map.jumpTo({
        center: before.center,
        zoom: before.zoom,
        pitch: before.pitch,
        bearing: before.bearing,
      });
    };
    // Whatever fails from here, the map gets its size and padding back.
    try {
      if (marks.length > 0) {
        this.map.addSource(MARKS, {
          type: "geojson",
          // Places on one point (Ezra 2 names five there) are one disc, the first number
          // in it and the others beside it, as a tour's revisited stops.
          data: {
            type: "FeatureCollection",
            features: [
              ...marks
                .reduce((g, m) => {
                  const key = `${m.at[0].toFixed(4)},${m.at[1].toFixed(4)}`;
                  g.set(key, [...(g.get(key) ?? []), m]);
                  return g;
                }, new Map<string, { at: LonLat; n: number }[]>())
                .values(),
            ].map((ms) => {
              const [first, ...rest] = ms;
              const at = first?.at ?? [0, 0];
              return {
                type: "Feature" as const,
                properties: {
                  n: first?.n ?? 0,
                  ...(rest.length > 0 ? { also: rest.map((m) => String(m.n)).join(" · ") } : {}),
                },
                geometry: { type: "Point" as const, coordinates: [at[0], at[1]] },
              };
            }),
          },
        });
        // On top of everything: a numbered disc on each place, as the tours' stops are.
        this.map.addLayer({
          id: `${MARKS}-dot`,
          type: "circle",
          source: MARKS,
          paint: {
            "circle-radius": 7.5,
            "circle-color": "#9a3b1f",
            "circle-stroke-color": "#f6efe1",
            "circle-stroke-width": 1.5,
          },
        });
        this.map.addLayer({
          id: MARKS,
          type: "symbol",
          source: MARKS,
          layout: {
            "text-field": ["to-string", ["get", "n"]],
            "text-font": [MAP_FONT],
            "text-size": 10,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": "#ffffff" },
        });
        this.map.addLayer({
          id: `${MARKS}-also`,
          type: "symbol",
          source: MARKS,
          filter: ["has", "also"],
          layout: {
            "text-field": ["get", "also"],
            "text-font": [MAP_FONT],
            "text-size": 10,
            "text-anchor": "left",
            "text-offset": [1.2, 0],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": "#9a3b1f", "text-halo-color": "#f6efe1", "text-halo-width": 1.5 },
        });
      }
      this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      if (points.length <= 1) {
        // One place: in the middle of the sheet, at the zoom it is seen at.
        const one = points[0];
        this.map.jumpTo({ ...(one ? { center: [one[0], one[1]] } : {}), pitch: 0, bearing: 0 });
      } else {
        // Room around the stops (a tenth of the span each side), and at least two and a
        // half degrees across: three stops a day apart still show a coast to place them by.
        const lons = points.map((p) => p[0]);
        const lats = points.map((p) => p[1]);
        const grow = (v: number[]) => {
          const lo = Math.min(...v);
          const hi = Math.max(...v);
          const pad = Math.max((hi - lo) * 0.1, (2.5 - (hi - lo)) / 2);
          v.push(lo - pad, hi + pad);
        };
        grow(lons);
        grow(lats);
        const margin = { top: 48, bottom: 48, left: 48, right: 48 };
        this.map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: margin, maxZoom: 9, pitch: 0, bearing: 0, duration: 0 },
        );
        this.correctFit(points, margin, 0);
      }
      await this.idle();
    } catch (e) {
      restore();
      throw e;
    }
    return restore;
  }

  /** Once the map has drawn everything it is loading (at most 6 s). */
  private idle(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 6000);
      this.map.once("idle", () => {
        window.clearTimeout(timer);
        resolve();
      });
      this.map.triggerRepaint();
    });
  }

  /** Pans and zooms out so that every point falls inside the padded view with its margin. */
  private correctFit(
    points: readonly LonLat[],
    margin: { top: number; bottom: number; left: number; right: number },
    duration = 500,
  ): void {
    const el = this.map.getContainer();
    const pad = this.map.getPadding();
    const edge = (v: number | undefined) => v ?? 0;
    const box = {
      left: edge(pad.left) + margin.left,
      right: el.clientWidth - edge(pad.right) - margin.right,
      top: edge(pad.top) + margin.top,
      bottom: el.clientHeight - edge(pad.bottom) - margin.bottom,
    };
    if (box.right <= box.left || box.bottom <= box.top) return;
    const xy = points.map((p) => this.map.project([p[0], p[1]]));
    const minX = Math.min(...xy.map((p) => p.x));
    const maxX = Math.max(...xy.map((p) => p.x));
    const minY = Math.min(...xy.map((p) => p.y));
    const maxY = Math.max(...xy.map((p) => p.y));
    if (minX >= box.left && maxX <= box.right && minY >= box.top && maxY <= box.bottom) return;
    // Zoom out by as much as the places overflow the box, and centre them in it.
    const scale = Math.max(
      1,
      (maxX - minX) / (box.right - box.left),
      (maxY - minY) / (box.bottom - box.top),
    );
    const shift: [number, number] = [
      (minX + maxX) / 2 - (box.left + box.right) / 2,
      (minY + maxY) / 2 - (box.top + box.bottom) / 2,
    ];
    const centre = this.map.project(this.map.getCenter());
    this.map.easeTo({
      center: this.map.unproject([centre.x + shift[0], centre.y + shift[1]]),
      // A little more than the overflow: the tilt makes the near edge grow as it zooms out.
      zoom: this.map.getZoom() - Math.log2(scale) - (scale > 1 ? 0.1 : 0),
      duration,
      essential: true,
    });
  }

  setTourPlaces(placeIds: readonly string[]): void {
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("tourPlaces", [...placeIds]);
    });
  }

  /** The straight line of "Distance from here", or none. */
  setMeasure(from: LonLat | null, to: LonLat | null): void {
    this.whenLoaded(() => {
      void this.map.getSource<GeoJSONSource>("measure")?.setData({
        type: "FeatureCollection",
        features:
          from && to
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: { type: "LineString", coordinates: [[...from], [...to]] },
                },
              ]
            : [],
      });
    });
  }

  /**
   * A tour's route: the way walked so far (to the current stop) drawn solid, the rest of
   * it faint, every stop with its number; the lights run along the last leg walked.
   */
  setRoute(coordinates: readonly LonLat[], currentIndex: number): void {
    this.whenLoaded(() => {
      const features: Feature[] = [];
      const line = (part: readonly LonLat[], ahead: boolean) => {
        if (part.length > 1)
          features.push({
            type: "Feature",
            properties: { ahead },
            geometry: { type: "LineString", coordinates: part.map((c) => [...c]) },
          });
      };
      const walked = coordinates.slice(0, currentIndex + 1);
      line(walked, false);
      line(coordinates.slice(Math.max(currentIndex, 0)), true);
      // A place the tour comes back to (Antioch: stops 1, 6, 12, 15) is one disc, not four
      // stacked with only the top number seen: it holds the number that matters now (this
      // stop, else the next one there, else the last), the others beside it, small.
      const at = new Map<string, number[]>();
      coordinates.forEach((c, i) => {
        const key = `${c[0].toFixed(4)},${c[1].toFixed(4)}`;
        at.set(key, [...(at.get(key) ?? []), i]);
      });
      for (const stops of at.values()) {
        const first = stops[0] ?? 0;
        const shown =
          stops.find((i) => i === currentIndex) ??
          stops.find((i) => i > currentIndex) ??
          stops.at(-1) ??
          first;
        const others = stops.filter((i) => i !== shown).map((i) => String(i + 1));
        const c = coordinates[first] ?? [0, 0];
        features.push({
          type: "Feature",
          properties: {
            current: shown === currentIndex,
            ahead: shown > currentIndex,
            n: shown + 1,
            ...(others.length > 0 ? { also: others.join(" · ") } : {}),
          },
          geometry: { type: "Point", coordinates: [...c] },
        });
      }
      void this.map.getSource<GeoJSONSource>("route")?.setData({
        type: "FeatureCollection",
        features,
      });
      this.stops.route = coordinates.length > 0;
      this.showStops();
      this.runPulses(walked);
    });
  }

  /**
   * Tells the style whether a tour's stop discs are drawn: a stop's own mark then lies
   * hidden under its disc (style-expressions.ts markOpacity), as the circles lay under it.
   */
  private showStops(): void {
    const shown = this.stops.route && this.stops.layer;
    if (shown === this.stops.shown) return;
    this.stops.shown = shown;
    this.map.setGlobalStateProperty("stops", shown);
  }

  /**
   * Small lights run along the last leg of the route, from the previous stop to the
   * current one, so the reader sees which way the tour went. DOM markers, not style changes: the map stays idle.
   * Off with no route, and for readers who ask the system for less motion.
   */
  private runPulses(coordinates: readonly LonLat[]): void {
    if (this.pulse) {
      cancelAnimationFrame(this.pulse.frame);
      for (const m of this.pulse.markers) m.remove();
      this.pulse = null;
    }
    if (coordinates.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const along = routeWalker(coordinates.slice(-2));
    const markers = [0, 1, 2].map(() => {
      // MapLibre sets the marker's own opacity (behind the globe, under terrain): the
      // light fades on an inner element, so the two never fight.
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      const light = document.createElement("div");
      light.className = "hg-pulse";
      el.append(light);
      return new maplibregl.Marker({ element: el }).setLngLat(along(0)).addTo(this.map);
    });
    // About 2.4 s along the leg, the three lights a third of it apart.
    const tick = (now: number) => {
      markers.forEach((m, k) => {
        const t = (now / 2400 + k / 3) % 1;
        m.setLngLat(along(t));
        const light = m.getElement().firstElementChild as HTMLElement | null;
        if (light) light.style.opacity = String(Math.sin(Math.PI * t) ** 0.5);
      });
      if (this.pulse) this.pulse.frame = requestAnimationFrame(tick);
    };
    this.pulse = { frame: requestAnimationFrame(tick), markers };
  }

  getCamera(): Camera {
    const c = this.map.getCenter();
    return {
      center: [c.lng, c.lat],
      zoom: this.map.getZoom(),
      pitch: this.map.getPitch(),
      bearing: this.map.getBearing(),
    };
  }

  /**
   * The map as drawn, as a PNG data URL, with the attribution it shows. Read inside the
   * frame that draws it: WebGL keeps no copy of the picture after the frame
   * (preserveDrawingBuffer is off, for speed).
   */
  snapshot(): Promise<{ image: string; width: number; height: number; attribution: string }> {
    return new Promise((resolve) => {
      this.map.once("render", () => {
        const canvas = this.map.getCanvas();
        // The app may move the map's controls out of its container (into the player):
        // the credits are looked up in the whole page, not only inside the map.
        const attribution =
          (
            this.map.getContainer().querySelector(".maplibregl-ctrl-attrib-inner") ??
            document.querySelector(".maplibregl-ctrl-attrib-inner")
          )?.textContent ?? "";
        resolve({
          image: canvas.toDataURL("image/png"),
          width: canvas.width,
          height: canvas.height,
          // The "Sources" link points at the About page: no use on a picture.
          attribution: attribution
            .replace(/\s+/g, " ")
            .replace(/\s*·\s*Sources$/, "")
            .trim(),
        });
      });
      this.map.triggerRepaint();
    });
  }

  visiblePlaces(): string[] {
    if (!this.loaded) return [];
    const ids = new Set<string>();
    for (const f of this.map.queryRenderedFeatures({ layers: PLACE_LAYERS })) {
      const id = (f.properties as { id?: string } | null)?.id;
      if (id) ids.add(id);
    }
    return [...ids];
  }

  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void {
    const set = this.handlers[event] as Set<RendererEvents[E]>;
    set.add(handler);
    return () => set.delete(handler);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.pulse) cancelAnimationFrame(this.pulse.frame);
    clearTimeout(this.readyTimer);
    clearTimeout(this.settleTimer);
    this.pending = [];
    for (const set of Object.values(this.handlers)) set.clear();
    this.map.remove();
  }
}
