# 0017. Canary marks in what is published, and one notice to the programs that read it

- Status: accepted (follows ADR 0016)
- Date: 2026-10-19

## Context

ADR 0016 put the articles and the answers under CC BY-NC-ND and reserved text and data
mining; its consequences said that a crawler that ignores robots.txt is stopped by nothing
in the code, and that a static site cannot stop a copy technically. What it can do is make a
copy provable: a site or a dataset built from this one, rather than from the same sources
(OpenBible, STEPBible), should be tellable with evidence. The data is CC BY: a copy of it is
allowed with credit, and the evidence then shows which copy owes the credit. The owner also
wants every program that reads the site, crawler, agent or copier, to meet the same short
statement of what may be taken and how, before it decides.

## Decision

- **Canary marks.** The build writes some records and texts in one of two fair ways,
  chosen by an HMAC of a seed and the record's id (`scripts/canary.ts`): one space more
  after a sentence's end in one paragraph of a text; two neighbouring records of a list that
  promises no order swapped; a record's keys in another order; the ids of a verse in another
  order. None changes what a reader sees or what the data says, and the texts are not
  touched in `content/`: the marks exist in the built files only. The seed comes from the
  environment (`HG_CANARY_SEED`); without it the build is as before, and the gate runs
  without it. Where the marks went is written to a file outside the repository
  (`HG_CANARY_REGISTRY`), with a detector that checks a suspect site or dataset against it.
  The repository is public, so it holds the mechanism and never the seed or a registry.
- **What is not a mark.** No fact is bent: no invented place, author, source, date or
  coordinate, and no invisible character in a text. Accuracy is the product (ADR 0007); a
  reader, a search engine and a screen reader get the same text as before.
- **The API's promise narrows by a word.** `places.json` and the ids of a verse were
  described as "in the order of the data"; they are now described as promising no order, as
  the readers of the API already treat them (they join on `id`). Fields and files still only
  grow.
- **One notice** (`packages/model/src/notice.ts`): four sentences on the data, the texts,
  the code and where to read more. It stands as a comment in the head of every page, in
  `index.json` (`notice`), and as `Link` headers (`rel="license"`, `rel="service-desc"`,
  `rel="service-doc"`) on every API and data file; `llms.txt` says the same at length, and
  `docs/build.html` says it to developers in every language.

## Alternatives considered

- **Fictitious entries** ("paper towns"). The strongest evidence in court, and a lie in an
  atlas whose claim is accuracy. Rejected.
- **Zero-width characters in the texts.** Survive copying well, but show up in copy-paste,
  can break find-in-page and are stripped by one regular expression. Rejected.
- **Marks in `content/` itself.** Would put them in the public repository and in every
  clone of it. The marks live in the build, keyed by a secret, so a clone of the repository
  and a copy of the site are told apart.

## Consequences

- A deploy that wants marks runs the content build with the seed (the owner's deploy steps);
  a deploy without it publishes none and loses nothing else. The registry of each deploy is
  kept; the seed stays the same, so every registry fits every later deploy.
- The outputs of the content and API builds are deterministic for a given seed, as before
  for none: the three-run determinism check of the content build still holds.
- A reader of `places.json` that relied on its order, against the description, now reads
  the ids. None is known.
