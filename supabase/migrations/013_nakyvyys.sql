-- Ylläpitäjä voi päättää, näkyvätkö alapalkin Lyö-nappi ja Bestiaario.
-- auto = näkyy kauden aikana (Lyö 1.10.–20.12., Bestiaario 1.10. alkaen), on = aina, off = ei koskaan.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.season add column if not exists nav_strike text not null default 'auto';
alter table public.season add column if not exists nav_bestiary text not null default 'auto';
alter table public.season drop constraint if exists season_nav_strike_check;
alter table public.season add constraint season_nav_strike_check check (nav_strike in ('auto', 'on', 'off'));
alter table public.season drop constraint if exists season_nav_bestiary_check;
alter table public.season add constraint season_nav_bestiary_check check (nav_bestiary in ('auto', 'on', 'off'));
