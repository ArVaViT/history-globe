# 0012. Vercel for the site, Supabase for the data

- Status: proposed
- Date: 2026-10-02

## Context

ADR 0009 planned static releases on Cloudflare R2 with Cloudflare Pages, and a backend
on Workers in front of Supabase only with the first external partner. On 2026-10-02 the
owner chose Vercel for hosting and a Supabase database now, to move the data off files
in the repository and off third-party hosts as the product grows ("избавляться от
зависимостей"), and to have one place where corrections and new languages land.

## Decision

- The schema lives in `db/migrations` (Postgres 17 + PostGIS, `pg_trgm`, `unaccent`):
  one table per kind of record, text in other languages as rows keyed by a BCP 47 code,
  ids kept from the release (OpenBible, content/, TIPNR), years astronomical (ADR 0003).
- Row level security on every table: public read, writes by the service role only.
  Readers' corrections go into `correction`, which is not readable by the public.
- For now the pipeline stays the source: `pnpm data` builds the release, and
  `scripts/export-db.ts` + `db/load.sh` copy it into the database. The app keeps reading
  the static release, served by Vercel, until an API reads from the database (Phase 2 of
  ADR 0009, on Vercel functions or Workers, decided then).
- Terrain tiles stay a separate static host (Mapterhorn's PMTiles, later our own copy).

## Consequences

- No running cost beyond Supabase's free or Pro tier until an API exists.
- Two copies of the content (repository and database) until the database becomes the
  source; the export is idempotent so the copy cannot drift silently.
- The Cloudflare-specific parts of ADR 0009 (R2 releases, Workers) are on hold, not
  rejected.

## Deploying on Vercel (first deploy 2026-10-03, historyglobe.app)

- Project root `apps/web`; `apps/web/vercel.json` sets the Vite output and the headers:
  hashed assets and the versioned MapLibre files cached for a year, the data files
  revalidated on every load (they have no hash in their names, and new code must not read
  old data), the site not framable by others, and `/embed/v1` and the page it opens
  (`/?embed=1…`) framable by any site (partners' origins to be listed when there are some).
- The data release (`apps/web/public/data`) is not in git: `pnpm data` downloads some
  260 MB (Cliopatria, Itiner-e, OpenBible, TIPNR, photos) and takes minutes. Building it
  on Vercel at every deploy would make each deploy depend on those hosts. Instead the
  release is built once (locally or in CI: `pnpm data && pnpm content`), then
  `vercel build` (it runs the app's build with the release in place and takes the
  headers from `vercel.json`) and `vercel deploy --prebuilt` of that output, with the
  Vercel token kept in 1Password and passed with `op run`. Moving the release to Supabase Storage or R2 later
  changes only `DATA_URL`.
- The build runs with `SITE_URL=https://historyglobe.app`, so the static pages carry
  canonical links and a sitemap. The offline worker (`sw.js`) and its list (`offline.json`)
  are served with `no-cache`, so a deploy reaches readers who saved the globe.
- Before every deploy: the production smoke check (`vite preview` + the map draws and
  "In view" fills, ADR 0011) on the very build that is deployed.
