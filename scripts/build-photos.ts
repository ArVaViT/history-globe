/**
 * Downloads the photos of content/photos.yaml from Wikimedia Commons, 960 px wide, into
 * apps/web/public/data/photos/<place id>.jpg, so readers load them from the site and not
 * from Wikimedia (no third-party request; the card links to the file page instead). The
 * downloads are cached in pipeline/.cache/photos; the licence was checked by the
 * content build.
 *
 * Usage: node scripts/build-photos.ts  (part of pnpm data)
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const root = join(import.meta.dirname, "..");
const cache = join(root, "pipeline/.cache/photos");
const out = join(root, "apps/web/public/data/photos");
// Wikimedia asks for an identifying User-Agent: the project, never a person.
const headers = {
  "User-Agent": "history-globe-photos/1.0 (https://github.com/ArVaViT/history-globe)",
};

const { photos } = parse(readFileSync(join(root, "content/photos.yaml"), "utf8")) as {
  photos: { place: string; file: string }[];
};
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

async function thumbUrl(file: string): Promise<string> {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({
    action: "query",
    format: "json",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "960",
  }))
    api.searchParams.set(k, v);
  const r = await fetch(api, { headers, signal: AbortSignal.timeout(30_000) });
  const data = (await r.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> };
  };
  const url = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0]?.thumburl;
  if (!url) throw new Error(`no such file on Commons: ${file}`);
  return url;
}

let fetched = 0;
for (const { place, file } of photos) {
  const cached = join(cache, `${createHash("sha256").update(file).digest("hex").slice(0, 16)}.jpg`);
  if (!existsSync(cached)) {
    const r = await fetch(await thumbUrl(file), { headers, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`${file}: ${String(r.status)}`);
    // Written beside and moved: an interrupted download never stays in the cache.
    writeFileSync(`${cached}.part`, Buffer.from(await r.arrayBuffer()));
    renameSync(`${cached}.part`, cached);
    fetched++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  copyFileSync(cached, join(out, `${place}.jpg`));
}
// A photo taken out of photos.yaml leaves the site too (its credit would be gone).
const wanted = new Set(photos.map((p) => `${p.place}.jpg`));
for (const name of readdirSync(out)) if (!wanted.has(name)) rmSync(join(out, name));
console.log(`photos: ${String(photos.length)} (${String(fetched)} downloaded)`);
