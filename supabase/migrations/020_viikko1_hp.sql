-- Viikko 1 kestää vain to–su (4 päivää), joten sen HP mitoitetaan 4/7 × 1,2 × viikkovauhti
-- (38,5 h lupauksilla 4 500 HP, ennen 1,2 × vauhti = 8 000). Näin ensimmäinen monsteri kaatuu
-- ensimmäisellä viikolla, kun porukka pitää lupauksensa, eikä jää roikkumaan rästiksi.
-- Aja Supabasen SQL-editorissa ENNEN ensimmäisen monsterin paljastusta (to 1.10. klo 00.00).
-- Turvallista ajaa uudelleen. Muut viikot ja loppupomo pysyvät ennallaan.

create or replace function public.lock_season() returns public.season
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_pace numeric;
  s public.season;
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi lukita tavoitteen.'; end if;
  select coalesce(sum(pledge_hours), 0) into v_total from public.profiles where pledge_locked_at is not null;
  v_pace := v_total * 100 + 2750;
  update public.monsters set hp = round((4.0 / 7) * 1.2 * v_pace / 500) * 500 where week = 1;
  update public.monsters set hp = round(v_pace * (1.05 + 0.1 * (week - 2) / 9.0) / 500) * 500 where week between 2 and 11;
  update public.monsters set hp = round(1.5 * v_pace / 500) * 500 where week = 12;
  update public.season set total_pledge_hours = v_total, pace = round(v_pace),
    boss_hp = round(1.5 * v_pace / 500) * 500, hp_locked_at = now()
  where id = 1 returning * into s;
  return s;
end $$;

-- Jo lukittu tavoite: päivitetään vain viikon 1 HP samalla kaavalla (jos monsteri ei ole vielä paljastunut).
update public.monsters m
set hp = round((4.0 / 7) * 1.2 * s.pace / 500) * 500
from public.season s
where m.week = 1 and s.id = 1 and s.hp_locked_at is not null and s.pace is not null
  and (m.revealed_at is null or m.revealed_at > now());
