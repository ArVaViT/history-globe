// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

// The verse links are the model's, so the static pages link a verse as the cards do.
export { verseUrl } from "@hg/model";

/** The place's point on Google Maps: where it is today. */
export function mapsUrl([lon, lat]: readonly [number, number]): string {
  return `https://www.google.com/maps/search/?api=1&query=${String(lat)},${String(lon)}`;
}
