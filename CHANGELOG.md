# Changes to the data

What changed in the data and the open API ([historyglobe.app/api/v1/](https://historyglobe.app/api/v1/))
from one release to the next, newest first. A release is named by the date of its data,
`built_at` in `api/v1/index.json`; cite the data by that date (README, "How to cite"). Files
and fields only grow: a field that is added is listed here and in `index.json`
(`fields_added`). Changes to the site alone (its pages, its look) are not listed; the
pull requests on GitHub have them.

## Unreleased

- `questions.json`: every question carries its licence, `license` (CC BY-NC-ND 4.0) and
  `license_url`, in the record itself.
- The map's data (`/data/`, not the API): the questions answered with a place moved out of
  `content.json`, which is CC BY, into `articles/questions/<language>.json` beside the
  articles, under their licence (ADR 0016); each article in `articles/<language>.json`
  carries `license` and `license_url`.
- `index.json`: the data is named "History Globe dataset", as in `CITATION.cff` and on Hugging
  Face.
- Photos: each licence is linked at its canonical address
  (`https://creativecommons.org/licenses/by/4.0/`, with the closing slash; CC0 without
  "deed.en").
- Tours: the Russian notes of the Augustine tour (Thagaste, Carthage, Milan) tell in our
  own words what they quoted from M. E. Sergeenko's translation, which is in copyright.

## 2026-11-04 to 2026-11-07

- One world of places: the ancient world's sites and the places of the Bible on one map, and
  the church after the Bible (#66, ADR 0018).
- Early Edom dated as the copper evidence has it; Tyritake ends in late antiquity (#69); the
  debate over early Edom named in "Where was Edom?" (#67).
- Hugging Face dataset: the ancient world's places as a table of their own,
  `ancient_places` (#68); snapshot of 4 November 2026.

## 2026-10-31 to 2026-11-01

- Rivers from RiverATLAS v1.0 (CC BY 4.0): the small biblical rivers (#57), the Jordan, the
  Euphrates and the Tigris (#58), six more (#59) and the Nile (#63), replacing our own trace
  from the Copernicus DEM (#54).

## 2026-10-24 to 2026-10-30

- The first scholar's review, by Juan Manuel Tebes, on five articles on Edom (#52).
- 21 languages: Hungarian, Finnish, Vietnamese, Romanian and Bulgarian (#48), with their
  names in the dataset (#49); Swedish, Norwegian, Danish, Tagalog and Serbian before them
  (#43).
- Ramah of the south and Baalath-beer on Tel Ira, not on Kinah's fort (#41).
- The Hugging Face dataset, built from each release (#45).

## 2026-10-17 to 2026-10-23

- All 746 articles re-checked against their sources; gazetteer ids, the crosswalk, and the
  people and chapters in the API (#30).
- The articles and the answered questions under CC BY-NC-ND 4.0 from 2026-10-17; the
  articles one language a file (#31, ADR 0016).
- The disputed places on the sites most scholars hold (#39); TIPNR ids, same-as points and
  four wrong gazetteer links fixed (#34); every upstream file pinned to a commit and a
  SHA-256 (#36).
- The Baalath-beer article; the TIPNR link of Ramah of the south (#40).

## 2026-10-03 to 2026-10-16

- The first public release on historyglobe.app (#4, #5): the places, names, tours, events
  and the open API under CC BY 4.0.
- 309 articles, 100 questions and 54 tours, with their sources in Russian (#7); every place
  named twice with an article (#9); 104 more articles in 11 languages (#26).
- The site and its names in Ukrainian, Spanish, Portuguese, German and French (#14), and in
  Italian, Dutch, Polish and Czech (#16).
- Places in any text, in every language (`hg-places.js`, #19); chapter maps and events
  (#22).
