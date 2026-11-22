import { POLITY_SPLIT_YEAR, type Locale } from "@hg/model";
import type { Feature, FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import { edgeStateLabels } from "./edge-labels.ts";
import { elevationReader } from "./elevation.ts";
import { Emitter } from "./emitter.ts";
import { emptyClicks } from "./empty-click.ts";
import {
  attributionBox,
  attributionText,
  type MapControls,
  refreshAttribution,
  relabelControls,
} from "./maplibre-internals.ts";
import { drawIcon } from "./icons.ts";
import { thinMajors, weight } from "./majors.ts";
import { alongPath, pointsAlongPath } from "./polyline.ts";
import { addPrintMarks, removePrintMarks } from "./print-marks.ts";
import {
  battleInfo,
  type Camera,
  type LonLat,
  type PolityName,
  type Renderer,
  type RendererEvents,
} from "./renderer.ts";
import { stopDiscs } from "./route-stops.ts";
import { DEFAULT_STATE, type LayerVisibility } from "./state.ts";
import { ROAD_MINZOOM, ROADS_FROM } from "./style-expressions.ts";
import { buildStyle, layersInGroup, seaLabels, type StyleOptions } from "./style.ts";
import { WheelClassifier } from "./wheel.ts";

/**
 * The loading pill goes at the latest this long after the map is made. The sea, the states
 * and the relief are drawn by about 4 s on a desktop; the places' tiles queue behind the
 * relief's in the worker, and waiting for them kept the pill up over a finished map.
 */
const READY_FALLBACK_MS = 4500;
/** A trackpad sends dozens of small moves a second: the camera is reported once it rests. */
const SETTLE_MS = 150;
/** The longest wait for the map to draw everything it is loading: some views never go idle. */
const IDLE_TIMEOUT_MS = 6000;
/** How long a print waits for MapLibre's own resize before it resizes the map itself. */
const RESIZE_TIMEOUT_MS = 250;
const TERRAIN = { source: "dem-terrain", exaggeration: 1.5 } as const;
/** A leg's profile is read at zoom 9 (about 160 m a pixel): a dozen tiles for a long leg. */
const PROFILE_ZOOM = 9;

/** MapLibre's own interface words: the app gives them in the reader's language (`mapUi`). */
export interface MapUiWords {
  readonly km: string;
  readonly m: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly north: string;
  readonly sources: string;
  readonly title: string;
  /** The link the credits end with, to the page of every source (the terrain's is long). */
  readonly sourcesPage: { readonly href: string; readonly label: string };
}
const ENGLISH_UI: MapUiWords = {
  km: "km",
  m: "m",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  north: "Reset bearing to north",
  sources: "Map sources",
  title: "Map",
  sourcesPage: { href: "docs/sources.html", label: "Sources" },
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

const withoutSuffix = (text: string, suffix: string) =>
  text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;

/** The link to the sources' page, after the relief's credit, in the reader's language. */
const sourcesLink = (w: MapUiWords) =>
  ` · <a href="${w.sourcesPage.href}">${w.sourcesPage.label}</a>`;

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

interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MapLibreRendererOptions extends StyleOptions {
  readonly container: HTMLElement;
  readonly camera: Camera;
  /** Place features with a numeric top-level `id` (feature-state) and `properties.id`. */
  readonly places: FeatureCollection;
  /** Screen edges covered by the interface, so a flight puts its target where it shows. */
  readonly viewPadding?: () => Padding;
  /** MapLibre's words in a language; English when not given. */
  readonly mapUi?: (locale: string) => MapUiWords;
}

export class MapLibreRenderer implements Renderer {
  readonly map: MLMap;
  private readonly controls: MapControls;
  private readonly events = new Emitter<RendererEvents>();
  private readonly featureIdByPlace = new Map<string, number>();
  /** Every place, the ancient world's with the Bible's. */
  private readonly allPlaces: FeatureCollection;
  /** The places drawn: all, or under the Bible alone only those it names. */
  private places: FeatureCollection;
  /** The great towns as last drawn (majors.ts): written again only when they change. */
  private majorsNow = "";
  private readonly groups: Record<keyof LayerVisibility, string[]>;
  private layers: LayerVisibility = DEFAULT_STATE.layers;
  private selectedPlaceId: string | null = null;
  private selectedFeatureId: number | null = null;
  private hoveredFeatureId: number | null = null;
  private hoveredPlaceId: string | null = null;
  private polityShown = false;
  private battleShown = false;
  private pendingYear: number | null = null;
  /** Work waiting for the style, and what to do instead if the map goes first. */
  private pending: { run: () => void; cancel: (() => void) | undefined }[] = [];
  private loaded = false;
  private destroyed = false;
  /** Which framing is current: a correction after a fit runs only if no move began since. */
  private fitId = 0;
  /** While a sheet is being drawn: the resize handler must not put the screen's padding back. */
  private printing = false;
  private paddingQueued = false;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  /** The edge labels last written: unchanged, nothing is set. */
  private edgeLabels = "[]";
  /** Whether the view changed since the edge labels were worked out. */
  private edgeDirty = true;
  private readonly viewPadding: (() => Padding) | undefined;
  private pulse: { frame: number; markers: maplibregl.Marker[] } | null = null;
  private ring: maplibregl.Marker | null = null;
  private readonly dataUrl: string;
  private lateStates: Promise<boolean> | null = null;
  private readonly roads: Record<"major" | "minor", "no" | "loading" | "yes"> = {
    major: "no",
    minor: "no",
  };
  private year: number;
  private battles: "no" | "loading" | "yes" = "no";
  /** The Bible alone (a setting): the places, events and battles it does not name off. */
  private bibleOnly = false;
  /** Whether the route has stops, and whether their discs are drawn (the routes layer on). */
  private readonly stops = { route: false, shown: false };
  private readonly mapUi: (locale: string) => MapUiWords;
  /** The words of the language shown, and the relief's credit the sources' link follows. */
  private ui: MapUiWords;
  private readonly terrainCredit: string;

  /** Heights above sea level from the relief's tiles (elevation.ts), for the tours. */
  readonly heightsAt: (points: readonly LonLat[]) => Promise<(number | null)[]>;
  /** Heights at `n` points along a way: two points for a straight leg, or a road's. */
  readonly profileAlong: (path: readonly LonLat[], n: number) => Promise<(number | null)[]>;

  constructor(o: MapLibreRendererOptions) {
    this.mapUi = o.mapUi ?? (() => ENGLISH_UI);
    this.ui = this.mapUi(o.initialLocale);
    this.terrainCredit = o.terrainAttribution;
    this.heightsAt = elevationReader(o.terrainTiles);
    const coarse = elevationReader(o.terrainTiles, PROFILE_ZOOM);
    this.profileAlong = (path, n) => coarse(pointsAlongPath(path, n));
    this.viewPadding = o.viewPadding;
    this.dataUrl = o.dataUrl;
    const style = buildStyle({
      ...o,
      terrainAttribution: o.terrainAttribution + sourcesLink(this.ui),
    });
    this.groups = {
      borders: layersInGroup(style, "borders"),
      places: layersInGroup(style, "places"),
      relief: layersInGroup(style, "relief"),
      routes: layersInGroup(style, "routes"),
      roads: layersInGroup(style, "roads"),
      battles: layersInGroup(style, "battles"),
    };
    this.allPlaces = o.places;
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
      // Added below and kept, to relabel and to read.
      attributionControl: false,
      // MapLibre's words in the page's language from the first frame: the scale draws
      // before setLocale runs and would stay "km" until the map moved.
      locale: toMapLibre(this.ui),
      canvasContextAttributes: { antialias: true },
      // Wheel handled below: two fingers pan, a pinch or a mouse wheel zooms.
      scrollZoom: false,
    });
    this.controls = {
      attribution: new maplibregl.AttributionControl({ compact: true }),
      nav: new maplibregl.NavigationControl({ visualizePitch: true }),
      scale: new maplibregl.ScaleControl({ unit: "metric" }),
    };
    this.map.addControl(this.controls.attribution);
    if (o.viewPadding) this.installPadding(o.viewPadding);
    this.foldAttribution();
    // Place icons are drawn when the style first asks for them.
    this.map.setMissingStyleImageResolver((id) => {
      if (this.map.hasImage(id)) return;
      const img = drawIcon(id);
      if (img) this.map.addImage(id, img, { sdf: true, pixelRatio: 2 });
    });
    this.installWheel();
    this.map.addControl(this.controls.nav, "bottom-right");
    this.map.addControl(this.controls.scale, "bottom-left");
    // The style is enough to set data and run queued work. "load" also waits for the
    // tiles in view, and in some views (zoom 22 over a pole) it never comes.
    this.map.once("style.load", () => {
      void this.map.getSource<GeoJSONSource>("places")?.setData(this.places);
      void this.map.getSource<GeoJSONSource>("sea-labels")?.setData(seaLabels(o.places));
      this.fillMajors();
      this.map.setTerrain(TERRAIN);
      this.loaded = true;
      for (const { run } of this.pending) run();
      this.pending = [];
      // A link may open close in, on a Roman year, without moving the map afterwards.
      this.loadRoads();
      this.loadBattles();
    });
    this.installReady();
    this.installPointer();
    this.installEdgeLabels();
    this.map.on("moveend", () => {
      this.loadRoads();
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        if (!this.destroyed) this.events.emit("cameraChanged", this.getCamera());
      }, SETTLE_MS);
    });
  }

  /**
   * The padding a flight uses stays with the map (the centre is the open part of the screen):
   * set from the start, so a link opens as a flight would, and again on resize.
   */
  private installPadding(pad: () => Padding): void {
    this.map.setPadding(pad());
    let waiting = false;
    this.map.on("resize", () => {
      if (this.printing) return;
      // setPadding stops a flight: during one, wait for it to end.
      if (!this.map.isMoving()) {
        this.map.setPadding(pad());
      } else if (!waiting) {
        waiting = true;
        this.map.once("moveend", () => {
          waiting = false;
          this.map.setPadding(pad());
        });
      }
    });
  }

  /**
   * MapLibre unfolds the compact attribution once by itself, when it first fills: it is folded
   * back, so the (i) only opens when someone presses it.
   */
  private foldAttribution(): void {
    const attrib = attributionBox(this.controls.attribution);
    const fold = new MutationObserver(() => {
      if (!attrib.classList.contains("maplibregl-compact-show")) return;
      attrib.classList.remove("maplibregl-compact-show");
      fold.disconnect();
    });
    fold.observe(attrib, { attributes: true, attributeFilter: ["class"] });
  }

  private installWheel(): void {
    const wheel = new WheelClassifier();
    const canvas = this.map.getCanvasContainer();
    canvas.addEventListener(
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
        const rect = canvas.getBoundingClientRect();
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
  }

  /**
   * Ready at the first frame that shows the places, or at the first idle frame if that comes
   * sooner: waiting for idle alone keeps the loading state up until every relief tile has
   * arrived, some 7 s on a 4G line. Some views never go idle (a camera over the pole keeps
   * re-rendering), so the loading state also ends READY_FALLBACK_MS after creation.
   */
  private installReady(): void {
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      this.map.off("sourcedata", onPlaces);
      this.events.emit("ready");
    };
    const onPlaces = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === "places" && this.map.isSourceLoaded("places"))
        this.map.once("render", fire);
    };
    this.map.on("sourcedata", onPlaces);
    this.map.once("idle", fire);
    this.readyTimer = setTimeout(fire, READY_FALLBACK_MS);
  }

  private installPointer(): void {
    // One handler over all place layers: per-layer mouseleave fires after the next layer's
    // mousemove, so moving from a label to its own dot would drop the hover. A name pressed
    // is its place; dots on one point (Jerusalem, Zion, the City of David) give the most
    // named, not whichever was drawn last.
    const placeAt = (e: MapMouseEvent) => {
      if (!this.loaded) return undefined;
      const fs = this.map.queryRenderedFeatures(e.point, { layers: PLACE_LAYERS });
      return (
        fs.find((f) => f.layer.id.startsWith("place-label")) ??
        fs.reduce<(typeof fs)[number] | undefined>(
          (a, f) => (a && weight(a) >= weight(f) ? a : f),
          undefined,
        )
      );
    };
    // A battle's mark opens the place it was fought at (its card tells the battle). A little
    // room round the point: a finger on a phone lands near the mark, not on it.
    const battleAt = (e: MapMouseEvent) =>
      this.loaded && this.battles === "yes" && this.layers.battles
        ? (this.map.queryRenderedFeatures(
            [
              [e.point.x - 8, e.point.y - 8],
              [e.point.x + 8, e.point.y + 8],
            ],
            { layers: ["battle-icon"] },
          )[0]?.properties as Record<string, unknown> | undefined)
        : undefined;
    // A click on the map itself, told apart from a drag's release, a press that stopped the
    // camera and a double-click (empty-click.ts).
    const empty = emptyClicks(() => {
      this.events.emit("pickNone");
    });
    this.map.on("mousedown", () => {
      empty.down(this.map.isMoving());
    });
    this.map.on("touchstart", () => {
      empty.down(this.map.isMoving());
    });
    this.map.on("move", () => {
      empty.moved();
    });
    this.map.on("dblclick", () => {
      empty.dblclick();
    });
    this.map.on("dragstart", () => {
      empty.dragged();
    });
    this.map.on("click", (e: MapMouseEvent) => {
      // The release of a drag a flight cut short picks nothing and clears nothing.
      if (!empty.isClick()) return;
      const battle = battleAt(e);
      const place = battle?.["place"];
      const info = battleInfo(battle);
      // A battle fought at no place (Gaugamela, events.yaml): no card to open, so a click or
      // a tap names it, as hovering does (a phone has no hover).
      if (info && typeof place !== "string") {
        this.battleShown = true;
        this.events.emit("hoverBattle", info, { x: e.point.x, y: e.point.y });
        empty.click(true);
        return;
      }
      const id =
        typeof place === "string"
          ? place
          : (placeAt(e)?.properties as { id?: string } | undefined)?.id;
      if (id) {
        // A tap on a phone also "hovers": its tip would stay over the card it opens.
        if (e.originalEvent instanceof PointerEvent && e.originalEvent.pointerType === "touch") {
          this.hidePlaceTip();
          this.hideBattleTip();
        }
        this.events.emit("pick", id);
      }
      empty.click(Boolean(id || battle));
    });
    // A tip would otherwise stay over a map that moved away: a tap on a phone, or a click
    // that flies to the place picked while the pointer rests where it was.
    this.map.on("movestart", () => {
      this.hidePlaceTip();
      this.hideBattleTip();
    });
    this.map.on("mousemove", (e: MapMouseEvent) => {
      const f = placeAt(e);
      const fid = typeof f?.id === "number" ? f.id : null;
      const battle = battleAt(e);
      this.map.getCanvas().style.cursor = f || battle ? "pointer" : "";
      const at = { x: e.point.x, y: e.point.y };
      // Over a battle's mark its name is told, not the place's under it.
      const named = battleInfo(battle);
      if (named || this.battleShown) {
        this.battleShown = named !== null;
        this.events.emit("hoverBattle", named, named ? at : null);
      }
      if (fid !== this.hoveredFeatureId) this.setHoverState(fid);
      const pid = (f?.properties as { id?: string } | undefined)?.id ?? null;
      // Over no place, the states under the pointer: their labels often give way to town
      // names. "No state here" is sent once, not on every mouse move.
      const states = pid ? null : this.politiesAtPixel(e.point);
      if (states || this.polityShown) {
        this.polityShown = states !== null;
        this.events.emit("hoverPolity", states, states ? at : null);
      }
      if (pid === null && this.hoveredPlaceId === null) return;
      this.hoveredPlaceId = pid;
      this.events.emit("hover", pid, pid ? at : null);
    });
    this.map.getCanvasContainer().addEventListener("mouseleave", () => {
      this.map.getCanvas().style.cursor = "";
      this.setHoverState(null);
      this.hidePlaceTip();
      this.hideBattleTip();
      if (this.polityShown) {
        this.polityShown = false;
        this.events.emit("hoverPolity", null, null);
      }
    });
  }

  private hidePlaceTip(): void {
    if (this.hoveredPlaceId === null) return;
    this.hoveredPlaceId = null;
    this.events.emit("hover", null, null);
  }

  private hideBattleTip(): void {
    if (!this.battleShown) return;
    this.battleShown = false;
    this.events.emit("hoverBattle", null, null);
  }

  /**
   * The large states the view shows unnamed get a label (edge-labels.ts), worked out again only
   * when the view or what it shows has changed: "idle" also follows a hover or the edge
   * labels' own new data.
   */
  private installEdgeLabels(): void {
    this.map.on("idle", () => {
      if (!this.edgeDirty || this.printing || this.destroyed) return;
      this.edgeDirty = false;
      const source = this.map.getSource<GeoJSONSource>("polity-edge-labels");
      if (!source) return;
      const features = edgeStateLabels(this.map);
      const data = JSON.stringify(features);
      if (data === this.edgeLabels) return;
      this.edgeLabels = data;
      void source.setData({ type: "FeatureCollection", features });
    });
    for (const event of ["moveend", "resize"] as const)
      this.map.on(event, () => {
        this.edgeDirty = true;
      });
    this.map.on("sourcedata", (e) => {
      if (e.sourceId === "polities" && e.isSourceLoaded) this.edgeDirty = true;
    });
  }

  /** The document the map lives in: the page's own, or a frame's. */
  private get doc(): Document {
    return this.map.getContainer().ownerDocument;
  }

  /**
   * The states drawn at a place for the year now shown, topmost first: null when the place
   * is off screen, at sea or the borders are hidden. Read after the map has drawn the year.
   */
  politiesAtPoint(at: LonLat): Promise<PolityName[] | null> {
    return new Promise((resolve) => {
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
      this.whenLoaded(
        () => {
          // After AD 500 the later states must be in before the borders are read.
          const ready =
            this.year > POLITY_SPLIT_YEAR ? this.loadLateStates() : Promise.resolve(true);
          void ready.then(() => this.idle()).then(read);
        },
        () => {
          resolve(null);
        },
      );
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
      const p = f.properties as Record<string, unknown> & { name?: string; v?: string };
      if (!p.name || seen.has(p.name)) continue;
      seen.add(p.name);
      // Every language's name_<code> and v_<code> the data carries.
      const names: Record<string, string> = {};
      const vassals: Record<string, string> = {};
      for (const [k, v] of Object.entries(p)) {
        if (typeof v !== "string") continue;
        if (k.startsWith("name_")) names[k.slice(5)] = v;
        else if (k.startsWith("v_")) vassals[k.slice(2)] = v;
      }
      out.push({
        name: p.name,
        names,
        ...(p.v ? { vassal: p.v, vassals } : {}),
      });
    }
    return out.length > 0 ? out : null;
  }

  /** Runs once the style is in; if the map is destroyed first, `cancel` runs instead. */
  private whenLoaded(run: () => void, cancel?: () => void): void {
    if (this.destroyed) cancel?.();
    else if (this.loaded) run();
    else this.pending.push({ run, cancel });
  }

  private setHoverState(fid: number | null): void {
    // The great towns are drawn from their own source, with the places' ids.
    for (const source of ["places", "majors"]) {
      if (this.hoveredFeatureId !== null)
        this.map.setFeatureState({ source, id: this.hoveredFeatureId }, { hover: false });
      if (fid !== null) this.map.setFeatureState({ source, id: fid }, { hover: true });
    }
    this.hoveredFeatureId = fid;
  }

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
      this.year = y;
      this.whenLoaded(() => {
        this.fillMajors();
      });
      this.loadRoads();
    });
  }

  /** The battles (a few kB) load once the map is up, while their layer is on. */
  private loadBattles(): void {
    if (!this.loaded || !this.layers.battles || this.battles !== "no") return;
    this.battles = "loading";
    void this.fill("battles", "battles.geojson").then((ok) => {
      this.battles = ok ? "yes" : "no";
    });
  }

  /**
   * The Bible alone (a setting): the places of the ancient world it does not name, and the
   * battles it does not tell, step off the map.
   */
  setBibleOnly(on: boolean): void {
    const changed = on !== this.bibleOnly;
    this.bibleOnly = on;
    this.places = on
      ? {
          ...this.allPlaces,
          features: this.allPlaces.features.filter(
            (f) => !(f.properties as { ancient?: string } | null)?.ancient,
          ),
        }
      : this.allPlaces;
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("bibleOnly", on);
      if (!changed) return;
      void this.map.getSource<GeoJSONSource>("places")?.setData(this.places);
      this.majorsNow = "";
      this.fillMajors();
      this.edgeDirty = true;
    });
  }

  setHiddenNames(ids: readonly string[]): void {
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("hiddenNames", [...ids]);
    });
  }

  /**
   * The Roman roads load the first time they could show: the layer on, the year from
   * ROADS_FROM and the map close enough. Each kind is fetched half a zoom level before it is
   * drawn, so its data is there at the first zoom it shows.
   */
  private loadRoads(): void {
    if (!this.loaded || !this.layers.roads || this.year < ROADS_FROM) return;
    const zoom = this.map.getZoom();
    for (const kind of ["major", "minor"] as const) {
      if (this.roads[kind] !== "no" || zoom < ROAD_MINZOOM[kind] - 0.5) continue;
      this.roads[kind] = "loading";
      void this.fill(`roads-${kind}`, `roads-${kind}.geojson`).then((ok) => {
        this.roads[kind] = ok ? "yes" : "no";
      });
    }
  }

  /**
   * Point a source at a data file, fetched and parsed in MapLibre's worker: false when the
   * file did not come, so the caller can try again. setData(url) reports a failed fetch only
   * as the source's error event, and keeps the data it had.
   */
  private async fill(source: string, file: string): Promise<boolean> {
    const src = this.map.getSource<GeoJSONSource>(source);
    if (!src || this.destroyed) return false;
    let failed = false;
    // The style adds the source's id to the events its sources send.
    const onError = (e: maplibregl.ErrorEvent) => {
      if ((e as { sourceId?: string }).sourceId === source) failed = true;
    };
    this.map.on("error", onError);
    try {
      await src.setData(`${this.dataUrl}/${file}`);
    } finally {
      this.map.off("error", onError);
    }
    return !failed;
  }

  /**
   * The states after AD 500 ship apart from the first frame's (scripts/build-content.ts):
   * the first time the year passes AD 500 the sources switch to the files with every
   * state, parsed in the worker. Resolves when they are in; tried again after a failure.
   */
  private loadLateStates(): Promise<boolean> {
    if (!this.lateStates) {
      const loading: Promise<boolean> = new Promise<boolean>((resolve) => {
        this.whenLoaded(
          () => {
            void Promise.all([
              this.fill("polities", "polities-all.geojson"),
              this.fill("polity-labels", "polity-labels-all.geojson"),
            ]).then(([a, b]) => {
              resolve(a && b);
            });
          },
          () => {
            resolve(false);
          },
        );
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
    this.ui = this.mapUi(locale);
    relabelControls(this.map, this.controls, toMapLibre(this.ui));
    const credit = this.terrainCredit + sourcesLink(this.ui);
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("locale", locale);
      const dem = this.map.getSource("dem");
      if (dem && dem.attribution !== credit) {
        dem.attribution = credit;
        refreshAttribution(this.controls.attribution);
      }
    });
  }

  setLayers(layers: LayerVisibility): void {
    this.edgeDirty = true;
    this.layers = layers;
    this.whenLoaded(() => {
      for (const [group, ids] of Object.entries(this.groups)) {
        const visible = layers[group as keyof LayerVisibility];
        for (const id of ids)
          this.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
      // The lights along a route go with the routes layer.
      this.map.getContainer().classList.toggle("hg-no-routes", !layers.routes);
      this.showStops();
      this.map.setTerrain(layers.relief ? TERRAIN : null);
      this.loadRoads();
      this.loadBattles();
    });
  }

  highlight(at: LonLat | null): void {
    this.whenLoaded(() => {
      // A marker over the map, not a feature state: the place may have no dot at this zoom
      // (Jerusalem under a selected Kidron), and the ring is seen all the same.
      if (!at) {
        this.ring?.remove();
        this.ring = null;
        return;
      }
      if (!this.ring) {
        const el = this.doc.createElement("div");
        el.setAttribute("aria-hidden", "true");
        // Only a sign: a press on the place under it reaches the map.
        el.style.pointerEvents = "none";
        const ring = this.doc.createElement("div");
        ring.className = "hg-ring";
        el.append(ring);
        this.ring = new maplibregl.Marker({ element: el });
      }
      this.ring.setLngLat([at[0], at[1]]).addTo(this.map);
    });
  }

  setSelected(placeId: string | null): void {
    this.whenLoaded(() => {
      if (this.selectedFeatureId !== null)
        this.map.setFeatureState(
          { source: "places", id: this.selectedFeatureId },
          { selected: false },
        );
      this.selectedFeatureId = placeId ? (this.featureIdByPlace.get(placeId) ?? null) : null;
      if (this.selectedFeatureId !== null)
        this.map.setFeatureState(
          { source: "places", id: this.selectedFeatureId },
          { selected: true },
        );
      // Filters cannot read feature-state: they read the selected place's id.
      this.map.setGlobalStateProperty("selected", placeId ?? "");
      this.selectedPlaceId = placeId;
      this.fillMajors();
    });
  }

  /**
   * The great towns standing in the year, each with the zooms its ring is drawn at
   * (majors.ts): written to their source only when that changes, a few times a century
   * of the slider, not on every step.
   */
  private fillMajors(): void {
    const majors = thinMajors(this.places, this.year, this.selectedPlaceId);
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

  fitTo(points: readonly LonLat[], options?: { readonly maxZoom?: number }): void {
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
        maxZoom: options?.maxZoom ?? 9,
        pitch: 30,
        bearing: 0,
        duration: 1600,
        essential: true,
      },
    );
    // On the globe and tilted, fitBounds frames the box only roughly: in a small frame the
    // nearest place can end under the timeline. Once there, measure where the places landed
    // and move once more to bring them all inside; not if another move (a flight, a print)
    // began meanwhile, nor long after, when fitBounds could not move at all.
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
    const box = this.map.getContainer();
    const size = { width: box.style.width, height: box.style.height };
    type Paint = Parameters<MLMap["setPaintProperty"]>;
    // What the sheet changed, each with what it was: given back as it was, not forced on.
    const hidden: { id: string; was: "visible" | undefined }[] = [];
    const paints: { id: string; key: Paint[1]; was: Paint[2] }[] = [];
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      this.edgeDirty = true;
      for (const x of paints)
        if (this.map.getLayer(x.id)) this.map.setPaintProperty(x.id, x.key, x.was);
      for (const l of hidden)
        if (this.map.getLayer(l.id)) this.map.setLayoutProperty(l.id, "visibility", l.was);
      removePrintMarks(this.map);
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
    const hide = (id: string) => {
      if (!this.map.getLayer(id) || this.map.getLayoutProperty(id, "visibility") === "none") return;
      hidden.push({
        id,
        was: this.map.getLayoutProperty(id, "visibility") as "visible" | undefined,
      });
      this.map.setLayoutProperty(id, "visibility", "none");
    };
    // Whatever fails from here, the map gets its size, its layers and its view back.
    try {
      // A smaller canvas for the sheet: on A4 the names come out half as large again as
      // they would from a full screen (1000 px across ≈ 186 mm).
      box.style.width = "1000px";
      box.style.height = "625px";
      await this.resized();
      if (blank) {
        // An outline map is a line drawing to write on: no names and no marks of places but
        // the stops' numbers, no relief, no tint of states; pale land and sea, the coast and
        // the rivers, the route.
        const keep = new Set(["route-num", "route-also"]);
        for (const l of this.map.getStyle().layers)
          if (l.type === "symbol" && !keep.has(l.id)) hide(l.id);
        for (const id of ["relief", "hillshade", "polity-fill"]) hide(id);
        const plain: { id: string; key: Paint[1]; to: Paint[2] }[] = [
          { id: "land", key: "background-color", to: "#ffffff" },
          { id: "water", key: "fill-color", to: "#e8eff2" },
          { id: "coast", key: "line-opacity", to: 1 },
        ];
        for (const x of plain) {
          if (!this.map.getLayer(x.id)) continue;
          paints.push({ id: x.id, key: x.key, was: this.map.getPaintProperty(x.id, x.key) });
          // At once: the sheet is taken in the next frame, not after a fade.
          this.map.setPaintProperty(x.id, `${x.key}-transition` as Paint[1], {
            duration: 0,
            delay: 0,
          });
          this.map.setPaintProperty(x.id, x.key, x.to);
        }
      }
      // No battles on the sheet: their swords crowd round the stops and cover the numbers of
      // a lesson sheet; the sheet is the tour's.
      hide("battle-icon");
      // The edge labels were worked out for the screen's view, not the sheet's.
      void this.map
        .getSource<GeoJSONSource>("polity-edge-labels")
        ?.setData({ type: "FeatureCollection", features: [] });
      this.edgeLabels = "[]";
      if (marks.length > 0) addPrintMarks(this.map, marks);
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

  /**
   * Once MapLibre has taken the container's new size. Its own watcher notices a new size a
   * little later (throttled): a sheet framed before it would be reframed by the late resize.
   */
  private resized(): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      // No resize in time: the map is resized here, so the sheet is never framed on the
      // screen's canvas.
      const timer = setTimeout(() => {
        this.map.off("resize", done);
        this.map.resize();
        resolve();
      }, RESIZE_TIMEOUT_MS);
      this.map.once("resize", done);
    });
  }

  /** Once the map has drawn everything it is loading, or after IDLE_TIMEOUT_MS. */
  private idle(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, IDLE_TIMEOUT_MS);
      this.map.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
      this.map.triggerRepaint();
    });
  }

  /** Pans and zooms out so that every point falls inside the padded view with its margin. */
  private correctFit(points: readonly LonLat[], margin: Padding, duration = 500): void {
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
   * it faint, every stop with its number (route-stops.ts); the lights run along the last leg
   * walked.
   */
  setRoute(
    coordinates: readonly LonLat[],
    currentIndex: number,
    options?: { readonly placeIds?: readonly string[]; readonly still?: boolean },
  ): void {
    const still = options?.still === true;
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
      for (const { at, shown, also } of stopDiscs(coordinates, currentIndex))
        features.push({
          type: "Feature",
          properties: {
            current: !still && shown === currentIndex,
            ahead: shown > currentIndex,
            n: shown + 1,
            ...(also.length > 0 ? { also: also.map((i) => String(i + 1)).join(" · ") } : {}),
          },
          geometry: { type: "Point", coordinates: [...at] },
        });
      void this.map.getSource<GeoJSONSource>("route")?.setData({
        type: "FeatureCollection",
        features,
      });
      this.stops.route = coordinates.length > 0;
      // Only the stops' own marks hide under their discs: a chapter's place named but not
      // walked (Thyatira in Acts 16) keeps its mark.
      this.map.setGlobalStateProperty("stopPlaces", [...(options?.placeIds ?? [])]);
      this.showStops();
      this.runPulses(still ? [] : walked);
    });
  }

  /**
   * Tells the style whether a tour's stop discs are drawn: a stop's own mark then lies hidden
   * under its disc (style-expressions.ts markOpacity).
   */
  private showStops(): void {
    const shown = this.stops.route && this.layers.routes;
    if (shown === this.stops.shown) return;
    this.stops.shown = shown;
    this.map.setGlobalStateProperty("stops", shown);
  }

  /**
   * Small lights run along the last leg of the route, from the previous stop to the current
   * one, so the reader sees which way the tour went. DOM markers, not style changes: the map
   * stays idle. Off with no route, and for readers who ask the system for less motion.
   */
  private runPulses(coordinates: readonly LonLat[]): void {
    if (this.pulse) {
      cancelAnimationFrame(this.pulse.frame);
      for (const m of this.pulse.markers) m.remove();
      this.pulse = null;
    }
    if (coordinates.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const along = alongPath(coordinates.slice(-2));
    const markers = [0, 1, 2].map(() => {
      // MapLibre sets the marker's own opacity (behind the globe, under terrain): the
      // light fades on an inner element, so the two never fight.
      const el = this.doc.createElement("div");
      el.setAttribute("aria-hidden", "true");
      // Only a sign: a light passing over the stop, as it does at the end of every run along
      // the leg, does not take the tap meant for the stop (MapLibre's marker takes the
      // pointer; the light inside it already lets it through).
      el.style.pointerEvents = "none";
      const light = this.doc.createElement("div");
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
        resolve({
          image: canvas.toDataURL("image/png"),
          width: canvas.width,
          height: canvas.height,
          // The link to the sources' page is no use on a picture.
          attribution: withoutSuffix(
            attributionText(this.controls.attribution).replace(/\s+/g, " ").trim(),
            ` · ${this.ui.sourcesPage.label}`,
          ),
        });
      });
      this.map.triggerRepaint();
    });
  }

  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void {
    return this.events.on(event, handler);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.pulse) cancelAnimationFrame(this.pulse.frame);
    clearTimeout(this.readyTimer);
    clearTimeout(this.settleTimer);
    const pending = this.pending;
    this.pending = [];
    for (const { cancel } of pending) cancel?.();
    this.events.clear();
    this.map.remove();
  }
}
