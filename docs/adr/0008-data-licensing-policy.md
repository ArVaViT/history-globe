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
- **OpenBible points are checked one by one** (added 2026-09-29): a point is dropped when
  its modern location took its coordinates from OSM or Google (`coordinates_source` in
  `modern.jsonl`), when it repeats such a coordinate digit for digit, or when it was
  computed from an OSM polygon. A dropped place falls back to Wikidata (CC0) unless that
  coordinate is the same copy; otherwise it is left out and listed in the manifest.
- **Provenance on every record**: dataset, licence, snapshot date, and a stored copy of
  the licence and README at import time.
- **Enforced in code, three locks**: the allowlist in the importer, exports only through
  views that exclude non-allowlisted provenance, and a test that fails the build if any
  such record reaches tiles or releases. Today: `ALLOWED_LICENSES` in
  `pipeline/build_data.py`, the per-point filter above, and `assert_no_banned_points`,
  which fails the build if a shipped point sits on a banned coordinate
  (`pipeline/test_build_data.py` covers the rules).
- `docs/ATTRIBUTIONS.md` is generated from provenance for every release.

## Consequences

- Some convenient datasets are off-limits; the gap (dated places, regional borders) is
  filled by our own curated content — which is the point.
- Open legal questions (TIPNR wording, vector tiles under ODbL, KJV in the UK) are kept
  in `docs/legal-questions.md` for a lawyer before commercial launch.
