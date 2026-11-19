/** Mean Earth radius, km (IUGG). */
const R = 6371.0088;

/** Great-circle distance between two [lon, lat] points, in km. */
export function distanceKm(a: readonly [number, number], b: readonly [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A distance as the card shows it, rounded so it does not claim more than a straight
 * line between two ancient sites can: to 1 km under 100, to 5 under 1000, then to 10.
 */
export function roundKm(km: number): number {
  const step = km < 100 ? 1 : km < 1000 ? 5 : 10;
  return Math.max(1, Math.round(km / step) * step);
}

/** The length of a route through its stops, in km, in a straight line between each. */
export function routeKm(points: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += distanceKm(a, b);
  }
  return total;
}

/** A day on foot in antiquity: about 30 km, the usual estimate for a day's journey. */
export const KM_PER_DAY = 30;

/**
 * How long a straight line takes on foot, as the card says it: hours under a day's walk
 * (at 5 km an hour), else whole days. Roads wind, so it is a floor, not an estimate.
 */
export function walkTime(km: number): { readonly hours: number } | { readonly days: number } {
  if (km < KM_PER_DAY) return { hours: Math.max(1, Math.round(km / 5)) };
  return { days: Math.max(1, Math.round(km / KM_PER_DAY)) };
}
