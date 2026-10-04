/**
 * Works without a network once the reader has saved the globe (Settings → "Save for use
 * offline") or simply opened it before: what was fetched is kept and served when the network
 * is gone.
 *
 *   the build (assets/, vendor/: names carry their hash)  kept for good, served from the cache
 *   pages and data (data/, the static pages)              the network first, the cache offline
 *   relief tiles (another host)                           from the cache once fetched, up to
 *                                                          TILE_MAX tiles, oldest dropped first;
 *                                                          the saved relief kept apart, never dropped
 *
 * Data goes to the network first even when it is cached: a deploy changes data and code
 * together, and new code must not read old data. offline.json (written by the build, see
 * vite.config.ts) lists the files a save fetches; the relief to save is sent by the page.
 * The build writes its id below, so each deploy installs this worker anew and drops the
 * built files of the one before.
 */
const BUILD = "dev";
const SHELL = "hg-shell";
const DATA = "hg-data";
const TILES = "hg-tiles";
const SAVED_TILES = "hg-tiles-saved";
const TILE_MAX = 4000;

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await prune();
    })(),
  );
});

/** Built files of earlier deploys are dropped: only the current build's stay. */
async function prune() {
  const list = await fetch("offline.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!list) return;
  const keep = new Set(list.files.map((f) => new URL(f, self.registration.scope).href));
  const cache = await caches.open(SHELL);
  for (const request of await cache.keys())
    if (/\/(assets|vendor)\//.test(request.url) && !keep.has(request.url))
      await cache.delete(request);
}

const built = (url) => /\/(assets|vendor)\//.test(url.pathname);
const tile = (url) => /\/\d+\/\d+\/\d+\.(webp|png)$/.test(url.pathname);
// A failed write (the storage quota) must not cost the reader the response itself.
const keep = (cache, key, response) => {
  cache.put(key, response).catch(() => undefined);
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // The renderer asks whether a data file is there before it loads it (HEAD): offline, a
  // saved file is.
  if (request.method === "HEAD" && url.origin === self.location.origin) {
    event.respondWith(headOffline(request));
    return;
  }
  if (request.method !== "GET") return;
  // The visit counter's script and its calls (privacy.html) go to the network as they are.
  if (url.pathname.startsWith("/_vercel/")) return;
  if (url.origin === self.location.origin) {
    if (built(url)) event.respondWith(cacheFirst(SHELL, request));
    else if (request.mode === "navigate") event.respondWith(networkFirst(SHELL, request, true));
    else event.respondWith(networkFirst(DATA, request, false));
  } else if (tile(url)) event.respondWith(tileFirst(request));
});

async function headOffline(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const hit = await caches.match(request, { ignoreMethod: true, ignoreVary: true });
    if (hit) return new Response(null, { status: 200, headers: hit.headers });
    throw error;
  }
}

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  // The page asks for modules with an Origin header, the save did not: a host that answers
  // "Vary: Origin" would make them different requests.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) keep(cache, request, response.clone());
  return response;
}

/** A relief tile: the saved set first, then the ones looked at, then the network. */
async function tileFirst(request) {
  const saved = await (await caches.open(SAVED_TILES)).match(request, { ignoreVary: true });
  if (saved) return saved;
  const cache = await caches.open(TILES);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    keep(cache, request, response.clone());
    void trimTiles(cache);
  }
  return response;
}

async function networkFirst(name, request, page) {
  const cache = await caches.open(name);
  try {
    const response = await fetch(request);
    if (response.ok) keep(cache, request, response.clone());
    return response;
  } catch (error) {
    // The address of the app carries the view (?year=…&place=…): any of them is the app.
    const hit =
      (await cache.match(request, { ignoreSearch: page, ignoreVary: true })) ??
      (page
        ? await cache.match(new URL("./", self.registration.scope).href, { ignoreVary: true })
        : undefined);
    if (hit) return hit;
    throw error;
  }
}

let trimming = false;
async function trimTiles(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    // Kept in the order put: the first are the oldest.
    for (const request of keys.slice(0, Math.max(0, keys.length - TILE_MAX)))
      await cache.delete(request);
  } finally {
    trimming = false;
  }
}

/**
 * A save, asked by the page: { type: "save", tiles: [urls] }. Progress goes back as
 * { type: "save", done, total } and ends with { type: "saved", failed } or { type: "save-error" }.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "save") return;
  const client = event.source;
  event.waitUntil(save(event.data.tiles ?? [], client));
});

async function save(tiles, client) {
  const post = (message) => client?.postMessage(message);
  try {
    const list = await fetch("offline.json", { cache: "no-store" }).then((r) => r.json());
    const scope = self.registration.scope;
    const jobs = [
      ...list.files.map((f) => {
        const url = new URL(f, scope);
        return { url: url.href, cache: built(url) ? SHELL : DATA };
      }),
      { url: new URL("./", scope).href, cache: SHELL },
      ...tiles.map((t) => ({ url: t, cache: SAVED_TILES })),
    ];
    let done = 0;
    let failed = 0;
    const open = {
      [SHELL]: await caches.open(SHELL),
      [DATA]: await caches.open(DATA),
      [SAVED_TILES]: await caches.open(SAVED_TILES),
    };
    // Six at a time, as a browser fetches from one host.
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          const cache = open[job.cache];
          // A built file never changes under its name; the page and the data are fetched
          // anew, so a save after a deploy keeps the new code with the new data.
          const url = new URL(job.url);
          if (!(built(url) && (await cache.match(job.url, { ignoreVary: true })))) {
            const response = await fetch(job.url, { cache: "no-cache" });
            if (response.ok) await cache.put(job.url, response);
            // A relief tile out at sea is not served (404): nothing to keep, nothing lost.
            else if (!(job.cache === SAVED_TILES && response.status === 404)) failed += 1;
          }
        } catch {
          failed += 1;
        }
        done += 1;
        if (done % 10 === 0 || done === jobs.length)
          post({ type: "save", done, total: jobs.length });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    await prune();
    post({ type: "saved", failed });
  } catch {
    post({ type: "save-error" });
  }
}
