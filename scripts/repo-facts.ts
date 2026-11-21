/**
 * What the repository's own front pages say of the data, checked against the build
 * (build-docs.ts runs both checks, so `pnpm content` and `pnpm gate` refuse a stale page):
 *
 * - the numbers in README.md and CITATION.cff, against the built data, and their release date,
 *   which must not be later than the data;
 * - docs/ATTRIBUTIONS.md and the sources page in every language, against the registry of
 *   sources: every source the data build reads (manifest.json, `sources` and
 *   `other_sources`) and every Bible edition (scripts/bible-text.ts) is credited in both.
 */

/** The counts the front pages cite, as the build has them. */
export interface Facts {
  /** Places named in the Bible (a verse names them; each has a page). */
  readonly named: number;
  /** Place records in all. */
  readonly records: number;
  readonly articles: number;
  readonly questions: number;
  readonly tours: number;
  readonly events: number;
  readonly battles: number;
  /** People in the open data (api/v1/people.json). */
  readonly people: number;
  /** Of them, the people the map shows with their families (data/people.json). */
  readonly peopleOnMap: number;
  /** Notes on what ancient authors wrote, and the places they are about. */
  readonly notes: number;
  readonly notedPlaces: number;
  /** Places of the ancient world the Bible does not name. */
  readonly ancient: number;
  readonly photos: number;
  readonly languages: number;
  /** The data's date, `built_at` in api/v1/index.json (YYYY-MM-DD). */
  readonly built: string;
}

/** A phrase of README.md or CITATION.cff, and the count its number must be. */
const PHRASES: readonly (readonly [RegExp, keyof Facts])[] = [
  [/(\d[\d,]*)\s+places\s+named\s+in\s+the\s+Bible/g, "named"],
  [/\((\d[\d,]*)\s+place\s+records/g, "records"],
  [/(\d[\d,]*)\s+place\s+articles/g, "articles"],
  [/for\s+(\d[\d,]*)\s+of\s+them,\s+an\s+article/g, "articles"],
  [/(\d[\d,]*)\s+answered\s+questions/g, "questions"],
  [/(\d[\d,]*)\s+tours/g, "tours"],
  [/(\d[\d,]*)\s+(?:dated\s+)?events/g, "events"],
  [/(\d[\d,]*)\s+battles/g, "battles"],
  [/(\d[\d,]*)\s+people/g, "people"],
  [/(\d[\d,]*)\s+of\s+them\s+with\s+their\s+families/g, "peopleOnMap"],
  [/(\d[\d,]*)\s+notes\s+on\s+what\s+ancient/g, "notes"],
  [/wrote\s+about\s+(\d[\d,]*)\s+of\s+the/g, "notedPlaces"],
  [/(\d[\d,]*)\s+places\s+of\s+the\s+ancient\s+world/g, "ancient"],
  [/(\d[\d,]*)\s+photographs/g, "photos"],
  [/(\d[\d,]*)\s+languages/g, "languages"],
];

/** The release date a front page gives (CITATION.cff; README.md's numbers are always the build's). */
const DATES: readonly RegExp[] = [
  /date-released: (\d{4}-\d{2}-\d{2})/g,
  /^version: "(\d{4}-\d{2}-\d{2})"/gm,
];

/**
 * Where a front page disagrees with the build. Its numbers must be the build's. Its date is
 * the last release's and must not be later than the data: every data build stamps
 * `built_at` with its own day, so the data is never older than the release it belongs to.
 */
export function factMismatches(file: string, text: string, facts: Facts): string[] {
  const out: string[] = [];
  for (const [re, key] of PHRASES)
    for (const m of text.matchAll(re)) {
      const said = Number((m[1] ?? "").replace(/,/g, ""));
      const is = facts[key];
      if (said !== is)
        out.push(`${file}: «${m[0].replace(/\s+/g, " ")}», the build has ${String(is)}`);
    }
  for (const re of DATES)
    for (const m of text.matchAll(re)) {
      const said = m[1] ?? "";
      if (said > facts.built) out.push(`${file}: «${m[0]}», the data is of ${facts.built}`);
    }
  return out;
}

/**
 * The names a source goes by in the credits, by its id in the manifest. A source the build
 * starts to read must be added here, and so be credited, before the check passes.
 */
export const SOURCE_NAMES: Readonly<Record<string, string>> = {
  openbible: "OpenBible.info",
  openbible_modern: "OpenBible.info",
  cliopatria: "Cliopatria",
  wikidata_coords: "Wikidata",
  natural_earth_ocean: "Natural Earth",
  natural_earth_ocean_10m: "Natural Earth",
  natural_earth_lakes: "Natural Earth",
  natural_earth_lakes_10m: "Natural Earth",
  natural_earth_rivers: "Natural Earth",
  natural_earth_land: "Natural Earth",
  stepbible_tipnr: "TIPNR",
  itinere: "Itiner-e",
  riveratlas: "RiverATLAS",
  pleiades: "Pleiades",
};

/** A Bible edition as the credits know it: its code at eBible.org or CrossWire, or its page. */
export interface Edition {
  readonly file: string;
  readonly page: string;
}

/**
 * The sources a credit leaves out: every source of the registry by its name, and every Bible
 * by its code or its page, in docs/ATTRIBUTIONS.md and in the built sources page of every
 * language (`pages`: language → the page's HTML).
 */
export function attributionGaps(
  registry: readonly string[],
  bibles: Readonly<Record<string, Edition>>,
  attributions: string,
  pages: Readonly<Record<string, string>>,
): string[] {
  const out: string[] = [];
  const flat = attributions.replace(/\s+/g, " ");
  for (const id of registry) {
    const name = SOURCE_NAMES[id];
    if (!name) {
      out.push(`manifest.json: source "${id}" has no name in SOURCE_NAMES (scripts/repo-facts.ts)`);
      continue;
    }
    if (!flat.includes(name)) out.push(`docs/ATTRIBUTIONS.md: no credit for ${name} (${id})`);
    for (const [l, html] of Object.entries(pages))
      if (!html.includes(name)) out.push(`docs/${l}/sources.html: no credit for ${name} (${id})`);
  }
  for (const [code, b] of Object.entries(bibles)) {
    const id = b.file.replace(/(_usfm)?\.zip$/, "");
    if (!flat.includes(b.page) && !(id !== b.file && flat.includes(id)))
      out.push(`docs/ATTRIBUTIONS.md: no credit for the ${code} Bible (${b.page})`);
    for (const [l, html] of Object.entries(pages))
      if (!html.includes(b.page))
        out.push(`docs/${l}/sources.html: no credit for the ${code} Bible (${b.page})`);
  }
  return out;
}
