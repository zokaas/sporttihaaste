-- Erikoisheikkoudet (mamu tai lapsi, nainen, isä): iskuun tallennetaan, minkä erikoisheikkouden kirjaaja merkitsi.
-- Merkintä näkyy iskulistassa; +50 % lasketaan sovelluksessa vain, kun se on viikon monsterin heikkous.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.hits add column if not exists special text;
