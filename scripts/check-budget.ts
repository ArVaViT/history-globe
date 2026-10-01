/**
 * JS budget (ADR 0010): everything needed before the first map frame, the entry chunk,
 * the renderer chunk it loads at once and MapLibre's own files under vendor/ (library,
 * worker and the module they share), at most 420 kB gzip (1 kB = 1000 bytes); raised from
 * 400 for the settings window and the timeline zoom (ADR 0011).
 *
 * Usage: node scripts/check-budget.ts  (after `pnpm build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 420;
const dist = join(import.meta.dirname, "../apps/web/dist");
const js = readdirSync(dist, { recursive: true, encoding: "utf8" })
  .filter((f) => /^(assets|vendor)\//.test(f) && /\.m?js$/.test(f))
  .map((f) => join(dist, f));
if (!js.some((f) => relative(dist, f).startsWith("assets")))
  throw new Error("no built JS: run `pnpm build` first");
if (!js.some((f) => f.endsWith("maplibre-gl-worker.mjs")))
  throw new Error("MapLibre's worker is missing from the build (vite.config.ts)");

let total = 0;
for (const f of js) {
  const kb = gzipSync(readFileSync(f)).length / 1000;
  total += kb;
  console.log(`${relative(dist, f).padEnd(56)} ${kb.toFixed(1)} kB gzip`);
}
console.log(`total ${total.toFixed(1)} kB gzip, budget ${String(BUDGET_KB)} kB`);
if (total > BUDGET_KB) {
  console.error(`over the JS budget by ${(total - BUDGET_KB).toFixed(1)} kB (ADR 0010)`);
  process.exit(1);
}
