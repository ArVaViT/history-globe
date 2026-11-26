# History Globe

[![The globe in AD 50: the eastern Mediterranean under Rome, the places of Acts 16 marked, the time slider below](apps/web/public/og/en.jpg)](https://historyglobe.app)

**[historyglobe.app](https://historyglobe.app)** is a free 3D atlas of biblical history. A time
slider moves the map through the centuries: state borders by year, cities in the years they
stood, roads, journeys and battles. Each place has the verses that name it, its candidate
sites when the identification is disputed, where it is today, and, for 746 of them, an
article with its sources. The site has no accounts, no ads and no fees. It is made by Vadym Arnaut.

[Open the globe](https://historyglobe.app) ·
[Methodology](https://historyglobe.app/docs/methodology.html) ·
[API](https://historyglobe.app/docs/api.html) ·
[Dataset](https://huggingface.co/datasets/ArVaViT/history-globe) ·
[How to cite](#how-to-cite) · [Changes to the data](CHANGELOG.md)

## What it holds

- 21 languages: English, Russian, Ukrainian, Spanish, Portuguese, German, French, Italian,
  Dutch, Polish, Czech, Swedish, Norwegian Bokmål, Danish, Tagalog, Serbian, Hungarian, Finnish,
  Vietnamese, Romanian and Bulgarian. No language
  comes first (ADR 0015).
- 1,214 places named in the Bible, each with its verses and a page of its own (1,271 place
  records in all); 746 place articles and 200 answered questions.
- 62 tours, 329 dated events and 60 battles.
- 2,994 people (STEPBible TIPNR) in the open data; 2,153 of them with their families on the
  map.
- 773 notes on what ancient authors wrote about 439 of the places; 1,987 places of the
  ancient world the Bible does not name; 320 photographs.
- State borders by year from 3500 BC to AD 1300 (Cliopatria, corrected for the lands of the
  Bible); Roman roads (Itiner-e).

## How it is checked

The places, verses and points come from open scholarly datasets (OpenBible.info, STEPBible
TIPNR, Pleiades, Wikidata, Cliopatria); where we depart from them, the reason and the source
are given. The
articles, tours and events are drafted by the author with the assistance of large language
models and then checked against their sources in separate review passes. The last full pass,
finished on 2026-10-17, re-read every article against its sources. These passes are the
project's own checks, not peer review. Reviews by specialists are published under their names:
an article a specialist has reviewed names the reviewer and links to the review (Juan Manuel
Tebes has reviewed five articles on Edom and the Arabah); every other article page says it has
not been read by a historian yet. How each layer is made and
what is uncertain: [methodology](https://historyglobe.app/docs/methodology.html).

Errors we found in the datasets we draw on, and our own disagreements with them, are listed
with their evidence in [`docs/crosswalk/their-errors.md`](docs/crosswalk/their-errors.md).

## Links

- Site: <https://historyglobe.app>
- Methodology: <https://historyglobe.app/docs/methodology.html>
- Sources and credits: <https://historyglobe.app/docs/sources.html>
- Open API (static JSON, no key): <https://historyglobe.app/api/v1/>, documented at
  <https://historyglobe.app/docs/api.html>
- What you may build on it: <https://historyglobe.app/docs/build.html>
- Dataset on Hugging Face: <https://huggingface.co/datasets/ArVaViT/history-globe>
- Crosswalk to OpenBible, Wikidata, Pleiades, TIPNR and Theographic:
  [`docs/crosswalk.md`](docs/crosswalk.md)

## Licences

| What                                                                     | Licence                       |
| ------------------------------------------------------------------------ | ----------------------------- |
| The code                                                                 | AGPL-3.0-or-later (`LICENSE`) |
| The places-in-any-text script (`hg-places.js` and its released versions) | MIT                           |
| The code examples on the documentation pages                             | CC0 1.0                       |
| The data (places, names, tours, events, people, API)                     | CC BY 4.0                     |
| The crosswalk tables (`docs/crosswalk/*.csv`)                            | CC BY-SA 4.0                  |
| The place articles and the answered questions                            | CC BY-NC-ND 4.0               |
| The reviews                                                              | their authors'                |
| The photographs and other third-party material                           | their own                     |
| The name "History Globe" and its logo                                    | not licensed                  |

The additional terms under section 7 of the AGPL (`LICENSING.md`, part 1), for a modified version: it
keeps the line "History Globe by Vadym Arnaut" with a link to https://historyglobe.app in what
it shows its users (7(b)), which may read "Based on History Globe by Vadym Arnaut" and does not
breach the other two terms; it is marked in reasonable ways as different from the original, as
by a name of its own (7(c)); and the licence grants no trademark rights to the name or the logo
(7(e)). The articles and the answers may be copied and shared unchanged, with credit and the
licence named, and not for commercial use; changed or translated versions may not be shared.
Text and data mining of them is reserved as far as their licence does not already permit it; the
reservation does not narrow the open licences of the other parts. Third-party data keeps its own
licence (`docs/ATTRIBUTIONS.md`). The crosswalk tables cite Theographic Bible Metadata and
are under its CC BY-SA 4.0; they are not part of the site, the API or the dataset. Which
licence covers which path, and how a contribution is licensed: [`LICENSING.md`](LICENSING.md),
and for tools `REUSE.toml`; the text of the AGPL: `LICENSE`; the decisions: ADR 0016 and ADR 0019.

## How to cite

As the methodology gives it (https://historyglobe.app/docs/methodology.html#cite); the date of
the data is `built_at` in api/v1/index.json, also at the foot of every documentation page.

The site:

```text
Arnaut, Vadym. History Globe: an atlas of biblical history. https://historyglobe.app/
(data of <built_at>; accessed …).
```

A page, by its title and address:

```text
“Jerusalem.” In Vadym Arnaut, History Globe. https://historyglobe.app/en/place/jerusalem/
(data of <built_at>; accessed …).
```

The data, by the date of the snapshot that the dataset's card gives (its version), with the
BibTeX entry on the card:

```text
Arnaut, Vadym. History Globe dataset. Hugging Face, snapshot of ….
https://huggingface.co/datasets/ArVaViT/history-globe. CC BY 4.0.
```

`CITATION.cff` has the same in machine-readable form. What changed in the data from one
release to the next: [`CHANGELOG.md`](CHANGELOG.md).

## Contact

historyglobe.vadym@gmail.com — corrections, reviews, questions and security reports
(`SECURITY.md`). A correction can also be filed as a GitHub issue ("Report an error"); an
email needs no account.

---

## For developers

Requirements: Node 24.11+ (CI runs 24; 26 works too), pnpm in the version pinned in
`package.json`, Python 3.11+ with its standard library only, and `git`, `curl` and `unzip` on
the path (the data build downloads with curl and reads zipped Bibles with unzip; the sitemap
takes its dates from git). No account or key is needed to build, run or test the site.

Node 24 bundles Corepack, which provides the pinned pnpm (`corepack enable`). Node 25 and later
no longer bundle it: install pnpm itself (`npm install --global pnpm`), and it switches to the
pinned version on its own.

```sh
corepack enable  # Node 24; on Node 25+: npm install --global pnpm
pnpm install
pnpm data        # downloads the open datasets (about 400 MB) and builds apps/web/public/data:
                 # about 20 minutes the first time; later runs reuse pipeline/.cache
pnpm content     # the static pages, the open API and the documentation pages:
                 # several minutes
pnpm dev         # http://localhost:5173
pnpm gate        # everything that must pass before a merge: several minutes (it runs
                 # pnpm content again)
```

`pnpm gate` runs format, lint, types, unit and pipeline tests, the content checks, links, the
build, the CSP hashes and the JS budget. CI runs the part of it that needs no data on every
pull request; the whole gate runs locally before a merge, and releases are deployed prebuilt
(ADR 0012). What the data and content checks refuse, and why: `docs/data-checks.md`. The
browser checks: `e2e/README.md`. How to contribute: `CONTRIBUTING.md`.

### Running your own copy

The code is yours to run under the AGPL. A modified version that serves others over a
network must offer them its source (section 13), keep the attribution line above and be marked
as different from the original, as by a name of its own. The build needs no secret:
`pnpm data && pnpm content && pnpm build` makes a complete site from the open data. Without
`content/articles/` and `content/questions/` it builds without them; a copy may carry them
only unchanged, with credit and the licence named, and not for commercial use (CC BY-NC-ND). The origin beacon (ADR 0017) is written only into a build for
`SITE_URL=https://historyglobe.app`, so a copy built from the source sends nothing to it.

Keys in the app: `[` `]` move the year by 10 (with Shift by 100), Space plays, `/` searches,
`←` `→` step through a tour, `N` turns north up, Esc closes.

### Environment

Nothing is read from a `.env` file; every variable is optional.

| Variable                               | Read by                                                                                                       | Without it                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `SITE_URL`                             | `scripts/build-pages.ts`, `build-docs.ts`, `build-page-hashes.ts`, `indexnow.ts`; `pipeline/build_dataset.py` | no canonical links and no sitemap; the dataset and IndexNow name `https://historyglobe.app`   |
| `HG_CONTACT`                           | `pipeline/net.py`                                                                                             | the data build's requests name the project, not you: set an address so a source can reach you |
| `WAVE`, `FAME`                         | `pipeline/ancient/` (its README)                                                                              | wave 1, and 8 Wikipedia articles as a site's least fame                                       |
| `HG_URL`                               | `e2e/`                                                                                                        | the browser checks open `http://localhost:5173/`                                              |
| `HG_TILES=live`                        | `e2e/browser.mjs`                                                                                             | the relief is one flat tile served locally                                                    |
| `CHROMIUM`                             | `e2e/browser.mjs`                                                                                             | Playwright's own Chromium                                                                     |
| `TEXT_PLACES_DEBUG`                    | `scripts/build-text-places.ts`                                                                                | the dropped name matches are not written out                                                  |
| `HG_CANARY_SEED`, `HG_CANARY_REGISTRY` | `scripts/canary.ts` (ADR 0017)                                                                                | no canary marks; for the official site only                                                   |
| `WEBMCP_ORIGIN_TRIAL`                  | `apps/web/vite.config.ts`                                                                                     | no origin-trial token; for the official site only                                             |
| `DATABASE_URL`                         | `db/load.sh`                                                                                                  | the optional database load cannot run                                                         |

Deploying the official site, loading its database and publishing the dataset need the
maintainers' credentials; none of it is needed to work on the code or the content.

### Principles

- **Every fact has a source**; disputed things are shown as disputed, with named proponents.
- **Scripture speaks for itself.** The Bible is a separate layer, never pulled into
  scholarly disputes.
- **Clean data provenance.** The data we take in is public domain, CC0 or CC BY only;
  nothing share-alike or non-commercial reaches the site, the API or the dataset (ADR 0008).
  The one share-alike part of the repository is the two crosswalk tables, which cite
  Theographic's record ids and are under its CC BY-SA 4.0.
- **Decisions that are expensive to reverse are recorded** in `docs/adr/`; a change of mind
  is a new record.

### Docs

- `AGENTS.md` — rules for coding agents (and humans).
- `CONTRIBUTING.md` — how to contribute, and how a contribution is licensed (DCO).
- `LICENSING.md` — which licence covers which part, and the AGPL's additional terms.
- [`docs/adr/`](docs/adr/README.md) — architecture decisions, with their index and status.
- `docs/content-guide.md` — how articles, tours, events and the years of towns are written.
- `docs/data-checks.md` — what the build refuses, and why.
- `docs/data-release.md` — the data release, file by file; `db/` — the same as a database.
- `docs/adding-a-language.md` — what a new language needs.
- `docs/embed-protocol.md` — the iframe contract with host pages.
- `docs/crosswalk.md` — the crosswalk to other gazetteers.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
