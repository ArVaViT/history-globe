# Database (Supabase)

The content of a data release as a Postgres + PostGIS database: places with their
names in every language of the site, verses, candidate sites, when they stood, photos, articles,
events, tours, the states by year with their borders, the ancient sites around them, the people of the Bible with
their families and places, and a table for readers' corrections (ADR 0012).

The app still reads the static release (`apps/web/public/data`). The database holds the
same records so that a release can later be built from it, an API can answer from it,
and corrections land somewhere.

No deploy loads the database and the gate does not compare it with the release (ADR 0020):
load it by hand, as below, when it is needed.

## Files

- `migrations/`: the schema, applied in the order of the file names. Every table is readable
  by anyone and writable only by the service role (row level security).
- `../scripts/export-db.ts`: writes `seed/*.csv` from a built release (not committed). It
  writes nothing when a primary or foreign key, a check or a language would fail the load.
- `load.sh`: empties the tables and loads `seed/*.csv` in one transaction.

Not in the schema: the battles (`api/v1/battles.json`), the questions (CC BY-NC-ND,
ADR 0016), the roads, the rulers, the ancient authors' mentions and the people's names
in languages other than Russian. The release and the API carry them.

## First load into a new Supabase project

1. Create the project (region close to the readers), then in **Database → Extensions**
   check that `postgis`, `pg_trgm` and `unaccent` can be enabled (the first migration
   enables them itself).
2. Apply the schema: SQL editor → paste each file of `migrations/` in order → Run. With the
   Supabase CLI instead: it reads migrations from `supabase/migrations/`, and this repository
   keeps them in `db/migrations/`. In a scratch folder, `supabase init`, copy
   `db/migrations/*.sql` into its `supabase/migrations/`, then `supabase link` and
   `supabase db push`.
3. Build and export the release: `pnpm data && node scripts/export-db.ts`.
4. Load: `DATABASE_URL='postgresql://postgres:<password>@<host>:5432/postgres' db/load.sh`
   (the direct connection or the session pooler, not the transaction pooler: `\copy`
   needs a session). Keep the password out of the shell history: pass it from a secret
   manager (`op run`).

The geography columns, their GiST indexes and the EWKT casts have not yet been loaded into
a real PostGIS: the first Supabase load is that test.
