import type { Camera, Engine } from "@hg/core";
import { chapterFocus } from "./chapter";
import type { LoadedData } from "./data";
import type { EmbedView } from "./embed";

/**
 * The embed protocol's work (docs/embed-protocol.md, v1), loaded only inside a frame: tell
 * the host when the map is ready and when the view settles, take its views and language.
 * Returns what undoes it.
 */
const viewOf = (engine: Engine): EmbedView => {
  const s = engine.store.get();
  return {
    year: s.year,
    locale: s.locale,
    ...(s.selectedPlace ? { place: s.selectedPlace } : {}),
    ...(s.tour ? { tour: s.tour.id, stop: s.tour.step + 1 } : {}),
    // A person's places are not a chapter: the host gets no ref for them (nor does the URL).
    ...(s.focus && !s.focus.ref.startsWith("person:") ? { ref: s.focus.ref } : {}),
    ...(s.camera ? { camera: rounded(s.camera) } : {}),
    layers: s.layers,
  };
};

const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const rounded = (c: Camera) => ({
  center: [r(c.center[0], 4), r(c.center[1], 4)] as [number, number],
  zoom: r(c.zoom, 2),
  pitch: Math.round(c.pitch),
  bearing: Math.round(c.bearing),
});

export function attachEmbed(
  renderer:
    | {
        flyTo: (
          target: Partial<Camera> & { center: readonly [number, number] },
          ms?: number,
        ) => void;
      }
    | undefined,
  engine: Engine,
  data: LoadedData,
): () => void {
  // Only a view that differs from the last one sent goes out: the store also changes
  // with every camera move, and a host that answers each message must not loop.
  let last = "";
  const post = (type: string) => {
    const view = viewOf(engine);
    const key = JSON.stringify(view);
    if (type === "hg:view-changed" && key === last) return;
    last = key;
    window.parent.postMessage({ type, v: 1, view }, "*");
  };
  post("hg:ready");
  let timer = 0;
  const off = engine.store.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      post("hg:view-changed");
    }, 400);
  });
  const onMessage = (e: MessageEvent) => {
    if (e.source !== window.parent || typeof e.data !== "object" || e.data === null) return;
    const m = e.data as {
      type?: unknown;
      v?: unknown;
      view?: Partial<EmbedView> | null;
      locale?: unknown;
    };
    if (m.v !== 1) return;
    if (m.type === "hg:set-locale" && (m.locale === "ru" || m.locale === "en"))
      engine.setLocale(m.locale);
    if (m.type !== "hg:set-view" || typeof m.view !== "object" || m.view === null) return;
    // What already holds is left alone: no flight for a view the map already shows.
    const v = m.view;
    const s = engine.store.get();
    const year = Number.isFinite(v.year) ? Math.round(v.year ?? 0) : undefined;
    if (year !== undefined && year !== s.year) engine.setYear(year);
    if (typeof v.tour === "string" && data.tours.some((t) => t.id === v.tour)) {
      const step = Number.isInteger(v.stop) && (v.stop ?? 0) >= 1 ? (v.stop ?? 1) - 1 : 0;
      if (s.tour?.id !== v.tour || s.tour.step !== step) engine.startTour(v.tour, step);
      return;
    }
    if (typeof v.ref === "string" && v.ref !== s.focus?.ref) {
      const focus = chapterFocus(data, v.ref);
      if (focus)
        engine.focusPlaces(year !== undefined ? { ref: focus.ref, places: focus.places } : focus);
    }
    if (typeof v.place === "string" && v.place !== s.selectedPlace && data.byId.has(v.place))
      engine.selectPlace(v.place);
    if (v.layers)
      for (const k of ["borders", "places", "relief", "routes", "roads", "ancient"] as const) {
        const on = v.layers[k];
        if (typeof on === "boolean" && on !== s.layers[k]) engine.setLayer(k, on);
      }
    const c = v.camera;
    const [lon, lat] = Array.isArray(c?.center) ? c.center : [NaN, NaN];
    if (renderer && c && Number.isFinite(lon) && Number.isFinite(lat)) {
      const target = {
        center: [((lon + 540) % 360) - 180, Math.max(-85, Math.min(85, lat))] as const,
        ...(Number.isFinite(c.zoom) ? { zoom: Math.max(0, Math.min(22, c.zoom)) } : {}),
        ...(Number.isFinite(c.pitch) ? { pitch: Math.max(0, Math.min(80, c.pitch)) } : {}),
        ...(Number.isFinite(c.bearing) ? { bearing: c.bearing } : {}),
      };
      // A camera already there is not flown to again.
      if (
        JSON.stringify(rounded({ ...s.camera, ...target } as Camera)) !==
        JSON.stringify(s.camera && rounded(s.camera))
      )
        renderer.flyTo(target, 1200);
    }
  };
  window.addEventListener("message", onMessage);
  return () => {
    off();
    window.clearTimeout(timer);
    window.removeEventListener("message", onMessage);
  };
}
