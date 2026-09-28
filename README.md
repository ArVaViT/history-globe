# history-globe

Working name. A 3D globe of biblical and ancient history: move the time slider and
the map changes — borders, cities, routes; hover a city to read what it was in that
century; every place links to the Scripture that mentions it.

Private and proprietary (see `LICENSE`). First host: Equip (equipbible.com);
later licensed to other platforms.

## Status

Pre-code. The stack is being decided in `docs/adr/`. A throwaway prototype and the
full research live outside this repo (`~/Desktop/history-globe-research/`).

## Principles

- **Quality over speed.** Every fact has a source; disputed things are shown as
  disputed, with named proponents.
- **Scripture speaks for itself.** The Bible is a separate layer, never pulled into
  scholarly disputes.
- **Clean data provenance.** Only public domain, CC0 and CC BY data; nothing
  share-alike or non-commercial ends up in the product.
- **Decisions are written down** in `docs/adr/` before they are coded.

## Where to start

- `docs/adr/` — architecture decisions.
- `docs/ATTRIBUTIONS.md` — third-party data and credits.
