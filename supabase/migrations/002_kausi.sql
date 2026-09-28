-- Vaihe 2a: kauden viikot, kirjausten viikkolukitus ja monsterien automaattinen paljastus.
-- Aja Supabasen SQL-editorissa, jos schema.sql on ajettu ennen tätä muutosta.

-- Kauden viikko 1–11 (0 = ennen kautta, 12 = jälkeen). Sama laskenta kuin lib/season.ts.
create or replace function public.season_week(d date) returns int
language sql immutable as $$
  select case
    when d < date '2026-10-01' then 0
    when d > date '2026-12-20' then 12
    when d < date '2026-10-12' then 1
    else least(11, 2 + (d - date '2026-10-12') / 7)
  end
$$;

create or replace function public.helsinki_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Helsinki')::date $$;

-- Kirjauksia voi lisätä, muuttaa ja poistaa vain kuluvan viikon päiville (ei tulevaisuuteen).
-- Viikko lukittuu sunnuntaina klo 23.59. Ylläpitäjä voi korjata mitä tahansa.
create or replace function public.guard_hit_week() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  current_week int := public.season_week(public.helsinki_today());
begin
  if public.is_admin() then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and public.season_week(old.trained_on) <> current_week then
    raise exception 'Viikko on jo lukittu.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.trained_on > today then
      raise exception 'Tulevalle päivälle ei voi kirjata.';
    end if;
    if public.season_week(new.trained_on) not between 1 and 11 then
      raise exception 'Päivä ei ole kauden aikana.';
    end if;
    if public.season_week(new.trained_on) <> current_week then
      raise exception 'Viikko on jo lukittu. Kirjaa vain kuluvan viikon päiville.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists hits_week_lock on public.hits;
create trigger hits_week_lock before insert or update or delete on public.hits
  for each row execute function public.guard_hit_week();

-- Monsteri paljastuu viikkonsa alkaessa klo 00.00 Suomen aikaa (viikko 1: to 1.10.).
update public.monsters set revealed_at =
  (case when week = 1 then date '2026-10-01' else date '2026-10-12' + (week - 2) * 7 end)::timestamp
  at time zone 'Europe/Helsinki';

create or replace view public.monsters_public as
select week, hp,
  case when revealed_at <= now() then name end as name,
  case when revealed_at <= now() then description end as description,
  case when revealed_at <= now() then weakness end as weakness,
  case when revealed_at <= now() then image_path end as image_path,
  revealed_at
from public.monsters;
