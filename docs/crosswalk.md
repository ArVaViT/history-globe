# Crosswalk to other Bible gazetteers

Our places and people matched to the open datasets others use, so a site that already keys
its data to one of them can join ours, and so their maintainers can see where we differ.
Built on 2026-10-17 from open files only (no accounts); the method is in each row. Our side
of the places table is refreshed from the build (2026-10-24, see below).

- [`crosswalk/places.csv`](crosswalk/places.csv): every place in `api/v1/places.json` (our id
  is OpenBible.info's ancient id) with its OpenBible page, Wikidata item, Pleiades id and
  STEPBible TIPNR unique name (as the API gives them), and the matching Theographic record: id
  and lookup, how it was matched (`match_method`), `confidence` and the distance between our
  point and theirs (`theographic_km`). `openbible_wikidata`, `openbible_pleiades` and
  `openbible_tipnr` keep OpenBible's own links where ours differ: the TIPNR links are to a
  2021 TIPNR and are followed to the current names by `scripts/tipnr-links.ts`
  (`content/tipnr.json`; [`their-errors.md`](crosswalk/their-errors.md), O5).
- [`crosswalk/people.csv`](crosswalk/people.csv): the people of `api/v1/people.json` (TIPNR
  ids) with the matching Theographic person, by name and first verse.
- [`crosswalk/their-errors.md`](crosswalk/their-errors.md): where we differ from Theographic,
  OpenBible, Pleiades and Wikidata, found while matching, each with its record and evidence, and the
  places where we were wrong (fixed here) or may be.

Refresh: `node scripts/crosswalk-places.ts` after `pnpm content` rewrites our columns of
`places.csv` from the build and keeps the Theographic columns. `theographic_km` is recomputed
only with `--theographic <path>` to a copy of Theographic's `json/places.json` kept outside the
repository (its coordinates are CC BY-SA and never enter it).

The two CSV files are open data under CC BY-SA 4.0
(<https://creativecommons.org/licenses/by-sa/4.0/>), each licensed as a whole
(`LICENSING.md`, part 4). Their `theographic_*` columns carry Theographic Bible Metadata's
record ids and lookup names, and in `places.csv` the records it takes for the same place, as
evidence; Theographic is under CC BY-SA 4.0, so the tables are too. None of its coordinates or
other data is taken (ADR 0008), and the tables are not part of the site, the API or the
dataset, which stay CC BY 4.0. Credit: History Globe (Vadym Arnaut), with Theographic Bible
Metadata (Robert Rouse), CC BY-SA 4.0. The other columns come from sources under CC BY 4.0
(OpenBible, TIPNR), CC BY 3.0 (Pleiades) or CC0 (Wikidata), as `docs/ATTRIBUTIONS.md` lists,
and keep their credit. Low `confidence` rows are guesses kept for review, not links to rely on.
