-- Testitila: ylläpitäjä voi tyhjentää kauden kirjaukset ennen kauden alkua.
-- Tunnukset, profiilit, lupaukset ja monsterit säilyvät.
create or replace function public.reset_test_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Vain ylläpitäjä voi tyhjentää testidatan.'; end if;
  if public.helsinki_today() >= date '2026-10-01' then raise exception 'Kausi on alkanut, testidataa ei voi enää tyhjentää.'; end if;
  delete from public.hits where true;
  delete from public.step_days where true;
  delete from public.sick_periods where true;
  delete from public.pledge_changes where true;
end $$;

revoke all on function public.reset_test_data() from public;
grant execute on function public.reset_test_data() to authenticated;
