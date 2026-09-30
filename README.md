# history-globe

Working name. A 3D globe of biblical and ancient history: move the time slider and
the map changes — borders, cities, routes; hover a city to read what it was in that
century; every place links to the Scripture that mentions it.

Source-available, not open source: the code is public to read, but all rights are
reserved (see `LICENSE`). First host: Equip (equipbible.com); later licensed to
other platforms.

## Status

A working prototype (PR #2): the globe with relief, state borders by year, 1288 biblical
places (1168 of them with a Synodal Russian name, and 15 more names for records not on the
map; references shown in the Synodal numbering in Russian), disputed locations, the years 27 towns stood and fell,
32 dated turning points on the time slider, and thirty-three tours from Abraham to the
seven churches of Revelation. Desktop first, with a phone and tablet layout; a link
reopens the same view, tour stop included. No production hosting yet.

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
- `docs/data-checks.md` — what the build refuses, and why.
- `docs/content-guide.md` — how tours, events and the years of towns are written.
- `docs/embed-protocol.md` — the iframe contract with host platforms.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
