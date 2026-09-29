import type { Locale } from "@hg/model";
import type { Feature, FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import type { Camera, LonLat, PolityName, Renderer, RendererEvents } from "./renderer.ts";
import type { LayerVisibility } from "./state.ts";
import { buildStyle, layersInGroup, type StyleOptions } from "./style.ts";

const READY_FALLBACK_MS = 6000;

const PLACE_LAYERS = [
  "place-dot",
  "landmark-dot",
  "place-label",
  "place-label-area",
  "place-label-water",
  "place-label-landmark",
];

export interface MapLibreRendererOptions extends StyleOptions {
  readonly container: HTMLElement;
  readonly camera: Camera;
  /** Place features with a numeric top-level `id` (feature-state) and `properties.id`. */
  readonly places: FeatureCollection;
}

export class MapLibreRenderer implements Renderer {
  readonly map: MLMap;
  private readonly featureIdByPlace = new Map<string, number>();
  private readonly groups: Record<string, string[]>;
  private selected: number | null = null;
  private hovered: number | null = null;
  private hoveredPlace: string | null = null;
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

  constructor(o: MapLibreRendererOptions) {
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
    });
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    this.map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    this.map.on("load", () => {
      void (this.map.getSource("places") as GeoJSONSource).setData(o.places);
      this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.5 });
      this.loaded = true;
      for (const run of this.pending) run();
      this.pending = [];
    });
    // Ready at the first idle frame. Some views never go idle (a camera over the pole
    // keeps re-rendering), so the loading state also ends a few seconds after load.
    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      for (const h of this.handlers.ready) h();
    };
    this.map.once("idle", fireReady);
    this.map.once("load", () => {
      this.readyTimer = setTimeout(fireReady, READY_FALLBACK_MS);
    });

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
      for (const h of this.handlers.hoverPolity) h(states, states ? at : null);
      if (pid === this.hoveredPlace && pid === null) return;
      this.hoveredPlace = pid;
      for (const h of this.handlers.hover) h(pid, pid ? at : null);
    });
    this.map.getCanvasContainer().addEventListener("mouseleave", () => {
      this.map.getCanvas().style.cursor = "";
      this.setHoverState(null);
      this.hoveredPlace = null;
      for (const h of this.handlers.hover) h(null, null);
      for (const h of this.handlers.hoverPolity) h(null, null);
    });
    this.map.on("moveend", () => {
      const cam = this.getCamera();
      for (const h of this.handlers.cameraChanged) h(cam);
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
    this.pending = [];
    for (const set of Object.values(this.handlers)) set.clear();
    this.map.remove();
  }
}
