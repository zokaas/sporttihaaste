-- Monsterikolmikko: viikon monsteri voi koostua kolmesta osasta, jotka jakavat viikon HP:n tasan.
-- Jokaisella osalla on oma nimi, kuvaus, heikkous ja kuva. Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.monsters add column if not exists parts jsonb;

-- Osat näkyvät muille vasta paljastuksen jälkeen, kuten muutkin tiedot.
create or replace view public.monsters_public as
select week, hp,
  case when revealed_at <= now() then name end as name,
  case when revealed_at <= now() then description end as description,
  case when revealed_at <= now() then weakness end as weakness,
  case when revealed_at <= now() then image_path end as image_path,
  revealed_at,
  case when revealed_at <= now() then parts end as parts
from public.monsters;
