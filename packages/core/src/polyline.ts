// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { LonLat } from "./renderer.ts";

interface Segment {
  readonly a: LonLat;
  readonly b: LonLat;
  /** Length along the line to `a` and to `b`. */
  readonly from: number;
  readonly to: number;
}

/**
 * The point at a fraction of a polyline's length: t = 0 is the first point, t = 1 the last.
 * Length is measured on the map, a degree of longitude counted shorter by the cosine of the
 * ends' middle latitude, so a line walked back gives the same points.
 */
export function alongPath(points: readonly LonLat[]): (t: number) => [number, number] {
  const [start] = points;
  const end = points.at(-1);
  if (!start || !end) throw new RangeError("a polyline needs a point");
  const k = Math.cos((((start[1] + end[1]) / 2) * Math.PI) / 180);
  const segments: Segment[] = [];
  let length = 0;
  for (const b of points.slice(1)) {
    const a = segments.at(-1)?.b ?? start;
    const to = length + Math.hypot((b[0] - a[0]) * k, b[1] - a[1]);
    segments.push({ a, b, from: length, to });
    length = to;
  }
  return (t) => {
    const d = Math.min(Math.max(t, 0), 1) * length;
    const s = segments.find((x) => x.to >= d) ?? segments.at(-1);
    if (!s) return [start[0], start[1]];
    const f = s.to > s.from ? Math.min(1, Math.max(0, (d - s.from) / (s.to - s.from))) : 0;
    return [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f];
  };
}

/** `n` points evenly along a line of several parts (a way by road), both ends included. */
export function pointsAlongPath(path: readonly LonLat[], n: number): LonLat[] {
  if (path.length === 0) return [];
  const at = alongPath(path);
  return Array.from({ length: n }, (_, i) => at(n > 1 ? i / (n - 1) : 0));
}
