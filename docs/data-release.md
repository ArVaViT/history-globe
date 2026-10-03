# The data release

What `apps/web/public/data` holds after `pnpm data && pnpm content`, for whoever builds on
it: the app itself, an embedding partner, the database export (`scripts/export-db.ts`,
ADR 0012). Years are astronomical integers (ADR 0003): 1 BC = 0, 586 BC = -585; spans
of states are half-open `[y0, y1)`, the years of towns and sites inclusive. Place ids are
OpenBible's (`a` and six hex digits), tour, event and article ids come from `content/`,
people's from STEP Bible's TIPNR.

`manifest.json` records when the release was built and every source with its licence,
URL, snapshot date and SHA-256. The credits shipped with the map are in
`docs/ATTRIBUTIONS.md` and on the About page; keep them with any copy of the data.

## Loaded for the first frame

| File                                                                       | What                                                      | Key fields                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `places.geojson`                                                           | the places of the Bible, one point each                   | `id`, `name` (English), `kind`, `rank` (0 most named … 3), `verses`, `ot`, `nt`, `osis` (verses, English numbering), `disputed`, `confidence` (0–1000, OpenBible's), `where` / `where_tpl` / `where_ref` (where it is today), `coord` (`openbible` or `wikidata`)                                |
| `content.json`                                                             | everything written by hand in `content/`                  | `names` (Russian names, with the Synodal verse read), `where_ru`, `tours`, `events` (with `place` or an ancient `site`), `life` (when towns stood), `photos`, `pleiades` (id and attested span), `chapter_years` (book → `[first chapter, last chapter, year]`), `articles` (place → article id) |
| `polities.geojson`, `polity-labels.geojson`                                | states to AD 500 and their label points                   | `name` (Cliopatria's), `name_ru`, `y0`, `y1`, `rel` (a vassal shape), `c` (colour index); labels also `tier`, `size`                                                                                                                                                                             |
| `water.geojson`, `coast.geojson`, `rivers.geojson`, `river-labels.geojson` | the sea, the shore, rivers (Natural Earth, public domain) | rivers: `name`, `rank`                                                                                                                                                                                                                                                                           |

## Loaded when first needed

| File                                                | When                                         | What                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sites.geojson`                                     | with the map's style, beside the first frame | candidate locations of disputed places: `place`, `share` (percent of OpenBible's sources), `label`, `label_ru`                                                                                                                     |
| `polities-all.geojson`, `polity-labels-all.geojson` | the slider first passes AD 500               | all states to AD 1300; `polities-late.*` hold the later half for rebuilding                                                                                                                                                        |
| `roads-major.geojson`, `roads-minor.geojson`        | from 312 BC and zoom 4.5 / 6.5               | Roman roads (Itiner-e, CC BY 4.0): `name`, `type`, `cert` (certain, conjectured, hypothetical)                                                                                                                                     |
| `ancient.geojson`                                   | once the map has loaded                      | the ancient world outside the Bible (ADR 0013): `id` (Pleiades or Wikidata), `en`, `ru`, `from`, `to`, `approx`, `kind`, `rank`                                                                                                    |
| `people.json`                                       | a card's People tab, the search              | `people`: rows `[id, name, ru, "m"/"f", fathers, mothers, spouses, children, verses]` with family as row indexes and the number of verses naming them; `places`: place id → `[person, tier, key verse]` (tier 0 central … 3 named) |
| `articles.json`                                     | an article opened                            | place id → `{id, title, body, sources, status, scripture}`, title and body per language                                                                                                                                            |
| `verses/<lang>/…`                                   | a verse opened                               | the Synodal and KJV text by chapter                                                                                                                                                                                                |
| `photos/<place id>.jpg`                             | a card with a photo                          | credit and licence in `content.json` → `photos`                                                                                                                                                                                    |

## Licences in one line each

OpenBible places and identifications CC BY 4.0 (points copied from OpenStreetMap or
Google left out, ADR 0008); Cliopatria states CC BY 4.0; STEP Bible TIPNR people CC BY
4.0; Itiner-e roads CC BY 4.0; Pleiades CC BY 3.0; Wikidata CC0; Natural Earth public
domain; photos from Wikimedia Commons, public domain, CC0 or CC BY only, each credited;
the text written for this project (names checked against the Synodal text, events,
articles, tours, notes) is the project's own and not licensed for reuse yet.

## If a source goes away

Every download the data is built from sits in `pipeline/.cache`, and the pipeline reads
from there first. `pnpm sources save <dir>` copies that cache to `<dir>/sources-<date>/`
with each file's size and SHA-256 (`SOURCES.json`), the credits and the release manifest.
`pnpm sources verify <copy>` checks a copy, and `pnpm sources restore <copy>` puts it back
so that `pnpm data && pnpm content` rebuild the same data without the network. Keep a copy
off this machine too; the licences above travel with it.
