# Changes to the data

What changed in the data and the open API ([historyglobe.app/api/v1/](https://historyglobe.app/api/v1/))
from one release to the next, newest first. A release is named by the date of its data,
`built_at` in `api/v1/index.json`; cite the data by that date (README, "How to cite"). Files
and fields only grow: a field that is added is listed here and in `index.json`
(`fields_added`). Changes to the site alone (its pages, its look) are not listed; the
pull requests on GitHub have them.

## Unreleased

- Places (`places.json`, `places.geojson`, the dataset): thirteen records OpenBible kept twice
  for one place under one name on one point are merged into the other (ADR 0022): Ai,
  Arad, Beersheba, Bethsaida, Galilee, Gath, Geba (two), Gederah, Hamath, Havilah,
  Kedesh, Ramah. The place takes every verse of the retired record, so
  `verses/<Book>.json` now names the place for them. The retired ids are listed in the
  place's new field `aliases` (also a column of the dataset's `places`); `?place=` and the
  old pages (`/en/place/ai-a63c70b/`) still lead to the place. The other 37 pairs on one
  point stay apart, with the reason (docs/crosswalk/their-errors.md, item 17).
- Places (`places.json`): new fields `certainty` (`settled`, `most likely`, `tentative` or
  `disputed`, as the dataset's column), `confidence` (OpenBible.info's score of the
  identification, 0–1000) and `sites` (the candidate sites with their names, points and
  shares of OpenBible's assessment), where OpenBible gives them. The place pages of a
  disputed place now list the candidate sites with their shares, as the map's card does.
- Ezion-geber is on Tell el-Kheleifeh, which most reference works, OpenBible's count of
  sources (28 to 15) and Wikidata hold, instead of Jezirat Faraun, which leads only by
  OpenBible's recent-trend weighting; it stays disputed, Jezirat Faraun and Elath its other
  candidates (docs/crosswalk/their-errors.md, item 16).

- Tours (`constantine`): Helena's church on the Mount of Olives, the Eleona, has its own stop
  after Bethlehem, over the cave where Jesus was remembered as teaching his disciples; the
  Bethlehem stop keeps the Nativity cave alone, and neither says the church marked the
  ascension. The Eusebius note on the Mount of Olives reads the same way. Thanks to a
  reader's correction.
- States (`polities*.geojson`, `rulers.json`): the borders audit of 2026-11-23 brought the
  map's state for each place in line with the articles, a place passing to the new state in
  the year of the event. Galilee, Dor, Megiddo, Gilead and the upper Jordan are Assyria's
  from 733 BC; Jebus is Jerusalem's own until 1003 BC; Megiddo, Taanach and Dor are
  Solomon's; Gezer and Ziklag are no longer Philistine; the Philistine kingdoms stay
  kingdoms under Assyria after 701 BC, to 605 BC; Sidon is Assyria's from 677 BC and Tyre
  keeps its island; Tyre and Ashkelon are free cities; Damascus is Aretas III's from
  85 BC; Alexandria never Antiochus IV's; Galilee and Nazareth Hasmonean from 104 BC;
  Samaria, Gaza, Gadara, Gerasa, Caesarea, Paneas and Bozrah follow Pompey's, Augustus's
  and Herod's grants. Three states are new: the Tetrarchy of Herod Antipas (4 BC-AD 38),
  the Tetrarchy of Philip (4 BC-AD 33) and the Kingdom of Agrippa I (AD 37-44).
- States (`polities*.geojson`, `rulers.json`): a second sweep of the borders, each place again
  passing in the year of the event.
  - Northern Levant: Kedesh is a village of Tyre, not Judea's; Moab under Mesha holds
    Medeba, Ataroth, Nebo and Kiriathaim from 852 BC and Heshbon from 733 BC; Hazael's
    Aram holds Gilead and Bashan in 830-786 BC; Acco is Phoenician until Esarhaddon, Assyria's
    from 677 BC; the Hauran is Assyria's from 732 BC; Beth-shan, Rabbah and the Decapolis
    follow Pompey.
  - Southern Levant: Joppa is the Hasmoneans' from 142 BC, Dor and Strato's Tower from
    100 BC; Ashdod and Jamnia follow Pompey and Herod; Panium is Seleucid from 200 BC;
    Rabbah is Ammon's until David; Jericho is Israel's until 723 BC; Libnah, Elath and
    Ezion-geber are drawn with Judah or Solomon.
  - Mesopotamia and Egypt: Babylon is never Elam's, Seleucid from 312 BC and Parthian from
    141 BC; Til Barsip is Bit-Adini's until Shalmaneser III; Memphis is Assyria's from
    671 BC and Thebes from 663 BC; Ur III (2112-2005 BC) and Asshur from 1808 BC.
  - Asia Minor and Syria: Galatia, Cappadocia, Bithynia, Lycia, Rhodes, Iconium, Lystra and
    Derbe pass to Rome in the year of annexation; Lydia is Seleucid 222-191 BC; Miletus
    rises in 499 BC and is freed in 479 BC; Media falls in 550 BC; Palmyra holds Zenobia's
    realm to AD 271, Roman again from AD 272; Osroene is restored after Trajan.
  - Mediterranean: Rome is Roman from 551 BC; Puteoli, Malta and Syracuse stay Roman in the
    Second Punic War; Macedonia and Greece are Roman from 146 BC, Philippi and Amphipolis
    Philip II's; Cyprus is Roman 58-48 BC and Demetrius' 306-295 BC; Salamis is a Greek
    city; Cyrene follows Egypt and is Roman from 96 BC; Athens is Roman from 86 BC.
  - Three states are new: the Kingdom of Agrippa II (AD 48-92), the Kingdom of Chalcis
    (AD 41-47) and the Lycian League (167 BC-AD 42).
- Tours: the stops after the fall of Jerusalem in the exile and Jeremiah tours are dated
  586 BC (were 587 BC); Peter's prison in Jerusalem (Acts 11:2-12:17) is dated AD 44 (was the
  tour's AD 40). `questions.json`: where-was-mizpah `c. 586 BC` (was `c. 587 BC`).

## 2026-11-08 to 2026-11-23

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
- States: Odoacer holds Sicily from 477 and Ravenna until 493; Samaria and the hill country
  are Seleucid until Judea is free in 142 BC; Palestine is Persian 614-629 without a break;
  Cyrene is not drawn as Egypt's or Persia's in 404-333 BC; Harran is Babylon's from 610 BC;
  Damascus is Fatimid until 1076. Persia's photo is Persepolis.
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
