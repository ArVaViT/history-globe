# 0013. The ancient world around the Bible, as its own quieter layer

- Status: proposed
- Date: 2026-10-02

## Context

The map named only the places of the Bible (OpenBible). Between them lay blank country:
in 1300 BC the Hittite capital, Ugarit, Mari, Emar or Assur were not on it, though the
states they ruled were drawn and the texts of those cities are how the period is dated.
Readers of the Bible meet the ancient world through its cities; a map that leaves them out
looks emptier than the history it tells.

Pleiades (CC BY 3.0) has tens of thousands of ancient places, but a filter on its data
alone gave a poor set: it is strongest on the Greek and Roman world, weak on the Bronze
Age Near East (Ugarit, Mari and Ebla are not under those names), and some of its dates are
modern ones. Wikidata's links to ancient sites often point at the modern city on top of
them (Narbo at Narbonne) or at another object altogether.

## Decision

- A curated list, `content/ancient-sites.json`: 553 capitals, cities, ports and
  sanctuaries the Bible does not name, each with a Pleiades id (or a Wikidata item when
  Pleiades has none), a point on the site itself rather than the modern town, the years it
  stood as a significant place, a kind and a rank (0 world, 1 regional, 2 other), and its
  sources. Checked against two sources each; a site within 3 km of one of our towns is a
  build error, so a place is never on the map twice.
- Its own layer, "Ancient world", on by default and quieter than the Bible's places: a
  small hollow grey ring and a grey name, the greatest from zoom 4, regional ones from 6,
  the rest from 8; shown only in the years the site stood and only inside the focus
  ring (the greyed-out world beyond keeps no names: 531 of the 553 are drawn). Its names
  give way to the Bible's places, and a biblical town not standing in the year gives way
  to them.
- Named on hover or tap with what it was and when; found by the search, which flies the
  map there in a year it stood; events may point at a site instead of a place.
- The file loads after the first frame (16 kB gzip) and is in the database as
  `ancient_site` (ADR 0012).

## Consequences

- The map is full where the history is, without competing with the Bible's own places.
- The list is content to maintain like the rest: a new site goes through the same
  two-source check. Names in other languages come from Wikidata only where its item is the
  site itself (`content/drafts/ancient-labels-wikidata.json` marks the others).
- No article or card for a site yet: the tip is the whole of it.
