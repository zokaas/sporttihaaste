-- Monsterin repliikit (HP alle 50 % ja alle 20 %) ja ennakkoarvoitus seuraavasta monsterista.
-- Arvoitus näkyy kaikille jo edellisen viikon perjantaista alkaen, muut tiedot vasta paljastuksessa.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.monsters add column if not exists taunt_half text;
alter table public.monsters add column if not exists taunt_low text;
alter table public.monsters add column if not exists teaser text;

create or replace view public.monsters_public as
select week, hp,
  case when revealed_at <= now() then name end as name,
  case when revealed_at <= now() then description end as description,
  case when revealed_at <= now() then weakness end as weakness,
  case when revealed_at <= now() then image_path end as image_path,
  revealed_at,
  case when revealed_at <= now() then parts end as parts,
  case when revealed_at <= now() then taunt_half end as taunt_half,
  case when revealed_at <= now() then taunt_low end as taunt_low,
  case when revealed_at - interval '3 days' <= now() then teaser end as teaser
from public.monsters;
