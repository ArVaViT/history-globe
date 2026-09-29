import { YEAR_MAX, YEAR_MIN, type Camera } from "@hg/core";
import type { Locale } from "@hg/model";

/** The shareable view (ADR 0006): everything needed to reopen the same scene. */
export interface UrlView {
  readonly year?: number;
  readonly place?: string;
  readonly camera?: Camera;
  readonly locale?: Locale;
}

/** Only languages with a UI dictionary; uk and de join when theirs exist. */
const LOCALES: readonly Locale[] = ["ru", "en"];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Into [-180, 180): the same meridian however many turns the link adds. */
const wrap180 = (v: number) => (v >= -180 && v < 180 ? v : ((((v + 180) % 360) + 360) % 360) - 180);

export function readUrl(search = window.location.search): UrlView {
  const p = new URLSearchParams(search);
  const view: { -readonly [K in keyof UrlView]: UrlView[K] } = {};
  const yearText = p.get("year")?.trim() ?? "";
  const year = Number(yearText);
  if (yearText !== "" && Number.isInteger(year)) view.year = clamp(year, YEAR_MIN, YEAR_MAX);
  const place = p.get("place");
  if (place && /^a[0-9a-f]{6}$/.test(place)) view.place = place;
  const cam = p.get("camera")?.split(",").map(Number);
  if (cam?.length === 5 && cam.every(Number.isFinite)) {
    const [lon = 0, lat = 0, zoom = 0, pitch = 0, bearing = 0] = cam;
    // Links can come from anywhere, embeds included: out-of-range values would make
    // MapLibre throw before the first frame, so they are brought into range here.
    view.camera = {
      center: [wrap180(lon), clamp(lat, -85, 85)],
      zoom: clamp(zoom, 0, 22),
      pitch: clamp(pitch, 0, 80),
      bearing: wrap180(bearing),
    };
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
