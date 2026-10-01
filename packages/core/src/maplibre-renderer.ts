import type { Locale } from "@hg/model";
import type { Feature, FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import type { Camera, LonLat, PolityName, Renderer, RendererEvents } from "./renderer.ts";
import type { LayerVisibility } from "./state.ts";
import { buildStyle, layersInGroup, type StyleOptions } from "./style.ts";
import { drawIcon } from "./icons.ts";
import { WheelClassifier } from "./wheel.ts";

const READY_FALLBACK_MS = 8000;

const PLACE_LAYERS = [
  "place-dot",
  "landmark-dot",
  "landmark-icon",
  "place-label",
  "place-label-area",
  "place-label-water",
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
}

export class MapLibreRenderer implements Renderer {
  readonly map: MLMap;
  private readonly featureIdByPlace = new Map<string, number>();
  private readonly groups: Record<string, string[]>;
  private selected: number | null = null;
  private hovered: number | null = null;
  private hoveredPlace: string | null = null;
  private polityShown = false;
  private readonly handlers: { [E in keyof RendererEvents]: Set<RendererEvents[E]> } = {
    pick: new Set(),
    hover: new Set(),
    hoverPolity: new Set(),
    cameraChanged: new Set(),
    ready: new Set(),
  };
  private pendingYear: number | null = null;
  private pending: (() => void)[] = [];
  private loaded = false;
  private destroyed = false;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly viewPadding: MapLibreRendererOptions["viewPadding"];

  constructor(o: MapLibreRendererOptions) {
    this.viewPadding = o.viewPadding;
    const style = buildStyle(o);
    this.groups = {
      borders: layersInGroup(style, "borders"),
      places: layersInGroup(style, "places"),
      relief: layersInGroup(style, "relief"),
      routes: layersInGroup(style, "routes"),
    };
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
    // The compact attribution opens expanded (MapLibre sets it after the first frames)
    // and then runs under the slider, on a phone over a third of the map: it starts
    // folded to its (i), which opens the full line.
    this.map.once("idle", () => {
      o.container
        .querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
    });

    // The style is enough to set data and run queued work. "load" also waits for the
    // tiles in view, and in some views (zoom 22 over a pole) it never comes.
    this.map.once("style.load", () => {
      void (this.map.getSource("places") as GeoJSONSource).setData(o.places);
      this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.5 });
      this.loaded = true;
      for (const run of this.pending) run();
      this.pending = [];
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
    const placeAt = (e: MapMouseEvent) =>
      this.loaded
        ? this.map.queryRenderedFeatures(e.point, { layers: PLACE_LAYERS })[0]
        : undefined;
    this.map.on("click", (e: MapMouseEvent) => {
      const id = (placeAt(e)?.properties as { id?: string } | undefined)?.id;
      if (id) for (const h of this.handlers.pick) h(id);
    });
    this.map.on("mousemove", (e: MapMouseEvent) => {
      const f = placeAt(e);
      const fid = typeof f?.id === "number" ? f.id : null;
      this.map.getCanvas().style.cursor = f ? "pointer" : "";
      if (fid !== this.hovered) this.setHoverState(fid);
      const pid = (f?.properties as { id?: string } | undefined)?.id ?? null;
      const at = { x: e.point.x, y: e.point.y };
      // Over no place, name the states under the pointer: their labels often give way
      // to town names.
      const states = pid ? null : this.politiesAt(e);
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
    });
    // A trackpad sends dozens of small moves a second: report the camera once it rests.
    this.map.on("moveend", () => {
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        if (this.destroyed) return;
        const cam = this.getCamera();
        for (const h of this.handlers.cameraChanged) h(cam);
      }, 150);
    });
  }

  private politiesAt(e: MapMouseEvent): PolityName[] | null {
    if (!this.loaded || this.map.getLayoutProperty("polity-fill", "visibility") === "none")
      return null;
    const seen = new Set<string>();
    const out: PolityName[] = [];
    for (const f of this.map.queryRenderedFeatures(e.point, { layers: ["polity-fill"] })) {
      const p = f.properties as { name?: string; name_ru?: string };
      if (!p.name || seen.has(p.name)) continue;
      seen.add(p.name);
      out.push(p.name_ru ? { name: p.name, nameRu: p.name_ru } : { name: p.name });
    }
    return out.length > 0 ? out : null;
  }

  private whenLoaded(run: () => void): void {
    if (this.destroyed) return;
    if (this.loaded) run();
    else this.pending.push(run);
  }

  private setHoverState(fid: number | null): void {
    if (this.hovered !== null)
      this.map.setFeatureState({ source: "places", id: this.hovered }, { hover: false });
    this.hovered = fid;
    if (fid !== null) this.map.setFeatureState({ source: "places", id: fid }, { hover: true });
  }

  setYear(year: number): void {
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
    });
  }

  setLocale(locale: Locale): void {
    this.whenLoaded(() => {
      this.map.setGlobalStateProperty("locale", locale);
    });
  }

  setLayers(layers: LayerVisibility): void {
    this.whenLoaded(() => {
      for (const [group, ids] of Object.entries(this.groups)) {
        const visible = layers[group as keyof LayerVisibility];
        for (const id of ids)
          this.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
      if (layers.relief) this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.5 });
      else this.map.setTerrain(null);
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
    });
  }

  flyTo(target: Partial<Camera> & { readonly center: LonLat }, durationMs?: number): void {
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

  setRoute(coordinates: readonly LonLat[], currentIndex: number): void {
    this.whenLoaded(() => {
      const features: Feature[] = [];
      if (coordinates.length > 1) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coordinates.map((c) => [...c]) },
        });
      }
      coordinates.forEach((c, i) => {
        features.push({
          type: "Feature",
          properties: { current: i === currentIndex },
          geometry: { type: "Point", coordinates: [...c] },
        });
      });
      void (this.map.getSource("route") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features,
      });
    });
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
    clearTimeout(this.readyTimer);
    clearTimeout(this.settleTimer);
    this.pending = [];
    for (const set of Object.values(this.handlers)) set.clear();
    this.map.remove();
  }
}
