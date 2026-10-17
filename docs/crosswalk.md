# Crosswalk to other Bible gazetteers

Our places and people matched to the open datasets others use, so a site that already keys
its data to one of them can join ours, and so their maintainers can see where we differ.
Built on 2026-10-17 from open files only (no accounts); the method is in each row.

- [`crosswalk/places.csv`](crosswalk/places.csv): every place in `api/v1/places.json` (our id
  is OpenBible.info's ancient id) with its OpenBible page, Wikidata item and Pleiades id (as
  the API gives them), STEPBible TIPNR id (OpenBible's link), and the matching Theographic
  record: id and lookup, how it was matched (`match_method`), `confidence` and the distance
  between our point and theirs (`theographic_km`). `openbible_wikidata` and
  `openbible_pleiades` keep OpenBible's own links where ours differ.
- [`crosswalk/people.csv`](crosswalk/people.csv): the people of `api/v1/people.json` (TIPNR
  ids) with the matching Theographic person, by name and first verse.
- [`crosswalk/their-errors.md`](crosswalk/their-errors.md): errors found in Theographic,
  OpenBible, Pleiades and Wikidata while matching, each with its record and evidence, and the
  places where we were wrong (fixed here) or may be.

The two CSV files are open data under CC BY 4.0, like the API (credit: History Globe by
Vadym Arnaut, with the sources below). Theographic Bible Metadata is CC BY-SA 4.0: this crosswalk carries only its record ids and a
few quoted values as evidence, none of its data (ADR 0008). The rest is CC BY 4.0 (OpenBible,
TIPNR), CC BY 3.0 (Pleiades) or CC0 (Wikidata), as `docs/ATTRIBUTIONS.md` lists. Low
`confidence` rows are guesses kept for review, not links to rely on.
