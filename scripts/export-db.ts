/**
 * A built data release as CSV, one file per table of db/migrations, for `\copy` into
 * Supabase (db/README.md). Reads apps/web/public/data after `pnpm data`;
 * writes db/seed/*.csv (not committed: rebuilt from the release). Nothing is written when a
 * key would fail the load (scripts/export-db-core.ts).
 *
 * Usage: node scripts/export-db.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { csv, type Release, seedProblems, seedTables } from "./export-db-core.ts";

const root = join(import.meta.dirname, "..");
const data = join(root, "apps/web/public/data");
const out = join(root, "db/seed");

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the shape of the file
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const inData = (file: string) => join(data, file);

type Features = { features: Release["places"] };
const ancientSources = Object.fromEntries(
  readdirSync(join(root, "content"))
    .filter((f) => /^ancient-sites(-wave\d+)?\.json$/.test(f))
    .flatMap(
      (f) =>
        read<{ sites: { id: string | number; sources: string[] }[] }>(join(root, "content", f))
          .sites,
    )
    .map((s) => [String(s.id), s.sources]),
);

const tables = seedTables({
  manifest: read(inData("manifest.json")),
  extraSources: [
    {
      id: "pleiades",
      title: "Pleiades: A Gazetteer of Past Places",
      url: "https://pleiades.stoa.org",
      license: "CC BY 3.0",
      license_url: "https://creativecommons.org/licenses/by/3.0/us/",
      credit: "Periods of places: Pleiades (ISAW, NYU), CC BY 3.0, modified",
    },
  ],
  places: read<Features>(inData("places.geojson")).features,
  sites: read<Features>(inData("sites.geojson")).features,
  ancient: read<Features>(inData("ancient.geojson")).features,
  ancientSources,
  content: read(inData("content.json")),
  wikidata: read<{ places: Record<string, string> }>(join(root, "content/wikidata.json")).places,
  // The articles in every language in one file (build-content.ts).
  articles: Object.values(
    read<Record<string, Record<string, unknown>>>(join(root, "apps/web/build/articles.json")),
  ),
  polities: [
    ...read<{ features: Release["polities"] }>(inData("polities.geojson")).features,
    ...read<{ features: Release["polities"] }>(inData("polities-late.geojson")).features,
  ],
  people: read(inData("people.json")),
});

const problems = seedProblems(tables);
if (problems.length) {
  console.error(
    `db seed: nothing written, the load would fail:\n${problems.slice(0, 40).join("\n")}`,
  );
  process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const [name, table] of Object.entries(tables))
  writeFileSync(join(out, `${name}.csv`), csv(table));
console.log(
  `db seed (${tables.release?.rows[0]?.[0] as string}): ${Object.entries(tables)
    .map(([k, v]) => `${k} ${String(v.rows.length)}`)
    .join(", ")}`,
);
