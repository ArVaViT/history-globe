import type { LonLat } from "./renderer.ts";

/**
 * Heights above sea level read from the relief's own tiles (terrarium encoding, 512 px),
 * the map's source of the terrain: one tile per point, at zoom 11 by default (about 40 m
 * a pixel in the Levant), fetched once and kept. A point at sea, or a tile that cannot be
 * read, gives null.
 */
export function elevationReader(
  template: string,
  zoom = 11,
): (points: readonly LonLat[]) => Promise<(number | null)[]> {
  const ZOOM = zoom;
  const SIZE = 512;
  // The tiles read last, a megabyte each: a tour's legs cross a few dozen, and kept all
  // they held a hundred megabytes for the session.
  const KEEP = 32;
  const tiles = new Map<string, Promise<ImageData | null>>();

  const tile = (x: number, y: number): Promise<ImageData | null> => {
    const key = `${String(x)}/${String(y)}`;
    let got = tiles.get(key);
    if (got) {
      // Most recently used last.
      tiles.delete(key);
      tiles.set(key, got);
    } else {
      const url = template
        .replace("{z}", String(ZOOM))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
      got = fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => createImageBitmap(b))
        .then((bmp) => {
          const canvas = new OffscreenCanvas(SIZE, SIZE);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return null;
          ctx.drawImage(bmp, 0, 0, SIZE, SIZE);
          return ctx.getImageData(0, 0, SIZE, SIZE);
        })
        .catch(() => {
          // Not remembered: a tile that failed once (offline for a moment) is tried again.
          tiles.delete(key);
          return null;
        });
      tiles.set(key, got);
      for (const old of tiles.keys()) {
        if (tiles.size <= KEEP) break;
        tiles.delete(old);
      }
    }
    return got;
  };

  return async (points) =>
    Promise.all(
      points.map(async ([lon, lat]) => {
        const world = SIZE * 2 ** ZOOM;
        const x = ((lon + 180) / 360) * world;
        const s = Math.sin((lat * Math.PI) / 180);
        const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
        const img = await tile(Math.floor(x / SIZE), Math.floor(y / SIZE));
        if (!img) return null;
        const px = Math.floor(x) % SIZE;
        const py = Math.floor(y) % SIZE;
        const i = (py * SIZE + px) * 4;
        const [r = 0, g = 0, b = 0] = [img.data[i], img.data[i + 1], img.data[i + 2]];
        const h = r * 256 + g + b / 256 - 32768;
        // The Dead Sea shore, about −430 m, is the lowest land; lower is the sea floor. The
        // open sea is a blank tile, exactly 0 before rounding (land carries fractions).
        return h < -440 || h === 0 ? null : Math.round(h);
      }),
    );
}

/** `n` points evenly along the straight line from `a` to `b`, both ends included. */
export function pointsAlong(a: LonLat, b: LonLat, n: number): LonLat[] {
  return pointsAlongPath([a, b], n);
}

/**
 * `n` points evenly along a line of several parts (a way by road), both ends included:
 * spaced by length, a degree of longitude counted shorter away from the equator.
 */
export function pointsAlongPath(path: readonly LonLat[], n: number): LonLat[] {
  // The middle latitude of the two ends: the same spacing either way round.
  const mid = ((path[0]?.[1] ?? 0) + (path[path.length - 1]?.[1] ?? 0)) / 2;
  const k = Math.cos((mid * Math.PI) / 180);
  const at = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] ?? [0, 0];
    const b = path[i] ?? [0, 0];
    at.push((at[i - 1] ?? 0) + Math.hypot((b[0] - a[0]) * k, b[1] - a[1]));
  }
  const total = at[at.length - 1] ?? 0;
  let j = 1;
  return Array.from({ length: n }, (_, i) => {
    const d = n > 1 ? (total * i) / (n - 1) : 0;
    while (j < path.length - 1 && (at[j] ?? 0) < d) j++;
    const a = path[j - 1] ?? path[0] ?? [0, 0];
    const b = path[j] ?? a;
    const span = (at[j] ?? 0) - (at[j - 1] ?? 0);
    const f = span > 0 ? Math.min(1, Math.max(0, (d - (at[j - 1] ?? 0)) / span)) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as const;
  });
}
