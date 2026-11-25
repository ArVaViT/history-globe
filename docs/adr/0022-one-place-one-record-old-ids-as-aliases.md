# 0022. One place, one record: a merged record's id lives on as an alias

- Status: accepted
- Date: 2026-11-25

## Context

OpenBible.info splits a place into records by referent. Where scholars hold the referents
apart (Ramah of Benjamin and Samuel's Ramah, the Bethel of Jacob and the Bethel of the Negeb)
that is information. Where they do not, the place is kept twice: Ai of Joshua and Ai of the
returnees in Ezra, Bethsaida in Matthew and Bethsaida in Mark, Gath of the Philistines and the
Gath of Obed-edom. The map drew one dot and one label for such a pair (`dup`), but the API, the
dataset and the pages listed the place twice, under two ids, each with part of the verses.
Every id is already published: in `api/v1/places.json`, the dataset on Hugging Face, the
pages (`/en/place/ai-a63c70b/`), tours and links people keep.

## Decision

- `content/place-aliases.json` names a retired record and the place it is merged into, with
  why. The data build (`pipeline/build_data.py`, `merge_aliases`) drops the retired record
  and gives its verses to the place, each once, in the order of the Bible; the place keeps
  its own identifications. The place carries `aliases`, the retired ids.
- A pair is merged only when all of these hold: one point, one English name, one kind; one
  record in STEPBible's TIPNR; and the retired record's leading identification on
  OpenBible, held by more than half of its sources, is "another name for" the other. Any
  other pair stays as it is (docs/crosswalk/their-errors.md, item 17, lists them and why).
- An old id keeps working: the map's `?place=`, `measure=`, the embed's `place` and the
  WebMCP tools open the place (`createEngine`'s `aliases`); the old page redirects to the
  place's page in every language (`apps/web/vercel.json`; build-pages stops when one is
  missing); `places.json` and the dataset list the ids under `aliases`.
- Content names the place, never a retired id: the build stops on a tour, an anchor or a
  name for a record that is not in the build, as for any other id.

## Alternatives considered

- Keeping both records and only marking one `duplicate` (as before): the API and the dataset
  went on counting one place twice, and each record had only part of the verses.
- A stub entry for each retired id in `places.json`: a reader that lists the places would
  list them twice again.

## Consequences

- `verses/<Book>.json` names the place for the retired record's verses, not the retired id.
  A reader that kept a retired id finds it under `aliases`.
- The retired record's own minority identification is no longer a candidate of its own; the
  article may say it. Gath 3 (Obed-edom the Gittite) loses Gath-rimmon (6 of OpenBible's 20
  sources); Galilee 2 (Josh 12:23, "the king of the nations of Gilgal", which TIPNR files
  under Galilee: "spelled Gilgal|Galilee") loses Jiljuliyeh (7 of 19).
- The rule is necessary, not sufficient: each pair is read against its verses. Bealoth 2
  (1 Kgs 4:16) passes it and stays apart: Baanah's district "in Asher and in Aloth" is in
  the north, not the Negeb town of Josh 15:24; on OpenBible "not a proper name" has 50 votes
  against 12 for Bealoth 1, and TIPNR marks the verse as the same form with another meaning.
- Merging is by hand, record by record: a rebuild of OpenBible's data does not merge or split
  anything by itself.
