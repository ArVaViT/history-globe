import type { Locale } from "@hg/model";
import type { Camera, LonLat, Renderer, RendererEvents } from "./renderer.ts";
import type { LayerVisibility } from "./state.ts";

type Call =
  | { readonly op: "year"; readonly year: number }
  | { readonly op: "locale"; readonly locale: Locale }
  | { readonly op: "layers"; readonly layers: LayerVisibility }
  | { readonly op: "selected"; readonly placeId: string | null }
  | { readonly op: "flyTo"; readonly center: LonLat; readonly zoom: number | undefined }
  | { readonly op: "route"; readonly points: number; readonly current: number };

/** Records every call so engine behaviour can be tested without WebGL. */
export class FakeRenderer implements Renderer {
  readonly calls: Call[] = [];
  private camera: Camera = { center: [35, 31.5], zoom: 2, pitch: 0, bearing: 0 };
  private readonly handlers: { [E in keyof RendererEvents]: Set<RendererEvents[E]> } = {
    pick: new Set(),
    hover: new Set(),
    cameraChanged: new Set(),
    ready: new Set(),
  };

  setYear(year: number): void {
    this.calls.push({ op: "year", year });
  }
  setLocale(locale: Locale): void {
    this.calls.push({ op: "locale", locale });
  }
  setLayers(layers: LayerVisibility): void {
    this.calls.push({ op: "layers", layers });
  }
  setSelected(placeId: string | null): void {
    this.calls.push({ op: "selected", placeId });
  }
  flyTo(target: Partial<Camera> & { readonly center: LonLat }): void {
    this.camera = { ...this.camera, ...target };
    this.calls.push({ op: "flyTo", center: target.center, zoom: target.zoom });
    // A real flight ends with a settled camera; the fake settles at once.
    for (const h of this.handlers.cameraChanged) h(this.camera);
  }
  setRoute(coordinates: readonly LonLat[], currentIndex: number): void {
    this.calls.push({ op: "route", points: coordinates.length, current: currentIndex });
  }
  getCamera(): Camera {
    return this.camera;
  }
  /** Tests set this to simulate what is on screen. */
  onScreen: string[] = [];
  visiblePlaces(): string[] {
    return this.onScreen;
  }
  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void {
    const set = this.handlers[event] as Set<RendererEvents[E]>;
    set.add(handler);
    return () => set.delete(handler);
  }
  destroy(): void {
    for (const set of Object.values(this.handlers)) set.clear();
  }

  /** Test helper: simulate a click on a place. */
  emitPick(placeId: string): void {
    for (const h of this.handlers.pick) h(placeId);
  }

  last<O extends Call["op"]>(op: O): Extract<Call, { op: O }> | undefined {
    return this.calls.filter((c): c is Extract<Call, { op: O }> => c.op === op).at(-1);
  }
}
