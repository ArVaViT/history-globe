# Data and content checks

What the build refuses, and why. `pnpm gate` runs all of it; `pnpm gate:full` rebuilds
the data first (`pnpm data`).

## Pipeline (`pipeline/build_data.py`)

- **Licence allowlist** (ADR 0008): every source in `SOURCES` carries a licence from
  `ALLOWED_LICENSES`, or the run stops.
- **No points copied from OSM or Google.** OpenBible's `modern.jsonl` says where each
  coordinate came from. A point is dropped when its modern location took its coordinates
  from OSM or Google, when it repeats such a coordinate digit for digit, or when it was
  computed from an OSM polygon. Wikidata (CC0) replaces it unless that is the same copy;
  otherwise the place is left out and listed in `manifest.json` as `excluded_places`.
  `assert_no_banned_points` checks the output independently of the filter.
- **Polities:** duplicate shapes and composites drawn over their own parts are dropped;
  small parts of a large polity get no label of their own.
- **Candidate sites:** shares are normalised over the candidates shown; a place is
  `disputed` when the runner-up has at least `DISPUTED_MIN_SHARE` %. OpenBible's English
  templates ("another name for X", "within 5 km of X") are kept with the referenced id.
- **Water has no holes.** Islands are joined to the sea's outline by zero-width cuts
  (`join_holes`), and the style draws the water unsimplified (`tolerance: 0`), so the cuts
  stay closed. A hole near a shore crossed the simplified coast in MapLibre's low-zoom tiles
  and earcut drew a straight band of sea across Arabia. `scripts/water-tiles.test.ts` tiles
  `water.geojson` as MapLibre does (geojson-vt, earcut) up to zoom 6 and fails on any sea
  drawn over land.
- Unit tests: `pipeline/test_build_data.py`.

## Content (`scripts/build-content.ts`, schemas in `packages/model/src/content.ts`)

- **Schemas are strict**: an unknown or misspelt field fails.
- **References exist**: OSIS book, chapter and verse are checked against
  `packages/model/src/versification.ts` (generated from the public-domain World English
  Bible by `pipeline/build_versification.py`; English numbering, not Synodal: Synodal
  Ps 67:16 is OSIS Ps.68.15). In Russian the references are shown in the Synodal
  numbering (`packages/model/src/synodal.ts`: the Psalms and chapter boundaries that
  moved, each seam checked against the text); links keep the English numbering.
- **Place names** (`content/place-names.yaml`): a plain name starting with a capital, no
  brackets, slashes or markers. Evidence, when given, must be a verse that OpenBible tags
  for that very place, and its excerpt must contain the name (the first letters of the
  last word, at the start of a word). Names of places left out for licence reasons are
  parked with a warning.
- **Tours**: the id matches the file name; each stop's passage must name its place, except
  stops listed in `NAMED_BY_CONTEXT` with the reason. A stop whose place the map draws
  faded in its year (the stop's own `year` or the tour's: not yet built, in ruins, gone,
  or named only in the New Testament before its events) is warned about, unless it is
  listed in `FADED_ON_PURPOSE` by tour, place and passage, with the reason (word of Jerusalem's fall reaching Ezekiel).
- **When places stood** (`content/place-life.yaml`): `from` (first year), `until` (last
  year) and `gap` (first and last year in ruins); at least one, the gap inside the years
  the place stood, "c." kept as approximate, at least one source each. Another name of a
  place (Zion for Jerusalem) shares its years. Disputed dates are left out, not guessed.
- **Polity overrides** (`content/polity-overrides.yaml`): our corrections to Cliopatria,
  each with a reason and sources; copies are marked `src: "override"` and replaced on
  every run, cut years kept in `cut` and restored. Kinds: `overrides` (last year),
  `starts` (first year), `clips` (cut to an area), `absent` (years it did not exist),
  `bridges` (years the data leaves it off), `annexed` (its last shape drawn as the empire
  that took it), `vassals` (overlord's colour and a second label line; `vc` keeps the
  own colour). A name missing from the data, an overlord absent in those years, or
  overlapping vassal years stop the build. Then the colours are assigned as a map
  (neighbours shape by shape) and the labels of small Levant states pinned (`pin`): both
  deterministic, so a rerun writes the same files.
- Nothing is written until every check passes.

## Places in any text (`scripts/build-text-places.ts`)

The index behind `hg-places.js`, the verse links in place cards and the links in the static
pages' verses. It drops rather than guesses. A form goes to a place only when the place's name
holds it against its namesakes (five times the verses, with a longer name counting for its
shorter one: Mount Carmel against Carmel) and against people (three times). It must also not be
an ordinary word: the KJV and the Synodal text write it capitalised more often than small, a
phrase not all in small letters. At least half of the cited verses that use it must be the
place's own (or another record's on the same point). A short hand-checked list drops
modern meanings. A dropped name of several words still blocks its first word, so «Антиохию
Писидийскую» never becomes Antioch of Syria. Russian names are declined by
`scripts/russian-forms.ts` (tested).

## Links

`scripts/check-links.ts`: every link and image in the documentation and the static place and
tour pages leads to a file that is there (links to the app itself and out of the site aside).

## Budget

`scripts/check-budget.ts`: the JavaScript needed before the first map frame stays within
420 kB gzip (ADR 0010; raised from 400 by ADR 0011). All the JavaScript, loaded
later too, stays under 560 kB.
