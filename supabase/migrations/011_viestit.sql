-- Viestit porukalle: kuka tahansa sankari voi lähettää yhden viestin päivässä (Suomen aikaa),
-- ylläpitäjä rajatta. Viesti lähtee push-ilmoituksena ja näkyy sovelluksen Viestit-sivulla.
-- Aja Supabasen SQL-editorissa. Turvallista ajaa uudelleen.

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

drop policy if exists "viestit näkyvät kaikille" on public.messages;
create policy "viestit näkyvät kaikille" on public.messages for select to authenticated using (true);
drop policy if exists "oma viesti" on public.messages;
create policy "oma viesti" on public.messages for insert to authenticated with check (sender = auth.uid());
drop policy if exists "ylläpito poistaa viestejä" on public.messages;
create policy "ylläpito poistaa viestejä" on public.messages for delete to authenticated using (public.is_admin());

-- Päiväraja: yksi viesti päivässä, ylläpitäjällä ei rajaa. Lukko estää kaksi samanaikaista lähetystä.
create or replace function public.guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if public.is_admin() then return new; end if;
  perform pg_advisory_xact_lock(hashtext('message-' || new.sender::text));
  if exists (
    select 1 from public.messages
    where sender = new.sender and (created_at at time zone 'Europe/Helsinki')::date = public.helsinki_today()
  ) then
    raise exception 'Olet jo lähettänyt tänään viestin. Seuraavan voit lähettää huomenna.';
  end if;
  return new;
end $$;

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert on public.messages
  for each row execute function public.guard_message();

-- Testidatan tyhjennys poistaa myös viestit.
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
  delete from public.messages where true;
end $$;
