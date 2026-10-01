# 0009. Backend, in phases

- Status: proposed
- Date: 2026-09-28

## Context

The research recommends Hono on Cloudflare Workers with Supabase Postgres + PostGIS,
Supabase Auth, domain-bound partner keys and usage metering. That is right for a
product with partners — and too much for an MVP inside Equip.

## Decision

- **Phase 1 (MVP): no backend.** The app is hosted on Cloudflare Pages. The pipeline
  publishes versioned static releases to Cloudflare R2 behind a CDN:
  - immutable paths `releases/<release-id>/…` (PMTiles, per-locale JSON for places and
    articles, glyphs, sprites);
  - `releases/<release-id>/manifest.json` listing every file with size and hash, plus
    `schema_version` and the attribution list;
  - one mutable pointer, `stable.json`, naming the current release — rollback is
    rewriting one small file.
    Equip's existing auth decides who sees the page that holds the iframe.
- **Phase 2 (first external partner or paid tier)**: Hono on Cloudflare Workers
  (+ Hyperdrive) in front of Supabase Postgres 17 + PostGIS in a separate Supabase
  organisation; SQL migrations with the Supabase CLI; postgres.js without an ORM;
  Supabase Auth; partner keys (`pk_` for public embeds with `frame-ancestors`, `sk_`
  exchanged for short-lived view tokens), usage in Workers Analytics Engine rolled up
  daily; signed URLs for premium tiles. Search: pg_trgm + unaccent with a table of
  declined name forms (Postgres has no Ukrainian stemmer).
- **Phase 3**: LTI 1.3 and SSO for seminaries.

## Alternatives considered

- FastAPI like Equip: a Worker is needed anyway for R2 and signed URLs, so a second
  runtime would only add cost.
- PostgREST directly: exposes the schema; weak for metering and partner keys.

## Consequences

- Phase 1 costs almost nothing; Phase 2 is estimated at about 30–45 USD per month.
- The JSON release format must match the future API responses, so moving to Phase 2
  changes the transport, not the client.
