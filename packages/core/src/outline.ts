import type { LonLat } from "./renderer.ts";

const R = 6371008.8;
const rad = Math.PI / 180;

/** The middle of an outline: the mean of its corners (the ring's last point repeats the first). */
export function outlineCentre(ring: readonly LonLat[]): LonLat {
  const pts =
    ring.length > 1 && ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1]
      ? ring.slice(0, -1)
      : ring;
  const n = Math.max(1, pts.length);
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n];
}

/**
 * An outline carried to another point at its true size: each corner keeps its distance
 * east and north of the outline's middle, in metres, laid out again around `to`. Jerusalem's
 * walls over Babylon, or over the reader's own town, cover the ground they covered.
 */
export function moveOutline(ring: readonly LonLat[], to: LonLat): LonLat[] {
  const [cx, cy] = outlineCentre(ring);
  const kFrom = Math.cos(cy * rad);
  const kTo = Math.cos(to[1] * rad);
  return ring.map(([x, y]) => {
    const east = (x - cx) * rad * R * kFrom;
    const north = (y - cy) * rad * R;
    return [to[0] + east / (R * kTo * rad), to[1] + north / (R * rad)] as const;
  });
}

/** An outline's area in square metres and its length round in metres (flat, near its middle). */
export function outlineSize(ring: readonly LonLat[]): { area: number; perimeter: number } {
  const [, cy] = outlineCentre(ring);
  const k = Math.cos(cy * rad);
  const xy = ring.map(([x, y]) => [x * rad * R * k, y * rad * R] as const);
  let area = 0;
  let perimeter = 0;
  for (let i = 1; i < xy.length; i++) {
    const [ax, ay] = xy[i - 1] ?? [0, 0];
    const [bx, by] = xy[i] ?? [0, 0];
    area += ax * by - bx * ay;
    perimeter += Math.hypot(bx - ax, by - ay);
  }
  return { area: Math.abs(area) / 2, perimeter };
}
