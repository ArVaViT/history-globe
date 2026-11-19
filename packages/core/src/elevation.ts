import type { LonLat } from "./renderer.ts";

/** The relief's tiles are 512 px across. */
const SIZE = 512;
/**
 * How many tiles are kept, the ones read last: a megabyte each, and a tour's legs cross a few
 * dozen, which kept all held a hundred megabytes for the session.
 */
const KEEP = 32;

/** The tile a point falls in at a zoom (web Mercator, 512 px tiles), and its pixel in that tile. */
export function tilePixel(
  lon: number,
  lat: number,
  zoom: number,
): { x: number; y: number; px: number; py: number } {
  const world = SIZE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  const wx = Math.floor(((lon + 180) / 360) * world);
  const wy = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world);
  return { x: Math.floor(wx / SIZE), y: Math.floor(wy / SIZE), px: wx % SIZE, py: wy % SIZE };
}

/**
 * A terrarium pixel's height in metres, or null at sea. The Dead Sea shore, about −430 m, is
 * the lowest land; lower is the sea floor. The open sea is a blank tile, exactly 0 before
 * rounding (land carries fractions).
 */
export function decodeTerrarium(r: number, g: number, b: number): number | null {
  const h = r * 256 + g + b / 256 - 32768;
  return h < -440 || h === 0 ? null : Math.round(h);
}

/**
 * Heights above sea level read from the relief's own tiles (terrarium encoding), the map's
 * source of the terrain: one tile per point, at zoom 11 by default (about 40 m a pixel in the
 * Levant), fetched once and kept. A point at sea, or a tile that cannot be read, gives null.
 */
export function elevationReader(
  template: string,
  zoom = 11,
): (points: readonly LonLat[]) => Promise<(number | null)[]> {
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
        .replace("{z}", String(zoom))
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

  return (points) =>
    Promise.all(
      points.map(async ([lon, lat]) => {
        const { x, y, px, py } = tilePixel(lon, lat, zoom);
        const img = await tile(x, y);
        if (!img) return null;
        const i = (py * SIZE + px) * 4;
        const [r = 0, g = 0, b = 0] = img.data.subarray(i, i + 3);
        return decodeTerrarium(r, g, b);
      }),
    );
}
