-- Portinvartija: kauden avaava yhden päivän taistelu ke 30.9.2026 (viikko 0).
-- Treenit ja askeleet lyövät, sinettiä ei ole. Jäljelle jäänyt HP siirtyy viikon 1 monsterille,
-- ylijäämä pottiin (lasketaan sovelluksessa). Päivän treenit eivät kerry viikon 1 lupaukseen.
-- Aja Supabasen SQL-editorissa TÄNÄÄN (ennen ke 30.9. klo 00.00). Turvallista ajaa uudelleen.

-- 1) Portinvartijan tiedot (yksi rivi). Muut näkevät sen vasta portinvartijan päivänä, ylläpito aina.
create table if not exists public.gate (
  id int primary key default 1 check (id = 1),
  name text,
  description text,
  image_path text,
  taunt text,
  hp int not null default 1500 check (hp between 100 and 100000)
);
insert into public.gate (id) values (1) on conflict (id) do nothing;
alter table public.gate enable row level security;
drop policy if exists "portinvartija näkyy" on public.gate;
create policy "portinvartija näkyy" on public.gate for select to authenticated
  using (public.helsinki_today() >= date '2026-09-30' or public.is_admin());
drop policy if exists "ylläpito muokkaa portinvartijaa" on public.gate;
create policy "ylläpito muokkaa portinvartijaa" on public.gate for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, update on public.gate to authenticated;
grant select on public.gate to service_role;

-- 2) Iskut ja askeleet sallitaan portinvartijan päivälle sinä päivänä (viikko 0).
create or replace function public.guard_hit_week() returns trigger
language plpgsql as $$
declare
  today date := public.helsinki_today();
  current_week int := public.season_week(public.helsinki_today());
  gate_ok boolean := today = date '2026-09-30' and (case when tg_op = 'DELETE' then old.trained_on else new.trained_on end) = date '2026-09-30';
begin
  if public.is_admin() or gate_ok then
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
  if today = date '2026-09-30' and d = date '2026-09-30' then return coalesce(new, old); end if;
  if d > today then raise exception 'Tulevaa päivää ei voi kuitata.'; end if;
  if public.season_week(d) not between 1 and 12 or public.season_week(d) <> public.season_week(today) then
    raise exception 'Viikko on jo lukittu.';
  end if;
  return coalesce(new, old);
end $$;

-- 3) Testidatan tyhjennys estyy jo portinvartijan päivänä, jotta sen iskut eivät katoa.
create or replace function public.reset_test_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi tyhjentää testidatan.'; end if;
  if public.helsinki_today() >= date '2026-09-30' then raise exception 'Portinvartijan taistelu on alkanut, testidataa ei voi enää tyhjentää.'; end if;
  delete from public.hits where true;
  delete from public.step_days where true;
  delete from public.sick_periods where true;
  delete from public.pledge_changes where true;
  delete from public.nudges where true;
  delete from public.notifications_sent where true;
  delete from public.messages where true;
end $$;
