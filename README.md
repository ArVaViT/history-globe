# history-globe

Working name. A 3D globe of biblical and ancient history: move the time slider and
the map changes — borders, cities, routes; hover a city to read what it was in that
century; every place links to the Scripture that mentions it.

Source-available, not open source: the code is public to read, but all rights are
reserved (see `LICENSE`). First host: Equip (equipbible.com); later licensed to
other platforms.

## Status

Pre-code. The stack is being decided in `docs/adr/`.

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
- `docs/embed-protocol.md` — the iframe contract with host platforms.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
