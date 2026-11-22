-- The credit line a photo's author asks for (content/photos.yaml `credit`), word for word
-- as the file's Commons page gives it; shown in the author's place when it is set.
alter table place_photo add column credit text;
