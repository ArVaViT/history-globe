# The data release

What `apps/web/public/data` holds after `pnpm data && pnpm content`, for whoever builds on
it: the app itself, an embedding partner, the database export (`scripts/export-db.ts`,
ADR 0012). Years are astronomical integers (ADR 0003): 1 BC = 0, 586 BC = -585; spans
of states are half-open `[y0, y1)`, the years of towns and sites inclusive. Place ids are
OpenBible's (`a` and six hex digits), tour, event and article ids come from `content/`,
people's from STEP Bible's TIPNR.

`manifest.json` records when the release was built and every source with its licence,
URL, snapshot date and SHA-256. The upstream files are read at one commit each
(`pipeline/sources.json`: repository, path, commit, SHA-256), so a build fetches the same
bytes whatever has happened upstream since, and refuses a file that hashes otherwise;
`python3 -m pipeline.pin_sources` shows what has moved upstream and `--write` moves the
pins (then `pnpm data` and the data checks, ADR 0007). The credits shipped with the map are in
`docs/ATTRIBUTIONS.md` and on the sources page (`/docs/sources.html`); keep them with any copy of the data.

## Loaded for the first frame

| File                                                                       | What                                                                                                                   | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `places.geojson`                                                           | the places of the Bible, one point each                                                                                | `id`, `name` (English), `kind`, `rank` (0 most named … 3), `verses`, `ot`, `nt`, `osis` (verses, English numbering), `disputed`, `confidence` (0–1000, OpenBible's), `where` / `where_tpl` / `where_ref` (where it is today), `coord` (`openbible` or `wikidata`)                                                                                                                                                                                                                                                                                                |
| `content.json`                                                             | everything written by hand in `content/`                                                                               | `schema_version`; `names` (place id → its name in each language, `ru` with `osis`, the Synodal verse it is read from), `where_ru`, `where_in` (language → place id → where it is today), `where_en` (the English line written anew where OpenBible's repeats the ancient name), `tours`, `events` (with `place` or an ancient `site`), `battles`, `life` (when towns stood), `photos`, `pleiades` (id and attested span), `chapter_years` (book → `[first chapter, last chapter, year]`), `articles` (place id → article id)                                     |
| `polities.geojson`, `polity-labels.geojson`                                | states to AD 500 and their label points                                                                                | `name` (Cliopatria's), `name_<lang>` (in each language), `y0`, `y1`, `c` (colour index), `rel` (an alliance or allegiance, not drawn as a state), `src` (`override`: a copy made by our corrections, `content/polity-overrides.yaml`), `v` and `v_<lang>` (a vassal's second line, "under Assyria"), `vin` (a vassal drawn inside its overlord: no fill of its own); labels also `tier` (0 shown first, 2 from zoom 6), `size` (from the area), `lead` (the one point naming the state at a continent's view), `pin` (a small state's point moved off the towns) |
| `water.geojson`, `coast.geojson`, `rivers.geojson`, `river-labels.geojson` | the sea, the shore, rivers (Natural Earth, public domain)                                                              | rivers: `name`, `rank`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ancient.geojson`                                                          | the ancient world's places the Bible does not name, loaded with the Bible's (ADR 0018); without it the map still opens | `id` (Pleiades or Wikidata), `en` and the name in each language that has one (`ru`, `uk`, …), `from`, `to`, `approx`, `kind`, `rank`, `qid`                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Loaded when first needed

| File                                                | When                                         | What                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sites.geojson`                                     | with the map's style, beside the first frame | candidate locations of disputed places: `place`, `share` (percent of OpenBible's sources), `label`, `label_<lang>`                                                                                                                                                            |
| `polities-all.geojson`, `polity-labels-all.geojson` | the slider first passes AD 500               | all states to AD 1300, with the fields of `polities.geojson`                                                                                                                                                                                                                  |
| `roads-major.geojson`, `roads-minor.geojson`        | from 312 BC and zoom 4.5 / 6.5               | Roman roads (Itiner-e, CC BY 4.0): `name`, `type`, `cert` (certain, conjectured, hypothetical)                                                                                                                                                                                |
| `people.json`                                       | a card's People tab, the search              | `people`: rows `[id, name, ru, "m"/"f", fathers, mothers, spouses, children, verses]` with family as row indexes and the number of verses naming them; `names`: the names in the other languages; `places`: place id → `[person, tier, key verse]` (tier 0 central … 3 named) |
| `articles/<lang>.json`                              | an article opened                            | place id → `{id, place, title, body, sources, status, reviews, scripture, license, license_url}`, title and body in that language (English where it has none); the Russian file also `sources_ru`, another language's `sources_in` where the sources are written in it        |
| `articles/questions/<lang>.json`                    | a card opened                                | `license`, `license_url`, `questions`: place id → `[{id, <lang>}]`, the questions answered with the place, in that language (English where it has none); CC BY-NC-ND 4.0 as the articles                                                                                      |
| `verses/<lang>/…`                                   | a verse opened                               | the text of each language's public-domain Bible by chapter (`verses/sources.json` names them; `zh` waits for its language, `docs/adding-a-language.md`)                                                                                                                       |
| `photos/<place id>.jpg`                             | a card with a photo                          | credit and licence in `content.json` → `photos`                                                                                                                                                                                                                               |

## On Hugging Face

The same data, as ten CSV tables with a dataset card ("History Globe dataset"), is at
[huggingface.co/datasets/ArVaViT/history-globe](https://huggingface.co/datasets/ArVaViT/history-globe):
places (with how sure each location is), the verses that name them, the proposed sites of
disputed places, the places of the ancient world the Bible does not name, people, events,
battles, journeys with their stops, and the ancient writers.
`pnpm dataset` (after `pnpm data && pnpm content`) writes it to `pipeline/out/dataset/` from
the API and `places.geojson` / `sites.geojson`; the card is `pipeline/dataset_card.md` with
its counts filled in, and the build stops on any fact of the card the release no longer
bears out. The maintainer uploads it after a deploy that changed it; the articles and the
answered questions are never part of it (ADR 0016).

## Licences in one line each

OpenBible places and identifications CC BY 4.0 (points copied from OpenStreetMap or
Google left out, ADR 0008); Cliopatria states CC BY 4.0; STEP Bible TIPNR people CC BY
4.0; Itiner-e roads CC BY 4.0; Pleiades CC BY 3.0; Wikidata CC0; Natural Earth public
domain; photos from Wikimedia Commons, public domain, CC0 or CC BY only, each credited;
the text written for this project is the project's own: the names in every language,
events, tours and notes under CC BY 4.0, the place articles and the answered questions
under CC BY-NC-ND 4.0 (`LICENSE`, ADR 0016).

## If a source goes away

Every download the data is built from sits in `pipeline/.cache`, and the pipeline reads
from there first. `pnpm sources save <dir>` copies that cache to `<dir>/sources-<date>/`
with each file's size and SHA-256 (`SOURCES.json`), the credits and the release manifest.
`pnpm sources verify <copy>` checks a copy, and `pnpm sources restore <copy>` puts it back
so that `pnpm data && pnpm content` rebuild the same data without the network. Keep a copy
off the machine that built it; the licences above travel with it.
