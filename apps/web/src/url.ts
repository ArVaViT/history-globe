import type { Camera } from "@hg/core";
import type { Locale } from "@hg/model";

/** The shareable view (ADR 0006): everything needed to reopen the same scene. */
export interface UrlView {
  readonly year?: number;
  readonly place?: string;
  readonly camera?: Camera;
  readonly locale?: Locale;
}

const LOCALES: readonly Locale[] = ["ru", "en", "uk", "de"];

export function readUrl(search = window.location.search): UrlView {
  const p = new URLSearchParams(search);
  const view: { -readonly [K in keyof UrlView]: UrlView[K] } = {};
  const year = Number(p.get("year"));
  if (p.has("year") && Number.isInteger(year)) view.year = year;
  const place = p.get("place");
  if (place && /^a[0-9a-f]{6}$/.test(place)) view.place = place;
  const cam = p.get("camera")?.split(",").map(Number);
  if (cam?.length === 5 && cam.every(Number.isFinite)) {
    const [lon = 0, lat = 0, zoom = 0, pitch = 0, bearing = 0] = cam;
    view.camera = { center: [lon, lat], zoom, pitch, bearing };
  }
  const locale = p.get("locale") as Locale | null;
  if (locale && LOCALES.includes(locale)) view.locale = locale;
  return view;
}

export function writeUrl(
  view: Required<Pick<UrlView, "year" | "camera" | "locale">> & Pick<UrlView, "place">,
): void {
  const p = new URLSearchParams();
  p.set("year", String(view.year));
  if (view.place) p.set("place", view.place);
  const c = view.camera;
  p.set(
    "camera",
    [
      c.center[0].toFixed(4),
      c.center[1].toFixed(4),
      c.zoom.toFixed(2),
      c.pitch.toFixed(0),
      c.bearing.toFixed(0),
    ].join(","),
  );
  p.set("locale", view.locale);
  window.history.replaceState(null, "", `?${p.toString()}`);
}
