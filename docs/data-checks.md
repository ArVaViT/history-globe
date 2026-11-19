# Data and content checks

What the build refuses, and why. `pnpm gate` runs all of it; `pnpm gate:full` rebuilds
the data first (`pnpm data`).

## Pipeline (`pipeline/build_data.py`)

- **Licence allowlist** (ADR 0008): every source in `SOURCES`, and in `OTHER_SOURCES` (those
  the other steps read: Itiner-e, RiverATLAS, Pleiades), carries a licence from
  `ALLOWED_LICENSES`, or the run stops before anything is built; the manifest lists both. Every
  Bible edition in `scripts/bible-text.ts` is public domain (`scripts/bible-text.test.ts`).
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
- **Points chosen by hand** (`content/place-points.json`): `same_as` puts a place on another
  record's point (a chain is followed to its end; a circle stops the build); `site` shows one
  of OpenBible's other modern locations for the place, with its point, confidence and today
  line; `wikidata` puts a land OpenBible places on a city's point (Judea on Jerusalem, Egypt
  on On) on its Wikidata item's point (CC0). A record or location not in the build, or a
  point the licence filter would drop, stops the build. The reasons are in the file and in
  `docs/crosswalk/their-errors.md`.
- **Water**: Natural Earth's ocean and lakes at 1:10m inside the map's region, 1:50m around
  it, without reservoirs (by type, and by id where a reservoir is tagged a lake).
- **Water has no holes.** Islands are joined to the sea's outline by zero-width cuts
  (`join_holes`), and the style draws the water unsimplified (`tolerance: 0`), so the cuts
  stay closed. A hole near a shore crossed the simplified coast in MapLibre's low-zoom tiles
  and earcut drew a straight band of sea across Arabia. `scripts/water-tiles.test.ts` tiles
  `water.geojson` as MapLibre does (geojson-vt, earcut) up to zoom 6 and fails on any sea
  drawn over land.
- Unit tests: `pipeline/test_build_data.py`.

## Content (`scripts/build-content.ts`, schemas in `packages/model/src/content.ts`)

- **Schemas are strict**: an unknown or misspelt field fails.
- **No private notes**: no file in `content/` points to a note a reader cannot open
  ("research note 16", "the session notes") or carries a "DRAFT" marker; it names its sources.
- **Photos** (`content/photos.yaml`): public domain, CC0 or CC BY only, and the licence linked
  at its canonical address (`https://creativecommons.org/licenses/by/X.Y/`; CC0's
  `…/publicdomain/zero/1.0/`), required for CC BY.
- **References exist**: OSIS book, chapter and verse are checked against
  `packages/model/src/versification.ts` (generated from the public-domain World English
  Bible by `pipeline/build_versification.py`; English numbering, not Synodal: Synodal
  Ps 67:16 is OSIS Ps.68.15). In Russian the references are shown in the Synodal
  numbering (`packages/model/src/synodal.ts`: the Psalms and chapter boundaries that
  moved, each seam checked against the text); links keep the English numbering.
- **Place names** (`content/place-names.yaml`): a plain name starting with a capital, no
  brackets, slashes or markers. Evidence, when given, must be a verse that OpenBible tags
  for that very place, and its excerpt must contain the name (the first letters of the
  last word, at the start of a word). Names of places left out for licence reasons are
  parked with a warning.
- **Articles** (`content/articles`): the id matches the file name, the place is in the data
  build, not a duplicate record and named in verses, and has no other article. English and
  Russian run to 450 words at most; every language has no double space and between half and
  one and a half times the English words. Russian, Ukrainian, Bulgarian and Serbian have no
  straight quotes and no hyphen for a dash (a quotation of the Bible keeps its own marks).
- **Questions** (`content/questions`): the id matches the file name; the place the page's
  button opens and the two places a "how far" question measures between (`map.measure`) are
  in the data build, and the opened place is one of the two.
- **Articles and answers lean on more than Wikipedia**: one that cites Wikipedia (or a work
  "as cited in Wikipedia", anywhere in a source line) also cites, in a line that does not
  name Wikipedia, a modern work of its own: one with a year or a reference work. The few
  articles that do not yet are listed in `WIKIPEDIA_ALONE` with what they rest on; the list
  only shrinks, and an entry that no longer needs it, or names no article, fails too.
- **Tours**: no translation in copyright is quoted (`PROTECTED_TRANSLATORS`: M. E.
  Sergeenko's Russian Augustine); the id matches the file name; each stop's passage must
  name its place, except stops listed in `NAMED_BY_CONTEXT` with the reason. A stop whose place the map draws
  faded in its year (the stop's own `year` or the tour's: not yet built, in ruins, gone,
  or named only in the New Testament before its events) is warned about, unless it is
  listed in `FADED_ON_PURPOSE` by tour, place and passage, with the reason (word of Jerusalem's fall reaching Ezekiel).
- **Ancient sites' corrections** (`content/ancient-wave-corrections.json`): the years, English
  labels, names and kinds set by hand when `pipeline/ancient/assemble.py` made the waves, and
  the labels it leaves out. Each must still hold in the wave files: the site there, with those
  years and the reason in its sources, that name or kind, no name Wikidata gave where it was
  refused (only ours, `pipeline/ancient/names-cyrillic.json`), no left-out label among them.
- **Faded in their own year**: an event, a battle or a question's map at a place the map
  draws faded in that year (as for the tours) is refused, unless it is the year the place
  falls, or it is listed in `FADED_ITEMS` with the reason.
- **Events and battles**: an event and a battle at the same place or ancient site within a
  year tell one story; the battle names the event (`event`), so the lists show it once. An
  unlinked pair, a link elsewhere and a battle id that is an event's stop the build.
- **The same passage, years apart**: a tour stop at its tour's year and another record of the
  same passage at the same place five or more years apart are warned about, unless listed
  in `SAME_PASSAGE_APART` with the reason.
- **"How far" answers**: the answer in every language states the distance between the two
  places it measures, within 10% (at least 3 km) of the straight line between their points.
- **Points in the water**: a place (other than a sea, a lake or a river), an ancient site or
  a battlefield more than 1.5 km inside the water the map draws (`water.geojson`; the depth measured to the shores of
  `coast.geojson`) stops the build, unless listed in `IN_WATER` with the reason (a submerged
  city, a sea battle, an islet Natural Earth leaves out).
- **Ancient sites**: a site within 3 km of one of our towns, or 1 km of another of our points
  (a campsite, a valley, a wadi; not a land, a sea, a river or a range), is the same place
  under another name and stops the build, unless `apart_from` or `SITE_APART` says why not.
- **When places stood** (`content/place-life.yaml`): `from` (first year), `until` (last
  year) and `gap` (first and last year in ruins); at least one, the gap inside the years
  the place stood, "c." kept as approximate, at least one source each. Another name of a
  place (Zion for Jerusalem), or the same place in other verses on its very point (Ur of
  Gen 11:28), shares its years. Disputed dates are left out, not guessed.
- **Polity overrides** (`content/polity-overrides.yaml`): our corrections to Cliopatria,
  each with a reason and sources, applied to the pipeline's states (`pipeline/.cache`) on
  every run, never to what an earlier run wrote; copies are marked `src: "override"`.
  Kinds: `overrides` (last year), `starts` (first year), `clips` (cut to an area),
  `absent` (years it did not exist), `renamed` (a new name from a year, for a polity the
  data names by one era too long), `bridges` (years the data leaves it off), `annexed` (its
  last shape drawn as the empire that took it), `vassals` (overlord's colour and a second
  label line), `extends` (an outline joined to its shapes of
  those years: Judah's Negev, Urartu's Lake Van) and `drawn` (a state Cliopatria lacks, our
  approximate outline less the land of the polities in `minus`: Aram-Damascus, Hamath,
  Carchemish, Ammon, Moab, Edom; its names in every language like any other). A clip is
  `within` a convex polygon or, with years, `without` any polygon; the land a clip with
  years cuts away goes `to` the state that took it, or the clip says `leaves_blank`: more
  than half of that land left without any state otherwise stops the build. A name missing
  from the data, an overlord absent in those years, overlapping vassal years, or a drawn
  state covering more than 5% of a state it does not subtract (save as a vassal) stop the
  build. Then the colours are assigned as a map (neighbours shape by shape) and the labels
  of small Levant states pinned (`pin`), both deterministic. A shape or label left with no
  years is not written.
- **Shapes reach the coast** (`scripts/polity-coast.ts`): Cliopatria's coasts run up to
  15 km inland of the real one, which put Tyre, Gaza and Constantinople outside every
  state. Before the corrections, an edge that faces the sea across land no other state of
  those years holds is carried out past the shore; the water is drawn over it.
- **Valid shapes**: every shape ships at three decimals with no repeated point, no spike,
  no ring crossing itself or another part (split at the crossings and joined again,
  `scripts/polygon-ops.ts`), and no speck or sliver; a shape that still fails stops the
  build.
- **Anchors** (`content/polity-anchors.yaml`): a capital or key town lies inside the state
  named for each period, inside some state in the years between, or the years are listed
  as a gap with the reason (Nineveh after 612 BC). Damascus, Rabbah, Dibon, Bozrah, Hamath,
  Carchemish, Babylon, Nineveh, Tushpa, Dan, Lachish, Beersheba, Arad, Gaza, Tyre and
  Constantinople among them.
- **The release is described** (`scripts/release-doc.ts`): every field of the states, of
  `content.json` and of the articles is named in `docs/data-release.md`, or the build stops.
- **Each language in its own script**: no Cyrillic in the articles, answers, tours and
  ancient writers' notes of a language written in Latin letters, and no «» in English (it
  quotes with “”). The few texts that quote the Synodal form of a name in every language are
  listed by name (`SYNODAL_FORM_QUOTED`) until the owner decides whether they keep it.
- **The texts of every language** (`scripts/text-checks.ts`, ADR 0015): each language speaks
  of its own Bible, so no text names the Synodal text outside Russian or the King James
  Version outside English, and no word in Cyrillic stands in a language written in Latin
  letters; an article's title holds its place's name on that language's map
  (`names-<code>.yaml`; English and Russian from `place-names.yaml`), apostrophes as written;
  no two articles bear one title in a language; and a quotation standing where the English
  quotes the KJV is word for word from that language's Bible (`bible-text.ts`, read from
  `pipeline/.cache`; without it the quotations are not checked). The records still waiting
  for their rewrite are listed in `scripts/text-exceptions.ts`; an entry that passes now
  stops the build, so the lists only shrink.
- Nothing is written until every check passes.

## Places in any text (`scripts/build-text-places.ts`)

The index behind `hg-places.js`, the verse links in place cards and the links in the static
pages' verses. It drops rather than guesses. A form goes to a place only when the place's name
holds it against its namesakes (five times the verses, with a longer name counting for its
shorter one: Mount Carmel against Carmel) and against people (three times). It must also not be
an ordinary word: the KJV and the Synodal text write it capitalised more often than small, a
phrase not all in small letters. At least half of the cited verses that use it must be the
place's own (or another record's on the same point). A short hand-checked list drops
modern meanings. A dropped name of several words still blocks its first word, so «Антиохию
Писидийскую» never becomes Antioch of Syria. Russian names are declined by
`packages/model/src/russian-forms.ts` (tested).

## Documentation (`scripts/build-docs.ts`, `scripts/api-openapi.test.ts`)

What the pages count of the data comes from the built data (`{{places}}`, `{{ancient_hand}}`,
…); a name the build does not know stops it. Every page in every language must give each
h2 and h3 its own id, the English one, in the English order, so a link to a section works in
any language. A number in the text is written as the counts beside it are (a hand-given one as
`{{n:1088}}`): one grouped otherwise, or of five digits ungrouped, stops the build. Every review
in `content/reviews/` must be linked from the overview, the methodology and the reviews page of
every language. A test fails when a field of the API's records is named neither on the open
data page of a language nor in its short list of fields described in words.

## API (`scripts/build-api.ts`)

Every file is checked against its description (`scripts/api-openapi.ts`), and every place id
in the events, battles and tours is in `places.json` or carries its ancient site (name and
point) beside it.

## Links

`scripts/check-links.ts`: every link and image in the site's own pages (the documentation, the
static pages in each language, and the pages at the root, the embed and the licences) leads to a
file that is there, and a link to a part of a page (`#review`) to an element with that id (links
to the app itself and out of the site aside).

## Pages

`scripts/build-pages.ts` stops when a place's today line has no words in a page's language (the
English line had stood on 19 languages' pages: «Heute in the region east of Gibeon»);
OpenBible's free-text lines are translated whole in `content/names-<lang>.yaml` (`labels`) and
`content/modern-names.yaml`, and `scripts/build-content.ts` stops on one with no words in a
language or a translation nothing uses (today lines and candidate sites alike).
`scripts/check-pages.ts` reads the built pages: every verse row has the verse or the note that
the translation numbers it otherwise, with its link (an empty row had stood under 3,108
references); a page's description is neither its title nor opens with it; `pages.css` has the
documentation's palette (`content/docs/docs.css`) with text colours at 4.5:1 at least, and every
page, the 404 among them, colours the browser's bar with the paper.

## Budget

`scripts/check-budget.ts`: the JavaScript needed before the first map frame stays within
`BUDGET_KB`, and all of it a reader can fetch, the shared code and one language, within
`TOTAL_KB` (gzip; ADR 0011 and ADR 0021).
