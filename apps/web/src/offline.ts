/**
 * The globe without a network (public/sw.js): the service worker keeps what was fetched, and
 * a save fetches the rest ahead — the data, the photos and the relief of the lands the
 * Bible walks, so a class with no Wi-Fi still has its map.
 */

/** The relief's tiles. Development source; production serves its own extract (ADR 0005). */
export const TERRAIN_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";

/** The service worker, in a production build only: the dev server's files change too often. */
export function registerOffline(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // No worker (a private window, a blocked origin): the globe works online as before.
    });
  });
}

/** Whether this browser can save at all (a worker in control of the page). */
export const canSave = (): boolean =>
  import.meta.env.PROD && "serviceWorker" in navigator && "caches" in window;

const tileXY = (lon: number, lat: number, z: number): [number, number] => {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  ];
};

/**
 * The relief to save: the Mediterranean to Persia down to zoom 6, the Holy Land and its
 * neighbours down to zoom 9 (224 tiles, about
 * 29 MB). Closer views are kept as they are looked at.
 */
export function reliefTiles(template = TERRAIN_TILES): string[] {
  const areas: [number, number, number, number, number, number][] = [
    // west, south, east, north, from zoom, to zoom
    [-10, 15, 65, 48, 0, 6],
    [33.8, 29.4, 36.9, 33.6, 7, 9],
  ];
  const urls = new Set<string>();
  for (const [w, s, e, n, z0, z1] of areas)
    for (let z = z0; z <= z1; z++) {
      const [x0, y0] = tileXY(w, n, z);
      const [x1, y1] = tileXY(e, s, z);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          urls.add(
            template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)),
          );
    }
  return [...urls];
}

/** The size of a save, in bytes: the files the build lists, and the relief at its average. */
export async function saveSize(): Promise<number | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}offline.json`, { cache: "no-store" });
    if (!r.ok) return null;
    const { bytes } = (await r.json()) as { bytes: number };
    // About 130 kB a tile: 221 of the 224 came back, 29 MB; three are open sea (404).
    return bytes + reliefTiles().length * 130_000;
  } catch {
    return null;
  }
}

export type SaveProgress =
  | { readonly state: "saving"; readonly done: number; readonly total: number }
  | { readonly state: "saved"; readonly failed: number }
  | { readonly state: "error" };

/** Asks the worker to save everything; progress comes back until it is done. */
export async function saveOffline(onProgress: (p: SaveProgress) => void): Promise<void> {
  // A worker that never registered (a private window) leaves `ready` pending for good.
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        resolve(null);
      }, 5000),
    ),
  ]);
  const worker = registration?.active;
  if (!worker) {
    onProgress({ state: "error" });
    return;
  }
  await new Promise<void>((resolve) => {
    const listen = (
      event: MessageEvent<{ type: string; done?: number; total?: number; failed?: number }>,
    ) => {
      const m = event.data;
      if (m.type === "save")
        onProgress({ state: "saving", done: m.done ?? 0, total: m.total ?? 0 });
      else if (m.type === "saved" || m.type === "save-error") {
        onProgress(
          m.type === "saved" ? { state: "saved", failed: m.failed ?? 0 } : { state: "error" },
        );
        navigator.serviceWorker.removeEventListener("message", listen);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", listen);
    worker.postMessage({ type: "save", tiles: reliefTiles() });
  });
}
