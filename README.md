# History Globe

**[historyglobe.app](https://historyglobe.app)** is a free 3D atlas of biblical history. A time
slider moves the map through the centuries: state borders by year, cities in the years they
stood, roads, journeys and battles. Each place has the verses that name it, its candidate
sites when the identification is disputed, where it is today, and, for 746 of them, an
article with its sources. The site has no accounts, no ads and no fees. It is made by Vadym Arnaut.

## What it holds

As of the release of 2026-10-24 (`api/v1/index.json`, `built_at`):

- 16 languages: English, Russian, Ukrainian, Spanish, Portuguese, German, French, Italian,
  Dutch, Polish, Czech, Swedish, Norwegian Bokmål, Danish, Tagalog and Serbian. No language
  comes first (ADR 0015).
- 1,288 biblical places, 1,231 of them with a page of their own; 746 place articles and
  200 answered questions.
- 54 tours, 329 dated events and 57 battles.
- 2,994 people (STEPBible TIPNR) in the open data; 2,153 of them with their families on the
  map.
- 773 notes on what ancient authors wrote about 439 of the places; 531 sites of the ancient
  world the Bible does not name on the map; 320 photographs.
- State borders by year from 3500 BC to AD 1300 (Cliopatria, corrected for the lands of the
  Bible); Roman roads (Itiner-e).

## How it is checked

The places, verses and points come from open scholarly datasets (OpenBible.info, STEPBible
TIPNR, Pleiades, Wikidata, Cliopatria); where we depart from them, the reason and the source
are given. The
articles, tours and events are drafted with AI help under the author's direction and then
checked against their sources in separate review passes. The last full pass, finished on
2026-10-17, re-read every article against its sources. These reviews were not made by
scholars: no article has been read by a historian yet, and each article page says so. An
article a historian has read will carry the historian's name. How each layer is made and
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

| What                                                 | Licence                             |
| ---------------------------------------------------- | ----------------------------------- |
| The data (places, names, tours, events, people, API) | CC BY 4.0                           |
| The place articles and the answered questions        | CC BY-NC-ND 4.0                     |
| The code, the site and its design                    | all rights reserved; public to read |

Third-party data keeps its own licence (`docs/ATTRIBUTIONS.md`). Details: `LICENSE`, ADR 0014
and ADR 0016.

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

The data, by the date of the snapshot that the dataset's card gives:

```text
Arnaut, Vadym. History Globe dataset. Hugging Face, snapshot of ….
https://huggingface.co/datasets/ArVaViT/history-globe. CC BY 4.0.
```

`CITATION.cff` has the same in machine-readable form.

## Contact

historyglobe.vadym@gmail.com — corrections, reviews, questions and security reports
(`SECURITY.md`). A correction can also be filed as a GitHub issue ("Report an error"); an
email needs no account.

---

## For developers

```sh
pnpm install
pnpm data        # download the open data sets and build apps/web/public/data (Python 3.11+)
pnpm dev         # http://localhost:5173
pnpm gate        # everything that must pass before a merge
```

`pnpm gate` runs format, lint, types, unit and pipeline tests, the content checks, links, the
build, the CSP hashes and the JS budget. It runs locally; releases are built on the owner's
machine and deployed prebuilt (ADR 0012). What the data and content checks refuse, and why:
`docs/data-checks.md`.

Keys in the app: `[` `]` move the year by 10 (with Shift by 100), Space plays, `/` searches,
`←` `→` step through a tour, `N` turns north up, Esc closes.

### Principles

- **Every fact has a source**; disputed things are shown as disputed, with named proponents.
- **Scripture speaks for itself.** The Bible is a separate layer, never pulled into
  scholarly disputes.
- **Clean data provenance.** The data we take in is public domain, CC0 or CC BY only;
  nothing share-alike or non-commercial (ADR 0008).
- **Decisions are written down** in `docs/adr/` before they are coded.

### Docs

- `AGENTS.md` — rules for AI coding agents (and humans).
- `docs/adr/` — architecture decisions:
  - [0001. Record architecture decisions](docs/adr/0001-record-architecture-decisions.md)
  - [0002. Monorepo and toolchain](docs/adr/0002-monorepo-and-toolchain.md)
  - [0003. Time model](docs/adr/0003-time-model.md)
  - [0004. Map engine](docs/adr/0004-map-engine.md)
  - [0005. Tiles and terrain pipeline](docs/adr/0005-tiles-and-terrain.md)
  - [0006. Frontend and embedding](docs/adr/0006-frontend-and-embedding.md)
  - [0007. Content as code](docs/adr/0007-content-as-code.md)
  - [0008. Data licensing policy](docs/adr/0008-data-licensing-policy.md)
  - [0009. Backend, in phases](docs/adr/0009-backend-phasing.md)
  - [0010. Quality gates](docs/adr/0010-quality-gates.md)
  - [0011. MapLibre unbundled; the JS budget counts its worker](docs/adr/0011-maplibre-unbundled-and-the-js-budget.md)
  - [0012. Vercel for the site, Supabase for the data](docs/adr/0012-vercel-and-supabase.md)
  - [0013. The ancient world around the Bible, as its own quieter layer](docs/adr/0013-the-ancient-world-layer.md)
  - [0014. Open data, closed code](docs/adr/0014-open-data-closed-code.md)
  - [0015. Every language equal](docs/adr/0015-every-language-equal.md)
  - [0016. The articles and the questions under CC BY-NC-ND; no training](docs/adr/0016-articles-and-questions-under-by-nc-nd.md)
  - [0017. Canary marks in what is published, and one notice to the programs that read it](docs/adr/0017-canary-marks-and-the-notice.md)
- `docs/content-guide.md` — how articles, tours, events and the years of towns are written.
- `docs/data-checks.md` — what the build refuses, and why.
- `docs/data-release.md` — the data release, file by file; `db/` — the same as a database.
- `docs/adding-a-language.md` — what a new language needs.
- `docs/embed-protocol.md` — the iframe contract with host pages.
- `docs/crosswalk.md` — the crosswalk to other gazetteers.
- `docs/launch-readiness.md` — rights, hosting, privacy and AI, as checked at launch.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
