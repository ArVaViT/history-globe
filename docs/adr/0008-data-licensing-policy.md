# 0008. Data licensing policy

- Status: proposed
- Date: 2026-09-28

## Context

The product will be licensed to other platforms, so its database must stay free of
obligations that would force it open or forbid commercial use. Licences were checked
twice against primary texts on 2026-09-28; the second check caught two errors in the
first.

## Decision

- **Allowlist only**: public domain, CC0, CC BY (any version), ODC-BY, and explicitly
  permissive terms (Copernicus DEM, GEBCO) with their attribution text.
- **Never imported**: CC BY-SA, ODbL, GPL data, any non-commercial licence. Known cases:
  Theographic, DARE, Chronas data, historical-basemaps, AWMC shapefiles, OpenStreetMap
  geometries inside OpenBible, dictionary texts from CCEL.
- **Provenance on every record**: dataset, licence, snapshot date, and a stored copy of
  the licence and README at import time.
- **Enforced in code, three locks**: the allowlist in the importer, exports only through
  views that exclude non-allowlisted provenance, and a test that fails the build if any
  such record reaches tiles or releases.
- `docs/ATTRIBUTIONS.md` is generated from provenance for every release.

## Consequences

- Some convenient datasets are off-limits; the gap (dated places, regional borders) is
  filled by our own curated content — which is the point.
- Open legal questions (TIPNR wording, vector tiles under ODbL, KJV in the UK) are kept
  in `docs/legal-questions.md` for a lawyer before commercial launch.
