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
  wording, facts, place id, order, year. Every tour so far needed at least one fix.

## Dated events (`content/events.yaml`)

- Turning points with a year mainstream scholarship states, preferably fixed by a
  non-biblical record (the Babylonian Chronicle, Assyrian annals, Josephus, a dated
  inscription). Titles are neutral; the place is where it happened (Herod died at
  Jericho, not Jerusalem).

## When towns stood (`content/place-life.yaml`)

- `from` (first year), `until` (last year), `gap` (first and last year in ruins).
  Only for towns founded, destroyed or abandoned inside 2000 BC – AD 100 with a firm
  date. Sacked but lived on (Susa, Tyre, Damascus) is not an end; a colony settled in an
  older town is not a founding.
- Check which site the point stands for before dating it (New Smyrna, not Old Smyrna;
  Jericho of the Old Testament and of the New are two places).
