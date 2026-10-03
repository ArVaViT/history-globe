import type { Locale } from "@hg/model";
import type { LayerVisibility } from "./state.ts";

export type LonLat = readonly [number, number];

export interface Camera {
  readonly center: LonLat;
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
}

export interface PolityName {
  readonly name: string;
  readonly nameRu?: string;
  /** In the years it was a vassal or client: "under Assyria" (and in Russian). */
  readonly vassal?: string;
  readonly vassalRu?: string;
}

/** A site of the ancient world layer (content/ancient-sites.json) under the pointer. */
export interface AncientSite {
  readonly en: string;
  readonly ru: string;
  readonly from: number;
  readonly to: number;
  readonly approx: boolean;
  readonly kind: string;
}

export interface RendererEvents {
  /** A place was clicked on the map. */
  pick: (placeId: string) => void;
  /** Hover changed; null when the pointer leaves all places. `at` is in screen pixels. */
  hover: (placeId: string | null, at: { readonly x: number; readonly y: number } | null) => void;
  /** The states under the pointer when it is over no place (topmost first), or null. */
  hoverPolity: (
    polities: readonly PolityName[] | null,
    at: { readonly x: number; readonly y: number } | null,
  ) => void;
  /** An ancient site under the pointer, over no biblical place; null when it leaves. */
  hoverAncient: (
    site: AncientSite | null,
    at: { readonly x: number; readonly y: number } | null,
  ) => void;
  /** A battle's mark under the pointer (its name and year); null when it leaves. */
  hoverBattle: (
    battle: {
      readonly en: string;
      readonly ru: string;
      readonly year: number;
      readonly approx: boolean;
    } | null,
    at: { readonly x: number; readonly y: number } | null,
  ) => void;
  /** The map finished its first full load and is interactive. */
  ready: () => void;
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
  /** Pan, keeping the zoom, if the point lies under the panels and cards. */
  reveal?(at: LonLat): void;
  /** An outline laid over the map at its true size, or none (comparing sizes). */
  setOutline?(ring: readonly LonLat[] | null): void;
  /** The Bible alone (a setting): what it does not tell steps off the map. */
  setBibleOnly?(on: boolean): void;
  setRoute(coordinates: readonly LonLat[], currentIndex: number): void;
  /** The places of the running tour (empty when none): the rest of the map steps back. */
  setTourPlaces(placeIds: readonly string[]): void;
  /** Frame these points (a chapter's places), clear of the interface. */
  fitTo(points: readonly LonLat[]): void;
  getCamera(): Camera;
  /** Ids of places currently drawn on screen (for the accessible "in view" list). */
  visiblePlaces(): string[];
  on<E extends keyof RendererEvents>(event: E, handler: RendererEvents[E]): () => void;
  destroy(): void;
}
