/**
 * Sends the pages that changed since the last run to IndexNow (scripts/indexnow-core.ts says
 * how they are chosen). Run by .github/workflows/indexnow.yml after a production deploy, and
 * by hand with `gh workflow run indexnow.yml`; it reads the live site only, so it needs no
 * build and no dependencies.
 *
 * A failed request (the network, the endpoint) is reported and the run still succeeds: the
 * pages it carried stay unsent in the state file and go with the next run.
 *
 * Usage: node scripts/indexnow.ts [--state <file>] [--all] [--dry-run]
 *   SITE_URL   the live site (https://historyglobe.app by default)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  batches,
  changedUrls,
  hashesByUrl,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  isSitemapIndex,
  requestBody,
  sitemapLocs,
  type SentState,
} from "./indexnow-core.ts";

const site = (process.env.SITE_URL ?? "https://historyglobe.app").replace(/\/+$/, "");
const args = process.argv.slice(2);
const stateFile = args.includes("--state") ? args[args.indexOf("--state") + 1] : undefined;
const all = args.includes("--all");
const dryRun = args.includes("--dry-run");

async function text(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": "history-globe-indexnow" } });
    if (!r.ok) {
      console.warn(`indexnow: ${url} answered ${String(r.status)}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.warn(`indexnow: ${url} failed: ${String(e)}`);
    return null;
  }
}

async function main(): Promise<void> {
  // Without the key file on the site every engine refuses the request: nothing to do yet.
  const key = await text(`${site}/${INDEXNOW_KEY}.txt`);
  if (key?.trim() !== INDEXNOW_KEY) {
    console.warn(`indexnow: ${site}/${INDEXNOW_KEY}.txt does not hold the key; nothing sent`);
    return;
  }
  const root = await text(`${site}/sitemap.xml`);
  if (root === null) return;
  const urls: string[] = [];
  if (isSitemapIndex(root)) {
    for (const loc of sitemapLocs(root)) {
      const xml = await text(loc);
      if (xml !== null) urls.push(...sitemapLocs(xml));
    }
  } else urls.push(...sitemapLocs(root));
  const own = urls.filter((u) => u.startsWith(`${site}/`));

  const hashesText = await text(`${site}/page-hashes.json`);
  const hashes = hashesText
    ? hashesByUrl(site, JSON.parse(hashesText) as Record<string, string>)
    : {};
  const sent =
    !all && stateFile && existsSync(stateFile)
      ? (JSON.parse(readFileSync(stateFile, "utf8")) as SentState)
      : null;
  const { send, gone, next } = changedUrls(own, hashes, sent);
  const list = [...send, ...gone];
  console.log(
    `indexnow: ${String(own.length)} pages in the sitemap; ${String(send.length)} new or changed, ${String(gone.length)} gone${sent ? "" : " (no earlier run: all)"}`,
  );

  // What is recorded: the earlier state, with each batch that went through brought up to date.
  const state: Record<string, string> = { ...(sent ?? {}) };
  let ok = 0;
  for (const batch of batches(list)) {
    if (dryRun) {
      console.log(`indexnow: would send ${String(batch.length)}, e.g. ${batch[0] ?? ""}`);
      continue;
    }
    try {
      const r = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: requestBody(site, batch),
      });
      // 200: received; 202: received, the key is still being checked.
      if (r.status === 200 || r.status === 202) {
        ok += batch.length;
        for (const u of batch) {
          const h = next[u];
          if (h === undefined) Reflect.deleteProperty(state, u);
          else state[u] = h;
        }
      } else console.warn(`indexnow: ${String(batch.length)} pages refused: ${String(r.status)}`);
    } catch (e) {
      console.warn(`indexnow: ${String(batch.length)} pages not sent: ${String(e)}`);
    }
  }
  console.log(`indexnow: ${String(ok)} of ${String(list.length)} sent`);
  if (stateFile && !dryRun) {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state));
  }
}

try {
  await main();
} catch (e) {
  // A malformed answer is reported, not fatal: the next deploy tries again.
  console.warn(`indexnow: ${String(e)}`);
}
