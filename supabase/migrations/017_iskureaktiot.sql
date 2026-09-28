-- Monsterin iskureaktiot (yksi per rivi, arvotaan), kriittisen iskun reaktio ja repliikki täydellä HP:lla.
-- Tyhjä kenttä = sovelluksen oletusrepliikit. Näkyvät vasta monsterin paljastuksen jälkeen.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.monsters add column if not exists hit_lines text;
alter table public.monsters add column if not exists hit_crit text;
alter table public.monsters add column if not exists taunt_full text;

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
  case when revealed_at <= now() then boss_whisper end as boss_whisper,
  case when revealed_at <= now() then hit_lines end as hit_lines,
  case when revealed_at <= now() then hit_crit end as hit_crit,
  case when revealed_at <= now() then taunt_full end as taunt_full
from public.monsters;
