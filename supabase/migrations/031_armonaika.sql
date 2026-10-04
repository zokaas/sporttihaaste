-- Armonaika: päättyneelle viikolle voi vielä kirjata maanantaihin klo 12 asti (Suomen aikaa).
-- Koskee iskuja, askelkuittauksia ja sairausmerkintöjä. Sama laskenta kuin lib/season.ts (graceWeek).
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

-- Armonajan päivä: Suomen aika 12 tuntia sitten. Maanantaina klo 0–12 se on vielä sunnuntai.
create or replace function public.grace_day() returns date
language sql stable as $$ select ((now() at time zone 'Europe/Helsinki') - interval '12 hours')::date $$;

-- Onko päivän viikko auki kirjauksille: kuluva viikko tai armonaikana edellinen viikko (kausi 1–12).
create or replace function public.week_open(d date) returns boolean
language sql stable as $$
  select public.season_week(d) between 1 and 12
    and public.season_week(d) in (public.season_week(public.helsinki_today()), public.season_week(public.grace_day()))
$$;

-- Ensimmäinen päivä, jolle voi kirjata (armonaikana edellisen viikon alku).
create or replace function public.open_from() returns date
language sql stable as $$
  select public.week_start(greatest(1, least(public.season_week(public.helsinki_today()), public.season_week(public.grace_day()))))
$$;

create or replace function public.guard_hit_week() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  d date := case when tg_op = 'DELETE' then old.trained_on else new.trained_on end;
  gate_ok boolean := today between date '2026-09-29' and date '2026-09-30' and d between date '2026-09-29' and today;
begin
  if public.is_admin() or gate_ok then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and not public.week_open(old.trained_on) then
    raise exception 'Viikko on jo lukittu.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.trained_on > today then
      raise exception 'Tulevalle päivälle ei voi kirjata.';
    end if;
    if public.season_week(new.trained_on) not between 1 and 12 then
      raise exception 'Päivä ei ole kauden aikana.';
    end if;
    if not public.week_open(new.trained_on) then
      raise exception 'Viikko on jo lukittu (ma klo 12). Kirjaa vain kuluvan viikon päiville.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.guard_step_week() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  d date := case when tg_op = 'DELETE' then old.day else new.day end;
begin
  if public.is_admin() then return coalesce(new, old); end if;
  if today between date '2026-09-29' and date '2026-09-30' and d between date '2026-09-29' and today then return coalesce(new, old); end if;
  if d > today then raise exception 'Tulevaa päivää ei voi kuitata.'; end if;
  if not public.week_open(d) then
    raise exception 'Viikko on jo lukittu.';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.guard_sick_period() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  week_start date := public.open_from();
begin
  if public.is_admin() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.starts_on < week_start then raise exception 'Vanhaa sairausjaksoa ei voi poistaa.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' and (new.starts_on < week_start or new.starts_on > today) then
    raise exception 'Sairastumisen voi merkitä vain kuluvalle viikolle.';
  end if;
  if tg_op = 'UPDATE' and new.starts_on is distinct from old.starts_on then
    raise exception 'Sairastumispäivää ei voi muuttaa.';
  end if;
  if new.ends_on is not null and (new.ends_on < new.starts_on or new.ends_on > today or new.ends_on < week_start - 1) then
    raise exception 'Paranemispäivä ei kelpaa.';
  end if;
  return new;
end $$;
