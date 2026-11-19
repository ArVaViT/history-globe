-- Tour stops at the ancient world's sites and stops told by an ancient author (ADR 0018),
-- article statuses as content/ has them, and no column the release cannot fill.

-- A stop is at a place of the Bible or at an ancient site, never both.
alter table tour_stop alter column place_id drop not null;
alter table tour_stop add column site_id text references ancient_site(id);
alter table tour_stop add constraint tour_stop_one_place check (num_nonnulls(place_id, site_id) = 1);

-- A stop is told by a verse or by an ancient author's passage (its translation is the note).
alter table tour_stop alter column osis drop not null;
alter table tour_stop add column source_url text;
alter table tour_stop add constraint tour_stop_told check (num_nonnulls(osis, source_url) = 1);
alter table tour_stop_i18n add column cite text;  -- the passage cited: "Josephus, Jewish War 3.7.3"

alter table article add constraint article_status check (status in ('checked', 'reviewed'));

-- The release marks a place's years as inherited but not from which place.
alter table place_life drop column inherited_from;
