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
- Unit tests: `pipeline/test_build_data.py`.

## Content (`scripts/build-content.ts`, schemas in `packages/model/src/content.ts`)

- **Schemas are strict**: an unknown or misspelt field fails.
- **References exist**: OSIS book, chapter and verse are checked against
  `packages/model/src/versification.ts` (generated from the public-domain World English
  Bible by `pipeline/build_versification.py`; English numbering, not Synodal: Synodal
  Ps 67:16 is OSIS Ps.68.15).
- **Place names** (`content/place-names.yaml`): a plain name starting with a capital, no
  brackets, slashes or markers. Evidence, when given, must be a verse that OpenBible tags
  for that very place, and its excerpt must contain the name (the first letters of the
  last word, at the start of a word). Names of places left out for licence reasons are
  parked with a warning.
- **Tours**: the id matches the file name; each stop's passage must name its place, except
  stops listed in `NAMED_BY_CONTEXT` with the reason.
- **When places stood** (`content/place-life.yaml`): `from` (first year), `until` (last
  year) and `gap` (first and last year in ruins); at least one, the gap inside the years
  the place stood, "c." kept as approximate, at least one source each. Another name of a
  place (Zion for Jerusalem) shares its years. Disputed dates are left out, not guessed.
- **Polity overrides** (`content/polity-overrides.yaml`): our corrections to Cliopatria,
  each with a reason and sources; copies are marked `src: "override"` and replaced on
  every run.
- Nothing is written until every check passes.

## Budget

`scripts/check-budget.ts`: the JavaScript needed before the first map frame stays within
400 kB gzip (ADR 0010).
