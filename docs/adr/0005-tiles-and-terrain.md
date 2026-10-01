# 0005. Tiles and terrain pipeline

- Status: proposed
- Date: 2026-09-28

## Context

The prototype loaded whole GeoJSON files and used public terrain tiles whose sea floor
sinks in 3D. The product needs its own tiles: small, cacheable, reproducible, and
provably free of share-alike data.

## Decision

- **Pipeline in Python** (`pipeline/`, uv): DuckDB spatial, GeoPandas/pyogrio, GDAL;
  tasks through `just`. Inputs are the dated dataset snapshots and the curated records
  in `content/`; there is no database in Phase 1 (ADR 0009). Each third-party dataset is downloaded as a dated snapshot with
  its licence text; see ADR 0008.
- **Vector tiles**: tippecanoe → **PMTiles**. Layers split by purpose (polities, places,
  routes, coast, labels); tiles carry only light properties (`id`, `y0`, `y1`, rank,
  names), everything else comes from the content API. freestiler/MLT kept as a later
  option (13–35 % smaller on our borders).
- **Terrain**: a Mapterhorn extract (Terrarium, lossless WebP, 512 px). Its sea is exactly
  0 m and the Dead Sea −432 m, which fixes the sinking sea floor. MVP extent: whole focus
  region to z10, the core Levant at z11; Paul's corridors and z12 later. Sea floor is a
  baked GEBCO colour raster; z0–7 uses a baked artistic shaded relief.
- **Hosting**: static files on Cloudflare R2 behind a CDN; no tile server.

## Alternatives considered

- Planetiler: Java, geared to OSM-scale. PostGIS `ST_AsMVT` on request: a live database
  in the hot path for static data.
- Public terrain services: sea floor problem, third-party availability, unclear terms.

## Consequences

- `pipeline/out/` is never committed; releases are versioned artefacts.
- Every source inside the published terrain extent must appear in `docs/ATTRIBUTIONS.md`.
