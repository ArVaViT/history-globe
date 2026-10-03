# Database (Supabase)

The content of a data release as a Postgres + PostGIS database: places with their
names in any language, verses, candidate sites, when they stood, photos, articles,
events, tours, the states by year with their borders, the ancient sites around them, the people of the Bible with
their families and places, and a table for readers' corrections (ADR 0012).

The app still reads the static release (`apps/web/public/data`). The database holds the
same records so that a release can later be built from it, an API can answer from it,
and corrections land somewhere.

## Files

- `migrations/0001_init.sql`: the schema. Every table is readable by anyone and
  writable only by the service role (row level security).
- `../scripts/export-db.ts`: writes `seed/*.csv` from a built release (not committed).
- `load.sh`: empties the tables and loads `seed/*.csv` in one transaction.

## First load into a new Supabase project

1. Create the project (region close to the readers), then in **Database → Extensions**
   check that `postgis`, `pg_trgm` and `unaccent` can be enabled (the migration enables
   them itself).
2. Apply the schema: SQL editor → paste `migrations/0001_init.sql` → Run. With the
   Supabase CLI instead: `supabase link`, then `supabase db push` with the file under
   `supabase/migrations/`.
3. Build and export the release: `pnpm data && node scripts/export-db.ts`.
4. Load: `DATABASE_URL='postgresql://postgres:<password>@<host>:5432/postgres' db/load.sh`
   (the direct connection or the session pooler, not the transaction pooler: `\copy`
   needs a session). Keep the password in 1Password and pass it with `op run`.

## Checked so far

On 2026-10-02 the schema and a full load were run against a local Postgres 17 with the
geometry columns as text (PostGIS was not installed on the machine): all 26 tables (29 since chapter_year and ancient_site, loaded again then), row
level security on each, every foreign key satisfied, 1288 places, 3892 state shapes, 2162
people. The geography columns, their GiST indexes and the EWKT casts are not yet tested
against real PostGIS: the first Supabase load is that test.

## Sizes (release of 2026-10-02)

| Table                                   | Rows                 |
| --------------------------------------- | -------------------- |
| place                                   | 1288                 |
| place_verse                             | 8617                 |
| place_site                              | 2244                 |
| polity_shape                            | 3865 (10 MB of EWKT) |
| event                                   | 327                  |
| chapter_year                            | 182                  |
| ancient_site                            | 553                  |
| tour / tour_stop                        | 46 / 395             |
| article                                 | 135                  |
| person / person_relation / place_person | 2153 / 1816 / 1059   |
