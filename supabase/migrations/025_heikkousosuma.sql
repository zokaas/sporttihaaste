-- Tallennetaan iskuun, saiko se heikkousbonuksen (+50 %). Kauden lopun Heikkousmetsästäjä-palkinto
-- lasketaan tästä: kaksikon/kolmikon vuorossa oleva osa ja "Urheilu mamun tai lapsen kanssa" menevät oikein.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.hits add column if not exists weakness_hit boolean not null default false;
