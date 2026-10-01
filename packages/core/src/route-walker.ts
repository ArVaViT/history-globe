import type { LonLat } from "./renderer.ts";

/**
 * A point at a fraction of a polyline's length, measured on the map (longitude shrunk by
 * the cosine of the latitude): t = 0 is the first point, t = 1 the last.
 */
export function routeWalker(points: readonly LonLat[]): (t: number) => [number, number] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] ?? [0, 0];
    const [bx, by] = points[i] ?? [0, 0];
    const k = Math.cos((((ay + by) / 2) * Math.PI) / 180);
    const d = Math.hypot((bx - ax) * k, by - ay);
    seg.push(d);
    total += d;
  }
  return (t) => {
    let left = Math.min(Math.max(t, 0), 1) * total;
    for (let i = 0; i < seg.length; i++) {
      const d = seg[i] ?? 0;
      if (left <= d || i === seg.length - 1) {
        const [ax, ay] = points[i] ?? [0, 0];
        const [bx, by] = points[i + 1] ?? [ax, ay];
        const f = d > 0 ? Math.min(left / d, 1) : 0;
        return [ax + (bx - ax) * f, ay + (by - ay) * f];
      }
      left -= d;
    }
    const last = points[points.length - 1] ?? [0, 0];
    return [last[0], last[1]];
  };
}
