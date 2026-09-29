-- Erikoisheikkous "Lapsen tai mummun kanssa": kirjaaja merkitsee iskuun, että treenasi lapsen tai mummun kanssa.
-- Merkintä näkyy iskulistassa; +50 % lasketaan sovelluksessa vain, kun se on viikon monsterin heikkous.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.hits add column if not exists with_family boolean not null default false;
