---
license: cc-by-4.0
language:
  - en
  - cs
  - da
  - de
  - es
  - fr
  - it
  - nb
  - nl
  - pl
  - pt
  - ru
  - sr
  - sv
  - tl
  - uk
pretty_name: "History Globe: Bible places, people and journeys"
tags:
  - bible
  - geography
  - history
  - geospatial
  - gazetteer
  - ancient-history
  - multilingual
size_categories:
  - 1K<n<10K
configs:
  - config_name: places
    data_files: data/places.csv
    default: true
  - config_name: place_verses
    data_files: data/place_verses.csv
  - config_name: place_sites
    data_files: data/place_sites.csv
  - config_name: people
    data_files: data/people.csv
  - config_name: events
    data_files: data/events.csv
  - config_name: battles
    data_files: data/battles.csv
  - config_name: tours
    data_files: data/tours.csv
  - config_name: tour_stops
    data_files: data/tour_stops.csv
  - config_name: ancient_writers
    data_files: data/ancient_writers.csv
---

# History Globe: Bible places, people and journeys

The places of the Bible on the map: where each one was, how sure that is, which verses name it, and its name in ${languages} languages. With them come the people of the Bible, dated events and battles, journeys stop by stop, and what ancient writers outside the Bible say about the places.

This is the open data behind **[History Globe](https://historyglobe.app)**, a free 3D atlas of biblical history. Every place links to the globe.

| table             |               rows | what                                                                                                              |
| ----------------- | -----------------: | ----------------------------------------------------------------------------------------------------------------- |
| `places`          |          ${places} | a place: point, kind, identification, certainty, gazetteer ids, names in ${languages} languages                   |
| `place_verses`    |    ${place_verses} | a verse that names a place                                                                                        |
| `place_sites`     |     ${place_sites} | the proposed locations of the ${multi_site_places} places with more than one                                      |
| `people`          |          ${people} | a person the Bible names                                                                                          |
| `events`          |          ${events} | a dated event, from ${events_from} to ${events_to}                                                                |
| `battles`         |         ${battles} | a battle or siege: place, year, sides, outcome                                                                    |
| `tours`           |           ${tours} | a journey: Abraham, the Exodus, the life of David, Elijah, the exile, the life of Jesus, Paul's journeys and more |
| `tour_stops`      |      ${tour_stops} | a stop of a journey, in order, with its passage                                                                   |
| `ancient_writers` | ${ancient_writers} | what Eusebius, Josephus, Strabo, Herodotus and others say about a place, with a link to the text                  |

## Quick start

```python
from datasets import load_dataset

places = load_dataset("ArVaViT/history-globe", "places", split="train")
```

```python
import pandas as pd

base = "hf://datasets/ArVaViT/history-globe/data"
places = pd.read_csv(f"{base}/places.csv")
verses = pd.read_csv(f"{base}/place_verses.csv")

# The places named in Acts 16
acts16 = verses[verses.ref.str.startswith("Acts.16.")].merge(places, left_on="place_id", right_on="id")
print(acts16.drop_duplicates("id")[["name", "lat", "lon", "url"]].to_string(index=False))
```

Always join on ids, not names: names repeat (two Jerichos are two places). `place_id` and `same_as` point to `places.id`; `tours.people` points to `people.id`.

## Tables

### `places`

| column                | meaning                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`                  | History Globe id; stable, the same as in the [API](https://historyglobe.app/api/v1/)                                  |
| `name`                | English name                                                                                                          |
| `kind`                | settlement, region, mountain, river, valley, gate, … (${kinds} kinds)                                                 |
| `lat`, `lon`          | the point History Globe shows, WGS 84                                                                                 |
| `identified_as`       | the modern site or description the point stands for: "Tell Abu Sus", "within 1 km of Bethel", "same place as Shittim" |
| `same_as`             | when `identified_as` says "same place as …", the id of that place                                                     |
| `certainty`           | how sure the location is, as the globe says it: `settled`, `most likely`, `tentative` or `disputed` (see below)       |
| `disputed`            | `true` when a second proposed site holds at least 10% of OpenBible.info's score (see below)                           |
| `confidence`          | OpenBible.info's score for the identification, 0–1000, weighted towards recent scholarship                            |
| `candidate_sites`     | how many proposed sites `place_sites` lists for the place (0 when one)                                                |
| `verse_count`         | how many verses name the place                                                                                        |
| `duplicate`           | `true` for a second record OpenBible keeps for the same place under a repeated name                                   |
| `wikidata`            | the Wikidata item (`Q…`)                                                                                              |
| `pleiades`            | the place in Pleiades, as a link                                                                                      |
| `tipnr`               | STEPBible's TIPNR name for the place, in STEPBible's abbreviations (`Abana@2Ki.5.12`)                                 |
| `url`                 | the place on historyglobe.app: its own page for the ${pages} places a verse names, the globe for the rest             |
| `name_cs` … `name_uk` | the name in ${other_languages} more languages                                                                         |

### `place_verses`

`place_id`, `ref`: a verse that names the place.

### `place_sites`

For a place with more than one proposed location, up to six of them: `place_id`, `rank` (in OpenBible's order, 1 = the highest score), `site`, `lat`, `lon`, `openbible_share` (the site's share, in per cent, of the positive scores of the sites listed; rounded, so a place's shares may add up to 99–101; empty where OpenBible gives no score). Sites whose only point OpenBible took from OpenStreetMap or Google are left out.

### `people`

`id` (STEPBible TIPNR unique name, e.g. `Aaron@Exo.4.14-Heb`), `name`, `sex` (`m`/`f`), `verse_count`, `first_ref` (the first verse TIPNR gives, in STEPBible's abbreviations), `name_cs` … `name_uk`. The names in other languages are empty for ${unnamed_people} people, most of them named in one or two verses.

### `events` and `battles`

`id`, `year`, `date` (readable: "c. 1070 BC"), `approximate`, `place_id` (empty for an event without a place), `ref` (where the Bible tells it, if it does), the text in ${languages} languages (`title_*`; battles also `sides_*` and `outcome_*`), and `sources` (the works the date and facts rest on, separated by `|`).

### `tours` and `tour_stops`

A tour: `id`, `year`, `date`, `stops`, `people` (TIPNR ids, space-separated), `title_*`.

Its stops, in the order travelled: `tour_id`, `stop`, `place_id`, `ref`, `note_*`, and how the stop was reached:

- `by`: empty for on foot or not stated, `sea` for by ship, `untold` when the text does not say and no route is guessed;
- `days_sailed`, `days_sailed_about`, `days_sailed_ref`: the days at sea where the text gives them, `true` when it says "about", and the verse.

### `ancient_writers`

`place_id`, `author`, `work`, `passage`, `url` (an online text of the passage), and a short summary of what it says, `note_*`.

## Conventions

- **Years** are astronomical: 1 BC is `0`, 586 BC is `-585`. The `date` column says it in words; dates before 1000 BC are approximate and marked "c.".
- **References** are OSIS with English book abbreviations and KJV verse numbers: `Gen.12.6`, `Judg.3.15-Judg.3.25`. A few events and battles cite 1–2 Maccabees (`1Macc.7.39`). The ids of people, `people.first_ref` and `places.tipnr` follow STEPBible's abbreviations instead (`2Sa`, `Act`).
- **A point is the most likely location, not a certainty.** A region (${regions} of them) is one point near its middle, not a boundary.
- **${no_verse} places have no verse.** OpenBible.info tags no verse to them: some are named only outside the 66 books (Adasa, 1 Maccabees 7:40), some are sites of the biblical world (Eridu, Carthage), and some are a second record of a place whose verses are under another record (Ur, Magdala).
- **Languages.** English is the original. Russian names follow the Synodal Bible of 1876, checked against a verse that contains them where the place has one. The other languages are History Globe's own translations, and not every language has been read by a native speaker yet.

### How sure is a location?

- `certainty` is what the globe tells a reader. `disputed` when scholars propose rival sites; otherwise OpenBible.info's `confidence` decides: 800 or above `settled`, 600 or above `most likely`, below that `tentative`.
- `disputed` is `true` when, of the proposed sites listed in `place_sites`, the second holds at least 10% of the positive score, or none is scored.
- `identified_as` names the site the point stands for; `place_sites` lists the rivals with their shares.

These scores and shares are OpenBible's assessment, not a scholarly consensus. On a place's page, History Globe says which identification it follows and why.

## Sources and license

**CC BY 4.0.** Use it, change it, build on it, commercially too; keep the credit:

> Data: History Globe by Vadym Arnaut (https://historyglobe.app), CC BY 4.0; places and verse tags from OpenBible.info (CC BY 4.0); people from STEPBible TIPNR (CC BY 4.0); Pleiades ids from Pleiades (CC BY 3.0).

| what                                                                                            | source                                                                                                                                                                    | license                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| places, verse tags, identifications, their scores and proposed sites                            | [OpenBible.info Bible Geocoding Data](https://www.openbible.info/geo/); points OpenBible took from OpenStreetMap or Google replaced with Wikidata coordinates or left out | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), modified |
| people                                                                                          | [STEPBible TIPNR](https://www.stepbible.org/), Tyndale House, Cambridge; matched to places                                                                                | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), modified |
| Wikidata items, some coordinates                                                                | [Wikidata](https://www.wikidata.org/)                                                                                                                                     | [CC0](https://creativecommons.org/publicdomain/zero/1.0/)           |
| Pleiades ids                                                                                    | [Pleiades](https://pleiades.stoa.org/)                                                                                                                                    | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/us/)        |
| Russian names                                                                                   | the Synodal translation (1876)                                                                                                                                            | public domain                                                       |
| quotations of the Bible in the notes                                                            | the public-domain editions listed on [the sources page](https://historyglobe.app/docs/sources.html) (KJV, Synodal, Luther 1912, Louis Segond 1910 and others)             | public domain                                                       |
| events, battles, journeys, summaries of ancient writers, names and texts in the other languages | History Globe                                                                                                                                                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)           |

**Not in this dataset:** the place articles and the answered questions on historyglobe.app. They are CC BY-NC-ND 4.0: quote and link them, but do not put them into a dataset ([what may be taken](https://historyglobe.app/docs/build.html)).

## Updates and contact

This is a snapshot of ${snapshot}. The [History Globe API](https://historyglobe.app/api/v1/) serves the same places, verses, people, events, battles, journeys and ancient writers, kept current: JSON, no key ([documentation](https://historyglobe.app/docs/api.html)). The certainty columns (`identified_as`, `same_as`, `certainty`, `confidence`, `candidate_sites`) and `place_sites` come from the data the globe itself draws, and are published here only.

Corrections are welcome in this dataset's Community tab or at historyglobe.vadym@gmail.com.

## Citation

```bibtex
@misc{arnaut2026historyglobe,
  author = {Arnaut, Vadym},
  title  = {History Globe: Bible places, people and journeys},
  year   = {2026},
  url    = {https://historyglobe.app},
  note   = {Dataset, CC BY 4.0, https://huggingface.co/datasets/ArVaViT/history-globe}
}
```
