-- Korjaus: tavoitteen lukitus kaatui virheeseen "column reference pace is ambiguous" (muuttuja ja sarake
-- samannimiset), joten tavoitetta ei voinut lukita lainkaan. Lisäksi testidatan tyhjennys poistaa nyt myös
-- muistutukset ja lähetettyjen ilmoitusten kirjanpidon. Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

create or replace function public.lock_season() returns public.season
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_pace numeric;
  s public.season;
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi lukita tavoitteen.'; end if;
  select coalesce(sum(pledge_hours), 0) into v_total from public.profiles where pledge_locked_at is not null;
  v_pace := v_total * 100 * 1.2 + 2750;
  update public.monsters set hp = round(0.8 * v_pace * 11 / 7 / 500) * 500 where week = 1;
  update public.monsters set hp = round(v_pace * (0.82 + 0.18 * (week - 2) / 8.0) / 500) * 500 where week between 2 and 10;
  update public.monsters set hp = round(1.5 * v_pace / 500) * 500 where week = 11;
  update public.season set total_pledge_hours = v_total, pace = round(v_pace),
    boss_hp = round(1.5 * v_pace / 500) * 500, hp_locked_at = now()
  where id = 1 returning * into s;
  return s;
end $$;

create or replace function public.reset_test_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi tyhjentää testidatan.'; end if;
  if public.helsinki_today() >= date '2026-10-01' then raise exception 'Kausi on alkanut, testidataa ei voi enää tyhjentää.'; end if;
  delete from public.hits where true;
  delete from public.step_days where true;
  delete from public.sick_periods where true;
  delete from public.pledge_changes where true;
  delete from public.nudges where true;
  delete from public.notifications_sent where true;
end $$;
