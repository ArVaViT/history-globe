import type { Locale } from "@hg/model";

/**
 * A verse or passage on BibleGateway. It reads OSIS references as they are and keeps
 * the English numbering, showing the Synodal verse under it (RUSV: Ps 68:15 is shown
 * as "(67-16) Гора Божия…"), so no conversion is needed.
 */
export function verseUrl(osis: string, locale: Locale): string {
  const version = locale === "ru" || locale === "uk" ? "RUSV" : "ESV";
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(osis)}&version=${version}`;
}

/** The place's point on Google Maps: where it is today. */
export function mapsUrl([lon, lat]: readonly [number, number]): string {
  return `https://www.google.com/maps/search/?api=1&query=${String(lat)},${String(lon)}`;
}
