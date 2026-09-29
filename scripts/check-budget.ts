/**
 * JS budget (ADR 0010): everything needed before the first map frame, the entry chunk
 * and the MapLibre chunk it loads at once, at most 400 kB gzip (1 kB = 1000 bytes).
 *
 * Usage: node scripts/check-budget.ts  (after `pnpm build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 400;
const assets = join(import.meta.dirname, "../apps/web/dist/assets");
const js = readdirSync(assets).filter((f) => f.endsWith(".js"));
if (js.length === 0) throw new Error("no built JS: run `pnpm build` first");

let total = 0;
for (const f of js) {
  const kb = gzipSync(readFileSync(join(assets, f))).length / 1000;
  total += kb;
  console.log(`${f.padEnd(40)} ${kb.toFixed(1)} kB gzip`);
}
console.log(`total ${total.toFixed(1)} kB gzip, budget ${String(BUDGET_KB)} kB`);
if (total > BUDGET_KB) {
  console.error(`over the JS budget by ${(total - BUDGET_KB).toFixed(1)} kB (ADR 0010)`);
  process.exit(1);
}
