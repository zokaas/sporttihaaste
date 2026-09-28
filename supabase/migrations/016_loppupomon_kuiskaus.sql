-- Loppupomon kuiskaus: repliikki, jonka loppupomo sanoo, kun viikon monsteri kaatuu (viikot 1–11).
-- Tyhjä kenttä = sovelluksen oletuskuiskaus. Näkyy vasta monsterin paljastuksen jälkeen.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.monsters add column if not exists boss_whisper text;

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
  case when revealed_at - interval '3 days' <= now() then teaser end as teaser,
  case when revealed_at <= now() then boss_whisper end as boss_whisper
from public.monsters;
