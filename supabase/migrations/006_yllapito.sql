-- Ylläpidon korjaustyökalut: ylläpitäjä voi korjata kaikkien askeleet, sairaudet ja lupausmuutokset.
-- (Iskuihin ylläpitäjällä on jo oikeus.) Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.
drop policy if exists "ylläpitäjä askeleet" on public.step_days;
create policy "ylläpitäjä askeleet" on public.step_days for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ylläpitäjä sairaudet" on public.sick_periods;
create policy "ylläpitäjä sairaudet" on public.sick_periods for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ylläpitäjä lupausmuutokset" on public.pledge_changes;
create policy "ylläpitäjä lupausmuutokset" on public.pledge_changes for all to authenticated using (public.is_admin()) with check (public.is_admin());
