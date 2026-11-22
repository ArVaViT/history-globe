/**
 * Writes apps/web/public/licenses/third-party.txt: the licence text, with its copyright, of
 * every package whose code or files the site ships. The list is read from the build, not
 * kept by hand, so a package that enters or leaves the bundles enters or leaves the file:
 *
 * - the app's chunks (apps/web/dist/assets): the packages their source maps list
 *   (apps/web/maps, written by `pnpm build`);
 * - MapLibre's files under dist/vendor/: the packages listed by the source maps MapLibre
 *   publishes for those very files, and by the map of any bundled file that has its own
 *   (geojson-vt carries kdbush);
 * - the fonts the app and the static pages serve (assets/, docs/fonts/), by their package;
 * - Tailwind CSS, whose base styles the app's stylesheet carries;
 * - the bundler's own helpers, which no source map lists: Rolldown's runtime (its chunk) and
 *   Vite's module preload code (found by what it does).
 *
 * Usage: node scripts/third-party-licenses.ts [--check]  (pnpm licenses), after `pnpm build`.
 * With --check it writes nothing and fails when the file is not what the build needs
 * (`pnpm gate` runs it so).
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const web = join(import.meta.dirname, "../apps/web");
const dist = join(web, "dist");
const out = join(web, "public/licenses/third-party.txt");
const check = process.argv.includes("--check");

interface Package {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
  /** Where the site ships it: "app", "MapLibre", "fonts". */
  readonly where: Set<string>;
}
const packages = new Map<string, Package>();
const problems: string[] = [];

/** Every file under a folder, as paths. */
function* filesUnder(dir: string): Generator<string> {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* filesUnder(path);
    else yield path;
  }
}

/**
 * The packages a path inside node_modules runs through, outermost first, each with the part
 * of the path that leads to it from the one before: ".../node_modules/@maplibre/
 * maplibre-gl-style-spec/dist/node_modules/quickselect/index.mjs" is the style spec, then
 * "dist/node_modules/quickselect" inside it.
 */
function packagesOf(path: string): { name: string; step: string; rest: string } | undefined {
  // pnpm's store (node_modules/.pnpm/<name>@<version>/node_modules/<name>) is no package.
  let at = path.indexOf("node_modules/");
  while (at >= 0 && path.startsWith(".", at + "node_modules/".length))
    at = path.indexOf("node_modules/", at + 1);
  if (at < 0) return undefined;
  const after = path.slice(at + "node_modules/".length);
  const parts = after.split("/");
  const name = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1] ?? ""}` : (parts[0] ?? "");
  return {
    name,
    step: path.slice(0, at + "node_modules/".length + name.length),
    rest: after.slice(name.length + 1),
  };
}

/**
 * Where the package a bundled file came from is installed, and the file itself when it is on
 * disk. Each package on the path is looked for where the path says, else as Node would find
 * it from the package before it (installed); so a copy that maplibre-gl-style-spec carries
 * in its own dist/node_modules, which has no package.json, is the version the style spec
 * itself depends on, never one picked up elsewhere.
 */
function locate(path: string, owner: string): { dir: string; file: string } | undefined {
  let pkg = packagesOf(path);
  if (!pkg) return undefined;
  let dir = existsSync(join(pkg.step, "package.json")) ? pkg.step : installed(pkg.name, owner);
  // The folder the path itself names, which may hold a copy with no package.json.
  let onDisk = existsSync(pkg.step) ? pkg.step : dir;
  for (;;) {
    if (!dir || !onDisk) return undefined;
    const inner = packagesOf(pkg.rest);
    if (!inner) {
      const copy = join(onDisk, pkg.rest);
      return { dir, file: existsSync(copy) ? copy : join(dir, pkg.rest) };
    }
    const literal = join(onDisk, inner.step);
    // A copy with no package.json is the version the package carrying it depends on; MapLibre's
    // own when that is not installed.
    const next = existsSync(join(literal, "package.json"))
      ? literal
      : (installed(inner.name, dir) ?? installed(inner.name, owner));
    onDisk = existsSync(literal) ? literal : next;
    dir = next;
    pkg = inner;
  }
}

/**
 * A package's licence text: its LICENSE (or LICENCE, COPYING) file, or else the licence
 * section of its README (murmurhash-js has no licence file).
 */
function licenceText(dir: string, name: string): string {
  const file = readdirSync(dir)
    .sort()
    .find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  // Vite's file goes on with the licences of what its own build bundles, which is not shipped.
  if (file)
    return (
      readFileSync(join(dir, file), "utf8")
        .split(/^# Licenses of bundled dependencies$/m)[0]
        ?.trim() ?? ""
    );
  const readme = readdirSync(dir)
    .sort()
    .find((f) => /^readme(\.md)?$/i.test(f));
  const section = readme
    ? /^#+ *Licen[cs]e\b.*$\n([\s\S]*?)(?=^#+ |(?![\s\S]))/im.exec(
        readFileSync(join(dir, readme), "utf8"),
      )
    : null;
  if (section?.[1]?.trim()) return section[1].trim();
  problems.push(`${name}: no licence text in ${dir}`);
  return "";
}

/** Records a package as shipped in a part of the site. */
function add(dir: string, where: string): void {
  const real = realpathSync(dir);
  const known = packages.get(real);
  if (known) {
    known.where.add(where);
    return;
  }
  const meta = JSON.parse(readFileSync(join(real, "package.json"), "utf8")) as {
    name: string;
    version: string;
    license?: string;
  };
  const text = licenceText(real, meta.name);
  // The copyright line is what the licences ask to keep with every copy.
  if (text && !/copyright|©/i.test(text)) problems.push(`${meta.name}: its licence names no one`);
  packages.set(real, {
    name: meta.name,
    version: meta.version,
    // "(MIT OR Apache-2.0)" without its brackets: the list puts the licence in brackets.
    license: meta.license?.replace(/^\((.*)\)$/, "$1") ?? "see the text",
    text,
    where: new Set([where]),
  });
}

/**
 * Where a package is installed for another, as Node would find it: in a node_modules folder
 * of the other's folder or of one above it (with pnpm, beside it). Not by `require.resolve`,
 * which a package's "exports" can refuse.
 */
function installed(name: string, from: string): string | undefined {
  // From the package's real folder: with pnpm, its own dependencies are installed beside it.
  for (let dir = realpathSync(from); dir !== dirname(dir); dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
  }
  return undefined;
}

interface SourceMap {
  readonly sources: string[];
  readonly sourceRoot?: string;
}
const readMap = (path: string) => JSON.parse(readFileSync(path, "utf8")) as SourceMap;

/**
 * The packages a source map lists. A source is found on disk where the map says; one a
 * package was built from elsewhere ("../node_modules/kdbush/index.js" in MapLibre's maps) is
 * found by its name from the package that bundled it. A bundled file with a map of its own
 * is followed in turn.
 */
function fromMap(mapPath: string, owner: string, where: string, seen = new Set<string>()): void {
  if (seen.has(mapPath)) return;
  seen.add(mapPath);
  const map = readMap(mapPath);
  const base = resolve(dirname(mapPath), map.sourceRoot ?? "");
  for (const source of map.sources) {
    const path = resolve(base, source.replace(/\?.*$/, ""));
    if (!path.includes("node_modules/")) continue;
    const found = locate(path, owner);
    if (!found) {
      problems.push(`${source}: bundled by ${owner}, but its package is not installed beside it`);
      continue;
    }
    // A font a chunk imports by its address is shipped as a font, not as code.
    add(found.dir, /\.(woff2?|ttf|otf)$/.test(path) ? "fonts" : where);
    if (existsSync(`${found.file}.map`)) fromMap(`${found.file}.map`, found.dir, where, seen);
  }
}

if (!existsSync(join(dist, "index.html")) || !existsSync(join(web, "maps")))
  throw new Error("third-party-licenses: build first (pnpm build)");

// The app's chunks.
for (const path of filesUnder(join(web, "maps")))
  if (path.endsWith(".map")) fromMap(path, web, "app");

// MapLibre's files under vendor/, by the maps of the package files they are copies of.
const requireWeb = createRequire(join(web, "package.json"));
const maplibre = dirname(requireWeb.resolve("maplibre-gl/package.json"));
const { version: maplibreVersion } = JSON.parse(
  readFileSync(join(maplibre, "package.json"), "utf8"),
) as { version: string };
for (const folder of readdirSync(join(dist, "vendor")).sort()) {
  if (folder !== `maplibre-gl-${maplibreVersion}`)
    problems.push(`vendor/${folder}: not the installed maplibre-gl ${maplibreVersion}`);
  for (const name of readdirSync(join(dist, "vendor", folder))
    .sort()
    .filter((f) => f.endsWith(".mjs"))) {
    const map = join(maplibre, "dist", `${name}.map`);
    if (!existsSync(map)) problems.push(`vendor/${folder}/${name}: MapLibre has no map for it`);
    else fromMap(map, maplibre, "MapLibre");
  }
  add(maplibre, "MapLibre");
}

// The fonts, by the package that has a file of that name: the build adds a hash to it.
const fontsource = join(web, "node_modules/@fontsource-variable");
const families = readdirSync(fontsource)
  .sort()
  .map((f) => join(fontsource, f));
const fonts = [
  ...filesUnder(join(dist, "assets")),
  ...(existsSync(join(dist, "docs/fonts")) ? filesUnder(join(dist, "docs/fonts")) : []),
].filter((f) => /\.(woff2?|ttf|otf)$/.test(f));
for (const font of fonts) {
  const name = font.split("/").pop() ?? "";
  const names = [name, name.replace(/-[\w-]{8}(\.\w+)$/, "$1")];
  const family = families.find((f) => names.some((n) => existsSync(join(f, "files", n))));
  if (family) add(family, "fonts");
  else problems.push(`${font}: a font from no package of @fontsource-variable`);
}

// The bundler's helpers, in the chunks without a source of their own in any map.
const requireVite = createRequire(requireWeb.resolve("vite/package.json"));
const chunks = [...filesUnder(join(dist, "assets"))].filter((f) => f.endsWith(".js"));
if (chunks.some((f) => /\/rolldown-runtime-[\w-]+\.js$/.test(f)))
  add(dirname(requireVite.resolve("rolldown/package.json")), "app");
if (
  chunks.some((f) =>
    /relList[\s\S]{0,80}supports\([`'"]modulepreload/.test(readFileSync(f, "utf8")),
  )
)
  add(dirname(requireWeb.resolve("vite/package.json")), "app");

// Tailwind's base styles (preflight) and generated rules, in the app's stylesheet.
const css = [...filesUnder(join(dist, "assets"))].filter((f) => f.endsWith(".css"));
if (css.some((f) => readFileSync(f, "utf8").includes("@layer theme")))
  add(dirname(requireWeb.resolve("tailwindcss/package.json")), "app");

const WHERE: Record<string, string> = {
  app: "the app (assets/)",
  MapLibre: `MapLibre GL JS (vendor/maplibre-gl-${maplibreVersion}/)`,
  fonts: "the fonts (assets/, docs/fonts/)",
};
const list = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
const line = "=".repeat(78);
const text =
  `Third-party software in History Globe, with its licence texts. The list is read from the\n` +
  `build (scripts/third-party-licenses.ts): every package whose code or files the site ships.\n` +
  `The UI icons: see lucide-icons.txt.\n\n` +
  Object.entries(WHERE)
    .map(
      ([key, title]) =>
        `In ${title}:\n${list
          .filter((p) => p.where.has(key))
          .map((p) => `  ${p.name} ${p.version} (${p.license})\n`)
          .join("")}`,
    )
    .join("\n") +
  `\n${list
    .map(
      (p) =>
        `${line}\n${p.name} ${p.version} (${p.license}), in ${[...p.where].map((w) => WHERE[w] ?? w).join(", ")}\n${line}\n\n${p.text}\n`,
    )
    .join("\n")}`;

for (const p of problems) console.error(`third-party-licenses: ${p}`);
if (problems.length) process.exit(1);
if (check) {
  const now = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (now !== text) {
    console.error(
      `third-party-licenses: ${out} is not what the build ships; run pnpm licenses and commit it`,
    );
    process.exit(1);
  }
  console.log(`third-party licences: ${String(list.length)} packages, up to date`);
} else {
  writeFileSync(out, text);
  console.log(`wrote ${out}: ${String(list.length)} packages`);
}
