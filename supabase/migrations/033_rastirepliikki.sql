-- Rästirepliikki: monsteri sanoo sen, kun se on jäänyt rästiin (ei kaatunut omalla viikollaan).
-- Kaksikon ja kolmikon osien omat rästirepliikit ovat parts-kentässä (taunt_backlog), eivät vaadi muutosta.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
alter table public.monsters add column if not exists taunt_backlog text;

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
  case when revealed_at <= now() then taunt_full end as taunt_full,
  case when revealed_at - interval '3 days' <= now() then
    array_remove(array[weakness] || coalesce(
      (select array_agg(p->>'weakness') from jsonb_array_elements(case when jsonb_typeof(parts) = 'array' then parts else '[]'::jsonb end) p),
      '{}'::text[]), null)
  end as teaser_weaknesses,
  case when revealed_at <= now() then taunt_backlog end as taunt_backlog
from public.monsters;
