# 0018. One world of places: the ancient world's cities as places like the Bible's

- Status: accepted
- Date: 2026-11-01

## Context

History Globe is meant to cover the whole globe one day, the Bible being one way to look at
it. The ancient world's cities (0013) were a quieter layer of their own: a hollow grey ring,
a tip on hover, no card, no link, a list of their own in the search. They read as a second
class of place.

## Decision

- The sites of `content/ancient-sites.json` are loaded with the Bible's places as places
  (`apps/web/src/data.ts`, `ancientPlaces`): the same marks, labels, card, search and link
  (`?place=` takes a Pleiades number or a Wikidata item). Only `ancient` (what the site was)
  tells them apart. The data build, the static pages, the API and the dataset are unchanged.
- "The Bible alone" (a setting) is the lens: it leaves the ancient world's places off the
  map and out of the search (`MapLibreRenderer.setBibleOnly`). The "Ancient world" layer
  switch is gone; an older link's `hide=ancient` is passed over.
- Ranks are put on one scale: an ancient site's rank goes one step down (0 → 1, 1 → 2,
  2 → 3), as its layer was drawn before, and its weight is the fewest verses a biblical place
  of that rank has. Mycenae with a great ring crowded Corinth off the map in 500 BC.
- The card of an ancient place: what it was, who ruled there (rulers.json takes the sites
  too), when it stood, its Pleiades and Wikidata records; no verses tab.

## Consequences

- One importance scale built from two sources is a stopgap; a measure for every place
  alike (Wikidata sitelinks, say) would replace it. First step (2026-11-01): fame lifts a
  town on both sides (`content/fame.json`, `pipeline/ancient/fame.py`): the Wikipedia
  articles of its Wikidata item, counted only when that item is the ancient place, not the
  modern town on it (Amman's are not Rabbah's). 60 articles make a place rank 1, 25 rank 2;
  it never lowers one, never makes a rank 0, and leaves a disputed point alone. Carthage,
  Sparta, Ur, Palmyra, Uruk, Memphis rose; so did Thugga, Masada, Numantia, Veii.
- The script's second wave (`content/ancient-sites-wave2.json`, 431 sites): the less known,
  5 to 7 Wikipedia articles, and those the first wave's classes missed (Gallo-Roman towns,
  Etruscan temples, Iberian settlements).
- English first: the docs' sentence about grey names is rewritten in English only until
  the next translation pass.
- Tours told outside the Bible (2026-11-02): a stop has a verse (`ref`) or a `source`, the
  ancient author's passage and a free translation of it, and may stop at an ancient site.
  The tours list gives them their own group, "Beyond the Bible", which the Bible-alone
  setting hides. First: the Jewish War after Josephus (`content/tours/jewish-war.yaml`),
  linked to Whiston's translation at Perseus.
