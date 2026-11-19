/**
 * Every use of MapLibre's private members, in one place. MapLibre 6.11.2 (pinned, ADR 0004)
 * has no public way to change its controls' language, to reach the credits' box or to write
 * the credits again after a source's changed: its controls read `map._locale` when they write
 * a title or the scale's unit, and keep their elements in private fields. An upgrade that
 * renames any of these fails maplibre-internals.test.ts, not the map in a reader's hands.
 */
import type * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";

export interface MapControls {
  readonly attribution: maplibregl.AttributionControl;
  readonly nav: maplibregl.NavigationControl;
  readonly scale: maplibregl.ScaleControl;
}

/** MapLibre's interface words, as its locale table keys them. */
export type MapLibreWords = Readonly<Record<string, string>> & { readonly "Map.Title": string };

/** The controls in other words: the locale table patched, each control's words written again. */
export function relabelControls(map: MLMap, controls: MapControls, words: MapLibreWords): void {
  Object.assign(map._locale, words);
  map.getCanvas().setAttribute("aria-label", words["Map.Title"]);
  const { nav, attribution, scale } = controls;
  nav._setButtonTitle(nav._zoomInButton, "ZoomIn");
  nav._setButtonTitle(nav._zoomOutButton, "ZoomOut");
  nav._setButtonTitle(nav._compass, "ResetBearing");
  attribution._setElementTitle(attribution._compactButton, "ToggleAttribution");
  scale._onMove();
}

/** The credits' box: the (i) and the list it opens. */
export function attributionBox(control: maplibregl.AttributionControl): HTMLElement {
  return control._container;
}

/** The credits as the box shows them, as plain text. */
export function attributionText(control: maplibregl.AttributionControl): string {
  return control._innerContainer.textContent;
}

/** The credits written again from the sources, after one's credit changed. */
export function refreshAttribution(control: maplibregl.AttributionControl): void {
  control._updateAttributions();
}
