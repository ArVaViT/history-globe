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

## Addendum (2026-10-19): the beacon and the honeypot

The marks above prove a copy once it is found. Two more things make a copy, and a crawler
that ignores `robots.txt`, show up by themselves, with nothing new to run or pay for: the
host's firewall (Vercel WAF, custom rules in log mode) is the only place the signals go.

- **The beacon** (`packages/model/src/beacon.ts`). A short script, without imports, stands
  inline at the end of every page: the app's (`vite.config.ts`, so that the bytes are the
  built pages' own and one hash in the Content-Security-Policy allows it everywhere) and the
  built place, tour, question and documentation pages (`scripts/page-shell.ts`, `bodyEnd`).
  On `historyglobe.app`, on `localhost`, on a `.local` name or a private network address
  (a developer's machine seen from a phone; a classroom's own mirror) and on the project's
  previews (`history-globe*.vercel.app`) it does nothing; a page opened from a file does
  nothing either. Nor on Google Translate's proxy (`*.translate.goog`) or the Wayback
  Machine (`web.archive.org`): a page shown through a translator or an archive is not a
  copy, both name the original themselves, and a line from us there would be clutter to
  the reader and noise in the log. From any other host it asks
  `https://historyglobe.app/origin/<host>` for an image (there is no such file: the answer
  is the 404 page, which the image never shows) and puts one line on the page, "Original:
  historyglobe.app", a link. The request carries the copy's host and nothing else: no
  query, no referrer (`referrerPolicy: no-referrer`), no cookie (the site sets none),
  nothing of the reader, who reaches the site as with any request to it. The policy's `img-src` names
  `https://historyglobe.app`, the site's own origin, so a copy that kept the headers still
  sends it. A globe framed by another site is not a copy: `/embed/v1` and `?embed=1` are
  served by the site, so their hostname is its own; `hg-places.js`, which runs on other
  sites by design, does not carry the script. A copier who reads the HTML can cut the
  script; the beacon is for the many copies made by a tool, not for the careful one.
- **The honeypot** (`packages/model/src/honeypot.ts`). `/export/` is disallowed in
  `robots.txt` for every crawler, and every page links to it with a link no reader sees
  (`hidden`, `aria-hidden`, out of the tab order, `rel="nofollow"`). A search engine reads
  `robots.txt` and never asks for it; whoever asks has read the HTML and ignored both. The
  page that is there says so, links only to the API and the Build page, and asks not to be
  indexed; it is not in the sitemap. Should a search console ever list the address as
  "indexed, though blocked by robots.txt", the link comes off the built pages and stays on
  the app's page alone.
- **Where the signals are read.** Two firewall rules, both in log mode and prepared outside
  the repository with the rate limits of the same day: "origin beacon" (path starts with
  `/origin/`) and "honeypot" (path starts with `/export/`). The firewall's overview, by rule
  and then by path, lists the copies' hosts and the addresses that asked for the honeypot,
  with their IP, network and user agent; the host's request logs list the same requests by
  path. After a week of logs the honeypot's rule may deny or challenge; the beacon's rule
  stays in log mode, since its requests come from readers of a copy, not from the copier.
  No rule is applied by the code: that is the owner's step, and reversible.
- **What is not done.** No server, no function and no analytics event receives the beacon:
  a static file host and its firewall are enough, and nothing new keeps data. The privacy
  page says, in every language, what a copy sends. The seed and the registry of the marks,
  and the firewall's logs, stay outside the repository as before.
