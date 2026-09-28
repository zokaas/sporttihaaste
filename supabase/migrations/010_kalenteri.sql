-- Uusi kalenteri: viikko 1 on to 1.10.–su 4.10., ja uusi monsteri paljastuu joka maanantai 5.10. alkaen.
-- Tavallisia monstereita on 11 (viikot 1–11), loppupomo on viikolla 12 (14.–20.12.).
-- Lisäksi uusi HP-mitoitus: pelkät lupaukset ja askeleet eivät riitä, bonuksia tarvitaan.
-- Aja Supabasen SQL-editorissa ENNEN tavoitteen lukitusta. Turvallista ajaa uudelleen.

-- Kauden viikko 1–12 (0 = ennen kautta, 13 = jälkeen). Sama laskenta kuin lib/season.ts.
create or replace function public.season_week(d date) returns int
language sql immutable as $$
  select case
    when d < date '2026-10-01' then 0
    when d > date '2026-12-20' then 13
    when d < date '2026-10-05' then 1
    else least(12, 2 + (d - date '2026-10-05') / 7)
  end
$$;

create or replace function public.week_start(w int) returns date
language sql immutable as $$
  select case when w <= 1 then date '2026-10-01' else date '2026-10-05' + (w - 2) * 7 end
$$;

-- Iskujen viikkolukitus: kausi on nyt viikot 1–12.
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
    if public.season_week(new.trained_on) not between 1 and 12 then
      raise exception 'Päivä ei ole kauden aikana.';
    end if;
    if public.season_week(new.trained_on) <> current_week then
      raise exception 'Viikko on jo lukittu. Kirjaa vain kuluvan viikon päiville.';
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
  if d > today then raise exception 'Tulevaa päivää ei voi kuitata.'; end if;
  if public.season_week(d) not between 1 and 12 or public.season_week(d) <> public.season_week(today) then
    raise exception 'Viikko on jo lukittu.';
  end if;
  return coalesce(new, old);
end $$;

-- Monsterit: viikot 1–12. Jos loppupomo oli jo tallennettu viikolle 11, se siirretään viikolle 12.
alter table public.monsters drop constraint if exists monsters_week_check;
alter table public.monsters add constraint monsters_week_check check (week between 1 and 12);
do $$
begin
  if not exists (select 1 from public.monsters where week = 12) then
    insert into public.monsters (week, name, description, weakness, image_path, parts)
      select 12, name, description, weakness, image_path, parts from public.monsters where week = 11;
    insert into public.monsters (week) select 12 where not exists (select 1 from public.monsters where week = 12);
    update public.monsters set name = null, description = null, weakness = null, image_path = null, parts = null, hp = null
      where week = 11;
  end if;
end $$;

-- Paljastus viikon alkaessa klo 00.00 Suomen aikaa.
update public.monsters set revealed_at = public.week_start(week)::timestamp at time zone 'Europe/Helsinki';

alter table public.pledge_changes drop constraint if exists pledge_changes_from_week_check;
alter table public.pledge_changes add constraint pledge_changes_from_week_check check (from_week between 2 and 12);

-- HP-mitoitus (sama kuin lib/rules.ts: seasonHp). Vauhti = lupaukset × 100 + askeleet 2 750.
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
  update public.monsters set hp = round(1.2 * v_pace / 500) * 500 where week = 1;
  update public.monsters set hp = round(v_pace * (1.05 + 0.1 * (week - 2) / 9.0) / 500) * 500 where week between 2 and 11;
  update public.monsters set hp = round(1.5 * v_pace / 500) * 500 where week = 12;
  update public.season set total_pledge_hours = v_total, pace = round(v_pace),
    boss_hp = round(1.5 * v_pace / 500) * 500, hp_locked_at = now()
  where id = 1 returning * into s;
  return s;
end $$;
-- Jos tavoite oli jo lukittu vanhalla kaavalla, lukitse se uudelleen ylläpidossa.
