# 0014. Open data, closed code

- Status: accepted
- Date: 2026-10-03

## Context

The repository was "all rights reserved" as a whole, while the open API (
`scripts/build-api.ts`) and its documentation already offered the data under CC BY 4.0:
the two said opposite things. The owner does not mean to earn from the project; he wants
it to be the best of its kind and known under his name, and wants other platforms to use
his data and API rather than copy the globe itself.

## Decision

Two licences, one repository (`LICENSE`):

- **Data: CC BY 4.0.** The curated content in `content/` and what the build makes of it
  (`apps/web/public/data/`, the API in `apps/web/public/api/`). Attribution keeps the
  author's name on every use.
- **Everything else: all rights reserved.** Code, documentation and design stay
  source-available only.

Third-party data keeps its own licence (ADR 0008 allows only PD, CC0, CC BY, ODC-BY), so
the CC BY grant covers this project's own contribution and nothing is relicensed.

## Alternatives considered

- **Everything reserved**: contradicts the open API and closes the way to scholarly
  partners (Pleiades, World Historical Gazetteer), who work with open data.
- **MIT or AGPL for the code too**: any platform could then take the globe whole; the
  owner wants the API used, not the globe copied.
- **CC BY-SA for the data**: share-alike would keep platforms from mixing it with their
  own, which is the use wanted.

## Consequences

The data may be taken and reused anywhere with credit, including commercially; that is
intended. The code stays the moat. A future change of either licence applies only to
what is released after it.
