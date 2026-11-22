-- The credit line a photo's author asks for (content/photos.yaml `credit`), word for word
-- as the file's Commons page gives it; shown in the author's place when it is set, with the
-- author after it when `credit_with_author` (the line names an agency or a collection).
alter table place_photo add column credit text;
alter table place_photo add column credit_with_author boolean not null default false;
