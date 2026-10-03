# History Globe

A 3D globe of biblical and ancient history: move the time slider and the map changes —
borders, cities, roads, journeys; open a place to read what it was in that century;
every place links to the Scripture that names it. **[historyglobe.app](https://historyglobe.app)**

The data is open: the curated content and the data built from it, served as an open
API, are under CC BY 4.0. The code is source-available, not open source: public to read,
all rights reserved. See `LICENSE` and ADR 0014.

## Status

Live at historyglobe.app, in Russian and English. The globe with relief from Spain to
Persia; state borders by year from 3500 BC to AD 1300; 1288 biblical places with their
Russian (Synodal) names, disputed locations with their candidate sites, where each is
today and the years it stood; 329 dated events and 57 battles; 2153 people of the Bible
with their families (STEP Bible TIPNR, every tie read against the text); 553 sites of the
ancient world around it; Roman roads (Itiner-e). 46 tours with walking days along the
roads and the relief of each leg; 155 place articles, 62 question pages and 80
ancient-author notes, 140 photos — each checked against its sources by an independent
pass.

- **People:** search a name ("Давид"), or Overview → People: their family, the line of
  their fathers, the places they lived and acted in lit on the map, which goes to their
  century.
- **The ancient world:** Ugarit, Hattusa, Mari, Delphi and five hundred more, quieter
  than the Bible's places and named on hover or tap; the search finds them too.
- **Chapter → map:** type «Деян 16» or "Gen 12" in the search, and the map shows the
  places of that chapter at its year (182 dated runs of chapters, `content/chapter-years.yaml`);
  `?ref=Acts.16` links to it.
- **Verses in the card:** the text of each verse a place cites, Synodal or KJV.
- **Pages for search engines:** a plain page for every place and tour
  (`scripts/build-pages.ts`), with a sitemap when built with `SITE_URL`.
- **For a class:** lessons built from place cards and shared by a link; A4 sheets, an
  outline map, quizzes on paper and on screen; the map as a picture with its credits; full
  screen for a projector; works offline once saved (Settings).
- **Open data:** static JSON under `/api/v1/` — the places a verse names, places, events,
  battles, tours, questions (`content/docs/en/api.html`).
- **Embedding:** `/embed/v1` in another site's page (`docs/embed-protocol.md`).
- Desktop first, with a phone and tablet layout; a link reopens the same view.

What has to happen before launch: `docs/launch-readiness.md`.

Keys: `[` `]` move the year by 10 (with Shift by 100), Space plays, `/` searches,
`←` `→` step through a tour, `N` turns north up, Esc closes.

## Run it locally

```sh
pnpm install
pnpm data        # download the open data sets and build apps/web/public/data (Python 3.11+)
pnpm dev         # http://localhost:5173
pnpm gate        # everything that must pass before a push
```

What the data and content checks refuse, and why: `docs/data-checks.md`.

## Principles

- **Quality over speed.** Every fact has a source; disputed things are shown as
  disputed, with named proponents.
- **Scripture speaks for itself.** The Bible is a separate layer, never pulled into
  scholarly disputes.
- **Clean data provenance.** Only public domain, CC0 and CC BY data; nothing
  share-alike or non-commercial ends up in the product.
- **Decisions are written down** in `docs/adr/` before they are coded.

## Where to start

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
- `docs/data-checks.md` — what the build refuses, and why.
- `docs/data-release.md` — the data release, file by file; `db/` — the same as a database.
- `docs/content-guide.md` — how tours, events and the years of towns are written.
- `docs/embed-protocol.md` — the iframe contract with host platforms.
- `docs/launch-readiness.md` — rights, hosting, privacy, AI and the launch-day checklist.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
