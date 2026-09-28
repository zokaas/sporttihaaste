-- Vaihe 2b: askelkuittausten, sairastumisten ja lupausmuutosten säännöt.
-- Vaatii migraation 002. Aja Supabasen SQL-editorissa.

-- Kauden viikon ensimmäinen päivä (sama kuin lib/season.ts: weekRange).
create or replace function public.week_start(w int) returns date
language sql immutable as $$
  select case when w <= 1 then date '2026-10-01' else date '2026-10-12' + (w - 2) * 7 end
$$;

-- Askelkuittaus vain kuluvan viikon päiville (ei tulevaisuuteen). Viikko lukittuu su 23.59.
create or replace function public.guard_step_week() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  d date := case when tg_op = 'DELETE' then old.day else new.day end;
begin
  if public.is_admin() then return coalesce(new, old); end if;
  if d > today then raise exception 'Tulevaa päivää ei voi kuitata.'; end if;
  if public.season_week(d) not between 1 and 11 or public.season_week(d) <> public.season_week(today) then
    raise exception 'Viikko on jo lukittu.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists step_days_week_lock on public.step_days;
create trigger step_days_week_lock before insert or update or delete on public.step_days
  for each row execute function public.guard_step_week();

-- Sairastumisen voi merkitä kuluvan viikon päivästä alkaen, ja paranemisen korkeintaan tälle päivälle.
-- ends_on on viimeinen sairaspäivä; null = yhä kipeä.
create or replace function public.guard_sick_period() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  week_start date := public.week_start(public.season_week(public.helsinki_today()));
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

drop trigger if exists sick_periods_guard on public.sick_periods;
create trigger sick_periods_guard before insert or update or delete on public.sick_periods
  for each row execute function public.guard_sick_period();

-- Lupauksen voi muuttaa kerran viikossa, ja muutos alkaa seuraavalta viikolta.
create or replace function public.guard_pledge_change() returns trigger
language plpgsql as $$
begin
  if public.is_admin() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.from_week <> public.season_week(public.helsinki_today()) + 1 then raise exception 'Muutos on jo voimassa.'; end if;
    return old;
  end if;
  if new.from_week <> public.season_week(public.helsinki_today()) + 1 then
    raise exception 'Lupauksen muutos alkaa aina seuraavalta viikolta.';
  end if;
  return new;
end $$;

drop trigger if exists pledge_changes_guard on public.pledge_changes;
create trigger pledge_changes_guard before insert or update or delete on public.pledge_changes
  for each row execute function public.guard_pledge_change();
