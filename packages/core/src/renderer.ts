import type { Locale } from "@hg/model";
import type { LayerVisibility } from "./state.ts";

export type LonLat = readonly [number, number];

export interface Camera {
  readonly center: LonLat;
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
}

export interface RendererEvents {
  /** A place was clicked on the map. */
  pick: (placeId: string) => void;
  /** Hover changed; null when the pointer leaves all places. */
  hover: (placeId: string | null) => void;
  /** Camera settled after user interaction or a flight. */
  cameraChanged: (camera: Camera) => void;
}

/**
 * Port between the engine and whatever draws the globe (ADR 0004). MapLibre in the app,
 * FakeRenderer in unit tests.
 */
export interface Renderer {
  setYear(year: number): void;
  setLocale(locale: Locale): void;
  setLayers(layers: LayerVisibility): void;
  setSelected(placeId: string | null): void;
  flyTo(target: Partial<Camera> & { readonly center: LonLat }, durationMs?: number): void;
  setRoute(coordinates: readonly LonLat[], currentIndex: number): void;
  getCamera(): Camera;
  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void;
  destroy(): void;
}
