# Changes to the data

What changed in the data and the open API ([historyglobe.app/api/v1/](https://historyglobe.app/api/v1/))
from one release to the next, newest first. A release is named by the date of its data,
`built_at` in `api/v1/index.json`; cite the data by that date (README, "How to cite"). Files
and fields only grow: a field that is added is listed here and in `index.json`
(`fields_added`). Changes to the site alone (its pages, its look) are not listed; the
pull requests on GitHub have them.

## Unreleased

- Events: the second Temple was finished in March 515 BC (Adar of Darius' sixth year), now
  `c. 515 BC` (was `c. 516 BC`). Battles: Samuel's victory at Mizpah is `c. 1050 BC` (was
  `c. 1070 BC`): the twenty years of 1 Sam 7:2 run from the ark's coming to Kiriath-jearim,
  seven months after Ebenezer (6:1).
- `questions.json`, the years of the questions' maps: when-was-the-second-temple-built
  `c. 515 BC` (was `c. 516 BC`); where-was-the-ark-of-the-covenant-kept and
  who-were-the-philistines `c. 1070 BC` (was `c. 1050 BC`).
- `questions.json`: every question carries its licence, `license` (CC BY-NC-ND 4.0) and
  `license_url`, in the record itself.
- The map's data (`/data/`, not the API): the questions answered with a place moved out of
  `content.json`, which is CC BY, into `articles/questions/<language>.json` beside the
  articles, under their licence (ADR 0016); each article in `articles/<language>.json`
  carries `license` and `license_url`.
- `index.json`: the data is named "History Globe dataset", as in `CITATION.cff` and on Hugging
  Face.
- Photos: a new field `credit` in `content.json` → `photos` (and the column
  `place_photo.credit` in the database) holds the credit line the author asks for, word for
  word as the file's Commons page gives it ("Uzi Paz Pikiwiki Israel"); it is shown in place
  of `author`. `credit_with_author` (`place_photo.credit_with_author`) is true where that line
  names an agency or a collection rather than the author, who is then shown after it ("Fars
  Media Corporation (Behzad Alipour)"). 45 photos carry a credit; one author is corrected
  (Richard Mortel).
- Photos: each licence is linked at its canonical address
  (`https://creativecommons.org/licenses/by/4.0/`, with the closing slash; CC0 without
  "deed.en").
- Tours: the Russian notes of the Augustine tour (Thagaste, Carthage, Milan) tell in our
  own words what they quoted from M. E. Sergeenko's translation, which is in copyright.
- States (`polities*.geojson`, `rulers.json`): the map agrees with the atlas's own events.
  Israel and Judah divide in 931 BC, not 901; Egypt is Persian from 525 BC and independent
  in 404-344 BC under the Twenty-eighth, Twenty-ninth and Thirtieth Dynasties (two new state
  names); raids are no longer drawn as rule (Rome, Athens, Corinth, Antioch, Antony's East
  in 32 BC); Odoacer's Italy (476-492) is drawn; Jerusalem is Persian from 614, Frankish in
  1229-1243 and Ayyubid until 1259; the Fatimid coast with Acre and Tyre until 1104 and 1124;
  the Hasmoneans independent from 142 BC; Babylonia under Assyria from 647 BC.
- States: a place passes to the state that took it in the year of the event that tells it
  (Samaria 722 BC, Jerusalem 586 BC, Babylon 539 BC, Carthage and Corinth 146 BC, Jerusalem
  1187, Acre 1191 and 1291, Constantinople 1204 and 1261, and others); the build checks it.
  Rome is Roman from 536 and again from 552; Syria is Mamluk from 1260, not Mongol.
- Places: Persia stands in Fars (Wikidata's Persis), no longer on Ecbatana.

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
