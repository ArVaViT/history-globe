import type { Locale } from "@hg/model";
import { Emitter } from "./emitter.ts";
import type { Camera, LonLat, Renderer, RendererEvents } from "./renderer.ts";
import type { LayerVisibility } from "./state.ts";

type Call =
  | { readonly op: "year"; readonly year: number }
  | { readonly op: "locale"; readonly locale: Locale }
  | { readonly op: "layers"; readonly layers: LayerVisibility }
  | { readonly op: "selected"; readonly placeId: string | null }
  | { readonly op: "highlight"; readonly at: LonLat | null }
  | { readonly op: "flyTo"; readonly center: LonLat; readonly zoom: number | undefined }
  | { readonly op: "bibleOnly"; readonly on: boolean }
  | { readonly op: "hiddenNames"; readonly ids: readonly string[] }
  | {
      readonly op: "route";
      readonly points: number;
      readonly current: number;
      readonly stops?: number;
      readonly still?: true;
    }
  | { readonly op: "tourPlaces"; readonly count: number }
  | { readonly op: "fitTo"; readonly count: number }
  | { readonly op: "reveal"; readonly at: LonLat };

/** Records every call so engine behaviour can be tested without WebGL. */
export class FakeRenderer implements Renderer {
  readonly calls: Call[] = [];
  private camera: Camera = { center: [35, 31.5], zoom: 2, pitch: 0, bearing: 0 };
  private readonly events = new Emitter<RendererEvents>();

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
  highlight(at: LonLat | null): void {
    this.calls.push({ op: "highlight", at });
  }
  reveal(at: LonLat): void {
    this.calls.push({ op: "reveal", at });
  }
  setBibleOnly(on: boolean): void {
    this.calls.push({ op: "bibleOnly", on });
  }
  setHiddenNames(ids: readonly string[]): void {
    this.calls.push({ op: "hiddenNames", ids });
  }

  flyTo(target: Partial<Camera> & { readonly center: LonLat }): void {
    this.camera = { ...this.camera, ...target };
    this.calls.push({ op: "flyTo", center: target.center, zoom: target.zoom });
    // A real flight ends with a settled camera; the fake settles at once.
    this.events.emit("cameraChanged", this.camera);
  }
  setRoute(
    coordinates: readonly LonLat[],
    currentIndex: number,
    options?: { readonly placeIds?: readonly string[]; readonly still?: boolean },
  ): void {
    this.calls.push({
      op: "route",
      points: coordinates.length,
      current: currentIndex,
      ...(options?.placeIds ? { stops: options.placeIds.length } : {}),
      ...(options?.still ? { still: true } : {}),
    });
  }
  setTourPlaces(placeIds: readonly string[]): void {
    this.calls.push({ op: "tourPlaces", count: placeIds.length });
  }
  fitTo(points: readonly LonLat[]): void {
    this.calls.push({ op: "fitTo", count: points.length });
  }
  getCamera(): Camera {
    return this.camera;
  }
  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void {
    return this.events.on(event, handler);
  }
  destroy(): void {
    this.events.clear();
  }

  /** Test helper: simulate a click on a place. */
  emitPick(placeId: string): void {
    this.events.emit("pick", placeId);
  }

  /** Test helper: simulate a click on the map where there is no place. */
  emitPickNone(): void {
    this.events.emit("pickNone");
  }

  last<O extends Call["op"]>(op: O): Extract<Call, { op: O }> | undefined {
    return this.calls.filter((c): c is Extract<Call, { op: O }> => c.op === op).at(-1);
  }
}
