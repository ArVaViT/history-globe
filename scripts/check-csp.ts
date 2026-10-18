/**
 * The Content-Security-Policy's `script-src` (apps/web/vercel.json) allows the site's own
 * scripts and, by hash, each inline script its pages carry. A page whose inline script
 * changes without a new hash would stop running it in production and nowhere else (the dev
 * server sends no such header), so this check runs on the build: every inline script of
 * every page in apps/web/dist has its hash in every policy, and no policy keeps a hash
 * nothing uses. It prints the hashes to paste when it fails. Every policy also has a
 * default-src, so that what no directive names is not allowed from anywhere.
 *
 * Usage: node scripts/check-csp.ts  (after the build)
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "apps/web/dist");

function* html(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* html(p);
    else if (e.name.endsWith(".html")) yield p;
  }
}

// Inline scripts that run: no src, and JavaScript (not JSON-LD or another data block).
const used = new Map<string, string>();
for (const file of html(dist))
  for (const m of readFileSync(file, "utf8").matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] ?? "";
    const type = /type="([^"]+)"/.exec(attrs)?.[1];
    if (/\ssrc=/.test(attrs) || (type && type !== "module" && type !== "text/javascript")) continue;
    const hash = `'sha256-${createHash("sha256")
      .update(m[2] ?? "")
      .digest("base64")}'`;
    if (!used.has(hash)) used.set(hash, file.slice(dist.length + 1));
  }

const vercel = JSON.parse(readFileSync(join(root, "apps/web/vercel.json"), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const policies = vercel.headers.flatMap((h) =>
  h.headers
    .filter((x) => x.key === "Content-Security-Policy")
    .map((x) => ({ source: h.source, value: x.value })),
);
const errors: string[] = [];
if (policies.length === 0) errors.push("vercel.json has no Content-Security-Policy");
for (const p of policies) {
  // What no directive names falls back to default-src: without it, anything is allowed.
  if (!/(^|;)\s*default-src\s/.test(p.value)) errors.push(`${p.source}: no default-src`);
  const scriptSrc = /script-src([^;]*)/.exec(p.value)?.[1];
  if (scriptSrc === undefined) {
    errors.push(`${p.source}: no script-src`);
    continue;
  }
  const listed = new Set(scriptSrc.match(/'sha256-[^']+'/g) ?? []);
  for (const [hash, page] of used)
    if (!listed.has(hash)) errors.push(`${p.source}: no ${hash} (inline script of ${page})`);
  for (const hash of listed)
    if (!used.has(hash)) errors.push(`${p.source}: ${hash} is used by no page`);
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\nThe inline scripts' hashes now:\n${[...used.keys()].join(" ")}`);
  process.exit(1);
}
console.log(
  `csp: ${String(used.size)} inline scripts, each allowed by hash in ${String(policies.length)} policies`,
);
