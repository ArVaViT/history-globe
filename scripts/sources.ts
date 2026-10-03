/**
 * A copy of every source the data is built from, kept outside the repo: should a source
 * move, change or close (a GitHub repo deleted, an API turned off), the map can still be
 * rebuilt from the copy, byte for byte. The pipeline reads its downloads from
 * pipeline/.cache first and fetches only what is missing, so a restored cache builds
 * offline (`pnpm data && pnpm content`).
 *
 *   node scripts/sources.ts save <dir>      copy pipeline/.cache to <dir>/sources-<date>/
 *                                           with SOURCES.json (each file's size and SHA-256)
 *   node scripts/sources.ts verify <copy>   check a copy against its SOURCES.json
 *   node scripts/sources.ts restore <copy>  verify, then copy it back into pipeline/.cache
 *
 * The licences stay with the copy: docs/ATTRIBUTIONS.md is copied beside the files, and
 * apps/web/public/data/manifest.json (where each source came from) when it is built.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

const root = join(import.meta.dirname, "..");
const cache = join(root, "pipeline/.cache");

interface Entry {
  path: string;
  bytes: number;
  sha256: string;
}

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? files(join(dir, d.name))
      : d.isFile() && !d.name.startsWith(".") && !d.name.endsWith(".part")
        ? [join(dir, d.name)]
        : [],
  );
const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

function check(copy: string): Entry[] {
  const listFile = join(copy, "SOURCES.json");
  if (!existsSync(listFile)) throw new Error(`${copy}: no SOURCES.json, not a copy of the sources`);
  const list = (JSON.parse(readFileSync(listFile, "utf8")) as { files: Entry[] }).files;
  // A path is the copy's own file, never one outside it or outside the cache it goes to.
  const outside = list.filter(
    (e) => isAbsolute(e.path) || normalize(e.path).split(sep).includes("..") || e.path === "",
  );
  if (outside.length)
    throw new Error(`${copy}: paths outside the copy: ${outside.map((e) => e.path).join(", ")}`);
  const bad = list.filter((e) => {
    const file = join(copy, "cache", e.path);
    return !existsSync(file) || statSync(file).size !== e.bytes || sha256(file) !== e.sha256;
  });
  if (bad.length)
    throw new Error(
      `${copy}: ${String(bad.length)} files missing or changed: ${bad.map((e) => e.path).join(", ")}`,
    );
  return list;
}

const [command, target] = process.argv.slice(2);
if (!target || !["save", "verify", "restore"].includes(command ?? "")) {
  console.error("usage: node scripts/sources.ts save <dir> | verify <copy> | restore <copy>");
  process.exit(2);
}
const at = resolve(target.replace(/^~(?=\/)/, process.env.HOME ?? "~"));

if (command === "save") {
  if (!existsSync(cache)) throw new Error("pipeline/.cache is empty: run pnpm data first");
  // Outside the repo (a copy inside it would be 300 MB that git sees), and never over an
  // earlier copy: a second one the same day gets the time too.
  if (!relative(root, at).startsWith("..") && !isAbsolute(relative(root, at)))
    throw new Error(`${at} is inside the repo: keep the copy elsewhere`);
  const stamp = new Date().toISOString();
  let copy = join(at, `sources-${stamp.slice(0, 10)}`);
  if (existsSync(copy)) copy = `${copy}-${stamp.slice(11, 16).replace(":", "")}`;
  if (existsSync(copy)) throw new Error(`${copy} exists: not written over`);
  const list: Entry[] = [];
  for (const file of files(cache).sort()) {
    const path = relative(cache, file);
    const to = join(copy, "cache", path);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(file, to);
    list.push({ path, bytes: statSync(file).size, sha256: sha256(file) });
  }
  copyFileSync(join(root, "docs/ATTRIBUTIONS.md"), join(copy, "ATTRIBUTIONS.md"));
  const manifest = join(root, "apps/web/public/data/manifest.json");
  if (existsSync(manifest)) copyFileSync(manifest, join(copy, "manifest.json"));
  writeFileSync(
    join(copy, "SOURCES.json"),
    `${JSON.stringify({ saved: new Date().toISOString(), files: list }, null, 1)}\n`,
  );
  check(copy);
  const mb = list.reduce((a, e) => a + e.bytes, 0) / 1e6;
  console.log(`sources: ${String(list.length)} files, ${mb.toFixed(0)} MB → ${copy} (verified)`);
} else if (command === "verify") {
  const list = check(at);
  console.log(`sources: ${String(list.length)} files match SOURCES.json`);
} else {
  const list = check(at);
  for (const e of list) {
    const to = join(cache, e.path);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(at, "cache", e.path), to);
    if (statSync(to).size !== e.bytes || sha256(to) !== e.sha256)
      throw new Error(`${e.path}: the restored file differs from the copy`);
  }
  console.log(`sources: ${String(list.length)} files restored to pipeline/.cache (verified)`);
}
