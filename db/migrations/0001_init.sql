-- History Globe: the content of a data release as a database (Supabase: Postgres + PostGIS).
--
-- The static release (apps/web/public/data) stays what the app reads today; this schema
-- holds the same records so that a release can be built from the database later, an API
-- can answer from it, and corrections from readers have somewhere to land (ADR 0012).
-- Loaded by scripts/export-db.ts, which writes db/seed/*.csv from a built release.
--
-- Conventions
--   * Ids are the release's own: OpenBible place ids ("a15257a"), tour, event and article
--     ids from content/, TIPNR unique names for people. Nothing is renumbered.
--   * Years are astronomical integers (ADR 0003): 1 BC = 0, 586 BC = -585.
--   * Text in several languages lives in *_i18n tables keyed by a BCP 47 code, so a new
--     language is rows, not columns.
--   * Every table is readable by anyone (the content is public) and writable only by the
--     service role (the pipeline, the admin). Row level security says so explicitly.

-- In Supabase's "extensions" schema, as its advisor asks; it is on the default search path.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;  -- for name search (ADR 0009)

-- Where a release came from: one row per data release, and the sources it credits.
create table release (
  id text primary key,                 -- e.g. "2026-10-02.1"
  built_at timestamptz not null,
  schema_version int not null,
  notes text
);

create table source (
  id text primary key,                 -- "openbible", "cliopatria", "stepbible-tipnr", "pleiades"
  title text not null,
  url text not null,
  license text not null,               -- "CC BY 4.0", "public domain", ...
  license_url text,
  credit text not null                 -- the exact credit line shipped with the release
);

-- Places of the Bible (OpenBible), with the point the map shows.
create table place (
  id text primary key,
  name text not null,                  -- the English form (KJV/OpenBible)
  kind text not null,                  -- settlement, region, mountain, river, ...
  geom geography(point, 4326) not null,
  coord_source text not null,          -- "openbible" | "wikidata"
  disputed boolean not null default false,
  confidence smallint check (confidence between 0 and 1000),  -- OpenBible's score
  verse_count int not null default 0,
  ot boolean not null default false,
  nt boolean not null default false,
  rank smallint not null default 3,    -- 0 most named
  pleiades_id text,                    -- https://pleiades.stoa.org/places/<id>
  wikidata_id text,                    -- the ancient place's item, when known
  attested_from int,                   -- span of the periods Pleiades attests it in
  attested_to int
);
create index place_geom on place using gist (geom);
create index place_kind on place (kind);

-- Names in every language: the main form, other forms and the verse it was read from.
create table place_name (
  place_id text not null references place(id) on delete cascade,
  lang text not null,                  -- "ru", "uk", "de", ...
  name text not null,
  is_main boolean not null default true,
  osis text,                           -- where the form was read (Synodal: "Josh.10.1")
  source_id text references source(id),
  primary key (place_id, lang, name)
);
create index place_name_trgm on place_name using gin (name gin_trgm_ops);

-- "Where it is today": the modern name or a description, per language.
create table place_today (
  place_id text not null references place(id) on delete cascade,
  lang text not null,
  text text not null,
  primary key (place_id, lang)
);

-- The verses that name a place (OSIS, English versification).
create table place_verse (
  place_id text not null references place(id) on delete cascade,
  osis text not null,
  primary key (place_id, osis)
);
create index place_verse_osis on place_verse (osis);

-- Proposed sites of a disputed place, with OpenBible's share.
create table place_site (
  id bigserial primary key,
  place_id text not null references place(id) on delete cascade,
  geom geography(point, 4326) not null,
  share smallint,                      -- percent of OpenBible's sources
  rank smallint not null default 0
);
create table place_site_i18n (
  site_id bigint not null references place_site(id) on delete cascade,
  lang text not null,
  label text not null,
  primary key (site_id, lang)
);

-- When a place stood (content/place-life.yaml): founded, ended, a gap in ruins.
create table place_life (
  place_id text primary key references place(id) on delete cascade,
  from_year int,
  from_approx boolean not null default false,
  until_year int,                      -- the last year it stood, inclusive
  until_approx boolean not null default false,
  gap_from int,
  gap_until int,
  inherited_from text references place(id),  -- a gate shares its city's years
  sources text[] not null default '{}'
);
create table place_life_i18n (
  place_id text not null references place_life(place_id) on delete cascade,
  lang text not null,
  note text not null,
  primary key (place_id, lang)
);

create table place_photo (
  place_id text primary key references place(id) on delete cascade,
  commons_file text not null,
  author text,
  license text not null,
  license_url text,
  shows jsonb                          -- {"en": ..., "ru": ...}: which candidate site it shows
);

-- Articles about places, with their sources and review status.
create table article (
  id text primary key,
  place_id text not null references place(id) on delete cascade,
  status text not null,                -- draft | reviewed | published
  sources text[] not null default '{}'
);
create table article_i18n (
  article_id text not null references article(id) on delete cascade,
  lang text not null,
  title text not null,
  body text not null,                  -- markdown
  primary key (article_id, lang)
);

-- Dated events of the history (content/events.yaml).
create table event (
  id text primary key,
  year int not null,
  approximate boolean not null default false,
  place_id text references place(id),
  site_id text,                        -- or an ancient site (ancient_site, declared below)
  sources text[] not null default '{}'
);
create index event_year on event (year);
create table event_i18n (
  event_id text not null references event(id) on delete cascade,
  lang text not null,
  title text not null,
  primary key (event_id, lang)
);

-- The ancient world around the Bible (content/ancient-sites.json): sites it does not name.
create table ancient_site (
  id text primary key,                 -- Pleiades id ("520998") or Wikidata QID ("Q16869")
  geom geography(point, 4326) not null,
  from_year int not null,
  to_year int not null,                -- the last year it stood, inclusive
  approximate boolean not null default false,
  kind text not null check (kind in ('city', 'capital', 'sanctuary', 'site', 'port')),
  rank smallint not null,              -- 0 world, 1 regional, 2 other
  sources text[] not null default '{}',
  check (to_year >= from_year)
);
create index ancient_site_geom on ancient_site using gist (geom);
alter table event add foreign key (site_id) references ancient_site(id);
create table ancient_site_i18n (
  site_id text not null references ancient_site(id) on delete cascade,
  lang text not null,
  name text not null,
  primary key (site_id, lang)
);

-- When the chapters happen (content/chapter-years.yaml): the year a chapter is shown at.
create table chapter_year (
  book text not null,                  -- OSIS book: "Gen", "1Sam", "Acts"
  from_chapter smallint not null,
  to_chapter smallint not null,
  year int not null,
  primary key (book, from_chapter),
  check (to_chapter >= from_chapter)
);

-- Tours: stops in order, each with a verse and a note.
create table tour (
  id text primary key,
  year int not null,
  approximate boolean not null default false
);
create table tour_i18n (
  tour_id text not null references tour(id) on delete cascade,
  lang text not null,
  title text not null,
  primary key (tour_id, lang)
);
create table tour_stop (
  tour_id text not null references tour(id) on delete cascade,
  position smallint not null,
  place_id text not null references place(id),
  osis text not null,
  year int,
  primary key (tour_id, position)
);
create table tour_stop_i18n (
  tour_id text not null,
  position smallint not null,
  lang text not null,
  note text not null,
  primary key (tour_id, position, lang),
  foreign key (tour_id, position) references tour_stop(tour_id, position) on delete cascade
);

-- States by year (Cliopatria, with our overrides): a shape is valid in [y0, y1).
create table polity_shape (
  id bigserial primary key,
  name text not null,                  -- Cliopatria's name, the key of polity_name
  y0 int not null,
  y1 int not null,
  related boolean not null default false,  -- a vassal or subordinate shape
  color smallint not null,
  geom geography(multipolygon, 4326) not null,
  source text not null default 'cliopatria'  -- or 'override'
);
create index polity_shape_years on polity_shape (y0, y1);
create index polity_shape_geom on polity_shape using gist (geom);
create table polity_name (
  name text not null,
  lang text not null,
  label text not null,
  primary key (name, lang)
);

-- People of the Bible (STEP Bible TIPNR) and how they relate.
create table person (
  id text primary key,                 -- TIPNR unique name: "David@Rut.4.17-Rev"
  name text not null,
  female boolean not null default false,
  verses int not null default 0        -- how many verses name them (TIPNR)
);
create table person_name (
  person_id text not null references person(id) on delete cascade,
  lang text not null,
  name text not null,
  primary key (person_id, lang)
);
create table person_relation (
  from_id text not null references person(id) on delete cascade,
  to_id text not null references person(id) on delete cascade,
  kind text not null check (kind in ('father', 'mother', 'spouse')),
  primary key (from_id, to_id, kind)   -- from_id is the father/mother/spouse of to_id
);
create index person_relation_to on person_relation (to_id);
create table place_person (
  place_id text not null references place(id) on delete cascade,
  person_id text not null references person(id) on delete cascade,
  tier smallint not null,              -- 0 core, 1 supporting, 2 local, 3 named by TIPNR
  osis text,                           -- the verse that ties them best
  primary key (place_id, person_id)
);
create index place_person_person on place_person (person_id);

-- Readers' reports of errors ("this place is wrong"): written by the API, read by editors.
create table correction (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  target_kind text not null check (target_kind in ('place', 'event', 'tour', 'article', 'person')),
  target_id text not null,
  lang text,
  message text not null check (length(message) between 3 and 4000),
  contact text,                        -- optional, given by the reader
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected', 'done')),
  resolution text
);

-- Row level security: everyone reads the content; nobody but the service role writes.
-- Corrections are not public: the API inserts them with the service role.
do $$
declare t text;
begin
  foreach t in array array[
    'release', 'source', 'place', 'place_name', 'place_today', 'place_verse', 'place_site',
    'place_site_i18n', 'place_life', 'place_life_i18n', 'place_photo', 'article',
    'article_i18n', 'event', 'event_i18n', 'chapter_year', 'ancient_site', 'ancient_site_i18n', 'tour', 'tour_i18n', 'tour_stop', 'tour_stop_i18n',
    'polity_shape', 'polity_name', 'person', 'person_name', 'person_relation', 'place_person'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;
alter table correction enable row level security;
