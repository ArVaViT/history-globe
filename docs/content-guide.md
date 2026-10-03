# Writing content

How tours, dated events and the years towns stood are written. What the build refuses is
in `data-checks.md`; this is what it cannot check.

## Everywhere

- **Every claim has a source.** Scripture as an OSIS reference in English numbering
  (`Acts.13.4`); ancient authors with book and section (Josephus, Antiquities 17.191);
  modern works by author, title and year.
- **Disputed things are left out or said to be disputed.** A wrong date is worse than a
  missing one. "c." marks an approximate year and is shown as "ок." / "c.".
- **Scripture is not pulled into scholarly disputes.** No title or note ties a verse to a
  contested date or reading (Luke 2:2 is not named with AD 6; Josiah's death is not
  called a battle, as 2 Kings and 2 Chronicles tell it differently).
- **Russian follows the Synodal text:** its names (Секелаг, Сонам, Ен-Гадди), its
  wording, and its spelling in quotations (no "ё": «ты мертв»). Names come from
  `content/place-names.yaml`; if the card shows a name, the note uses the same one.
  References are shown in the Synodal numbering automatically (`synodal.ts`).
- **English** follows the sense of the KJV; quotations are word for word from the KJV,
  which is in the public domain (ATTRIBUTIONS). Modern versions under copyright (ESV,
  NIV, NKJV) are not quoted.

## Tours (`content/tours/*.yaml`)

- Before writing one, search `content/tours/` for its passages: a tour that repeats most
  of another's stops is not added (a tour of the ark was dropped, as "Samuel and the ark"
  already follows it). A tour taking up where another ends says so in its header.
- Stops in the order of the text. Each stop's passage must name its place (the build
  checks it against OpenBible's tags); a stop named only by context goes into
  `NAMED_BY_CONTEXT` with the reason.
- **The year is a point for the map**, marked `approximate: true` unless the whole tour
  happened in one known year. The header comment says what the year stands for and what
  else is held (the Exodus: 1446 BC after 1 Kgs 6:1, c. 1260 BC also held; the
  patriarchs: a conventional point). A stop may carry its own `year` where the text dates
  it apart (Nehemiah's twentieth year, 445 BC, in a tour set at Ezra's 458; the fortieth
  year of the Exodus at Mount Hor); the slider moves to it. The build warns if a stop's
  place is drawn faded in its year (not yet built, in ruins, gone).
- Notes are one or two sentences: where, who, what happened. Quotations in «» are
  verbatim Synodal; in English, verbatim KJV in straight double quotes.
- Avoid two stops citing the same verse; where the text moves on within a verse, cite
  the next verses instead.
- A tour across several Gospels follows the order usually given and says where the
  Gospels do not fix it; no stop's range settles a question of harmonisation (Luke
  24:44-49 is left out of the resurrection tour for that reason).
- The note names a place as its card does, even where the verse uses another form
  ("Sea of Galilee", not "sea of Tiberias").
- Before a tour lands, an independent fact check against the Synodal text: reference,
  wording, facts, place id, order, year. Every tour so far needed at least one fix. A
  checker's finding is checked in turn against the text itself
  (`pipeline/.cache/russyn_usfm.zip`): of 23 in one pass, 4 were the checker's memory of the
  Synodal, not the Synodal.
- `by: sea` on a stop whose leg was sailed (Acts 20:14, Assos to Mitylene): no time on foot
  and no way by road. `walked: false` on a tour whose stops are not a way travelled (the
  letters' readers). From 312 BC the build finds each walked leg's way along the Roman roads
  (`scripts/build-road-legs.ts`); a tour before then is given the straight line only.
- `people:` names the people whose route the tour follows, by TIPNR id (`Paul@Act.7.58-2Pe`), so their card
  offers it; the build fails on an id that is not in `people.json`. Only the tour's own
  subject: not everyone it mentions.

## Dated events (`content/events.yaml`)

- Turning points with a year mainstream scholarship states, preferably fixed by a
  non-biblical record (the Babylonian Chronicle, Assyrian annals, Josephus, a dated
  inscription). Titles are neutral; the place is where it happened (Herod died at
  Jericho, not Jerusalem).
- Two independent sources each, both opened and read: a reference written from memory
  (a paragraph number, a page) is left out, not shipped. Disputed dates are not dated
  (the Exodus, the census of Quirinius, Ezra's arrival).
- `place` is one of our places; an event at a city the Bible does not name gives `site`,
  an id from `content/ancient-sites.json` instead (the fall of Hattusa). The build checks
  the event falls inside the site's years.

## When the chapters happen (`content/chapter-years.yaml`)

- Runs of chapters per OSIS book with the year the map shows them at: the start of the
  reign or the dated event the run turns on. The project's own chronology first (the
  tours' and events' years), Thiele for the kings. Books without an agreed time (Gen
  1–11, Job, Psalms) are left out. A person's year is the middle of their chapters.

## When towns stood (`content/place-life.yaml`)

- `from` (first year), `until` (last year), `gap` (first and last year in ruins).
  Only for towns founded, destroyed or abandoned inside 3500 BC – AD 1300 with a firm
  date. Sacked but lived on (Susa, Tyre, Damascus) is not an end; a colony settled in an
  older town is not a founding.
- Check which site the point stands for before dating it (New Smyrna, not Old Smyrna;
  Jericho of the Old Testament and of the New are two places).

## People (`content/people-ru.json`, `content/people-not-in-text.json`, `content/people-places-not-in-text.json`)

- People and their families come from STEP Bible's TIPNR; the card shows only what the
  text says. A family link the text does not make (a tradition, a reading of a
  genealogy, a namesake taken for another) goes into `people-not-in-text.json` with the
  reason; a spouse link is dropped both ways.
  A link the text makes and TIPNR leaves out goes into `people-links-in-text.json` with
  its verse (Matt 1:15: Matthan begat Jacob).
- "Where they lived and acted" comes from TIPNR's ties and verses named together, a rule
  that errs often (dates "in the year of Asa", a mother's home town, "from Dan to
  Beersheba"). A tie the key verse does not bear out goes into
  `people-places-not-in-text.json`: under `ties` if the person was not there by the text,
  under `verses` with the verse that shows it if they were (one of the place's own).
- Check each against the KJV and the Synodal text, both read, not recalled.

## The ancient world (`content/ancient-sites.json`, ADR 0013)

- Capitals, cities, ports and sanctuaries the Bible does not name, inside the map's
  area. The point is on the site itself, not on the modern town over it; the years are
  those it stood as a significant place, checked against two sources (Pleiades periods,
  an encyclopaedia; Wikidata only where its item is the site and not its modern
  successor). Rank 0 for some forty of world importance, 1 for regional centres.
- A site within 3 km of one of our towns is the same place: the build refuses it.

## States (`content/polity-overrides.yaml`)

- Corrections to Cliopatria's years: `last_year` later than its end keeps the last
  shape on the map, earlier ends it (the Hamdanids in 1004, not 1259); `starts` draws a
  polity from an earlier year with its first shape (Israel from David, 1010 BC), or from
  a later one with the earlier shapes cut (the Hyksos from 1650 BC). Each with the
  reason and two sources. A shape drawn too far is cut to a convex polygon under `clips`
  (Philistia on the coastal plain); missing states are not added here. A cut reshapes the
  release's own files: to widen or drop one, rebuild them from the source with `pnpm data`.

## Articles (`content/articles/*.yaml`, ADR 0007)

- One overview article per place: `id` = file name, `place` = the OpenBible record that
  carries the verses (not a `dup`). 3–4 paragraphs, the same number in both languages,
  60–900 characters each, at most 450 words per language. English is the master; the
  Russian says the same.
- The arc: where it is → earliest history and archaeology → its biblical role → later
  history to about AD 500. Mainstream facts only; disputed datings and identifications are
  named as disputed, with the candidates ("Tell el-Qudeirat is the usual identification").
- Every claim rests on a cited source: a primary text with its locator (Josephus,
  Eusebius' Onomasticon, a chronicle, an inscription) and one to three standard modern
  works. Open the source and check the locator; what cannot be opened is softened or cut.
  Never a locator from memory.
- Quotations only from the KJV (en) and the Synodal text (ru), word for word; Russian
  biblical names in their Synodal form, as in `place-names.yaml`.
- Russian typography (the build checks): «» quotes, an em dash between words (the
  digital Synodal text sets hyphens: quote it with dashes), no double spaces.
- The cycle that converges: a writer, then an independent reviewer who opens the sources
  and fixes the file, then the lead reads the report and commits. No article has passed
  without changes; reviewers find 4–8 points per batch of five.

## Photos (`content/photos.yaml`)

- One photo per place, from Wikimedia Commons, only public domain, CC0 or CC BY (no
  share-alike, ADR 0008; the build refuses other licences). Author and licence as Commons
  states them; an "unknown author" is left out rather than guessed.
- What it shows: the ancient site, its tell or ruins, or its landscape; an old photograph
  is welcome, but not an engraving, drawing or painting (the card calls it a photo), not a
  close-up of a find, mosaic or statue, and no people in the foreground. Not modern streets, signs, maps or unrelated scenes. Where the
  place is disputed, the photo shows the site the map puts it at, and the caption says so
  ("На снимке Эт-Телль — одна из версий"); where nobody knows the site and the map's
  point is only one guess among many (Mount Sinai), no photo.
- How to find one: the place's Wikidata image (P18) first, then its Commons category
  (P373), then a targeted search ("Tel Lachish gate"); filter by licence from Commons
  metadata, choose by eye from a contact sheet. Free-text search alone finds namesakes.
- `pnpm data` downloads them (scripts/build-photos.ts); the site serves them itself, and
  the card credits the author and links to the file page.
