#!/bin/bash
# Load db/seed/*.csv (node scripts/export-db.ts) into a database made from db/migrations.
# Usage: DATABASE_URL=postgres://... db/load.sh   (Supabase: the session pooler or direct URL)
# Tables are emptied first and filled in dependency order, in one transaction.
set -euo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:?set DATABASE_URL}"
ORDER="release source place place_name place_today place_verse place_site place_site_i18n
place_life place_life_i18n place_photo article article_i18n ancient_site ancient_site_i18n event event_i18n chapter_year tour tour_i18n
tour_stop tour_stop_i18n polity_shape polity_name person person_name person_relation place_person"
{
  echo "begin;"
  echo "truncate $(echo $ORDER | tr ' ' ',') restart identity cascade;"
  for t in $ORDER; do
    echo "\\copy $t ($(head -1 "seed/$t.csv")) from 'seed/$t.csv' with (format csv, header true)"
  done
  # The rows came with their ids: serial columns continue after them.
  echo "select setval(pg_get_serial_sequence('place_site', 'id'), coalesce(max(id), 1)) from place_site;"
  echo "select setval(pg_get_serial_sequence('polity_shape', 'id'), coalesce(max(id), 1)) from polity_shape;"
  echo "commit;"
} | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
echo "loaded: $(echo $ORDER | wc -w | tr -d ' ') tables"
