/**
 * Writes apps/web/public/licenses/third-party.txt: the licence of every package whose
 * code or files reach the browser (MIT for React keeps its notice in every copy; OFL for
 * the fonts travels with them). MapLibre ships its own LICENSE under vendor/ (vite config).
 *
 * Usage: node scripts/third-party-licenses.ts — rerun after a dependency changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const web = join(import.meta.dirname, "../apps/web");
const require = createRequire(join(web, "package.json"));

/** Packages in the browser bundle or served from it (react-dom brings scheduler). */
const PACKAGES = [
  "react",
  "react-dom",
  "scheduler",
  "@fontsource-variable/golos-text",
  "@fontsource-variable/literata",
];

function dirOf(name: string): string {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    // scheduler is react-dom's own dependency: resolve it from there.
    const rd = dirname(require.resolve("react-dom/package.json"));
    return dirname(createRequire(join(rd, "package.json")).resolve(`${name}/package.json`));
  }
}

const parts = PACKAGES.map((name) => {
  const dir = dirOf(name);
  const { version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    version: string;
  };
  const licence = readFileSync(join(dir, "LICENSE"), "utf8").trim();
  return `${"=".repeat(78)}\n${name} ${version}\n${"=".repeat(78)}\n\n${licence}\n`;
});

const out = join(web, "public/licenses/third-party.txt");
writeFileSync(
  out,
  `Third-party software in History Globe, with its licence texts.\n` +
    `MapLibre GL JS ships its own LICENSE.txt next to its files under vendor/.\n` +
    `The UI icons: see lucide-icons.txt.\n\n${parts.join("\n")}`,
);
console.log(`wrote ${out}: ${String(PACKAGES.length)} packages`);
